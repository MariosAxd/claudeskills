# d3figurer

MCP server that lets Claude Code render D3.js figures to PDF, PNG, or SVG via a persistent Chrome/Puppeteer process, and check them for layout issues (overlapping text, clipping, box overflows).

## Why D3 + AI is a great combination

D3.js is the gold standard for precise, publication-quality data visualisation, but it has a steep learning curve — the API surface is large, the coordinate math is fiddly, and getting text placement, scales, and layout exactly right takes experience. This is where AI assistance shines: Claude can write and iterate on D3 code rapidly, treating the SVG output as the source of truth rather than a browser screenshot.

d3figurer closes the loop:

**AI writes code, not pixels.** Claude generates `figure.js` files that produce SVG programmatically. The output is a clean, editable source file, not a rasterised image — you own the data and the design, and can regenerate at any size or format.

**Instant visual feedback.** The `check_figure` tool runs layout QA automatically — detecting overlapping labels, clipped text, and elements spilling outside the canvas — so Claude can fix problems in the next iteration without you having to open a browser.

**No context-window bloat.** Rendering happens in a separate persistent process. Claude gets back a short success/error message, not base64-encoded image data. This keeps the conversation context clean for many render-edit cycles.

**Production formats out of the box.** A single command produces PDF (vector, print-ready), PNG (raster for web/slides), and SVG (editable in Illustrator/Inkscape). No post-processing pipeline needed.

**Figures are reproducible and version-controlled.** Each figure is a small CommonJS module. You can diff changes, regenerate on CI, and share the source alongside the output. The gallery ships with a GitHub Actions workflow that rebuilds all figures and deploys the preview on every push.

**The gallery as a pattern library.** The 18 included figures cover the most common infographic types — flow diagrams, timelines, bubble charts, dumbbell charts, area charts, network diagrams. They are real examples from a published book, not toy demos, and each one is a reusable starting point for Claude to adapt.

## MCP tools

| Tool | Description |
|------|-------------|
| `render_figure` | Render a named figure to PDF or PNG |
| `check_figure` | Check a figure for text overlaps, clipping, and box overflows |
| `server_status` | Check whether the render server is running and list loaded figures |

## Installation

**npm (recommended — macOS, Linux, WSL):**
```bash
npm install -g d3figurer
d3figurer-setup-mcp
```

**From repo clone — macOS, Linux, WSL:**
```bash
d3figurer/setup_mcp.sh
```

**Windows (CMD):**
```bat
d3figurer\setup_mcp.cmd
```

`setup_mcp.sh` / `d3figurer-setup-mcp` installs Node.js if needed, installs npm packages and Chrome, then registers `mcp.sh` with Claude Code via `claude mcp add --scope user`. Restart Claude Code after running.

## Requirements

- macOS, Linux, or WSL2 (Windows)
- Node.js ≥ 18 — installed automatically by the setup script if missing
- Chrome — downloaded by Puppeteer during `npm install`

## Usage

### 1. Start the render server

The MCP tools call the render server over HTTP. Start it once before using Claude:

```bash
d3figurer/server.sh start --src-dir /path/to/figures/src
```

The server loads all figure modules at startup and keeps Chrome warm between renders.

### 2. Use the MCP tools in Claude

Once the server is running, Claude can call the tools directly:

```
render_figure(name="my_chart", output_path="/tmp/my_chart.pdf")
check_figure(name="my_chart")
server_status()
```

### Figure module format

Each figure lives in its own directory and exports a function that returns SVG markup:

```javascript
// figures/src/my_chart/figure.js
'use strict';
const d3 = require('d3');
const { JSDOM } = require('jsdom');

module.exports = function () {
  const dom      = new JSDOM('<!DOCTYPE html><body></body>');
  const document = dom.window.document;

  const svg = d3.select(document.body)
    .append('svg')
    .attr('width', 800)
    .attr('height', 600);

  svg.append('circle')
    .attr('cx', 400).attr('cy', 300).attr('r', 50)
    .attr('fill', 'steelblue');

  return document.body.innerHTML;
};
```

The root `<svg>` element must have `width="N" height="N"` attributes — the server reads these to set the Puppeteer viewport.

Source files are discovered automatically: every subdirectory of `--src-dir` that contains a `figure.js` is treated as a figure. The `shared/` subdirectory is skipped (use it for helpers).

### Font support

Pass raw CSS as `fontCSS` to `server.sh start` or `FigurerServer`:

```bash
server.sh start --src-dir ./figs --font-css "@import url('...');"
```

The string is injected verbatim into the `<style>` block that Chrome renders.

## Server lifecycle

```bash
./server.sh install                       # one-time: install node_modules + Chrome
./server.sh start --src-dir <path>        # start Chrome + render server
./server.sh stop                          # graceful stop (both processes)
./server.sh restart                       # restart render-server only (Chrome stays warm)
./server.sh status                        # check running / ready
./server.sh log                           # tail render-server log
./server.sh chrome-log                    # tail Chrome log
```

Default ports: `9229` (render HTTP server), `9230` (Chrome DevTools). Override with `--port`.

Work directory defaults to `~/.d3figurer-work/`. Override with `--work-dir <path>` or `D3FIGURER_WORK_DIR`.

## Performance

Chrome starts once and stays warm. After the initial cold start (~5–10 s), each render takes ~1–2 s. The server auto-shuts down after 10 minutes of inactivity (`IDLE_SHUTDOWN_AFTER` env var).

## Sample gallery

`gallery/` contains 18 ready-to-render figures from an AI book (chapters 2–5) covering neural network diagrams, LLM timelines, hardware charts, and economic impact visualisations. Use them to try out d3figurer immediately:

```bash
./server.sh start --src-dir gallery
```

See [`gallery/README.md`](gallery/README.md) for the full figure index and shared helper documentation.

**Live preview:** [mcroomp.github.io/claudeskills/preview/](https://mcroomp.github.io/claudeskills/preview/)

## Testing

```bash
./test.sh           # quiet summary (83 tests)
./test.sh -v        # verbose — every ✔/✖ line
./test.sh "pattern" # filter by test name regex
```

Tests cover `formatReport` logic, `FigurerClient` internals, `FigurerServer` constructor and `_loadFigureModules`, the serial render queue, PDF date normalisation, and the full MCP server JSON-RPC protocol. No running server required.

## License

MIT
