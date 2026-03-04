# ch02_ai_timeline — Cronología de la IA (1950–2024)

## Purpose (why it's in the book)

Chapter 2 tells the full history of AI as a pendulum between two philosophical approaches: **top-down** (symbolic/logic-based AI, blue) and **bottom-up** (neural networks/connectionism, orange). The book argues this oscillation explains both the AI winters and the current deep learning boom. This figure is the visual summary of that entire chapter — placed near the end after the reader has followed the full narrative. It lets the reader see the entire 70-year arc at once and understand where we are today.

**Book caption:** *Cronología de la Inteligencia Artificial. Puede observarse la alternancia en la prevalencia de los modelos simbólico-lógicos (en azul) y los modelos bottom-up (en naranja).*

**Surrounding text:** "...los modelos llamados de deep learning, son los tres factores que han confluido para instalar hoy día a la Inteligencia Artificial en una 'primavera perpetua'..."

---

## What it shows

A single integrated figure with two aligned layers:

1. **Top zone (event labels)**: 10 major milestones from the book's history, staggered at 3 height levels to avoid overlap
2. **Timeline bar**: Horizontal axis with right-arrow tip; red event dots with dotted white vertical guide lines dropping into the area below
3. **Stacked area chart**: Shows the proportion of top-down (blue, `#85C1E9`) vs bottom-up (orange, `#F39C12`) research dominance over time, with era labels inside each colored band

---

## Data (edit these JSON arrays at the top of figure.js)

### `events` — milestone labels above the timeline
```javascript
{ year: 1950, lv: 3, title: 'Prueba de Turing',           sub: 'Alan Turing'        }
{ year: 1956, lv: 1, title: 'Conf. Dartmouth',            sub: 'Nace la IA'         }
{ year: 1958, lv: 2, title: 'Perceptrón',                 sub: 'Rosenblatt'         }
{ year: 1969, lv: 3, title: 'Límites Perceptrón',         sub: 'Minsky & Papert'    }
{ year: 1986, lv: 1, title: 'Retropropagación',           sub: 'Rumelhart & Hinton' }
{ year: 1997, lv: 2, title: 'Deep Blue',                  sub: 'IBM'                }
{ year: 2012, lv: 3, title: 'AlexNet',                    sub: 'Deep Learning'      }
{ year: 2017, lv: 1, title: 'Transformer',                sub: 'Vaswani et al.'     }
{ year: 2022, lv: 2, title: 'ChatGPT',                    sub: 'OpenAI'             }
{ year: 2024, lv: 3, title: 'Era de LLMs',                sub: ''                   }
```
- `lv` controls vertical height: 1 = closest to timeline (y≈200), 2 = mid (y≈145), 3 = highest (y≈88)
- Add/remove rows to change which events appear

### `areaData` — the proportion curve (bottom-up %)
```javascript
{ year: 1945, bu: 5 }   // td = 100 - bu is computed automatically
{ year: 1950, bu: 25 }
...
{ year: 2024, bu: 98 }
```
- `bu` = bottom-up (orange) percentage; top-down fills the rest
- Values are **illustrative estimates**, not hard measurements
- Adjust to change the shape of the wavy division between blue and orange

### `areaLabels` — era labels inside the colored bands
```javascript
{ year: 1960, color: 'blue',   label: '1.ª Época Dorada',  sub: '1956–1973' }
{ year: 1977, color: 'blue',   label: '1.er Invierno',     sub: '1974–1979' }
{ year: 1983, color: 'blue',   label: '2.ª Época Dorada',  sub: 'Sist. Expertos' }
{ year: 1993, color: 'blue',   label: '2.º Invierno',      sub: '1987–1993' }
{ year: 2004, color: 'orange', label: 'Conexionismo',      sub: 'Bottom-up' }
{ year: 2014, color: 'orange', label: 'Deep Learning',     sub: '2012–2021' }
{ year: 2020, color: 'orange', label: 'Era LLMs',          sub: '2022–hoy' }
```
- `color: 'blue'` → label positioned in the upper (blue/top-down) band
- `color: 'orange'` → label positioned in the lower (orange/bottom-up) band
- `year` controls horizontal position; y is **auto-calculated** via `getBuAt(year)` so labels stay centred in their band

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1100, 700 | Canvas size in SVG pixels |
| `X_LEFT` | 65 | x coordinate of leftmost chart edge (xScale range start) |
| `X_RIGHT` | 1075 | x coordinate of rightmost chart edge (xScale range end) |
| `AREA_TOP` | 280 | y of top edge of stacked area chart |
| `AREA_BOT` | 620 | y of bottom edge of stacked area chart |
| `TIMELINE_Y` | 280 | y of the horizontal timeline bar |
| `LEVEL_Y` | {1:238, 2:172, 3:100} | y centre for each event label level (1=closest, 3=highest) |
| `LEGEND_X` | 65 | x left edge of the legend row |
| `LEGEND_Y` | 652 | y of the legend row |
| `FONT_EVENT_TITLE` | 18 | Font size for event title labels above the timeline |
| `FONT_EVENT_SUB` | 16 | Font size for event subtitle (attribution) labels |
| `FONT_AREA_LABEL` | 14 | Font size for era labels inside the area bands |
| `FONT_AREA_SUB` | 12 | Font size for era sublabels inside the area bands |
| `FONT_AXIS` | 18 | Font size for x-axis year tick labels |
| `FONT_BAND_VERT` | 17 | Font size for rotated band paradigm labels (left margin) |
| `FONT_LEGEND` | 16 | Font size for legend text |

## Technical details

### Shared x-scale
```javascript
const xScale = d3.scaleLinear().domain([1945, 2028]).range([65, 1075]);
```
Both event labels and area chart use this scale — they are perfectly aligned.

### Auto-positioning era labels (`getBuAt`)
```javascript
function getBuAt(year) {
  // linear interpolation in areaData to find bu% at any year
  // returns the bu value, used to compute vertical midpoint of each band
}
```
Labels in blue band: y = midpoint between top of chart and the dividing line
Labels in orange band: y = midpoint between dividing line and bottom of chart

### Canvas
- W=1100, H=580
- Timeline at y=240
- Area chart: y=240 (top) to y=510 (bottom)
- Event levels: lv1=y200, lv2=y145, lv3=y88
