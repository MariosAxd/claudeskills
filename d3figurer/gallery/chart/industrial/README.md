# ch04_industrial — Las Cuatro Revoluciones Industriales

## Purpose (why it's in the book)

Chapter 4 contextualizes AI as part of the Fourth Industrial Revolution — not just a new technology, but a civilizational shift comparable to steam power, electricity, and computing. This figure places AI in that long historical arc, making the scale of the transformation legible. The book argues this framing is important for policymakers and the public: understanding AI as a foundational infrastructure shift, not a product or feature.

**Book caption:** *Las cuatro revoluciones industriales desde el siglo XVIII.*

**Surrounding text:** "...la IA ha pasado de ser una herramienta especializada a convertirse en una tecnología de propósito general comparable a la electricidad o internet, transformando todos los sectores simultáneamente y reconfigurando el mercado laboral global."

---

## What it shows

Four industrial revolutions as **ascending staircase panels**, each higher than the previous, visually encoding productive capacity growth:

| Revolution | Period | Key technology | Driver |
|-----------|--------|----------------|--------|
| 1.ª | ~1760–1840 | Vapor y mecanización | Carbón, hierro, telar mecánico |
| 2.ª | ~1870–1914 | Electricidad y producción en masa | Motor eléctrico, cadena de montaje |
| 3.ª | ~1960–2000 | Informática y automatización | Ordenadores, internet, robótica |
| 4.ª | 2010–hoy | IA y datos | Deep learning, LLMs, robótica avanzada |

The 4th revolution panel is larger and in red (#e4003b) to indicate it is current and ongoing. An upward arrow on the last panel suggests it continues beyond the chart.

---

## Visual structure

| Element | Details |
|---------|---------|
| 4 staircase panels | Rising from left to right, each taller than the last |
| Panel labels | Revolution number + decade range + key technology |
| Icon or symbol | Small icon in each panel (e.g., steam cog, lightning bolt, circuit, brain) |
| Colors | Gray for 1–3, red for 4th (ongoing) |
| Upward arrow | On rightmost panel indicating continuation |
| X-axis | Time arrow at bottom labeled with centuries |

**Canvas:** W=1000, H=480

---

## How to modify

- **Update 4th revolution description**: Edit the label and sub-text in the 4th panel to include latest AI developments (e.g., AGI debates, AI Act)
- **Add a 5th step**: Add a speculative "5.ª Revolución" panel beyond current — useful if the book discusses AGI futures
- **Change icons**: Replace current SVG icon paths with different symbols per revolution
- **Add GDP growth annotations**: Small labels on each step showing approximate GDP per capita at the time of each revolution
- **Change color scheme**: All 4 panels can be given a gradient from gray → red to show progression toward the present

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 580 | Canvas size in SVG pixels |
| `PW` | 222 | Panel width |
| `GAP` | 10 | Gap between panels |
| `baseH` | [290, 335, 380, 440] | Panel heights for revolutions 1–4 |
| `startX` | computed | Leftmost panel x — centred automatically from W, PW, GAP |
| `FONT_NUM` | 38 | Revolution number font size inside badge |
| `FONT_ERA` | 20 | Era date-range label font size |
| `FONT_TITLE` | 24 | Revolution title font size |
| `FONT_DRIVER` | 22 | Key technology driver font size |
| `FONT_TECH` | 20 | Individual tech items font size |
| `FONT_ARROW` | 30 | Connector arrow between panels font size |
| `FONT_NOW` | 22 | "Actualidad" label font size |
| `BADGE_R` | 28 | Radius of the revolution-number circle badge |
| `Y_NUM` | 36 | Revolution number badge centre y (within panel) |
| `Y_ERA` | 80 | Era label centre y (within panel) |
| `Y_TITLE` | 115 | Title centre y (within panel) |
| `Y_DRIVER` | 148 | Driver centre y (within panel) |
| `Y_DIVIDER` | 168 | Divider line y (within panel) |
| `Y_TECH_START` | 196 | First tech item centre y (within panel) |
| `Y_TECH_SPACING` | 28 | Vertical spacing between tech items |
