#!/usr/bin/env node
'use strict';

/**
 * d3figurer CLI - Command-line interface for D3Figurer
 */

const D3Figurer = require('../src/index');
const { formatReport } = require('../src/checker');
const path = require('path');
const fs = require('fs');

// Parse command-line arguments
const args = process.argv.slice(2);
const command = args[0];

function showUsage() {
  console.log(`
d3figurer - Server-side D3.js figure generation

Usage:
  d3figurer server [--port 9229] [--src-dir path]    Start persistent server
  d3figurer render <figure> <output> [--format pdf|png|svg]
  d3figurer batch <output-dir> --src-dir <path> [--format pdf|png|svg] [figures...]
  d3figurer check <figure> [--src-dir path]          Check figure layout
  d3figurer stop [--port 9229]                       Stop server

Options:
  --src-dir     Directory containing figure modules
  --port        Server port (default: 9229)
  --format      Output format: pdf | png | svg (default for batch: png)

Examples:
  d3figurer server --src-dir ./gallery --port 9229
  d3figurer render diagram/transformer /tmp/transformer.pdf --format pdf
  d3figurer batch /tmp/gallery-out --src-dir gallery             # PNGs + index.html
  d3figurer batch /tmp/gallery-out --src-dir gallery --format pdf # PDFs + PNGs + index.html
  d3figurer stop
`);
}

function parseArgs(args) {
  const options = {};
  const positionals = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  
  return { options, positionals };
}

