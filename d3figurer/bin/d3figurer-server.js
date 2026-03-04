#!/usr/bin/env node
'use strict';

/**
 * d3figurer-server.js — persistent render daemon entry point
 *
 * Started by server.sh; keeps Chrome + D3 warm for fast consecutive renders.
 * Source-directory is passed via D3FIGURER_SRC_DIR environment variable.
 *
 * Usage (via server.sh):
 *   D3FIGURER_SRC_DIR=/path/to/figures/src node d3figurer-server.js [port]
 *
 * HTTP API:
 *   GET  /          → { ready: true, figures: N }
 *   POST /render    → { figure, outputPath, format? }
 *   POST /check     → { figure }
 *   DELETE /        → shutdown
 */

const path = require('path');
const FigurerServer = require('../src/server');

const PORT   = parseInt(process.argv[2] || process.env.D3FIGURER_PORT || '9229', 10);
const SRC_DIR = process.env.D3FIGURER_SRC_DIR || null;

async function main() {
  const server = new FigurerServer({
    port: PORT,
    srcDir: SRC_DIR,
  });

  process.on('SIGINT',  () => server.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => server.stop().then(() => process.exit(0)));

  await server.start();
}

main().catch(err => {
  process.stderr.write(`d3figurer-server fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
