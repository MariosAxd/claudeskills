'use strict';
/**
 * FigurerClient — HTTP client for FigurerServer
 *
 * Wraps every HTTP call, adds hang detection + server-restart when a render
 * exceeds the hard timeout, and logs slow renders to a markdown file.
 *
 * Options:
 *   port            {number}  Server port (default 9229)
 *   host            {string}  Server host (default '127.0.0.1')
 *   hangThresholdMs {number}  Log to hangLog if exceeded (default 5000)
 *   hangHardTimeout {number}  Abort + restart server after this (default 30000)
 *   hangLog         {string}  Path to hang log file (default './render_hangs.md')
 *   serverShPath    {string}  Path to server.sh for restart (optional)
 */

const http         = require('http');
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

class FigurerClient {
  constructor(options = {}) {
    this.options = {
      port:            9229,
      host:            '127.0.0.1',
      hangThresholdMs: 5_000,
      hangHardTimeout: 30_000,
      hangLog:         path.join(process.cwd(), 'render_hangs.md'),
      serverShPath:    null,
      ...options,
    };
  }

  // ── Low-level request ─────────────────────────────────────────────────────
  // socketTimeout: connection-idle timeout; 0 = no timeout (for long renders)
  request(method, urlPath, body = null, socketTimeout = 0) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const opts = {
        host: this.options.host,
        port: this.options.port,
        method,
        path: urlPath,
        headers: data ? {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(data),
        } : {},
      };
      const req = http.request(opts, res => {
        let buf = '';
        res.on('data', d => { buf += d; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
          catch (_) { resolve({ status: res.statusCode, body: buf }); }
        });
      });
      if (socketTimeout > 0) {
        req.setTimeout(socketTimeout, () => { req.destroy(); reject(new Error('timeout')); });
      }
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // Like request() but with an optional hard total-elapsed timeout
  _requestTimed(method, urlPath, body, hardTimeoutMs) {
    const req = this.request(method, urlPath, body);
    if (!hardTimeoutMs) return req;
    let timerId;
    const timer = new Promise((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`render timed out after ${hardTimeoutMs / 1000}s`)),
        hardTimeoutMs,
      );
    });
    return Promise.race([req, timer]).finally(() => clearTimeout(timerId));
  }

  // ── Hang logging + server restart ─────────────────────────────────────────
  _logHang(figure, durationMs, reason) {
    const ts     = new Date().toISOString();
    const secs   = (durationMs / 1000).toFixed(1);
    const header = fs.existsSync(this.options.hangLog)
      ? ''
      : '# Render Hangs Log\n\nRenders that exceeded the threshold.\n\n';
    const entry  = `## ${ts} — ${figure}\n- Duration: ${secs}s\n- Reason: ${reason || 'slow (completed)'}\n\n`;
    try { fs.appendFileSync(this.options.hangLog, header + entry); } catch (_) {}
  }

  _restartServer() {
    const sh = this.options.serverShPath;
    if (!sh) { process.stderr.write('[HANG] No serverShPath configured — cannot restart\n'); return; }
    process.stderr.write('[HANG] Restarting server...\n');
    try {
      execSync(`"${sh}" restart`, { cwd: path.dirname(sh), stdio: 'pipe', timeout: 30_000 });
      process.stderr.write('[HANG] Server restarted.\n');
    } catch (e) {
      process.stderr.write(`[HANG] Restart failed: ${e.message}\n`);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async isServerAvailable() {
    try {
      const r = await this.request('GET', '/', null, 500);
      return r.status === 200 && r.body.ready;
    } catch (_) { return false; }
  }

  async getStatus() {
    const r = await this.request('GET', '/');
    if (r.status !== 200) throw new Error(`Server error: ${r.status}`);
    return r.body;
  }

  async render(figureName, outputPath, options = {}) {
    const { reload = false, format = 'pdf' } = options;
    const r = await this.request('POST', '/render', { figure: figureName, outputPath, format, reload });
    if (r.status !== 200) throw new Error(`Render failed: ${r.body?.error || r.status}`);
    return r.body;
  }

  async loadUrl(url, screenshotPath) {
    const r = await this.request('POST', '/load-url', { url, screenshotPath: screenshotPath || null });
    if (r.status !== 200) throw new Error(`Load failed: ${r.body?.error || r.status}`);
    return r.body;
  }

  /**
   * renderBatch — render a list of figures with hang detection.
   *
   * @param {Array<{name: string, output: string}>} figures
   * @param {object} opts
   *   verbose  {boolean}  Print per-figure status (default: figures.length === 1)
   *   outputDir {string}  Base dir; if provided each figure.output is relative to it
   * @returns {Promise<{ok: number, errors: Array}>}
   */
  async renderBatch(figures, opts = {}) {
    const verbose  = opts.verbose ?? (figures.length === 1);
    const errors   = [];
    const start    = Date.now();
    const { hangThresholdMs, hangHardTimeout } = this.options;

    for (const fig of figures) {
      const format = fig.format || opts.format || 'pdf';
      const ext    = fig.output ? path.extname(fig.output).slice(1) || format : format;
      const outputPath = opts.outputDir
        ? path.resolve(opts.outputDir, fig.output || `${fig.name}.${format}`)
        : fig.output;
      const t0 = Date.now();
      let hung = false;
      try {
        const r = await this._requestTimed('POST', '/render',
          { figure: fig.name, outputPath, format: ext, reload: fig.reload },
          hangHardTimeout,
        );
        const elapsed = Date.now() - t0;
        if (elapsed > hangThresholdMs) {
          hung = true;
          this._logHang(fig.name, elapsed, 'slow render (completed)');
          process.stderr.write(`\n[HANG] ${fig.name} took ${(elapsed / 1000).toFixed(1)}s\n`);
        }
        if (r.status !== 200) throw new Error(r.body?.error || `HTTP ${r.status}`);
        if (verbose) process.stderr.write(`[OK] ${fig.name} → ${path.basename(outputPath)}\n`);
        else         process.stderr.write('.');
      } catch (err) {
        const elapsed = Date.now() - t0;
        if (elapsed >= hangHardTimeout - 100 || err.message.includes('timed out')) {
          this._logHang(fig.name, elapsed, err.message);
          process.stderr.write(`\n[HANG] ${fig.name}: ${err.message} — restarting server\n`);
          this._restartServer();
        } else if (elapsed > hangThresholdMs && !hung) {
          this._logHang(fig.name, elapsed, err.message);
        }
        errors.push({ name: fig.name, message: err.message });
        process.stderr.write(verbose ? `[ERROR] ${fig.name}: ${err.message}\n` : 'E');
      }
    }

    if (!verbose) process.stderr.write('\n');
    errors.forEach(e => process.stderr.write(`  ERROR ${e.name}: ${e.message}\n`));
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const ok = figures.length - errors.length;
    process.stderr.write(
      `Done — ${errors.length ? `${ok}/${figures.length} ok` : `${figures.length} ok`} in ${elapsed}s (server)\n`,
    );
    return { ok, total: figures.length, errors };
  }

  async checkFigure(figureName, options = {}) {
    const r = await this.request('POST', '/check', { figure: figureName, ...options });
    if (r.status !== 200) throw new Error(`Check failed: ${r.body?.error || r.status}`);
    return r.body;
  }

  async shutdown() {
    try { await this.request('DELETE', '/'); return true; }
    catch (_) { return false; }
  }
}

module.exports = FigurerClient;