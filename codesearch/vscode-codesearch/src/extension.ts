import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
    CodesearchConfig,
    MODES,
    loadConfig,
    getRoots,
    collectionForRoot as _collectionForRoot,
    doSearch,
    resolveFilePath,
} from './client';

// ---------------------------------------------------------------------------
// Config discovery (needs vscode API)
// ---------------------------------------------------------------------------

function friendlyConfigError(raw: string): string {
    if (raw.includes('directory, not a file') || raw.includes('EISDIR')) {
        return `codesearch.configPath points to a directory — set it to the config.json file itself (e.g. …/codesearch/config.json)`;
    }
    if (raw.includes('not found') || raw.includes('ENOENT')) {
        return `config.json not found at the configured path — check the codesearch.configPath setting`;
    }
    if (raw.includes('JSON') || raw.includes('Unexpected token') || raw.includes('SyntaxError')) {
        return `config.json contains invalid JSON — check the file for syntax errors`;
    }
    return `Failed to load config.json — ${raw}`;
}

function findConfigPath(): string | null {
    const setting = vscode.workspace.getConfiguration('codesearch').get<string>('configPath');
    if (setting) {
        // Validate explicitly so we can give a useful error rather than EISDIR/ENOENT
        try {
            const stat = fs.statSync(setting);
            if (!stat.isFile()) {
                throw new Error(`codesearch.configPath points to a directory, not a file.\nExpected a path like: ${path.join(setting, 'config.json')}`);
            }
        } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error(`codesearch.configPath not found: ${setting}`);
            }
            throw e;
        }
        return setting;
    }
    for (const folder of vscode.workspace.workspaceFolders || []) {
        for (const rel of ['codesearch/config.json', 'config.json']) {
            const candidate = path.join(folder.uri.fsPath, rel);
            if (!fs.existsSync(candidate)) { continue; }
            try {
                const d = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
                if ('api_key' in d && ('roots' in d || 'src_root' in d)) { return candidate; }
            } catch { /* skip */ }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Nonce helper
// ---------------------------------------------------------------------------

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---------------------------------------------------------------------------
// Webview HTML
// ---------------------------------------------------------------------------

function buildWebviewHtml(nonce: string, roots: string[], defaultRoot: string): string {
    const modesJson = JSON.stringify(MODES.map((m) => ({ key: m.key, label: m.label, desc: m.desc })));
    const rootsJson = JSON.stringify(roots);
    const defaultRootJson = JSON.stringify(defaultRoot);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Code Search</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:var(--vscode-font-family);
  font-size:var(--vscode-font-size);
  color:var(--vscode-foreground);
  background:var(--vscode-editor-background);
  height:100vh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.header{
  padding:8px;
  border-bottom:1px solid var(--vscode-panel-border,#333);
  flex-shrink:0;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.search-row{display:flex;gap:4px;align-items:center}
input.search-box{
  flex:1;
  background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);
  border:1px solid var(--vscode-input-border,transparent);
  border-radius:2px;
  padding:5px 8px;
  font-family:inherit;
  font-size:inherit;
  outline:none;
}
input.search-box:focus{border-color:var(--vscode-focusBorder)}
input.search-box::placeholder{color:var(--vscode-input-placeholderForeground)}
.filters{
  display:flex;
  flex-wrap:wrap;
  gap:4px 6px;
  align-items:center;
}
.filter-label{
  font-size:11px;
  color:var(--vscode-descriptionForeground);
  white-space:nowrap;
}
select.filter-select,input.filter-input{
  background:var(--vscode-dropdown-background,var(--vscode-input-background));
  color:var(--vscode-dropdown-foreground,var(--vscode-input-foreground));
  border:1px solid var(--vscode-dropdown-border,var(--vscode-input-border,transparent));
  border-radius:2px;
  padding:3px 6px;
  font-family:inherit;
  font-size:11px;
  outline:none;
  cursor:pointer;
}
select.filter-select:focus,input.filter-input:focus{border-color:var(--vscode-focusBorder)}
input.filter-input{width:90px;cursor:text}
input.filter-input::placeholder{color:var(--vscode-input-placeholderForeground);font-style:italic}
.status-bar{
  padding:3px 10px;
  font-size:11px;
  color:var(--vscode-descriptionForeground);
  min-height:20px;
  flex-shrink:0;
  border-bottom:1px solid var(--vscode-panel-border,#333);
}
.status-bar.error{color:var(--vscode-errorForeground)}
.results{flex:1;overflow-y:auto;padding-bottom:8px}
.result-item{
  padding:7px 12px 7px 10px;
  border-bottom:1px solid var(--vscode-list-inactiveSelectionBackground,rgba(255,255,255,0.04));
  cursor:pointer;
}
.result-item:hover{background:var(--vscode-list-hoverBackground)}
.result-item:focus{
  background:var(--vscode-list-activeSelectionBackground);
  color:var(--vscode-list-activeSelectionForeground);
  outline:none;
}
.result-path{
  font-size:calc(var(--vscode-font-size) - 1px);
  word-break:break-all;
  line-height:1.4;
}
.result-dir{color:var(--vscode-descriptionForeground)}
.result-fname{font-weight:600}
.badge{
  display:inline-block;
  background:var(--vscode-badge-background);
  color:var(--vscode-badge-foreground);
  border-radius:8px;
  padding:0 6px;
  font-size:10px;
  font-weight:600;
  vertical-align:middle;
  margin-left:5px;
}
.meta{
  display:flex;
  flex-direction:column;
  gap:1px;
  margin-top:3px;
}
.meta-row{
  display:flex;
  align-items:baseline;
  gap:5px;
  font-size:11px;
  line-height:1.4;
}
.meta-key{
  color:var(--vscode-descriptionForeground);
  flex-shrink:0;
  min-width:70px;
  text-align:right;
}
.meta-val{opacity:.9;word-break:break-all}
.snippet{
  margin-top:3px;
  font-size:11px;
  color:var(--vscode-descriptionForeground);
  font-style:italic;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
mark{
  background:var(--vscode-editor-findMatchHighlightBackground,rgba(255,255,0,0.4));
  color:var(--vscode-foreground);
  border-radius:2px;
  padding:0 1px;
}
.empty{
  padding:32px 20px;
  text-align:center;
  color:var(--vscode-descriptionForeground);
  font-size:13px;
}
@keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
.dot{display:inline-block;animation:blink 1.4s infinite}
.dot:nth-child(2){animation-delay:.2s}
.dot:nth-child(3){animation-delay:.4s}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--vscode-scrollbarSlider-background);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--vscode-scrollbarSlider-hoverBackground)}
</style>
</head>
<body>
<div class="header">
  <div class="search-row">
    <input id="q" class="search-box" type="text" placeholder="Search code…" spellcheck="false" autocomplete="off">
  </div>
  <div class="filters">
    <span class="filter-label">Mode</span>
    <select id="mode" class="filter-select" title="Search mode"></select>
    <span class="filter-label">Ext</span>
    <input id="ext" class="filter-input" type="text" placeholder="cs, h, py…" title="Filter by file extension (e.g. cs)">
    <span class="filter-label">Sub</span>
    <input id="sub" class="filter-input" type="text" placeholder="subsystem…" title="Filter by subsystem directory">
    <span id="rootWrap" class="filter-label" style="display:none">Root</span>
    <select id="root" class="filter-select" title="Source root" style="display:none"></select>
    <span class="filter-label">Limit</span>
    <select id="limit" class="filter-select" title="Max results">
      <option value="10">10</option>
      <option value="25" selected>25</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
  </div>
</div>
<div id="status" class="status-bar"></div>
<div id="results" class="results">
  <div class="empty">Type to search across your codebase</div>
</div>
<script nonce="${nonce}">
(function() {
  'use strict';
  const vscode = acquireVsCodeApi();
  const MODES = ${modesJson};
  const ROOTS = ${rootsJson};
  const DEFAULT_ROOT = ${defaultRootJson};

  const modeEl = document.getElementById('mode');
  MODES.forEach(function(m) {
    const o = document.createElement('option');
    o.value = m.key;
    o.textContent = m.label;
    o.title = m.desc;
    modeEl.appendChild(o);
  });

  const rootEl = document.getElementById('root');
  const rootWrap = document.getElementById('rootWrap');
  ROOTS.forEach(function(r) {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = r;
    if (r === DEFAULT_ROOT) { o.selected = true; }
    rootEl.appendChild(o);
  });
  if (ROOTS.length > 1) {
    rootEl.style.display = '';
    rootWrap.style.display = '';
  }

  let timer = null;
  const qEl = document.getElementById('q');
  const extEl = document.getElementById('ext');
  const subEl = document.getElementById('sub');
  const limitEl = document.getElementById('limit');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');

  function triggerSearch() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      const query = qEl.value.trim();
      if (!query) {
        resultsEl.innerHTML = '<div class="empty">Type to search across your codebase</div>';
        statusEl.textContent = '';
        statusEl.className = 'status-bar';
        return;
      }
      statusEl.innerHTML = 'Searching<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
      statusEl.className = 'status-bar';
      vscode.postMessage({
        type: 'search',
        query: query,
        mode: modeEl.value,
        ext: extEl.value.trim(),
        sub: subEl.value.trim(),
        root: rootEl.value,
        limit: parseInt(limitEl.value, 10)
      });
    }, 180);
  }

  qEl.addEventListener('input', triggerSearch);
  modeEl.addEventListener('change', triggerSearch);
  extEl.addEventListener('input', triggerSearch);
  subEl.addEventListener('input', triggerSearch);
  rootEl.addEventListener('change', triggerSearch);
  limitEl.addEventListener('change', triggerSearch);

  function esc(s) {
    if (!s) { return ''; }
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hlSnippet(highlights, fields) {
    if (!highlights) { return null; }
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      for (var j = 0; j < highlights.length; j++) {
        var h = highlights[j];
        if (h.field === f) {
          var s = h.snippet || (h.snippets && h.snippets[0]);
          if (s) { return s; }
        }
      }
    }
    return null;
  }

  function hlOrEsc(highlights, field, arr, count) {
    var s = hlSnippet(highlights, [field]);
    if (s) { return s; }
    if (!arr || !arr.length) { return null; }
    return esc(arr.slice(0, count).join(', '));
  }

  function renderHit(hit, index) {
    var doc = hit.document;
    var hl = hit.highlights || [];
    var rel = doc.relative_path || '';
    var slash = rel.lastIndexOf('/');
    var dir = slash >= 0 ? rel.slice(0, slash + 1) : '';
    var fname = slash >= 0 ? rel.slice(slash + 1) : rel;
    var fnameHl = hlSnippet(hl, ['filename']);

    var html = '<div class="result-item" tabindex="0" data-i="' + index + '">';
    html += '<div class="result-path">';
    html += '<span class="result-dir">' + esc(dir) + '</span>';
    html += '<span class="result-fname">' + (fnameHl || esc(fname)) + '</span>';
    if (doc.subsystem) {
      html += '<span class="badge">' + esc(doc.subsystem) + '</span>';
    }
    html += '</div>';

    var rows = [];
    if (doc.namespace) { rows.push(['Namespace', esc(doc.namespace)]); }
    var classes = hlOrEsc(hl, 'class_names', doc.class_names, 5);
    if (classes) { rows.push(['Classes', classes]); }
    var bases = hlOrEsc(hl, 'base_types', doc.base_types, 5);
    if (bases) { rows.push(['Implements', bases]); }
    var sigs = hlOrEsc(hl, 'method_sigs', doc.method_sigs, 3);
    if (sigs) {
      rows.push(['Signatures', sigs]);
    } else {
      var methods = hlOrEsc(hl, 'method_names', doc.method_names, 6);
      if (methods) { rows.push(['Members', methods]); }
    }
    var attrs = hlOrEsc(hl, 'attributes', doc.attributes, 5);
    if (attrs) { rows.push(['Attributes', attrs]); }
    var callers = hlOrEsc(hl, 'call_sites', doc.call_sites, 3);
    if (callers) { rows.push(['Call sites', callers]); }
    var typerefs = hlOrEsc(hl, 'type_refs', doc.type_refs, 3);
    if (typerefs) { rows.push(['Type refs', typerefs]); }
    var usings = hlOrEsc(hl, 'usings', doc.usings, 4);
    if (usings) { rows.push(['Usings', usings]); }

    if (rows.length > 0) {
      html += '<div class="meta">';
      for (var r = 0; r < rows.length; r++) {
        html += '<div class="meta-row"><span class="meta-key">' + esc(rows[r][0]) + '</span>';
        html += '<span class="meta-val">' + rows[r][1] + '</span></div>';
      }
      html += '</div>';
    }

    var snippet = hlSnippet(hl, ['content']);
    if (snippet) {
      html += '<div class="snippet">\u2026' + snippet + '\u2026</div>';
    }
    html += '</div>';
    return html;
  }

  function showResults(data) {
    var hits = data.hits || [];
    var found = data.found || 0;
    var modeLabel = MODES.find(function(m) { return m.key === data.mode; });
    modeLabel = modeLabel ? modeLabel.label : data.mode;
    statusEl.textContent = found === 0
      ? 'No results'
      : found + ' result' + (found === 1 ? '' : 's') + ' \u2014 ' + data.elapsed + 'ms \u2014 ' + modeLabel + ' mode';
    statusEl.className = 'status-bar';
    if (hits.length === 0) {
      resultsEl.innerHTML = '<div class="empty">No results for <strong>' + esc(data.query) + '</strong></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < hits.length; i++) { html += renderHit(hits[i], i); }
    resultsEl.innerHTML = html;
    var items = resultsEl.querySelectorAll('.result-item');
    for (var j = 0; j < items.length; j++) {
      (function(item, hit) {
        item.addEventListener('click', function() { openHit(hit); });
        item.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { openHit(hit); }
          if (e.key === 'ArrowDown') { var n = item.nextElementSibling; if (n) { n.focus(); e.preventDefault(); } }
          if (e.key === 'ArrowUp') { var p = item.previousElementSibling; if (p) { p.focus(); e.preventDefault(); } else { qEl.focus(); e.preventDefault(); } }
        });
      })(items[j], hits[j]);
    }
  }

  function openHit(hit) {
    vscode.postMessage({ type: 'openFile', relativePath: hit.document.relative_path, root: rootEl.value });
  }

  qEl.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') { var f = resultsEl.querySelector('.result-item'); if (f) { f.focus(); e.preventDefault(); } }
  });

  window.addEventListener('message', function(ev) {
    var msg = ev.data;
    if (msg.type === 'results') { showResults(msg); }
    else if (msg.type === 'error') {
      statusEl.textContent = 'Error: ' + msg.message;
      statusEl.className = 'status-bar error';
      resultsEl.innerHTML = '<div class="empty">Search failed \u2014 is the Typesense server running?<br><small>Run: ts start</small></div>';
    } else if (msg.type === 'configError') {
      statusEl.textContent = msg.message;
      statusEl.className = 'status-bar error';
    }
  });

  qEl.focus();
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Extension activation
// ---------------------------------------------------------------------------

