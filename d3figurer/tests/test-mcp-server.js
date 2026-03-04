'use strict';
const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const { spawn } = require('child_process');
const path      = require('path');
const os        = require('os');

const SERVER_JS = path.join(__dirname, '..', 'mcp_server.js');

// Use an unused port so isServerAvailable() returns false immediately (ECONNREFUSED)
// without waiting for a real server.
const TEST_PORT = '19229';

// ── Helpers ───────────────────────────────────────────────────────────────────

function startServer() {
  const proc = spawn(process.execPath, [SERVER_JS], {
    env:   { ...process.env, D3FIGURER_PORT: TEST_PORT },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stderr.resume(); // discard — not under test
  return proc;
}

// Send one JSON-RPC request and resolve with the parsed response.
// Times out after 3 s to prevent hanging tests.
function request(proc, msg) {
  return new Promise((resolve, reject) => {
    let buf  = '';
    let done = false;

    const finish = (fn, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      fn(val);
    };

    const timer = setTimeout(
      () => finish(reject, new Error(`timeout waiting for response to id=${msg.id}`)),
      3000,
    );

    const onData = chunk => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      try {
        finish(resolve, JSON.parse(buf.slice(0, nl)));
      } catch (e) {
        finish(reject, new Error(`bad JSON from server: ${buf.slice(0, nl)}`));
      }
    };

    proc.stdout.on('data', onData);
    proc.stdin.write(JSON.stringify(msg) + '\n');
  });
}

// Write a notification (no id, no response expected).
function notify(proc, method, params = {}) {
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

// ── Protocol: initialize ─────────────────────────────────────────────────────

test('initialize returns jsonrpc 2.0 and matching id', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(r.jsonrpc, '2.0');
    assert.equal(r.id, 1);
    assert.ok(!r.error, `unexpected error: ${r.error?.message}`);
  } finally { proc.kill(); }
});

test('initialize returns protocolVersion and serverInfo', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 2, method: 'initialize', params: {} });
    assert.ok(r.result.protocolVersion, 'protocolVersion should be set');
    assert.equal(r.result.serverInfo.name, 'd3figurer');
    assert.ok(r.result.serverInfo.version, 'version should be set');
  } finally { proc.kill(); }
});

test('initialize result has tools capability', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 3, method: 'initialize', params: {} });
    assert.ok(r.result.capabilities.tools !== undefined, 'tools capability should be present');
  } finally { proc.kill(); }
});

// ── Protocol: tools/list ─────────────────────────────────────────────────────

test('tools/list returns exactly 3 tools', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    assert.equal(r.result.tools.length, 3);
  } finally { proc.kill(); }
});

test('tools/list tool names are render_figure, check_figure, server_status', async () => {
  const proc = startServer();
  try {
    const r     = await request(proc, { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} });
    const names = r.result.tools.map(t => t.name);
    assert.deepEqual(names, ['render_figure', 'check_figure', 'server_status']);
  } finally { proc.kill(); }
});

test('render_figure schema requires name and output_path', async () => {
  const proc = startServer();
  try {
    const r    = await request(proc, { jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} });
    const tool = r.result.tools.find(t => t.name === 'render_figure');
    assert.deepEqual(tool.inputSchema.required, ['name', 'output_path']);
  } finally { proc.kill(); }
});

test('check_figure schema requires name', async () => {
  const proc = startServer();
  try {
    const r    = await request(proc, { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} });
    const tool = r.result.tools.find(t => t.name === 'check_figure');
    assert.deepEqual(tool.inputSchema.required, ['name']);
  } finally { proc.kill(); }
});

test('server_status schema has no required fields', async () => {
  const proc = startServer();
  try {
    const r    = await request(proc, { jsonrpc: '2.0', id: 8, method: 'tools/list', params: {} });
    const tool = r.result.tools.find(t => t.name === 'server_status');
    assert.ok(!tool.inputSchema.required, 'server_status should have no required array');
  } finally { proc.kill(); }
});

