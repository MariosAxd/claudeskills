# ch05_ai_market — Mercado Global de IA (2016–2031)

## Purpose (why it's in the book)

Chapter 5 opens its economic analysis by establishing the scale of AI's market impact. Before discussing job displacement, GDP effects, and societal challenges, the book anchors the reader with hard numbers: the AI market grew from $1.4B in 2016 to an estimated $242B by 2031. This figure makes the trajectory clear — not linear growth, but an accelerating curve that frames why the economic disruptions discussed in the rest of the chapter are real and urgent.

**Book caption:** *Estimación del tamaño del Mercado global de la Inteligencia Artificial 2016–2031 en millones de dólares americanos (fuentes: Statista Market Outlook 2025, IDC AI Spending Forecast, Gartner 2025). Datos históricos 2016–2023, actuales 2024–2025, proyecciones 2026–2031.*

**Surrounding text:** "Norteamérica y China experimentarán los mayores beneficios, dada la concentración de la investigación, la innovación y el desarrollo de la Inteligencia Artificial en estas regiones."

---

## What it shows

The global AI market size from 2016 to 2031, combining three data phases:

| Phase | Years | Visual treatment |
|-------|-------|----------------|
| Historical | 2016–2023 | Solid red area chart |
| Current | 2024–2025 | Solid area, slightly different shade |
| Projected | 2026–2031 | Dashed outline only (uncertainty) |

Key data points labeled: $1.4B (2016), ~$100B (2023), ~$184B (2025), ~$242B (2031, projected).

---

## Visual structure

| Element | Details |
|---------|---------|
| Area chart | Red (#e4003b) fill for historical, lighter pink for projected |
| Dashed boundary | Dashed line at the historical/projected transition |
| Year axis | x-axis with ticks at key years |
| Value axis | y-axis in billions USD |
| Data labels | Key values annotated at important inflection points |
| Legend | "Datos históricos / Actuales / Proyección" |

**Canvas:** W=900, H=460

---

## Data (edit the `marketData` array at the top of figure.js)

```javascript
const marketData = [
  { year: 2016, value: 1.4,   type: 'historical' },
  { year: 2017, value: 2.4,   type: 'historical' },
  // ...
  { year: 2023, value: 100,   type: 'historical' },
  { year: 2024, value: 142,   type: 'current'    },
  { year: 2025, value: 184,   type: 'current'    },
  { year: 2026, value: 210,   type: 'projected'  },
  // ...
  { year: 2031, value: 242,   type: 'projected'  },
];
```

**Sources:** Statista Market Outlook 2025, IDC AI Spending Forecast, Gartner 2025

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | `1000`, `700` | Canvas size in SVG pixels |
| `MARGIN` | top:`100`, right:`80`, bottom:`100`, left:`130` | Chart margins (px) |
| `ANN_W` | `310` | Annotation box width (px) |
| `ANN_CX` | `innerW - 155` | Annotation box centre x within chart group |
| `ANN_Y` | `34` | Annotation box top y within chart group (px) |
| `ANN_H` | `96` | Annotation box height (px) |
| `ANN_Y1` | `74` | y of "×175" main text line within chart group (px) |
| `ANN_Y2` | `100` | y of subtitle text line within chart group (px) |
| `ANN_Y3` | `120` | y of source note text line within chart group (px) |
| `FONT_AXIS` | `22` | Axis tick label font size |
| `FONT_CALLOUT` | `24` | Callout value label font size |
| `FONT_ANN_MAIN` | `48` | Annotation "×175" font size |
| `FONT_ANN_SUB` | `20` | Annotation subtitle font size |
| `FONT_ANN_NOTE` | `18` | Annotation source note font size |
| `FONT_AXIS_LABEL` | `22` | y-axis title font size |
| `FONT_LEGEND` | `20` | Legend text font size |
| `LEG_X` | `MARGIN.left` | Legend left x in SVG coordinates |
| `LEG_Y` | `H - 32` | Legend baseline y in SVG coordinates |
| `DIV_X_YEAR` | `2025.5` | x-domain value where the projection dashed divider line appears |

---

## How to modify

- **Update to new data**: Replace values in `allData`; chart auto-scales
- **Change projection end year**: Extend the `proj: true` entries beyond 2031
- **Add a second line**: Add a second `series` (e.g., "Generative AI only") as a separate line on the same chart
- **Add recession/event annotations**: Add vertical dashed lines at notable years (e.g., 2022 ChatGPT launch)
- **Show regional breakdown**: Change to a stacked area with regions (US, China, EU, Rest) as separate colors
- **Move the projection divider**: Change `DIV_X_YEAR` in the layout block
