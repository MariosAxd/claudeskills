# d3figurer gallery

18 sample D3.js figures from an AI book. Use these to try out d3figurer, as reference implementations when writing new figures, or as starting points to adapt.

All figures are in Spanish (the book's language). Labels and titles are part of the design; the underlying chart patterns are universally reusable.

## Quick start

```bash
# Start the render server pointing at this directory
./server.sh start --src-dir /path/to/d3figurer/gallery

# Render a figure — use the category/name form
# then in Claude: render_figure(name="diagram/transformer", output_path="/tmp/transformer.pdf")

# Render all figures and build the preview gallery (writes gallery/output/ and gallery/preview/)
node bin/d3figurer.js batch gallery --src-dir gallery --format png
# Open gallery/preview/index.html in a browser to browse all figures
```

Generated output (checked in):
- `output/`  — flat PNG/PDF/SVG files, one per figure (`diagram_transformer.png`, …)
- `preview/` — `index.html` gallery grid + one `<name>.html` per figure; SVGs rendered live from source

The `shared/` subdirectory contains helper utilities. It is automatically skipped by the server's figure discovery — only directories with a `figure.js` are loaded.

## Figures

Figures are grouped into three categories. The `name` to pass to `render_figure` or `check_figure` is `category/figure` (e.g. `diagram/perceptron`).

---

### diagram/

Node diagrams, flow charts, and architecture illustrations.

| Name | Title | Description |
|------|-------|-------------|
| `diagram/turing_test` | La Prueba de Turing | Three-party Turing test: Computer A and Human B both send anonymous messages to an evaluator (C) who must guess which is which. |
| `diagram/perceptron` | El Perceptrón de Rosenblatt | Single artificial neuron: four weighted inputs → summation node (Σ) → activation function (φ) → binary output. Edges colour-coded by weight magnitude. |
| `diagram/xor_gate` | XOR y la No-Linealidad | Two panels: truth table (left) and scatter plot with three failed linear separators marked ✗ (right) — why a single-layer perceptron cannot solve XOR. |
| `diagram/topdown_bottomup` | Top-Down vs Bottom-Up | Side-by-side cards contrasting symbolic/logic AI (top-down, grey) with connectionist/statistical AI (bottom-up, red). |
| `diagram/mlp` | Red Neuronal Multicapa | Multi-layer perceptron (4→4→1 nodes). Blue arrows show the forward pass; red dashed arrows show backpropagation. |
| `diagram/deep_nn` | Red Neuronal Profunda | Six-layer deep network for face recognition (6→5→4→4→3→1 nodes), illustrating how each layer learns increasingly abstract representations. |
| `diagram/transformer` | Mecanismo de Atención | Attention weights visualised as curved arcs over a Spanish sentence. Arc thickness and opacity are proportional to attention scores. |
| `diagram/workflow` | Pipeline de un LLM | Five-step LLM processing pipeline: Tokenización → Embeddings → Atención → FFN → Generación. |
| `diagram/agent` | Arquitectura de un Agente IA | ReAct agent loop: central LLM node surrounded by four capability boxes (Perception, Planning, Memory, Tools) with circular arrows. |

---

### timeline/

Horizontal timelines and event sequences.

| Name | Title | Description |
|------|-------|-------------|
| `timeline/ai_timeline` | Cronología de la IA (1950–2024) | 70-year history of AI showing the pendulum between symbolic (blue) and neural (orange) approaches, with 10 milestone events over a stacked area chart. |
| `timeline/llm_timeline` | Cronología de los LLMs (2017–2024) | Nine key milestones from Transformer (2017) to multimodal models (2024). Labels alternate above/below the axis; ChatGPT highlighted with a larger dot. |
| `timeline/national_strategies` | Estrategias Nacionales de IA (2017–2025) | 49 national AI strategies plotted on a horizontal timeline, stacked as country cards under each year. Dashed red line at 2022 marks the generative AI inflection. |

---

### chart/

Bar charts, line charts, area charts, bubble charts, and dumbbell charts.

| Name | Title | Description |
|------|-------|-------------|
| `chart/parameters` | Escala de los LLMs | Three circles for GPT-1 (117M), GPT-2 (1.5B), GPT-3 (175B) with area proportional to parameter count. Growth multipliers annotated between circles. |
| `chart/adoption` | La Adopción Más Rápida | Months to reach 100M users for six platforms. ChatGPT's bar (2 months) is dramatically shorter and red; all others grey. |
| `chart/moores_law` | Ley de Moore: CPUs vs GPUs | CPU (blue) vs GPU (red) transistor counts from 2000–2024. The GPU line's near-vertical climb explains why deep learning became practical post-2012. |
| `chart/industrial` | Las Cuatro Revoluciones Industriales | Four ascending panels representing the industrial revolutions (steam, electricity, computing, AI). The fourth panel is red. |
| `chart/ai_market` | Mercado Global de IA (2016–2031) | AI market growth from $1.4B (2016) to a projected $242B (2031). The projected portion (2026–2031) is dashed. |
| `chart/gdp_growth` | Impacto de la IA en el PIB (2025–2035) | Estimated cumulative GDP growth for 13 countries, with a grey hollow dot (without AI) and red filled dot (with AI) connected by a dumbbell line. |

---

## Shared utilities (`shared/`)

All figures import from `../../shared/`:

**`helpers.js`**
- `makeSVG(W, H)` — creates a JSDOM document + D3 SVG element sized to W×H; returns `{ svg, document }`. Every figure calls this first.
- `addMarker(defs, id, color, dir, size)` — appends an SVG arrowhead marker to `defs`. `dir` is `'forward'` or `'backward'`.
- `addText(parent, x, y, text, size, weight, fill, anchor, italic)` — convenience wrapper for `svg.append('text')` with all common attributes set in one call.
- `addIcon(parent, pathData, cx, cy, size, fill, opacity)` — places a Material Design icon path scaled and centred at `(cx, cy)`.

**`styles.js`**
- Colour palette: `S.RED` (#e4003b), `S.RED_LIGHT`, `S.RED_DARK`, `S.GRAY_LIGHT`, `S.GRAY_MID`, `S.GRAY_DARK`, `S.TEXT`, `S.WHITE`, `S.BLACK`
- Typography: `S.FONT` (Montserrat family string for `font-family`)
- Standard widths: `S.PNG_W` (1600), `S.PDF_W` (900)
- `S.fontStyle(svgNode)` — appends a `<defs><style>` block importing Montserrat from Google Fonts (requires network access during render)

## Writing your own figure

Copy any existing figure directory as a starting point. The minimal structure:

```
gallery/
└── diagram/          ← or timeline/ or chart/
    └── my_figure/
        ├── figure.js   ← required: exports a function returning SVG HTML
        └── data.json   ← optional: loaded via require('./data.json')
```

```javascript
// figure.js
'use strict';
const { makeSVG } = require('../../shared/helpers');
const d3 = require('d3');
const S  = require('../../shared/styles');

module.exports = function () {
  const W = 900, H = 600;
  const { svg, document } = makeSVG(W, H);

  svg.append('text')
    .attr('x', W / 2).attr('y', H / 2)
    .attr('text-anchor', 'middle')
    .attr('font-size', 32)
    .attr('fill', S.RED)
    .text('Hello, d3figurer');

  return document.body.innerHTML;
};
```

The root `<svg>` must have `width="N" height="N"` — `makeSVG` sets these automatically.
