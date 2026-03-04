'use strict';
const { test }   = require('node:test');
const assert     = require('node:assert/strict');
const { formatReport } = require('../src/checker');

// Minimal valid result object
const base = { textCount: 5, checkedCount: 5, overlaps: [], tooClose: [], clipped: [], boxOverflows: [], svgW: 800, svgH: 600 };

// ── Header line ────────────────────────────────────────────────────────────
test('header contains figure name and dimensions', () => {
  const r = formatReport(base, 'myfig', { elapsedMs: 42 });
  assert.match(r, /myfig 800x600/);
  assert.match(r, /42ms/);
});

test('header shows elapsed ms', () => {
  const r = formatReport(base, 'fig', { elapsedMs: 123 });
  assert.match(r, /123ms/);
});

test('watch mode adds [run N] tag', () => {
  const r = formatReport(base, 'fig', { watchMode: true, runNum: 7 });
  assert.match(r, /\[run 7\]/);
});

test('no run tag when runNum=0 even in watchMode', () => {
  const r = formatReport(base, 'fig', { watchMode: true, runNum: 0 });
  assert.doesNotMatch(r, /\[run/);
});

test('no run tag when watchMode=false', () => {
  const r = formatReport(base, 'fig', { watchMode: false, runNum: 5 });
  assert.doesNotMatch(r, /\[run/);
});

// ── All-clear path ─────────────────────────────────────────────────────────
test('all clear shows OK line', () => {
  const r = formatReport(base, 'fig', {});
  assert.match(r, /OK — no overlaps, no clipping, no box overflows/);
});

test('all clear does not show any section headers', () => {
  const r = formatReport(base, 'fig', {});
  assert.doesNotMatch(r, /OVERLAPS|TOO CLOSE|CLIPPED|BOX OVERFLOWS/);
});

// ── Skipped elements note ──────────────────────────────────────────────────
test('skipped elements note appears when checkedCount < textCount', () => {
  const r = formatReport({ ...base, textCount: 10, checkedCount: 7 }, 'fig', {});
  assert.match(r, /3 skipped via data-skip-check/);
});

test('no skip note when all elements checked', () => {
  const r = formatReport({ ...base, textCount: 5, checkedCount: 5 }, 'fig', {});
  assert.doesNotMatch(r, /skipped/);
});

// ── OVERLAPS ───────────────────────────────────────────────────────────────
const OVERLAPS2 = [
  { a: 'Small', b: 'B', overlapX: 5, overlapY: 3, overlapPx: 15, aPos: [0, 0], bPos: [3, 1] },
  { a: 'Big',   b: 'D', overlapX: 10, overlapY: 8, overlapPx: 80, aPos: [10, 10], bPos: [15, 12] },
];

test('OVERLAPS section appears when overlaps present', () => {
  const r = formatReport({ ...base, overlaps: OVERLAPS2 }, 'fig', {});
  assert.match(r, /OVERLAPS \(2\)/);
});

test('overlaps sorted by overlapPx descending (Big before Small)', () => {
  const r = formatReport({ ...base, overlaps: OVERLAPS2 }, 'fig', {});
  assert.ok(r.indexOf('"Big"') < r.indexOf('"Small"'), 'Larger overlap should appear first');
});

test('overlap dimensions shown as NxMpx when overlapX present', () => {
  const r = formatReport({ ...base, overlaps: [OVERLAPS2[0]] }, 'fig', {});
  assert.match(r, /5×3px/);
});

test('overlap shows positions', () => {
  const r = formatReport({ ...base, overlaps: [OVERLAPS2[1]] }, 'fig', {});
  assert.match(r, /\(10,10\)/);
  assert.match(r, /\(15,12\)/);
});

// ── TOO CLOSE ──────────────────────────────────────────────────────────────
const TOO_CLOSE_ITEMS = [
  { a: 'X', b: 'Y', gapX: 1, gapY: 2, gapPx: 2, aPos: [5, 5], bPos: [7, 6] },
  { a: 'P', b: 'Q', gapX: 0, gapY: 1, gapPx: 1, aPos: [20, 20], bPos: [21, 21] },
];

test('TOO CLOSE section appears when tooClose present', () => {
  const r = formatReport({ ...base, tooClose: TOO_CLOSE_ITEMS }, 'fig', {});
  assert.match(r, /TOO CLOSE \(2\)/);
});

test('tooClose sorted by gapPx ascending (smallest gap first)', () => {
  const r = formatReport({ ...base, tooClose: TOO_CLOSE_ITEMS }, 'fig', {});
  // P/Q has gapPx=1 (smaller), X/Y has gapPx=2 → P should appear before X
  assert.ok(r.indexOf('"P"') < r.indexOf('"X"'), 'Smallest gap should appear first');
});

test('tooClose shows gap dimensions', () => {
  const r = formatReport({ ...base, tooClose: [TOO_CLOSE_ITEMS[0]] }, 'fig', {});
  assert.match(r, /1×2px gap/);
});

// ── CLIPPED ───────────────────────────────────────────────────────────────
const CLIPPED = [
  { text: 'Hello', edge: 'right', overflowPx: 12 },
  { text: 'World', edge: 'top',   overflowPx: 3  },
];

test('CLIPPED section appears when clipped present', () => {
  const r = formatReport({ ...base, clipped: CLIPPED }, 'fig', {});
  assert.match(r, /CLIPPED \(2\)/);
});

test('clipped shows edge and overflow amount', () => {
  const r = formatReport({ ...base, clipped: [CLIPPED[0]] }, 'fig', {});
  assert.match(r, /right \+12px.*"Hello"/);
});

// ── BOX OVERFLOWS ─────────────────────────────────────────────────────────
const BOX_OVERFLOWS = [
  { text: 'small', edge: 'bottom', overflowPx: 4,  textPos: [10, 10] },
  { text: 'big',   edge: 'right',  overflowPx: 20, textPos: [50, 50] },
];

test('BOX OVERFLOWS section appears when boxOverflows present', () => {
  const r = formatReport({ ...base, boxOverflows: BOX_OVERFLOWS }, 'fig', {});
  assert.match(r, /BOX OVERFLOWS \(2\)/);
});

test('boxOverflows sorted by overflowPx descending (big before small)', () => {
  const r = formatReport({ ...base, boxOverflows: BOX_OVERFLOWS }, 'fig', {});
  assert.ok(r.indexOf('"big"') < r.indexOf('"small"'), 'Larger overflow should appear first');
});

test('boxOverflow shows edge, amount, and position', () => {
  const r = formatReport({ ...base, boxOverflows: [BOX_OVERFLOWS[1]] }, 'fig', {});
  assert.match(r, /right \+20px.*"big".*\(50,50\)/);
});

// ── Screenshot path ────────────────────────────────────────────────────────
test('screenshot path appears when provided', () => {
  const r = formatReport(base, 'fig', { screenshotPath: '/tmp/shot.png' });
  assert.match(r, /Screenshot: \/tmp\/shot\.png/);
});

test('no Screenshot line when screenshotPath is null', () => {
  const r = formatReport(base, 'fig', { screenshotPath: null });
  assert.doesNotMatch(r, /Screenshot:/);
});

// ── allClear suppressed when any issue present ─────────────────────────────
test('OK line absent when there are overlaps', () => {
  const r = formatReport({ ...base, overlaps: [OVERLAPS2[0]] }, 'fig', {});
  assert.doesNotMatch(r, /OK — no overlaps/);
});

test('OK line absent when there are clipped elements', () => {
  const r = formatReport({ ...base, clipped: [CLIPPED[0]] }, 'fig', {});
  assert.doesNotMatch(r, /OK — no overlaps/);
});

// ── Corner cases from book figure patterns ─────────────────────────────────
// ch02_turing_test / ch02_ai_timeline style figures produce overlap/gap
// results that omit overlapX/gapX when the check is area-based only.

test('overlap shows px² area when overlapX absent (area-based result)', () => {
  const issue = { a: 'A — Computadora', b: 'B — Persona',
                  overlapPx: 42, aPos: [100, 200], bPos: [300, 400] };
  const r = formatReport({ ...base, overlaps: [issue] }, 'turing_test', {});
  assert.match(r, /42px²/);
  assert.doesNotMatch(r, /42×/); // must not render as dimensional
});

test('tooClose shows single-value gap when gapX absent (area-based result)', () => {
  const issue = { a: 'Año 1950', b: 'Año 1956',
                  gapPx: 2, aPos: [50, 300], bPos: [55, 300] };
  const r = formatReport({ ...base, tooClose: [issue] }, 'ai_timeline', {});
  assert.match(r, /2px gap/);
  assert.doesNotMatch(r, /2×/); // must not render as dimensional
});

test('textCount=0 (empty SVG, no text elements) still shows OK line', () => {
  const r = formatReport(
    { textCount: 0, checkedCount: 0, overlaps: [], tooClose: [],
      clipped: [], boxOverflows: [], svgW: 900, svgH: 560 },
    'empty_fig', {},
  );
  assert.match(r, /OK — no overlaps/);
  assert.match(r, /0 text elements inspected/);
});

test('checkedCount=null means no elements skipped — no skip note shown', () => {
  // When server returns checkedCount=null it means no data-skip-check attrs used
  const r = formatReport({ ...base, checkedCount: null }, 'fig', {});
  assert.doesNotMatch(r, /skipped/);
});

test('overlaps and clipped simultaneously — both sections shown, no OK line', () => {
  const overlap = { a: 'X', b: 'Y', overlapX: 5, overlapY: 3,
                    aPos: [0, 0], bPos: [4, 2] };
  const clip    = { text: 'Z', edge: 'right', overflowPx: 8 };
  const r = formatReport(
    { ...base, overlaps: [overlap], clipped: [clip] }, 'fig', {},
  );
  assert.match(r, /OVERLAPS \(1\)/);
  assert.match(r, /CLIPPED \(1\)/);
  assert.doesNotMatch(r, /OK — no overlaps/);
});
