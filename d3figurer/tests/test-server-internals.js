'use strict';
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const os       = require('os');
const fs       = require('fs');
const path     = require('path');

const { _internals } = require('../src/server');
const { normalizePdfDates, makeQueue } = _internals;

// ── makeQueue ─────────────────────────────────────────────────────────────
test('makeQueue serialises concurrent tasks sequentially', async () => {
  const enqueue = makeQueue();
  const log = [];

  // Fire all three without awaiting individually — they should still run 1→2→3
  await Promise.all([
    enqueue(() => new Promise(r => setTimeout(() => { log.push(1); r(); }, 40))),
    enqueue(() => new Promise(r => setTimeout(() => { log.push(2); r(); }, 10))),
    enqueue(() => Promise.resolve().then(() => log.push(3))),
  ]);

  assert.deepEqual(log, [1, 2, 3], 'Tasks must run in enqueue order regardless of individual duration');
});

test('makeQueue returns the task result', async () => {
  const enqueue = makeQueue();
  const val = await enqueue(() => Promise.resolve(42));
  assert.equal(val, 42);
});

test('makeQueue continues after a rejected task', async () => {
  const enqueue = makeQueue();
  const log = [];

  await enqueue(() => Promise.reject(new Error('oops'))).catch(() => {});
  await enqueue(() => Promise.resolve(log.push('after')));

  assert.deepEqual(log, ['after'], 'Queue should not deadlock after a rejection');
});

test('multiple independent queues do not interfere', async () => {
  const q1 = makeQueue();
  const q2 = makeQueue();
  const log = [];

  await Promise.all([
    q1(() => new Promise(r => setTimeout(() => { log.push('q1-a'); r(); }, 20))),
    q2(() => new Promise(r => setTimeout(() => { log.push('q2-a'); r(); }, 5))),
    q1(() => Promise.resolve(log.push('q1-b'))),
  ]);

  // q1-a must precede q1-b (same queue); q2-a order relative to q1 doesn't matter
  assert.ok(log.indexOf('q1-a') < log.indexOf('q1-b'), 'q1 internal order preserved');
  assert.ok(log.includes('q2-a'), 'q2 task ran');
});

