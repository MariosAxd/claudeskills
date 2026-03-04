# ch03_parameters — Escala de los LLMs (Parámetros GPT)

## Purpose (why it's in the book)

Chapter 3 argues that *scale* was a key driver of the LLM revolution: simply making models bigger (more parameters, more training data, more compute) consistently produced qualitative improvements in capability. This figure makes that exponential growth visceral — GPT-3 has 1,495× more parameters than GPT-1, achieved in just 2 years. Readers who cannot intuitively grasp "175 billion" can see it as a circle 38× the area of GPT-1's circle.

**Book caption:** *Evolución exponencial del número de parámetros en modelos GPT (2018–2020): de 117 millones en GPT-1 a 175.000 millones en GPT-3, con un crecimiento de 1.495 veces en solo 2 años.*

**Surrounding text:** "El salto a GPT-4, lanzado en marzo de 2023, fue aún más impresionante. Era un modelo multimodal, es decir, además de texto, podía procesar imágenes. Superó con nota exámenes de nivel universitario..."

---

## What it shows

Three GPT generations as a **bubble chart** where circle *area* is proportional to parameter count:

| Model | Year | Parameters | Relative size |
|-------|------|-----------|---------------|
| GPT-1 | 2018 | 117M | Small circle |
| GPT-2 | 2019 | 1,500M (1.5B) | Medium circle |
| GPT-3 | 2020 | 175,000M (175B) | Giant circle |

Each bubble labeled with model name, year, and parameter count. Growth factor annotated (×13 GPT-1→GPT-2, ×117 GPT-2→GPT-3, ×1495 total).

---

## Visual structure

| Element | Details |
|---------|---------|
| 3 circles | Left to right, radii scaled so area ∝ parameters |
| Circle labels | Model name, year, parameter count (formatted: "117M", "1.5B", "175B") |
| Growth arrows | Connecting arrows with ×N multiplier labels |
| Color | GPT-1 light gray → GPT-2 medium red → GPT-3 deep red (#e4003b) |
| X-axis | Year axis (2018–2020) |

**Canvas:** W=900, H=500

---

## Data (edit the `models` array at the top of figure.js)

```javascript
const models = [
  { year: 2018, name: 'GPT-1', params: 117e6,   label: '117M'  },
  { year: 2019, name: 'GPT-2', params: 1500e6,  label: '1.5B'  },
  { year: 2020, name: 'GPT-3', params: 175000e6, label: '175B' },
];
```

---

## How to modify

- **Add GPT-4**: Add `{ year: 2023, name: 'GPT-4', params: 1800000e6, label: '~1.8T' }` (estimated)
- **Add other models**: Add LLaMA, Claude, Gemini with their parameter counts for comparison
- **Change scale**: Circle radius uses `Math.sqrt(params)` — do not use params directly (would make GPT-3 impossibly large)
- **Switch to log axis**: Replace the bubble chart with a connected dot plot on a log y-axis to show all models including GPT-4

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 900, 640 | Canvas size in SVG pixels |
| `MODEL_POS` | `[{cx:150,cy:510}, {cx:430,cy:440}, {cx:720,cy:200}]` | GPT-1, GPT-2, GPT-3 circle centre coordinates |
| `maxR` | 200 | Maximum bubble radius (applied to GPT-3) |
| `arrowY1` | 498 | Y position of the GPT-1 → GPT-2 growth annotation arrow |
| `arrowY2` | 398 | Y position of the GPT-2 → GPT-3 growth annotation arrow |
| `ANN_X`, `ANN_Y` | 20, 20 | Annotation box top-left corner |
| `ANN_W`, `ANN_H` | 500, 96 | Annotation box width and height |
| `ANN_Y1` | 52 | Y of annotation main label text line |
| `ANN_Y2` | 76 | Y of annotation sub-label text line |
| `ANN_Y3` | 98 | Y of annotation note text line (italic) |
| `LABEL_DX` | 16 | X gap from circle edge to outside label block |
| `LABEL_DY` | `[-14, 8, 30]` | Y offsets for outside label lines: name, count, unit |
| `FONT_YEAR` | 26 | Year tick labels on x-axis |
| `FONT_INSIDE_NAME` | 38 | Model name inside large circles |
| `FONT_INSIDE_COUNT` | 42 | Parameter count inside large circles |
| `FONT_INSIDE_UNIT` | 22 | "parámetros" unit label inside large circles |
| `FONT_OUTSIDE` | 28 | Model name and count outside small circles |
| `FONT_OUTSIDE_UNIT` | 21 | "parámetros" unit label outside small circles |
| `FONT_ANN_MAIN` | 28 | Annotation box main label |
| `FONT_ANN_SUB` | 22 | Annotation box sub-label |
| `FONT_ANN_NOTE` | 19 | Annotation box note (italic) |
| `FONT_BADGE` | 28 | Growth badge labels (×13, ×117) |
