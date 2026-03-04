'use strict';
const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');
const FigurerClient = require('../src/client');

// ── isServerAvailable ─────────────────────────────────────────────────────
test('isServerAvailable returns false when nothing is running', async () => {
  const client = new FigurerClient({ port: 19999 }); // unused port
  assert.equal(await client.isServerAvailable(), false);
});

// ── _logHang ─────────────────────────────────────────────────────────────
test('_logHang creates file and writes entry', () => {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'd3figurer-test-'));
  const logPath = path.join(tmpDir, 'hangs.md');
  const client  = new FigurerClient({ hangLog: logPath });

  client._logHang('ch02_mlp', 6200, 'slow render');

  const content = fs.readFileSync(logPath, 'utf8');
  assert.match(content, /ch02_mlp/);
  assert.match(content, /6\.2s/);
  assert.match(content, /slow render/);
  assert.match(content, /# Render Hangs Log/);

  fs.rmSync(tmpDir, { recursive: true });
});

test('_logHang appends without duplicating the header', () => {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'd3figurer-test-'));
  const logPath = path.join(tmpDir, 'hangs.md');
  const client  = new FigurerClient({ hangLog: logPath });

  client._logHang('fig1', 5500, 'reason1');
  client._logHang('fig2', 7000, 'reason2');

  const content      = fs.readFileSync(logPath, 'utf8');
  const headerCount  = (content.match(/# Render Hangs Log/g) || []).length;
  assert.equal(headerCount, 1, 'Header must appear exactly once');
  assert.match(content, /fig1/);
  assert.match(content, /fig2/);

  fs.rmSync(tmpDir, { recursive: true });
});

test('_logHang handles write errors silently', () => {
  const client = new FigurerClient({ hangLog: '/nonexistent-dir/hangs.md' });
  assert.doesNotThrow(() => client._logHang('fig', 5000, 'oops'));
});

// ── _requestTimed ────────────────────────────────────────────────────────
test('_requestTimed resolves normally when request completes in time', async () => {
  const client = new FigurerClient({ port: 19998 });
  client.request = async () => ({ status: 200, body: { ok: true } });

  const result = await client._requestTimed('POST', '/render', {}, 1000);
  assert.equal(result.status, 200);
});

test('_requestTimed rejects after hardTimeoutMs elapses', async () => {
  const client = new FigurerClient({ port: 19997 });
  client.request = () => new Promise(() => {}); // never resolves

  await assert.rejects(
    () => client._requestTimed('POST', '/render', {}, 50),
    /timed out after/,
  );
});

test('_requestTimed with no timeout delegates directly to request()', async () => {
  const client = new FigurerClient({ port: 19996 });
  let called = false;
  client.request = async () => { called = true; return { status: 200, body: {} }; };

  await client._requestTimed('GET', '/', null, 0);
  assert.equal(called, true);
});

// ── renderBatch ─────────────────────────────────────────────────────────
test('renderBatch resolves output paths against outputDir', async () => {
  const renderedPaths = [];
  const client = new FigurerClient({ port: 19995 });
  client._requestTimed = async (_m, _p, body) => {
    renderedPaths.push(body.outputPath);
    return { status: 200, body: { ok: true } };
  };

  await client.renderBatch(
    [{ name: 'ch02_mlp' }, { name: 'ch03_transformer' }],
    { outputDir: '/tmp/test-out', verbose: false },
  );

  assert.equal(renderedPaths.length, 2);
  assert.ok(renderedPaths[0].endsWith('ch02_mlp.pdf'),       `got ${renderedPaths[0]}`);
  assert.ok(renderedPaths[1].endsWith('ch03_transformer.pdf'), `got ${renderedPaths[1]}`);
  assert.ok(renderedPaths[0].startsWith('/tmp/test-out'));
});

test('renderBatch uses figure.output when outputDir not set', async () => {
  const renderedPaths = [];
  const client = new FigurerClient({ port: 19994 });
  client._requestTimed = async (_m, _p, body) => {
    renderedPaths.push(body.outputPath);
    return { status: 200, body: { ok: true } };
  };

  await client.renderBatch(
    [{ name: 'myfig', output: '/custom/path/myfig.pdf' }],
    { verbose: false },
  );

  assert.equal(renderedPaths[0], '/custom/path/myfig.pdf');
});

test('renderBatch reports correct ok count and errors array', async () => {
  const client = new FigurerClient({ port: 19993 });
  let n = 0;
  client._requestTimed = async (_m, _p, body) => {
    n++;
    if (n === 2) throw new Error('simulated failure');
    return { status: 200, body: { ok: true } };
  };

  const figures = [
    { name: 'a', output: '/tmp/a.pdf' },
    { name: 'b', output: '/tmp/b.pdf' },
    { name: 'c', output: '/tmp/c.pdf' },
  ];
  const result = await client.renderBatch(figures, { verbose: false });

  assert.equal(result.total, 3);
  assert.equal(result.ok, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].name, 'b');
});

test('renderBatch returns all ok when no failures', async () => {
  const client = new FigurerClient({ port: 19992 });
  client._requestTimed = async () => ({ status: 200, body: { ok: true } });

  const result = await client.renderBatch(
    [{ name: 'x', output: '/tmp/x.pdf' }],
    { verbose: false },
  );
  assert.equal(result.ok, 1);
  assert.equal(result.errors.length, 0);
});

// ── shutdown ─────────────────────────────────────────────────────────────
test('shutdown returns false when server not reachable', async () => {
  const client = new FigurerClient({ port: 19991 });
  const result = await client.shutdown();
  assert.equal(result, false);
});

// ── Corner cases from book figure rendering patterns ───────────────────────
// The book renders 18 figures; slow renders on the WSL2/Windows filesystem
// occasionally trigger hang logging.  Test the duration formatting exactly.

test('_logHang formats exactly 1000ms as "1.0s"', () => {
  const tmp = path.join(os.tmpdir(), `hang-test-${Date.now()}.md`);
  const client = new FigurerClient({ hangLog: tmp });
  client._logHang('ch02_turing_test', 1000, 'slow render (completed)');
  const content = fs.readFileSync(tmp, 'utf8');
  assert.ok(content.includes('1.0s'), `expected "1.0s" in: ${content}`);
  fs.unlinkSync(tmp);
});

test('_logHang formats 500ms as "0.5s"', () => {
  const tmp = path.join(os.tmpdir(), `hang-test-${Date.now()}.md`);
  const client = new FigurerClient({ hangLog: tmp });
  client._logHang('ch02_ai_timeline', 500, 'slow render (completed)');
  const content = fs.readFileSync(tmp, 'utf8');
  assert.ok(content.includes('0.5s'), `expected "0.5s" in: ${content}`);
  fs.unlinkSync(tmp);
});

test('_logHang includes the figure name in the log entry', () => {
  // Mirrors how render-batch logs each of the 18 book figures by name
  const tmp = path.join(os.tmpdir(), `hang-test-${Date.now()}.md`);
  const client = new FigurerClient({ hangLog: tmp });
  client._logHang('ch03_llm_timeline', 7500, 'slow render (completed)');
  const content = fs.readFileSync(tmp, 'utf8');
  assert.ok(content.includes('ch03_llm_timeline'), `figure name missing from: ${content}`);
  fs.unlinkSync(tmp);
});