test('each tool has a non-empty description', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} });
    for (const tool of r.result.tools) {
      assert.ok(tool.description && tool.description.length > 0,
        `tool ${tool.name} has empty description`);
    }
  } finally { proc.kill(); }
});

// ── Protocol: ping and error handling ────────────────────────────────────────

test('ping returns empty result object', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 10, method: 'ping', params: {} });
    assert.deepEqual(r.result, {});
  } finally { proc.kill(); }
});

test('unknown method returns -32601 error', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 11, method: 'no_such_method', params: {} });
    assert.equal(r.error.code, -32601);
    assert.match(r.error.message, /no_such_method/);
  } finally { proc.kill(); }
});

test('unknown method error preserves the request id', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, { jsonrpc: '2.0', id: 42, method: 'no_such_method', params: {} });
    assert.equal(r.id, 42);
  } finally { proc.kill(); }
});

test('notifications/initialized produces no response — subsequent ping gets correct id', async () => {
  const proc = startServer();
  try {
    // Send notification (no id) immediately followed by a ping with a distinct id.
    // If the notification produced a spurious response the first thing we'd read
    // would have the wrong id.
    notify(proc, 'notifications/initialized');
    const r = await request(proc, { jsonrpc: '2.0', id: 99, method: 'ping', params: {} });
    assert.equal(r.id, 99, 'response id must match ping id, not a spurious notification response');
    assert.deepEqual(r.result, {});
  } finally { proc.kill(); }
});

test('invalid JSON line is ignored and server keeps working', async () => {
  const proc = startServer();
  try {
    proc.stdin.write('this is not json\n');
    const r = await request(proc, { jsonrpc: '2.0', id: 13, method: 'ping', params: {} });
    assert.deepEqual(r.result, {});
  } finally { proc.kill(); }
});

// ── Tool calls — render server not available ──────────────────────────────────
// D3FIGURER_PORT is set to TEST_PORT (19229) which has nothing listening,
// so isServerAvailable() returns false immediately (ECONNREFUSED).

test('render_figure returns text content when server not running', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, {
      jsonrpc: '2.0', id: 14, method: 'tools/call',
      params: { name: 'render_figure', arguments: { name: 'my_fig', output_path: '/tmp/out.pdf' } },
    });
    assert.ok(!r.error, `unexpected error: ${r.error?.message}`);
    assert.equal(r.result.content[0].type, 'text');
    assert.match(r.result.content[0].text, /not running/i);
  } finally { proc.kill(); }
});

test('check_figure returns text content when server not running', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, {
      jsonrpc: '2.0', id: 15, method: 'tools/call',
      params: { name: 'check_figure', arguments: { name: 'my_fig' } },
    });
    assert.equal(r.result.content[0].type, 'text');
    assert.match(r.result.content[0].text, /not running/i);
  } finally { proc.kill(); }
});

test('server_status mentions port and not-running when server is down', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, {
      jsonrpc: '2.0', id: 16, method: 'tools/call',
      params: { name: 'server_status', arguments: {} },
    });
    assert.equal(r.result.content[0].type, 'text');
    const text = r.result.content[0].text;
    assert.match(text, /not running/i);
    assert.match(text, new RegExp(TEST_PORT));
  } finally { proc.kill(); }
});

test('unknown tool name returns -32603 error', async () => {
  const proc = startServer();
  try {
    const r = await request(proc, {
      jsonrpc: '2.0', id: 17, method: 'tools/call',
      params: { name: 'no_such_tool', arguments: {} },
    });
    assert.equal(r.error.code, -32603);
    assert.match(r.error.message, /no_such_tool/);
  } finally { proc.kill(); }
});

// ── Multiple sequential requests on one connection ───────────────────────────

test('multiple sequential requests each return the correct id', async () => {
  const proc = startServer();
  try {
    const ids = [20, 21, 22];
    for (const id of ids) {
      const r = await request(proc, { jsonrpc: '2.0', id, method: 'ping', params: {} });
      assert.equal(r.id, id, `response id ${r.id} should match request id ${id}`);
    }
  } finally { proc.kill(); }
});