// ── normalizePdfDates ─────────────────────────────────────────────────────
function makeTmpPdf(content) {
  const p = path.join(os.tmpdir(), `d3figurer-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(p, content, 'binary');
  return p;
}

test('normalizePdfDates rewrites /CreationDate and /ModDate', () => {
  const tmp = makeTmpPdf("/CreationDate (D:20240115093000+01'00') /ModDate (D:20240115093000)");
  normalizePdfDates(tmp);
  const result = fs.readFileSync(tmp, 'binary');
  assert.match(result, /\/CreationDate \(D:20000101000000Z\)/);
  assert.match(result, /\/ModDate \(D:20000101000000Z\)/);
  fs.unlinkSync(tmp);
});

test('normalizePdfDates rewrites XMP CreateDate', () => {
  const tmp = makeTmpPdf('<xmp:CreateDate>2024-01-15T09:30:00+01:00</xmp:CreateDate>');
  normalizePdfDates(tmp);
  const result = fs.readFileSync(tmp, 'binary');
  assert.match(result, /<xmp:CreateDate>2000-01-01T00:00:00Z<\/xmp:CreateDate>/);
  fs.unlinkSync(tmp);
});

test('normalizePdfDates rewrites XMP ModifyDate and MetadataDate', () => {
  const tmp = makeTmpPdf(
    '<xmp:ModifyDate>2024-06-01T12:00:00Z</xmp:ModifyDate>' +
    '<xmp:MetadataDate>2024-06-01T12:00:00Z</xmp:MetadataDate>',
  );
  normalizePdfDates(tmp);
  const result = fs.readFileSync(tmp, 'binary');
  assert.match(result, /<xmp:ModifyDate>2000-01-01T00:00:00Z<\/xmp:ModifyDate>/);
  assert.match(result, /<xmp:MetadataDate>2000-01-01T00:00:00Z<\/xmp:MetadataDate>/);
  fs.unlinkSync(tmp);
});

test('normalizePdfDates is idempotent', () => {
  const tmp = makeTmpPdf("/CreationDate (D:20240115093000) /ModDate (D:20240115093000)");
  normalizePdfDates(tmp);
  const after1 = fs.readFileSync(tmp, 'binary');
  normalizePdfDates(tmp);
  const after2 = fs.readFileSync(tmp, 'binary');
  assert.equal(after1, after2, 'Second call must produce identical output');
  fs.unlinkSync(tmp);
});

test('normalizePdfDates does not modify file without date fields', () => {
  const content = 'Just some PDF content without dates.';
  const tmp = makeTmpPdf(content);
  const statBefore = fs.statSync(tmp).mtimeMs;
  normalizePdfDates(tmp);
  const statAfter = fs.statSync(tmp).mtimeMs;
  // No write should happen (mtime unchanged) — or if it does, content same
  const result = fs.readFileSync(tmp, 'binary');
  assert.equal(result, content);
  fs.unlinkSync(tmp);
});

test('normalizePdfDates handles missing file gracefully', () => {
  assert.doesNotThrow(() => normalizePdfDates('/nonexistent/path/file.pdf'));
});

// ── FigurerServer constructor (no Puppeteer) ──────────────────────────────
const FigurerServer = require('../src/server');

test('FigurerServer constructor applies default options', () => {
  const s = new FigurerServer();
  assert.equal(s.options.port, 9229);
  assert.equal(s.options.srcDir, null);
  assert.equal(s.options.fontCSS, '');
});

test('FigurerServer constructor merges custom options', () => {
  const s = new FigurerServer({ port: 9876, srcDir: '/tmp/figs' });
  assert.equal(s.options.port, 9876);
  assert.equal(s.options.srcDir, '/tmp/figs');
  assert.equal(s.options.fontCSS, ''); // default preserved
});

test('FigurerServer stores fontCSS option verbatim', () => {
  const css = '@font-face{font-family:"TestFont";src:url(test.woff2)}';
  const s = new FigurerServer({ fontCSS: css });
  assert.equal(s.options.fontCSS, css);
});

test('FigurerServer fontCSS defaults to empty string (no font injection)', () => {
  const s = new FigurerServer();
  assert.equal(s.options.fontCSS, '');
  // Confirm the generic package does not hardcode any specific font
  assert.doesNotMatch(s.options.fontCSS, /Montserrat|googleapis/);
});

test('FigurerServer._loadFigureModules returns empty object when srcDir is null', () => {
  const s = new FigurerServer({ srcDir: null });
  const cache = s._loadFigureModules();
  assert.deepEqual(cache, {});
});

// ── Corner cases from book figure structure ────────────────────────────────
// figures/d3/src/ has a 'shared/' subdirectory alongside figure dirs.
// _loadFigureModules must skip it even when it happens to contain a figure.js.

test('_loadFigureModules skips the shared/ directory', () => {
  // Build a temp srcDir that mimics figures/d3/src/:
  //   shared/figure.js  — must be ignored
  //   ch99_test/figure.js  — must be loaded
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figurer-test-'));
  try {
    const sharedDir = path.join(tmpDir, 'shared');
    const figDir    = path.join(tmpDir, 'ch99_test');
    fs.mkdirSync(sharedDir);
    fs.mkdirSync(figDir);
    fs.writeFileSync(path.join(sharedDir, 'figure.js'),
      "module.exports = function(){ return '<svg width=\"10\" height=\"10\"></svg>'; };");
    fs.writeFileSync(path.join(figDir, 'figure.js'),
      "module.exports = function(){ return '<svg width=\"10\" height=\"10\"></svg>'; };");

    const s = new FigurerServer({ srcDir: tmpDir });
    const cache = s._loadFigureModules();
    assert.ok(!Object.prototype.hasOwnProperty.call(cache, 'shared'),
      'shared/ must not appear in figure cache');
    assert.ok(Object.prototype.hasOwnProperty.call(cache, 'ch99_test'),
      'ch99_test must appear in figure cache');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('_loadFigureModules skips directories without figure.js', () => {
  // A directory without figure.js (e.g. an assets/ or old/ folder)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figurer-test-'));
  try {
    const noFig  = path.join(tmpDir, 'old');
    const hasFig = path.join(tmpDir, 'ch02_turing_test');
    fs.mkdirSync(noFig);
    fs.mkdirSync(hasFig);
    // 'old' has no figure.js
    fs.writeFileSync(path.join(noFig, 'README.md'), '# old figure');
    fs.writeFileSync(path.join(hasFig, 'figure.js'),
      "module.exports = function(){ return '<svg width=\"900\" height=\"620\"></svg>'; };");

    const s = new FigurerServer({ srcDir: tmpDir });
    const cache = s._loadFigureModules();
    assert.ok(!Object.prototype.hasOwnProperty.call(cache, 'old'),
      'Directory without figure.js must be skipped');
    assert.ok(Object.prototype.hasOwnProperty.call(cache, 'ch02_turing_test'),
      'Directory with figure.js must be loaded');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('_loadFigureModules loads category/name figures two levels deep', () => {
  // srcDir/diagram/turing_test/figure.js  → cache key 'diagram/turing_test'
  // srcDir/shared/                        → skipped
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figurer-test-'));
  try {
    const catDir = path.join(tmpDir, 'diagram');
    const figDir = path.join(catDir, 'turing_test');
    fs.mkdirSync(catDir);
    fs.mkdirSync(figDir);
    fs.writeFileSync(path.join(figDir, 'figure.js'),
      "module.exports = function(){ return '<svg width=\"800\" height=\"600\"></svg>'; };");

    const s = new FigurerServer({ srcDir: tmpDir });
    const cache = s._loadFigureModules();
    assert.ok(Object.prototype.hasOwnProperty.call(cache, 'diagram/turing_test'),
      'category/name key must be in cache');
    assert.ok(!Object.prototype.hasOwnProperty.call(cache, 'diagram'),
      'bare category name must not appear in cache');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('normalizePdfDates replaces all CreationDate occurrences when multiple present', () => {
  // A malformed or concatenated PDF that has the date string more than once
  const tmpFile = path.join(os.tmpdir(), 'multi-date.pdf');
  const date    = '20241215120000';
  const content = "/CreationDate (D:" + date + "+00'00') "
                + "/ModDate (D:" + date + "+00'00') "
                + "/CreationDate (D:" + date + "+00'00')"; // second occurrence
  fs.writeFileSync(tmpFile, content, 'latin1');
  try {
    normalizePdfDates(tmpFile);
    const out = fs.readFileSync(tmpFile, 'latin1');
    // original date must not appear anywhere
    assert.ok(!out.includes(date), 'All occurrences of original date must be replaced');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
