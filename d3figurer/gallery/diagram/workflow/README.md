# ch03_workflow — Pipeline de Procesamiento de un LLM

## Purpose (why it's in the book)

Chapter 3 explains not just the high-level concept of the Transformer but also how it actually processes text, step by step. This figure appears immediately after the attention mechanism figure to give the reader a complete mental model: from raw text input all the way to the generated word output. Without this, readers might understand attention but not how it fits into the full pipeline. The figure demystifies what happens "inside" ChatGPT when you type a message.

**Book caption:** *Flujo completo de procesamiento en un Transformer: desde el procesamiento de entrada, pasando por el codificador, los mecanismos de atención (auto-atención y multi-cabeza), la red neuronal feedforward, hasta el decodificador que genera la respuesta final palabra por palabra.*

---

## What it shows

The 5-step processing pipeline of a Large Language Model, from raw text to final output:

| Step | Label | What happens |
|------|-------|-------------|
| 1 | Tokenización | Text split into tokens (subwords) |
| 2 | Embeddings | Tokens converted to numerical vectors |
| 3 | Atención | Multi-head self-attention computes relationships |
| 4 | FFN | Feed-forward network processes each position |
| 5 | Generación | Decoder produces next token, word by word |

Each step shown as a distinct colored box in a **horizontal flow** with labeled arrows between them.

---

## Visual structure

| Element | Details |
|---------|---------|
| 5 step boxes | Rectangles, evenly spaced, each with step number + label |
| Arrows | Thick red arrows between steps |
| Step icons | Small icon or mini-diagram inside each box to aid comprehension |
| Input/output | "Texto entrada" on left, "Texto generado" on right, outside the pipeline |
| Box colors | Gradient from light gray to red as steps progress |

**Canvas:** W=1000, H=320

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 540 | Canvas size in SVG pixels |
| `BW` | 185 | Box width (sized to fit longest title at font 20) |
| `BH` | 260 | Box height |
| `RX` | 12 | Box corner radius |
| `GAP` | 11 | Horizontal gap between boxes |
| `BADGE_R` | 16 | Step number badge circle radius |
| `BADGE_OFFSET_X` | 22 | Badge centre offset from box right edge |
| `BADGE_OFFSET_Y` | 22 | Badge centre offset from box top edge |
| `ICON_OFFSET_Y` | 80 | Icon y offset from box top |
| `TITLE_OFFSET_Y` | 130 | Title y offset from box top |
| `DESC_OFFSET_Y` | 175 | First description line y offset from box top |
| `DESC_LINE_SPACING` | 28 | Vertical spacing between description lines |
| `FONT_BADGE` | 22 | Step number badge font size |
| `FONT_ICON` | 22 | Icon font size |
| `FONT_TITLE` | 20 | Box title font size |
| `FONT_DESC` | 16 | Description line font size |

---

## How to modify

- **Add/remove steps**: Edit the `steps` array — layout auto-spaces based on count
- **Change step descriptions**: Edit `label` and `sub` in the steps array
- **Add example text**: Add a small annotation above step 1 showing tokenization example (e.g., "Chat" → "Chat|GPT" → ["Chat", "G", "PT"])
- **Expand a step**: Make one box taller with a mini-diagram inside (e.g., show the attention matrix inside step 3)
- **Show training vs inference**: Add a second row of boxes showing the training direction (with backprop arrows going right to left)
