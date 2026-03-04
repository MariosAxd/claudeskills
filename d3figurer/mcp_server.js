#!/usr/bin/env node
'use strict';
/**
 * mcp_server.js — d3figurer MCP stdio server
 *
 * Implements the Model Context Protocol over stdin/stdout using newline-delimited
 * JSON-RPC 2.0.  No external SDK dependency — the protocol is simple enough to
 * handle directly.
 *
 * Launched by mcp.sh, which sets NODE_PATH to the work-dir node_modules so that
 * require('d3'), require('jsdom'), etc. resolve from the Linux filesystem.
 *
 * TRANSPORT
 *   Each message is one line of JSON on stdin.
 *   Each response is one line of JSON on stdout.
 *   Stderr is reserved for diagnostics and is not part of the protocol.
 *   Invalid JSON lines and notifications (messages without an id) that don't need
 *   a response are silently dropped.
 *
 * METHODS HANDLED
 *   initialize               → capabilities handshake
 *   notifications/initialized → no-op (client acknowledgement, no id)
 *   tools/list               → returns TOOLS array
 *   tools/call               → dispatches to renderFigure / checkFigure / serverStatus
 *   ping                     → returns {}
 *   <anything else with id>  → error -32601 Method not found
 *
 * TOOLS
 *   render_figure   Render a named figure to PDF or PNG via the HTTP render server.
 *   check_figure    Check a figure for text overlaps, clipping, and box overflows.
 *   server_status   Report whether the HTTP render server is up and list loaded figures.
 *
 * ENVIRONMENT
 *   D3FIGURER_PORT  HTTP port for FigurerClient (default: 9229)
 *
 * TESTING
 *   tests/test-mcp-server.js spawns this process with D3FIGURER_PORT=19229
 *   (nothing listening → ECONNREFUSED) and communicates over stdio pipes.
 */

const readline = require('readline');
const path     = require('path');

const FigurerClient  = require('./src/client');
const { formatReport } = require('./src/checker');

const PORT   = parseInt(process.env.D3FIGURER_PORT || '9229', 10);
const client = new FigurerClient({ port: PORT });

// ── Tool definitions ──────────────────────────────────────────────────────────
// Returned verbatim by tools/list.  inputSchema follows JSON Schema draft-07.

const TOOLS = [
  {
    name: 'render_figure',
    description: 'Render a D3.js figure to PDF or PNG via the d3figurer render server.',
    inputSchema: {
      type: 'object',
      properties: {
        name:        { type: 'string', description: 'Figure directory name (subdirectory under src-dir)' },
        output_path: { type: 'string', description: 'Absolute path for the output file' },
        format:      { type: 'string', enum: ['pdf', 'png'], description: 'Output format (default: pdf)' },
      },
      required: ['name', 'output_path'],
    },
  },
  {
    name: 'check_figure',
    description: 'Check a D3.js figure for layout issues: text overlaps, clipping, and box overflows.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Figure directory name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'server_status',
    description: 'Check whether the d3figurer render server is running and list loaded figures.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────
// Each handler returns a plain string.  If the render server is not reachable
// the handler returns a human-readable "not running" message rather than throwing,
// so Claude sees a clear explanation rather than a protocol error.

/**
 * Render a named figure to PDF or PNG.
 * @param {object} args
 * @param {string} args.name         Figure directory name
 * @param {string} args.output_path  Absolute output file path
 * @param {string} [args.format]     'pdf' (default) or 'png'
 * @returns {Promise<string>}
 */
async function renderFigure({ name, output_path, format = 'pdf' }) {
  if (!await client.isServerAvailable()) {
    return 'Server not running. Start it with:\n  ./server.sh start --src-dir <figures-dir>';
  }
  try {
    await client.render(name, output_path, { format });
    return `Rendered ${name} → ${output_path}`;
  } catch (err) {
    return `Render failed: ${err.message}`;
  }
}

/**
 * Check a figure for layout issues and return a formatted report.
 * Passes reload:true so the server hot-reloads figure.js before checking.
 * @param {object} args
 * @param {string} args.name  Figure directory name
 * @returns {Promise<string>}
 */
async function checkFigure({ name }) {
  if (!await client.isServerAvailable()) {
    return 'Server not running. Start it with:\n  ./server.sh start --src-dir <figures-dir>';
  }
  try {
    const t0     = Date.now();
    const result = await client.checkFigure(name, { reload: true });
    return formatReport(result, name, { elapsedMs: Date.now() - t0 });
  } catch (err) {
    return `Check failed: ${err.message}`;
  }
}

/**
 * Report whether the HTTP render server is running and which figures are loaded.
 * Mentions the configured port so the caller can diagnose connection issues.
 * @returns {Promise<string>}
 */
async function serverStatus() {
  if (!await client.isServerAvailable()) {
    return `Server not running on port ${PORT}.\nStart with: ./server.sh start --src-dir <figures-dir>`;
  }
  try {
    const s    = await client.getStatus();
    const figs = s.figures && s.figures.length ? s.figures.join(', ') : '(none)';
    return `Server ready on port ${PORT}. Figures loaded: ${figs}`;
  } catch (err) {
    return `Server error: ${err.message}`;
  }
}

/**
 * Dispatch a tools/call request to the appropriate handler.
 * Throws with a descriptive message for unknown tool names (caught by the
 * request loop and returned as a -32603 Internal error response).
 * @param {string} name  Tool name
 * @param {object} args  Tool arguments (from params.arguments)
 * @returns {Promise<string>}
 */
async function callTool(name, args) {
  switch (name) {
    case 'render_figure':  return renderFigure(args);
    case 'check_figure':   return checkFigure(args);
    case 'server_status':  return serverStatus();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC stdio transport ──────────────────────────────────────────────────

/**
 * Write one JSON-RPC response to stdout.
 * A trailing newline is appended so the client can split on '\n'.
 * @param {object} obj  The full JSON-RPC response object
 */
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

/**
 * Main message loop.
 * Each line on stdin is one JSON-RPC message.  Invalid JSON is silently ignored.
 * Notifications (no id field) that don't require a response are also silent.
 */
rl.on('line', async line => {
  line = line.trim();
  if (!line) return;

  let msg;
  try { msg = JSON.parse(line); } catch (_) { return; } // silently drop bad JSON

  const { method, id, params = {} } = msg;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'd3figurer', version: '1.0.0' },
      }});

    } else if (method === 'notifications/initialized') {
      // Client acknowledgement — notifications have no id; no response sent.

    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

    } else if (method === 'tools/call') {
      const text = await callTool(params.name, params.arguments || {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });

    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });

    } else if (id !== undefined) {
      // Unknown method with a request id — return Method Not Found.
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
    // Unknown method without an id is a notification — silently ignored.

  } catch (err) {
    // Internal error during handling — only respond if there is a request id.
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
  }
});

// Clean exit when stdin is closed (Claude Code terminates the process this way).
rl.on('close', () => process.exit(0));
