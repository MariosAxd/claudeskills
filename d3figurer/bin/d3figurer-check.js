#!/usr/bin/env node
'use strict';
/**
 * d3figurer-check — layout QA tool
 *
 * Usage:
 *   d3figurer-check <figure>                            # one-shot
 *   d3figurer-check <figure> --watch                   # re-check on every save
 *   d3figurer-check <figure> --out /tmp/fig.png        # + screenshot
 *   d3figurer-check <figure> --src-dir <dir> --watch   # explicit src dir
 *
 * The server must already be running:
 *   d3figurer server start --src-dir <dir>
 */

const path    = require('path');
const { checkAndReport, watchFigure } = require('../src/checker');
const FigurerClient = require('../src/client');

const args   = process.argv.slice(2);
const figure = args.find(a => !a.startsWith('-'));

if (!figure) {
  process.stderr.write('Usage: d3figurer-check <figure> [--watch] [--out path.png] [--port N] [--src-dir dir]\n');
  process.exit(1);
}

const watchMode = args.includes('--watch');

const outIdx         = args.indexOf('--out');
const screenshotPath = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : null;

const portIdx = args.indexOf('--port');
const port    = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : (parseInt(process.env.D3FIGURER_PORT || '9229', 10));

const srcDirIdx = args.indexOf('--src-dir');
const srcDir    = srcDirIdx >= 0
  ? path.resolve(args[srcDirIdx + 1])
  : (process.env.D3FIGURER_SRC_DIR ? path.resolve(process.env.D3FIGURER_SRC_DIR) : null);

const client = new FigurerClient({ port });

if (watchMode) {
  if (!srcDir) {
    process.stderr.write('Error: --watch requires --src-dir <dir> or D3FIGURER_SRC_DIR env var\n');
    process.exit(1);
  }
  watchFigure(client, figure, { figureSrcDir: srcDir, screenshotPath });
} else {
  checkAndReport(client, figure, { screenshotPath, reload: true })
    .then(() => process.exit(0))
    .catch(err => {
      process.stderr.write(`Error: ${err.message}\n`);
      if (err.message.includes('ECONNREFUSED'))
        process.stderr.write('Is the server running?  d3figurer server start --src-dir <dir>\n');
      process.exit(1);
    });
}