let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('codesearch.openPanel', () => {
            if (currentPanel) { currentPanel.reveal(); return; }

            const panel = vscode.window.createWebviewPanel(
                'codesearch', 'Code Search', vscode.ViewColumn.One,
                { enableScripts: true, retainContextWhenHidden: true }
            );
            currentPanel = panel;

            let config: CodesearchConfig | null = null;
            let roots: string[] = ['default'];
            let defaultRoot = 'default';

            function reloadConfig(): boolean {
                try {
                    const p = findConfigPath();
                    if (!p) {
                        panel.webview.postMessage({ type: 'configError', message: 'No config.json found. Set codesearch.configPath in VS Code settings.' });
                        vscode.window.showWarningMessage('Code Search: config.json not found.', 'Open Settings').then((choice) => {
                            if (choice === 'Open Settings') { vscode.commands.executeCommand('workbench.action.openSettings', 'codesearch.configPath'); }
                        });
                        return false;
                    }
                    config = loadConfig(p);
                    const rootMap = getRoots(config);
                    roots = Object.keys(rootMap);
                    defaultRoot = roots[0] ?? 'default';
                    return true;
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    const friendly = friendlyConfigError(msg);
                    panel.webview.postMessage({ type: 'configError', message: friendly });
                    vscode.window.showErrorMessage(`Code Search: ${friendly}`, 'Open Settings').then((choice) => {
                        if (choice === 'Open Settings') { vscode.commands.executeCommand('workbench.action.openSettings', 'codesearch.configPath'); }
                    });
                    return false;
                }
            }

            reloadConfig();
            panel.webview.html = buildWebviewHtml(getNonce(), roots, defaultRoot);

            panel.webview.onDidReceiveMessage(async (msg) => {
                if (msg.type === 'search') {
                    if (!config && !reloadConfig()) { return; }
                    const start = Date.now();
                    try {
                        const result = await doSearch(
                            config!, msg.query, msg.mode,
                            msg.ext || '', msg.sub || '',
                            msg.root || defaultRoot, msg.limit || 25
                        );
                        panel.webview.postMessage({
                            type: 'results',
                            hits: result.hits ?? [],
                            found: result.found ?? 0,
                            elapsed: Date.now() - start,
                            query: msg.query,
                            mode: msg.mode,
                        });
                    } catch (e: unknown) {
                        panel.webview.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
                    }

                } else if (msg.type === 'openFile') {
                    if (!config && !reloadConfig()) { return; }
                    const rootMap = getRoots(config!);
                    const rootPath = rootMap[msg.root as string] ?? Object.values(rootMap)[0];
                    if (!rootPath) { vscode.window.showErrorMessage('Code Search: no source root configured.'); return; }
                    try {
                        const fullPath = resolveFilePath(rootPath, msg.relativePath as string);
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
                        await vscode.window.showTextDocument(doc, { preview: false });
                    } catch (e: unknown) {
                        vscode.window.showErrorMessage(`Code Search: cannot open file — ${e instanceof Error ? e.message : e}`);
                    }
                }
            }, undefined, context.subscriptions);

            panel.onDidDispose(() => { currentPanel = undefined; }, undefined, context.subscriptions);
        })
    );
}

export function deactivate(): void { /* nothing */ }
