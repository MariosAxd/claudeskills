# ch03_transformer — Mecanismo de Atención (Transformer)

## Purpose (why it's in the book)

Chapter 3 explains the Transformer architecture as the technical foundation that made LLMs possible. The book's key insight is the *attention mechanism*: the model learns which words in a sentence are relevant to understanding each other word, regardless of distance. This figure makes that abstract concept concrete using the book's own example sentence: "El gato perseguía al ratón porque tenía hambre" — showing visually that "tenía hambre" connects back to "gato" (not "ratón"), which is exactly what the Transformer's attention learns.

**Book caption:** *Arquitectura Transformer: el mecanismo de atención permite al modelo identificar qué palabras son relevantes para comprender cada término, independientemente de su posición en el texto.*

**Surrounding text:** "Imaginemos que leemos la frase: 'El gato perseguía al ratón porque tenía hambre'. ¿Quién tenía hambre? Para comprenderlo necesitamos relacionar 'tenía hambre' con 'el gato', palabras separadas por varias posiciones. El mecanismo de atención hace precisamente eso."

---

## What it shows

The attention mechanism visualized using the sentence *"El gato perseguía al ratón porque tenía hambre"*:

1. **Word tokens** — each word shown as a labeled box in a horizontal row
2. **Attention arcs** — curved lines connecting words, with thickness/opacity proportional to attention weight
3. **Focus word highlight** — one word highlighted in red (e.g., "hambre") with its strongest attention connections drawn prominently
4. **Attention weight legend** — a small gradient bar showing low → high attention

The figure shows that "tenía" and "hambre" attend strongly to "gato", not "ratón" — demonstrating long-range dependency resolution.

---

## Visual structure

| Element | Details |
|---------|---------|
| Word boxes | Rectangles, evenly spaced, labeled with each token |
| Attention arcs | Bézier curves above/below the word row, opacity = attention strength |
| Focus word | Red (#e4003b) background on the query word |
| Strong connections | Thicker, darker red arcs for high-attention pairs |
| Weak connections | Thin, light gray arcs for low-attention pairs |
| Label | "Mecanismo de Atención" title at top |

**Canvas:** W=900, H=420

---

## Data (the sentence and attention weights)

The attention weights are **illustrative** — designed to demonstrate the concept, not actual model output:

```javascript
const sentence = ['El', 'gato', 'perseguía', 'al', 'ratón', 'porque', 'tenía', 'hambre'];
const focusWord = 6; // index of 'tenía'
// attention[i][j] = how much word i attends to word j
```

---

## How to modify

- **Change the sentence**: Edit the `sentence` array — layout auto-adjusts
- **Change focus word**: Edit `focusWord` index to highlight a different word
- **Change attention weights**: Edit the attention matrix to show different connections
- **Show multiple heads**: Add 2–3 rows of arcs in different colors to illustrate multi-head attention
- **Add encoder/decoder boxes**: Wrap the token row in a larger box labeled "Codificador" to show full Transformer structure

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 920, 580 | Canvas size in SVG pixels |
| `WY` | 310 | Y centre of the word token row |
| `wordBoxH` | 56 | Height of each word token box |
| `lx`, `ly` | 580, 448 | Legend top-left position |
| `ANN_X`, `ANN_Y` | 44, `WY-210` (100) | "Alta atención" annotation box top-left |
| `ANN_W`, `ANN_H` | 192, 54 | Annotation box width and height |
| `IN_X`, `IN_Y` | 30, `WY+12` (322) | "IN" edge label position |
| `OUT_X`, `OUT_Y` | 895, `WY+12` (322) | "OUT" edge label position |
| `FONT_WORD` | 28 | Word token labels inside boxes |
| `FONT_ANNOTATION` | 22 | Annotation box text |
| `FONT_SUBTITLE` | 20 | Bottom note and annotation italic sub-line |
| `FONT_LEGEND` | 20 | Legend text labels |
| `FONT_IN_OUT` | 20 | IN / OUT edge labels |
