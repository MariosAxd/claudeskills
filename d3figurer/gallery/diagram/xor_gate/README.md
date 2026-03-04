# ch02_xor_gate — XOR y la No-Linealidad

## Purpose (why it's in the book)

This figure explains the famous crisis that ended the first AI spring and triggered the first AI winter: Minsky and Papert's 1969 proof that a single-layer perceptron cannot solve the XOR problem. This was a devastating blow to early neural network research. The figure makes the mathematical concept of *linear separability* immediately intuitive — the reader can see with their own eyes why a straight line cannot separate the XOR outputs, without needing to understand the algebra.

**Book caption:** *Representación de XOR (fuente: Wikipedia).*

**Surrounding text:** "XOR devuelve un 1 cuando tiene un número impar de valores de entrada que valen 1 [...] Pese a su sencillez, XOR no es linealmente separable: si representamos los valores (0,0) (1,1) (0,1) y (1,0) en un gráfico, es imposible separar con una recta el (0,0) (1,1) del (0,1) (1,0)... Para poder representar XOR, o cualquier otra función no linealmente separable, se necesitan modelos más complejos que un simple perceptrón."

---

## What it shows

Two side-by-side panels:

**Left panel — Truth Table:**
- XOR truth table: 4 rows × 3 columns (Entrada A, Entrada B, XOR result)
- XOR output column uses colored circles: red = 1, gray = 0

**Right panel — Scatter plot (not linearly separable):**
- 4 points on a 2D grid: (0,0)=0, (0,1)=1, (1,0)=1, (1,1)=0
- Three dashed "failed" separator lines, each with a red ✗ mark
- No straight line can separate the two red (output=1) points from the two gray (output=0) points
- This is why a single-layer perceptron cannot learn XOR

---

## Visual structure

| Element | Details |
|---------|---------|
| Two panels | Left (x=20, w=340) and right (x=420, w=380), both y=20, h=420 |
| Points | Circles (r=22): output=1 in red, output=0 in gray |
| Failed lines | Three dashed gray lines showing all separation attempts fail |
| Red ✗ marks | At endpoints of failed lines |
| Axes | Origin at (480, 358), x-axis to 780, y-axis to 114 |
| Legend | Gray circle = 0 (no), red circle = 1 (sí) at y=444 |

**Canvas:** W=820, H=490

---

## How to modify

- **Change gate type**: Replace the point output values (`isOne`) in `POINTS` and truth table data in `ROWS`
- **Show the solution to XOR**: Add a third panel showing a 2-layer network decision boundary (curved)
- **Add a failure annotation**: The ✗ marks are already in `X_MARKS` — adjust positions there
- **Animate**: Use D3 transitions to move the decision line showing it can never separate XOR

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 820, 490 | Canvas size in SVG pixels |
| `LEFT_X`, `LEFT_Y` | 20, 20 | Top-left corner of left panel rect |
| `LEFT_W`, `LEFT_H` | 340, 420 | Size of left panel |
| `LEFT_RX` | 12 | Corner radius of left panel |
| `LEFT_CX` | derived (190) | Centre x of left panel — derived from `LEFT_X + LEFT_W / 2` |
| `PANEL_TITLE_Y` | 58 | y of panel title labels |
| `PANEL_TITLE_FONT` | 24 | Font size of panel titles |
| `TABLE_HEADER_Y` | 86 | y of table column headers |
| `TABLE_HEADER_FONT` | 16 | Font size of table column headers |
| `COL_A_X`, `COL_B_X`, `COL_XOR_X` | 130, 220, 310 | x centres of the three table columns |
| `TABLE_DIVIDER_Y` | 102 | y of the horizontal divider below the header |
| `TABLE_DIVIDER_X1`, `TABLE_DIVIDER_X2` | 48, 352 | Left/right x of all horizontal dividers |
| `ROW_FONT` | 28 | Font size of data values in table rows |
| `XOR_CIRCLE_R` | 16 | Radius of the XOR result circles |
| `ROWS` | array of 4 | Row data: `a`, `b`, `xor` values; `ty` (text y), `cy` (circle cy), `isOne` |
| `VERT_DIV_Y1`, `VERT_DIV_Y2` | 74, 400 | y1/y2 of vertical column dividers |
| `VERT_DIV_XS` | [162, 256, 344] | x positions of the three vertical column dividers |
| `HORIZ_DIV_YS` | [183, 256, 328] | y positions of three row-separator lines |
| `LEGEND_Y` | 444 | y of legend circles/text at the bottom of the panel |
| `LEGEND_R` | 10 | Radius of legend indicator circles |
| `LEGEND_0_CX` | 80 | cx of "= 0" legend circle |
| `LEGEND_1_CX` | 192 | cx of "= 1" legend circle |
| `LEGEND_FONT` | 21 | Font size of legend text |
| `RIGHT_X`, `RIGHT_Y` | 420, 20 | Top-left corner of right panel |
| `RIGHT_W`, `RIGHT_H` | 380, 420 | Size of right panel |
| `RIGHT_RX` | 12 | Corner radius of right panel |
| `RIGHT_CX` | derived (610) | Centre x of right panel — derived from `RIGHT_X + RIGHT_W / 2` |
| `AX_OX`, `AX_OY` | 480, 358 | Origin of scatter axes (bottom-left corner) |
| `AX_X2` | 780 | Right end of x-axis |
| `AX_Y2` | 114 | Top end of y-axis |
| `AXIS_FONT` | 21 | Font size of axis tick labels and titles |
| `AX_LABEL_X` | 630 | x of "Entrada A" axis label |
| `AX_LABEL_X_Y` | 394 | y of x-axis label |
| `AX_LABEL_Y_X` | 450 | x of "Entrada B" label (before rotation) |
| `AX_LABEL_Y_Y` | 238 | y of "Entrada B" label (before rotation) |
| `POINT_R` | 22 | Radius of scatter plot data points |
| `POINTS` | array of 4 | Scatter point positions and `isOne` flags |
| `FAILED_LINES` | array of 3 | Coordinates of dashed failed separator lines |
| `X_MARKS` | array of 3 | Positions of red ✗ marks near failed line endpoints |
| `X_MARK_FONT` | 30 | Font size of ✗ marks |
| `FOOTER_Y1` | 448 | y of first footer line |
| `FOOTER_Y2` | 480 | y of second footer line (with coloured dots) |
| `FOOTER_CX` | 600 | x centre of both footer lines |
| `FOOTER_FONT` | 21 | Font size of footer text |
| `FOOTER_DOT_FONT` | 26 | Font size of the ● dot glyphs in footer line 2 |