async function runServer(options) {
  const figurer = new D3Figurer({
    port: parseInt(options.port) || 9229,
    srcDir: options.srcDir ? path.resolve(options.srcDir) : null
  });
  
  console.log(`Starting server on port ${figurer.options.port}...`);
  try {
    await figurer.startServer();
    console.log('Server ready. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\\nShutting down server...');
      await figurer.stopServer();
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

async function runRender(figureName, outputPath, options) {
  if (!figureName || !outputPath) {
    console.error('Error: figure name and output path required');
    showUsage();
    process.exit(1);
  }
  
  const figurer = new D3Figurer({
    srcDir: options.srcDir ? path.resolve(options.srcDir) : null
  });
  
  try {
    await figurer.render(figureName, path.resolve(outputPath), {
      format: options.format || 'pdf'
    });
    console.log(`[OK] ${figureName} → ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`Error rendering ${figureName}:`, error.message);
    process.exit(1);
  }
}

// Recursively find all figure names under srcDir (same logic as server's _loadFigureModules).
// Returns names relative to srcDir, e.g. ['diagram/turing_test', 'timeline/ai_timeline'].
// Directories named 'shared' are skipped at every level.
function discoverFigures(dir, prefix = '') {
  const names = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'shared') continue;
    const full = path.join(dir, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    const name = prefix ? `${prefix}/${entry}` : entry;
    if (fs.existsSync(path.join(full, 'figure.js'))) {
      names.push(name);
    } else {
      names.push(...discoverFigures(full, name));
    }
  }
  return names;
}

// Convert a figure name like 'diagram/turing_test' to a flat file stem 'diagram_turing_test'.
function flatName(name) {
  return name.replace(/\//g, '_');
}

const FORMATS = ['png', 'svg', 'pdf'];

// Call figure.js and return its SVG string. On error returns a red placeholder SVG.
function renderInlineSvg(srcDir, name) {
  try {
    const figPath = path.join(srcDir, name, 'figure.js');
    try { delete require.cache[require.resolve(figPath)]; } catch (_) {}
    return require(figPath)();
  } catch (e) {
    return `<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="80" fill="#2a1010"/>
      <text x="10" y="24" fill="#e4003b" font-size="13" font-family="monospace">Error: ${name}</text>
      <text x="10" y="46" fill="#aaa" font-size="11" font-family="monospace">${e.message.slice(0, 64)}</text>
    </svg>`;
  }
}

// preview/<stem>.html — figure page used both as iframe source and standalone view.
function buildFigureHtml(srcDir, name, rendered) {
  const [category, ...rest] = name.split('/');
  const title = (rest.join('/') || name).replace(/_/g, ' ');
  const stem  = flatName(name);
  const links = FORMATS
    .filter(f => rendered.has(f))
    .map(f => `<a class="dl" href="../${f}/${stem}.${f}">${f.toUpperCase()}</a>`)
    .join(' ');
  const inlineSvg = renderInlineSvg(srcDir, name);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — d3figurer</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background: white; }
  body { padding: 16px; font-family: system-ui, Arial, sans-serif; }
  h2 { font-size: 11px; font-weight: 700; color: #e4003b; margin-bottom: 10px;
       font-family: monospace; text-transform: uppercase; letter-spacing: .05em; }
  svg { max-width: 100%; height: auto; display: block; }
  .err { color: #e4003b; font-size: 12px; font-family: monospace; }
  .downloads { margin-top: 10px; display: flex; gap: 8px; }
  .dl { color: #e4003b; text-decoration: none; font-size: 11px; font-weight: 700; }
  .dl:hover { text-decoration: underline; }
  .back { font-size: 11px; color: #aaa; text-decoration: none; margin-bottom: 8px; display: inline-block; }
  .back:hover { color: #e4003b; }
</style>
</head>
<body>
<a class="back" href="index.html">← gallery</a>
<h2>${category} · ${title}</h2>
${inlineSvg}
<div class="downloads">${links}</div>
<script>
(function() {
  if (window.self !== window.top) {
    document.querySelectorAll('.back, h2, .downloads').forEach(function(el) { el.style.display = 'none'; });
    document.body.style.padding = '0';
  }
  var svg = document.querySelector('svg');
  if (!svg) return;
  var w = parseFloat(svg.getAttribute('width'))  || svg.viewBox.baseVal.width  || 900;
  var h = parseFloat(svg.getAttribute('height')) || svg.viewBox.baseVal.height || 500;
  window.parent.postMessage({ type: 'figureReady', name: '${stem}', width: w, height: h }, '*');
})();
</script>
</body>
</html>`;
}

// preview/index.html — aibook-style iframe grid with auto-sizing and bg toggle.
function buildIndexHtml(srcDir, entries) {
  const figuresData = entries.map(({ name, rendered }) => {
    const [category, ...rest] = name.split('/');
    const title = (rest.join('/') || name).replace(/_/g, ' ');
    const stem  = flatName(name);
    const dlLinks = FORMATS
      .filter(f => rendered.has(f))
      .map(f => `<a class="dl" href="../${f}/${stem}.${f}">${f.toUpperCase()}</a>`)
      .join(' ');
    return { name, category, title, stem, dlLinks };
  });

  const cards = figuresData.map(({ name, category, title, stem, dlLinks }) => `
  <div class="card" data-name="${stem}" data-cat="${category}" data-title="${title}">
    <div class="card-header">
      <span class="card-cat">${category}</span>
      <span class="card-name">${title}</span>
      <a class="card-open" href="${stem}.html" target="_blank">open ↗</a>
    </div>
    <div class="card-body white" id="body-${stem}">
      <iframe src="${stem}.html" scrolling="no" title="${title}"></iframe>
    </div>
    <div class="card-footer">${dlLinks}</div>
  </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>d3figurer gallery</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, Arial, sans-serif; background: #f0f0f0; }

  header {
    background: #e4003b; color: white; padding: 12px 24px;
    display: flex; align-items: baseline; gap: 14px;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
  }
  header h1 { font-size: 16px; font-weight: 700; }
  header span { font-size: 12px; opacity: .75; }

  #toolbar {
    background: white; border-bottom: 1px solid #ddd;
    padding: 8px 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  label { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .05em; }
  #filter { padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px;
    font-family: inherit; font-size: 13px; width: 200px; }
  .btns { display: flex; gap: 5px; }
  .btn { padding: 5px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;
    font-family: inherit; font-size: 11px; font-weight: 700; background: white; color: #666; }
  .btn.active { background: #e4003b; border-color: #e4003b; color: white; }
  #count { margin-left: auto; font-size: 11px; color: #aaa; }

  main { padding: 16px 24px; display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 16px; }

  .card { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.12);
    overflow: hidden; transition: box-shadow .15s; }
  .card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.18); }

  .card-header { padding: 8px 14px; background: #fafafa; border-bottom: 1px solid #eee;
    display: flex; align-items: baseline; gap: 10px; }
  .card-cat  { font-size: 10px; font-weight: 700; color: #e4003b;
    text-transform: uppercase; letter-spacing: .06em; }
  .card-name { font-size: 12px; font-weight: 700; color: #333; font-family: monospace; }
  .card-open { margin-left: auto; font-size: 10px; color: #bbb; text-decoration: none; }
  .card-open:hover { color: #e4003b; }

  .card-body { overflow: hidden; }
  .card-body.white { background: white; }
  .card-body.gray  { background: #c0c0c0; }
  .card-body.dark  { background: #222; }
  .card-body iframe { display: block; width: 100%; height: 200px; border: none; background: transparent; }

  .card-footer { padding: 6px 14px; border-top: 1px solid #eee; display: flex; gap: 8px; }
  .dl { color: #e4003b; text-decoration: none; font-size: 10px; font-weight: 700; }
  .dl:hover { text-decoration: underline; }

  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>d3figurer gallery</h1>
  <span>${entries.length} figures</span>
</header>
<div id="toolbar">
  <label>Filter:</label>
  <input id="filter" type="text" placeholder="diagram, timeline, chart…" oninput="applyFilter()">
  <label>Background:</label>
  <div class="btns">
    <button class="btn active" onclick="setBg('white',this)">White</button>
    <button class="btn" onclick="setBg('gray',this)">Gray</button>
    <button class="btn" onclick="setBg('dark',this)">Dark</button>
  </div>
  <span id="count"></span>
</div>
<main id="grid">
${cards}
</main>
<script>
updateCount();

window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'figureReady') return;
  var name = e.data.name, svgW = e.data.width, svgH = e.data.height;
  var body = document.getElementById('body-' + name);
  if (!body) return;
  var iframe = body.querySelector('iframe');
  if (!iframe) return;
  var cardW = body.clientWidth;
  iframe.style.height = Math.round((cardW / svgW) * svgH) + 'px';
});

function applyFilter() {
  var q = document.getElementById('filter').value.toLowerCase();
  var n = 0;
  document.querySelectorAll('.card').forEach(function(c) {
    var match = !q || c.dataset.name.includes(q) || c.dataset.cat.includes(q) || c.dataset.title.includes(q);
    c.classList.toggle('hidden', !match);
    if (match) n++;
  });
  updateCount(n);
}

function updateCount(n) {
  var total = document.querySelectorAll('.card').length;
  document.getElementById('count').textContent =
    (n !== undefined ? n + ' / ' : '') + total + ' figures';
}

function setBg(bg, btn) {
  document.querySelectorAll('.btns .btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.card-body').forEach(function(b) {
    b.classList.remove('white','gray','dark');
    b.classList.add(bg);
  });
}
</script>
</body>
</html>`;
}

async function runBatch(outputDir, figures, options) {
  if (!outputDir) {
    console.error('Error: output directory required');
    showUsage();
    process.exit(1);
  }

  const FigurerClient = require('../src/client');
  const port    = parseInt(options.port) || 9229;
  const client  = new FigurerClient({ port });
  const srcDir  = options.srcDir ? path.resolve(options.srcDir) : null;
  const previewOnly = !!options.previewOnly;

  if (!srcDir || !fs.existsSync(srcDir)) {
    console.error('Error: valid --src-dir required for batch rendering');
    process.exit(1);
  }

  const basePath    = path.resolve(outputDir);
  const previewPath = path.join(basePath, 'output', 'preview');
  const fmtPaths    = Object.fromEntries(FORMATS.map(f => [f, path.join(basePath, 'output', f)]));
  for (const p of [previewPath, ...Object.values(fmtPaths)]) fs.mkdirSync(p, { recursive: true });

  const figureNames = figures.length > 0 ? figures : discoverFigures(srcDir);
  if (figureNames.length === 0) {
    console.error('No figures found under', srcDir);
    process.exit(1);
  }

  // Track which output files exist
  const existsFor  = (name, fmt) => fs.existsSync(path.join(fmtPaths[fmt], `${flatName(name)}.${fmt}`));
  const renderedMap = () => new Map(figureNames.map(n => [n, new Set(FORMATS.filter(f => existsFor(n, f)))]));

  let errors = [];

  if (previewOnly) {
    // Skip rendering — just rebuild the HTML from existing output files
    console.log(`Rebuilding preview for ${figureNames.length} figures (--preview-only)...`);
  } else {
    if (!await client.isServerAvailable()) {
      console.error(`Error: render server not running on port ${port}.\nStart with: ./server.sh start --src-dir <dir>`);
      process.exit(1);
    }
    console.log(`Rendering ${figureNames.length} figures × ${FORMATS.length} formats → output/{${FORMATS.join(',')}}/ ...`);
    const specs = figureNames.flatMap(name =>
      FORMATS.map(fmt => ({ name, output: path.join(fmtPaths[fmt], `${flatName(name)}.${fmt}`), format: fmt }))
    );
    ({ errors } = await client.renderBatch(specs, { verbose: false }));
    if (errors.length) errors.forEach(e => process.stderr.write(`  FAILED ${e.name}: ${e.message}\n`));
    for (const fmt of FORMATS) {
      console.log(`  output/${fmt}/     ${figureNames.filter(n => existsFor(n, fmt)).length}/${figureNames.length} files`);
    }
  }

  // Build preview/
  const rm = renderedMap();
  const entries = figureNames.map(name => ({ name, rendered: rm.get(name) }));
  for (const { name, rendered } of entries) {
    fs.writeFileSync(path.join(previewPath, `${flatName(name)}.html`), buildFigureHtml(srcDir, name, rendered), 'utf8');
  }
  const indexPath = path.join(previewPath, 'index.html');
  fs.writeFileSync(indexPath, buildIndexHtml(srcDir, entries), 'utf8');
  console.log(`  output/preview/  index.html + ${entries.length} figure pages`);

  // Verify gallery loads in Chromium
  if (!previewOnly || await client.isServerAvailable()) {
    process.stdout.write('Verifying output/preview/index.html in Chromium... ');
    try {
      const result = await client.loadUrl('file://' + indexPath);
      console.log(result.ok ? 'OK' : `WARNING: ${result.failedRequests.length} failed resource(s)`);
      if (!result.ok) result.failedRequests.forEach(u => console.warn('  ', u));
    } catch (err) {
      console.warn(`WARNING: could not verify: ${err.message}`);
    }
  }

  if (errors.length > 0) process.exit(1);
}

async function runCheck(figureName, options) {
  if (!figureName) {
    console.error('Error: figure name required');
    showUsage();
    process.exit(1);
  }

  const figurer = new D3Figurer({
    srcDir: options.srcDir ? path.resolve(options.srcDir) : null
  });

  const t0 = Date.now();
  try {
    const result = await figurer.checkFigure(figureName);
    const elapsed = Date.now() - t0;
    process.stdout.write(formatReport(result, figureName, { elapsedMs: elapsed }) + '\n');

    const hasIssues = result.overlaps.length > 0 || result.clipped.length > 0
      || (result.tooClose || []).length > 0 || (result.boxOverflows || []).length > 0
      || (result.rectIntrusions || []).length > 0;
    if (hasIssues) process.exit(1);
  } catch (error) {
    console.error(`Error checking ${figureName}:`, error.message);
    process.exit(1);
  }
}

async function runStop(options) {
  const figurer = new D3Figurer({
    port: parseInt(options.port) || 9229
  });
  
  const client = figurer.getClient();
  
  try {
    const success = await client.shutdown();
    if (success) {
      console.log('Server stopped.');
    } else {
      console.log('No server running.');
    }
  } catch (error) {
    console.error('Error stopping server:', error.message);
    process.exit(1);
  }
}

// Main command dispatcher
async function main() {
  if (args.length === 0 || command === 'help' || command === '--help') {
    showUsage();
    return;
  }
  
  const { options, positionals } = parseArgs(args.slice(1));
  
  try {
    switch (command) {
      case 'server':
        await runServer(options);
        break;
        
      case 'render':
        await runRender(positionals[0], positionals[1], options);
        break;
        
      case 'batch':
        await runBatch(positionals[0], positionals.slice(1), options);
        break;
        
      case 'check':
        await runCheck(positionals[0], options);
        break;
        
      case 'stop':
        await runStop(options);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Command failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});