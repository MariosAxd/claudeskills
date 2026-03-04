# claudeskills

A collection of MCP servers and Claude Code skills that give Claude efficient semantic access to your codebase and a visualization toolchain.

Each tool lives in its own subdirectory and registers itself as an MCP server with a single setup command.

## MCPs

### `codesearch/` — Search 100K+ source files in milliseconds

When your codebase is too large to fit in context, `codesearch` gives Claude a search engine instead. It indexes your entire source tree into [Typesense](https://typesense.org) and exposes structural C# queries via [tree-sitter](https://tree-sitter.github.io), so Claude can find exactly what it needs without you copy-pasting code into the chat.

- **Scale:** handles monorepos with 100,000+ source files across C#, C++, Python, and more
- **Two-layer search:** Typesense narrows the haystack to ~50 candidate files in milliseconds; tree-sitter then parses each one for precise AST-level matches
- **Structural queries:** find all callers of a method, implementations of an interface, usages of a type, fields of a given type, classes with a specific attribute — not just text matches
- **Always fresh:** a file watcher incrementally updates the index on every save; a heartbeat process auto-restarts the server if it dies
- **Zero copy-paste:** Claude calls `search_code` or `query_cs` directly and gets back ranked results scoped to the right subsystem

**Tools:** `search_code`, `query_cs`, `service_status`

See [`codesearch/README.md`](codesearch/README.md) for setup and usage.

---

### `d3figurer/` — Publication-quality figures from natural language

D3.js produces the most precise, beautiful data visualizations in the browser — but the API is large and the coordinate math is unforgiving. `d3figurer` pairs Claude's ability to write and iterate on D3 code with a persistent headless Chrome renderer, so the feedback loop is code → render → fix in seconds.

- **AI writes code, not pixels:** Claude generates `figure.js` files that produce clean, editable SVG — not rasterized screenshots. You own the source and can regenerate at any size or format
- **Instant layout QA:** `check_figure` detects overlapping labels, clipped text, and elements spilling outside the canvas so Claude can fix problems before you even open a browser
- **No context bloat:** rendering happens in a separate persistent process; Claude gets a short success/error message, not base64-encoded image data — keeping the conversation clean across many render-edit cycles
- **Production formats:** a single render produces PDF (vector, print-ready), PNG (raster for web/slides), and SVG (editable in Illustrator/Inkscape)
- **Version-controlled figures:** each figure is a small CommonJS module — diff changes, regenerate on CI, share source alongside output
- **18-figure gallery:** real examples from a published AI book covering flow diagrams, timelines, bubble charts, dumbbell charts, area charts, and network diagrams — each a working starting point for Claude to adapt

**Tools:** `render_figure`, `check_figure`, `server_status`

**Live gallery:** [mcroomp.github.io/claudeskills/preview/](https://mcroomp.github.io/claudeskills/preview/)

See [`d3figurer/README.md`](d3figurer/README.md) for setup and usage.

---

## Installation

Each MCP is self-contained and registers itself via a single setup script:

```bat
codesearch\setup_mcp.cmd
d3figurer\setup_mcp.cmd
```

Then restart Claude Code. The tools for each MCP will be available in your session.

## Keywords

MCP server · Claude Code tools · code search · Typesense · tree-sitter · C# AST · monorepo search · D3.js · data visualization · WSL · Windows
