# ch05_gdp_growth — Impacto de la IA en el PIB (2025–2035)

## Purpose (why it's in the book)

Chapter 5 makes the case that AI's economic impact is not evenly distributed: countries that adopt AI early will see dramatically higher GDP growth than those that don't. This creates a global inequality risk — a new digital divide between AI-ready and AI-left-behind economies. The figure turns an abstract geopolitical argument into a concrete comparison: Spain and 12 other countries side by side, with the gap between "Con IA" and "Sin IA" making the stakes visible.

**Book caption:** *Estimación del crecimiento del Producto Interior Bruto (PIB) de diferentes economías mundiales (incluyendo la española), en función de su capacidad para adoptar o no la IA, proyección 2025–2035 (fuentes: IMF "The Global Impact of AI: Mind the Gap" WP/25/76 Abril 2025, PwC AI Impact Study 2025, McKinsey Global Economics 2025).*

**Surrounding text:** "la Inteligencia Artificial tiene el potencial de duplicar las tasas de crecimiento de los 12 países estudiados, entre los que se encuentran EE. UU., Finlandia, Reino Unido, Alemania, Francia y España."

---

## What it shows

A **dumbbell chart** (connected dot plot) showing estimated cumulative GDP growth 2025–2035 for 13 countries:

- **Gray hollow dot**: Baseline growth without AI ("Sin IA")
- **Red filled dot**: Growth with full AI adoption ("Con IA")
- **Connecting line**: Shows the gap — the AI dividend
- Countries sorted by the "Con IA" value (highest benefit at top)
- Spain is highlighted with a slightly different color or label style to make it easy to find

Key insight: countries with strong AI ecosystems (US, UK, Finland) show larger gaps; developing/late-adopter countries show smaller but still significant gaps.

---

## Visual structure

| Element | Details |
|---------|---------|
| Y-axis | Country names (sorted by "Con IA" value) |
| X-axis | Cumulative GDP growth % over 10 years |
| Gray dots | "Sin IA" baseline, hollow circle |
| Red dots | "Con IA" projection, filled red (#e4003b) |
| Connecting lines | Thin gray lines linking the two dots per country |
| Gap labels | Optional: small label showing the delta ("+X.X pp") |
| Spain highlight | Bold label or star marker |

**Canvas:** W=800, H=520

---

## Data (edit the `countries` array at the top of figure.js)

```javascript
const countries = [
  { country: 'EE. UU.',     sinIA: 18, conIA: 26 },
  { country: 'Finlandia',   sinIA: 14, conIA: 22 },
  { country: 'Reino Unido', sinIA: 16, conIA: 23 },
  { country: 'Alemania',    sinIA: 15, conIA: 20 },
  { country: 'Francia',     sinIA: 14, conIA: 19 },
  { country: 'España',      sinIA: 13, conIA: 18, highlight: true },
  // ... 7 more countries
];
```

**Sources:** IMF WP/25/76 (April 2025), PwC AI Impact Study 2025, McKinsey Global Economics 2025

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | `900`, `680` | Canvas size in SVG pixels |
| `MARGIN` | top:`80`, right:`150`, bottom:`90`, left:`165` | Chart margins (px) |
| `ANN_AT_X` | `5` | x-scale domain value where annotation box starts |
| `ANN_OFFSET_Y` | `-40` | y offset (px) above China band for annotation box top |
| `ANN_W` | `280` | Annotation box width (px) |
| `ANN_H` | `54` | Annotation box height (px) |
| `ANN_TEXT_DY` | `[18, 38]` | dy offsets from `annY` for the two annotation text lines |
| `LEG_X` | `innerW - 240` | Legend top-left x within chart group |
| `LEG_Y` | `innerH - 70` | Legend top-left y within chart group |
| `FONT_COUNTRY` | `23` | Country label font size (non-highlighted) |
| `FONT_COUNTRY_HL` | `26` | Country label font size (highlighted) |
| `FONT_VALUE` | `22` | Value label font size (non-highlighted) |
| `FONT_VALUE_HL` | `26` | Value label font size (highlighted) |
| `FONT_TICK` | `22` | x-axis tick label font size |
| `FONT_AXIS_LABEL` | `23` | x-axis title font size |
| `FONT_ANN` | `20` | Annotation and legend text font size |
| `DOT_R` | `8` | Radius of "Con IA" total dot (non-highlighted) |
| `DOT_R_HL` | `11` | Radius of "Con IA" total dot (highlighted) |
| `BASE_DOT_R` | `7` | Radius of "Sin IA" base dot |

---

## How to modify

- **Add/remove countries**: Edit `data` array; chart auto-adjusts row heights
- **Update projections**: Replace `base` and `total` values when new IMF/PwC data is published
- **Highlight a different country**: Set `highlight: true` on any country row
- **Change to bar chart**: Replace dumbbell dots with paired horizontal bars for a less sophisticated audience
- **Add a third scenario**: Add a third dot value for "partial AI adoption" as a third dot color (e.g., orange)
- **Sort differently**: Change the order of entries in `data` to sort by gap size (total - base) to highlight which countries benefit most
- **Move the annotation box**: Change `ANN_AT_X` (x position) and `ANN_OFFSET_Y` (y offset) in the layout block
