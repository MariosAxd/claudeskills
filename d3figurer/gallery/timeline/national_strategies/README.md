# ch04_national_strategies — Estrategias Nacionales de IA (2017–2025)

## Purpose (why it's in the book)

Chapter 4 argues that AI has become a matter of national strategy, not just corporate or academic interest. The book's narrative — written by someone who participated in drafting the EU AI guidelines — traces how the world's governments moved from ignoring AI to racing to regulate and lead it. This figure makes the global scope and acceleration of that race immediately visible: 6 countries in 2017, an explosion to 21 in 2018, then steadily more until almost every major economy has a strategy by 2025. The dashed "IA Generativa" line at 2022 marks the inflection point when strategies shifted from research investment to governance and risk control.

**Book caption:** *Línea temporal de las estrategias nacionales sobre Inteligencia Artificial 2017–2025 (fuentes: OECD Progress Report 2025, World Privacy Forum Global Table of National AI Strategies, CCIA Global Round-Up 2025, Tim Dutton).*

**Surrounding text:** "Cuando empezamos a hablar en serio de estrategias nacionales de IA, allá por 2017, éramos un grupo relativamente pequeño de países convencidos de que esta tecnología iba a ser transformadora. En 2026, prácticamente no existe economía significativa que no haya elaborado la suya..."

**Ported from:** `figures/complex/fig14_national_strategies/generate.py` (Python/svgwrite with SVG flag assets). The D3 version replaces embedded flags with ISO country code badges for portability.

---

## What it shows

A horizontal timeline (2017–2025) with:
- **Year badges** (colored rectangles) at the top, connected by a thin baseline
- **Country cards** stacked below each year — each card shows the ISO country code, country name, and a brief description
- **Color progression**: gray for early years (research era) → red for 2022+ (generative AI era)
- **"IA Generativa →" dashed line** at 2022 marks the turning point when ChatGPT changed the nature of these strategies

---

## Data (edit the `strategies` array at the top of figure.js)

```javascript
{ year: 2017, country: 'Canadá',   code: 'CA', desc: 'Investigación y talento' },
{ year: 2018, country: 'Francia',  code: 'FR', desc: 'IA humanista'            },
// ...49 entries total
```

- `year`: groups the card under the correct year column (2017–2025)
- `country`: displayed name (Spanish, truncated to 10 chars if needed)
- `code`: 2-letter ISO code shown in the colored badge on the card
- `desc`: short description, auto-wrapped to 2 lines (~14 chars each)

**Sources:** OECD Progress Report 2025, World Privacy Forum Global Table of National AI Strategies, CCIA Global Round-Up 2025, Tim Dutton's national AI strategy tracker.

---

## Visual structure

| Element | Details |
|---------|---------|
| Timeline baseline | Thin gray line at y=42, full width |
| Year badges | Colored rectangles with white year label; connected to baseline via dot + short line |
| Country cards | 88×70px cards with colored top accent bar, ISO code badge, country name, 2-line description |
| Colors | Gradient from `#888888` (2017) → `#e4003b` (2024–2025), emphasizing acceleration |
| "IA Generativa" marker | Dashed red vertical line between 2021 and 2022 columns |
| Card layout | Up to 7 cards per column; 2018 (21 countries) uses 3 columns |

**Canvas:** Auto-calculated based on data. With current 49-country dataset: ~1100×620px

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `CARD_W` | `88` | Width of each country card (px) |
| `CARD_H` | `78` | Height of each country card — flag (47px) + desc rows (px) |
| `GAP_X` | `6` | Horizontal gap between cards within a year group (px) |
| `GAP_Y` | `5` | Vertical gap between card rows (px) |
| `MAX_ROWS` | `7` | Maximum cards stacked in a single column |
| `TOP` | `75` | y coordinate where cards start (px) |
| `LEFT` | `20` | x coordinate of the first card column (px) |
| `GRP_GAP` | `14` | Extra horizontal gap between year groups (px) |
| `TIMELINE_Y` | `42` | y of the thin horizontal timeline baseline (px) |
| `GEN_AI_YEAR` | `2022` | Year at which the "IA Generativa →" dashed marker appears |
| `FONT_BADGE` | `13` | Font size for year badge labels |
| `FONT_DESC` | `7.5` | Font size for per-card description text |
| `FONT_MARKER` | `8` | Font size for the "IA Generativa →" annotation |

Note: canvas `W` and `H` are computed automatically from the data and layout constants.

---

## How to modify

- **Add a new country**: Push a new `{ year, country, code, desc }` object to `strategies`; layout recalculates automatically
- **Update descriptions**: Edit `desc` field — auto-wraps at ~14 chars per line
- **Move the generative AI marker**: Change `GEN_AI_YEAR` in the layout block
- **Change year colors**: Edit the `yearColors` object at the top of figure.js
- **Change max cards per column**: Edit `MAX_ROWS` in the layout block
- **Change card size**: Edit `CARD_W` and `CARD_H` in the layout block; spacing adjusts automatically
