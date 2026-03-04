# ch02_perceptron — El Perceptrón de Rosenblatt

## Purpose (why it's in the book)

The perceptron (1957) is the foundational unit of all neural networks — the artificial neuron. Chapter 2 uses it to explain the bottom-up approach to AI: instead of hand-coding rules, you build a system that *learns* from examples by adjusting numerical weights. This figure gives the reader the essential mental model of how a single artificial neuron works (inputs × weights → sum → threshold → output) before the book builds up to multi-layer networks and deep learning.

**Book caption:** *Perceptrón de Rosenblatt (fuente: Wikipedia).*

**Surrounding text:** "el Perceptrón recibe un conjunto de valores de entrada que multiplica cada valor de entrada por un coeficiente determinado al que llamamos peso [...] y produce una salida: 1 si la suma de las entradas moduladas por sus pesos es superior a un cierto valor, y 0 si es inferior."

---

## What it shows

A single artificial neuron (perceptron) with:
- **4 input nodes** (x₁–x₄) on the left, each labeled with a weight (w₁j–w₄j)
- **Summation node** (Σ) in the center — adds up all weighted inputs
- **Activation function** (φ) — applies a threshold, producing the output
- **Binary output** (0 or 1) on the right
- Edges connecting inputs → Σ → φ → output, color-coded by weight magnitude

---

## Visual structure

| Element | Details |
|---------|---------|
| Input nodes | 4 red circles (r=28) at x=60, y=96/176/256/336 |
| Weight labels | Italic labels w₁–w₄ at x=192 |
| Summation node | Large circle (r=76) at cx=365, cy=210, with Σ symbol |
| Activation box | Red rect (96×64) at x=490, y=178, with φ symbol |
| Output column | "1" (red) and "0" (gray) at x=690; side labels at x=795 |
| Arrows | Gray lines from inputs to neuron; red arrow from activation to output |

**Canvas:** W=800, H=460

---

## How to modify

- **Change number of inputs**: Add/remove entries in `INPUT_CYS` and `WEIGHT_YS`; adjust y-spacing
- **Change activation label**: Edit the `φ` text node to show a specific function (e.g., sigmoid, ReLU)
- **Add bias input**: Add a `+1` input node connected to Σ with a `b` weight label
- **Highlight a specific path**: Change a single edge's stroke color to emphasize one input's contribution

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 800, 460 | Canvas size in SVG pixels |
| `INPUT_CX` | 60 | x centre of all input node circles |
| `INPUT_CYS` | [96,176,256,336] | y centres of the four input nodes |
| `INPUT_R` | 28 | Radius of input node circles |
| `INPUT_FONT` | 24 | Font size of x₁–x₄ labels inside input nodes |
| `INPUT_LINE_X1` | 88 | x where connection lines leave the input nodes (right edge of circle) |
| `INPUT_LINE_X2` | 330 | x where connection lines arrive at the neuron (approach point) |
| `WEIGHT_CX` | 192 | x centre of weight labels (w₁–w₄) |
| `WEIGHT_YS` | [125,170,212,268] | y of each weight label |
| `WEIGHT_FONT` | 22 | Font size of weight labels |
| `HEADER_Y` | 54 | y of column header labels ("Entradas", "Pesos", etc.) |
| `HEADER_FONT` | 20 | Font size of column headers |
| `NEURON_CX` | 365 | x centre of the summation neuron circle |
| `NEURON_CY` | 210 | y centre of the summation neuron circle |
| `NEURON_R` | 76 | Radius of the summation neuron circle |
| `SIGMA_FONT` | 60 | Font size of the Σ symbol |
| `SIGMA_Y` | 200 | y of the Σ symbol (dominant-baseline: middle) |
| `NEURON_SUBLABEL_Y` | 258 | y of the italic "Neurona" label inside the neuron circle |
| `NEURON_SUBLABEL_FONT` | 18 | Font size of the "Neurona" sublabel |
| `CONN_X1` | derived (441) | x where connector line leaves neuron right edge — derived from `NEURON_CX + NEURON_R` |
| `CONN_X2` | 490 | x where connector line arrives at activation box |
| `ACT_BOX_X` | 490 | Left edge of activation (φ) box |
| `ACT_BOX_Y` | 178 | Top edge of activation box |
| `ACT_BOX_W` | 96 | Width of activation box |
| `ACT_BOX_H` | 64 | Height of activation box |
| `ACT_BOX_RX` | 8 | Corner radius of activation box |
| `ACT_CX` | derived (538) | x centre of activation box — derived from `ACT_BOX_X + ACT_BOX_W / 2` |
| `PHI_FONT` | 46 | Font size of the φ symbol |
| `ACT_LABEL_Y1` | 143 | y of "Función de" label above activation box |
| `ACT_LABEL_Y2` | 164 | y of "Activación" label above activation box |
| `ACT_LABEL_FONT` | 19 | Font size of activation box label lines |
| `OUTPUT_CX` | 690 | x centre of the output column |
| `OUTPUT_FONT` | 36 | Font size of output "1" / "0" values |
| `OUTPUT_1_Y` | 184 | y of output "1" (Activa) |
| `OUTPUT_0_Y` | 236 | y of output "0" (No activa) |
| `OUTPUT_SIDE_X` | 795 | x of "Activa" / "No activa" side labels |
| `OUTPUT_SIDE_FONT` | 19 | Font size of side labels |
| `SEP_X1`, `SEP_X2` | 668, 714 | x1/x2 of the separator line between outputs |
| `SEP_Y` | 210 | y of the separator line |
| `ARR_X1` | 586 | x where the red output arrow starts (activation box right) |
| `ARR_X2` | 652 | x where the red output arrow ends |
| `BOTTOM_LABEL_X` | 400 | x of the bottom "Perceptrón" label |
| `BOTTOM_LABEL_Y` | 428 | y of the bottom "Perceptrón" label |
| `BOTTOM_LABEL_FONT` | 23 | Font size of the bottom label |
