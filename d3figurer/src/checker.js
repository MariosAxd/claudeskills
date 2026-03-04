'use strict';
/**
 * checker.js — layout QA helpers for d3figurer
 *
 * Exports:
 *   formatReport(result, figure, opts)   → string   pretty-print a /check response
 *   checkAndReport(client, figure, opts) → Promise  run one check and print report
 *   watchFigure(client, figure, opts)    → void     watch figureJs and re-check on save
 *
 * opts:
 *   screenshotPath  {string}   save PNG of the rendered figure
 *   watchMode       {boolean}  adds [run N] tag to report header
 *   figureSrcDir    {string}   directory containing <figure>/figure.js (needed for watch)
 */

const fs   = require('fs');
const path = require('path');

// ── Report formatter ──────────────────────────────────────────────────────
/**
 * @param {object} result    Response body from POST /check
 * @param {string} figure    Figure name (for display)
 * @param {object} opts
 *   runNum        {number}   watch-mode run counter (default 0 = no tag)
 *   elapsedMs     {number}   elapsed time in ms
 *   watchMode     {boolean}  show [run N] tag
 *   screenshotPath {string}  path where screenshot was saved
 */
function formatReport(result, figure, opts = {}) {
  const { textCount, checkedCount, overlaps = [], tooClose = [],
          clipped = [], boxOverflows = [], rectIntrusions = [], svgW, svgH } = result;
  const { runNum = 0, elapsedMs = 0, watchMode = false, screenshotPath = null } = opts;

  const lines = [];
  const ts     = new Date().toLocaleTimeString();
  const runTag = watchMode && runNum > 0 ? ` [run ${runNum}]` : '';
  lines.push(`\n--- ${figure} ${svgW}x${svgH}  ${ts}${runTag}  (${elapsedMs}ms) ---`);

  const skipped   = (textCount || 0) - (checkedCount != null ? checkedCount : textCount || 0);
  const skipNote  = skipped > 0 ? ` (${skipped} skipped via data-skip-check)` : '';
  lines.push(`  ${textCount} text elements inspected${skipNote}`);

  const allClear = overlaps.length === 0 && tooClose.length === 0
    && clipped.length === 0 && boxOverflows.length === 0 && rectIntrusions.length === 0;
  if (allClear) lines.push('  OK — no overlaps, no clipping, no box overflows');

  if (overlaps.length > 0) {
    lines.push(`\n  OVERLAPS (${overlaps.length}):`);
    const sorted = [...overlaps].sort((a, b) => b.overlapPx - a.overlapPx);
    for (const o of sorted) {
      const dim = o.overlapX != null ? `${o.overlapX}×${o.overlapY}px` : `${o.overlapPx}px²`;
      lines.push(`    ${dim}  "${o.a}" @ (${o.aPos[0]},${o.aPos[1]})  x  "${o.b}" @ (${o.bPos[0]},${o.bPos[1]})`);
    }
  }

  if (tooClose.length > 0) {
    lines.push(`\n  TOO CLOSE (${tooClose.length}) — gap < 3px:`);
    const sorted = [...tooClose].sort((a, b) => a.gapPx - b.gapPx);
    for (const o of sorted) {
      const dim = o.gapX != null ? `${o.gapX}×${o.gapY}px gap` : `${o.gapPx}px gap`;
      lines.push(`    ${dim}  "${o.a}" @ (${o.aPos[0]},${o.aPos[1]})  ~  "${o.b}" @ (${o.bPos[0]},${o.bPos[1]})`);
    }
  }

  if (clipped.length > 0) {
    lines.push(`\n  CLIPPED (${clipped.length}) — extends outside SVG:`);
    for (const c of clipped) lines.push(`    ${c.edge} +${c.overflowPx}px  "${c.text}"`);
  }

  if (boxOverflows.length > 0) {
    lines.push(`\n  BOX OVERFLOWS (${boxOverflows.length}) — text escapes its container rect:`);
    const sorted = [...boxOverflows].sort((a, b) => b.overflowPx - a.overflowPx);
    for (const o of sorted) {
      lines.push(`    ${o.edge} +${o.overflowPx}px  "${o.text}" @ (${o.textPos[0]},${o.textPos[1]})`);
    }
  }

  if (rectIntrusions.length > 0) {
    lines.push(`\n  RECT INTRUSIONS (${rectIntrusions.length}) — text outside a rect but bounding box overlaps it:`);
    const sorted = [...rectIntrusions].sort((a, b) => (b.overlapX * b.overlapY) - (a.overlapX * a.overlapY));
    for (const o of sorted) {
      lines.push(`    ${o.edge} edge  ${o.overlapX}×${o.overlapY}px  "${o.text}" @ (${o.textPos[0]},${o.textPos[1]})`);
    }
  }

  if (screenshotPath) lines.push(`\n  Screenshot: ${screenshotPath}`);

  return lines.join('\n');
}

// ── One-shot check ────────────────────────────────────────────────────────
/**
 * Run one check against the server and print the formatted report.
 *
 * @param {import('./client')} client   FigurerClient instance
 * @param {string}             figure  Figure name
 * @param {object}             opts
 *   screenshotPath  {string}   save PNG screenshot
 *   reload          {boolean}  ask server to hot-reload figure.js (default true)
 *   runNum          {number}   run counter for watch mode
 *   watchMode       {boolean}  show [run N] tag
 * @returns {Promise<object>}  raw result from server
 */
async function checkAndReport(client, figure, opts = {}) {
  const { screenshotPath = null, reload = true, runNum = 0, watchMode = false } = opts;
  const t0 = Date.now();
  const r  = await client.checkFigure(figure, { screenshotPath, reload });
  const elapsed = Date.now() - t0;
  process.stdout.write(formatReport(r, figure, { runNum, elapsedMs: elapsed, watchMode, screenshotPath }) + '\n');
  return r;
}

// ── Watch mode ────────────────────────────────────────────────────────────
/**
 * Watch <figureSrcDir>/<figure>/figure.js and re-check on every save.
 * Debounced at 250 ms to avoid duplicate events.
 *
 * @param {import('./client')} client
 * @param {string}             figure
 * @param {object}             opts
 *   figureSrcDir  {string}   directory containing <figure>/figure.js  (required)
 *   screenshotPath {string}  save PNG screenshot on each check
 */
function watchFigure(client, figure, opts = {}) {
  const { figureSrcDir, screenshotPath = null } = opts;
  if (!figureSrcDir) throw new Error('watchFigure: opts.figureSrcDir is required');

  const figureJs = path.join(figureSrcDir, figure, 'figure.js');
  if (!fs.existsSync(figureJs)) throw new Error(`Not found: ${figureJs}`);

  process.stdout.write(`Watching ${figure}/figure.js — Ctrl+C to stop\n`);

  let runNum  = 0;
  let running = false;

  const doCheck = async (reload) => {
    if (running) return;
    running = true;
    runNum++;
    try {
      await checkAndReport(client, figure, { screenshotPath, reload, runNum, watchMode: true });
    } catch (err) {
      process.stdout.write(`\n  Server error: ${err.message}\n`);
      if (err.message.includes('ECONNREFUSED'))
        process.stdout.write('  Is the server running?  d3figurer server start --src-dir <dir>\n');
    } finally {
      running = false;
    }
  };

  // Run once immediately (no reload — server already loaded the module)
  doCheck(false);

  // Debounced watcher
  let debounce = null;
  fs.watch(figureJs, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doCheck(true), 250);
  });

  // Keep process alive
  process.stdin.resume();
}

module.exports = { formatReport, checkAndReport, watchFigure };
