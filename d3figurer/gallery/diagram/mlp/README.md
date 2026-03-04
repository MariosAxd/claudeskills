# ch02_mlp — Red Neuronal Multicapa (MLP)

## Purpose (why it's in the book)

After the XOR crisis, the solution came in 1986 with *backpropagation*: an algorithm to train multi-layer neural networks. Chapter 2 explains this as the key breakthrough that revived neural network research and eventually led to deep learning. This figure shows the architecture that makes backpropagation possible — a network with multiple layers — and illustrates the forward pass (left to right) and error correction (right to left) that defines how these networks learn.

**Book caption:** *Perceptrón multi-capa con una capa oculta (fuente: figura propia).*

**Surrounding text:** "Se llama backpropagation porque se propagan los errores hacia atrás en la red, desde las neuronas de salida [...] a las neuronas de entrada. Por tanto, los errores que comete la red neuronal al entrenarse sirven, gracias al algoritmo backpropagation, para determinar los valores de los pesos que lograrían reducir tales errores."

---

## What it shows

A Multi-Layer Perceptron (MLP) with three layers:
- **Input layer**: 4 nodes (x₁–x₄)
- **Hidden layer**: 4 nodes (h₁–h₄) — the key innovation over a simple perceptron
- **Output layer**: 1 node (ŷ)
- **Forward pass arrows**: Left to right (blue), showing data flow during prediction
- **Backpropagation arrows**: Right to left (red, dashed), showing error correction during training
- All-to-all connections between adjacent layers (fully connected)

---

## Visual structure

| Element | Details |
|---------|---------|
| Input layer | 4 circles, left column, y-spaced evenly |
| Hidden layer | 4 circles, center column |
| Output layer | 1 circle, right side |
| Forward edges | Thin gray lines, all input→hidden and hidden→output |
| Backprop arrows | Red dashed arrows, output→hidden direction |
| Layer labels | "Entrada", "Oculta", "Salida" below each column |
| Node labels | x₁–x₄, h₁–h₄, ŷ |

**Canvas:** W=700, H=400

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 880, 540 | Canvas size in SVG pixels |
| `IX` | 140 | Input layer x centre |
| `HX` | 440 | Hidden layer x centre |
| `OX` | 740 | Output layer x centre |
| `R` | 28 | Node circle radius |
| `inputY` | [110, 200, 290, 380] | Input node y positions |
| `hiddenY` | [110, 200, 290, 380] | Hidden node y positions |
| `outputY` | 245 | Output node y centre |
| `LAYER_LABEL_Y` | 500 | y position of layer name labels |
| `ARROW_LABEL_Y` | 46 | y position of backprop/forward direction labels |
| `BACKPROP_LABEL_X` | 290 | x centre of the backpropagation label |
| `FORWARD_LABEL_X` | 590 | x centre of the forward-pass label |
| `OUTPUT_R` | 42 | Output node radius (larger than hidden nodes) |
| `FONT_NODE` | 26 | Font size for node subscript labels (x₁, a₁…) |
| `FONT_OUTPUT` | 24 | Font size for output node "Salida" label |
| `FONT_LAYER` | 23 | Font size for layer name labels |
| `FONT_ARROW` | 21 | Font size for direction labels |

## How to modify

- **Change layer sizes**: Edit the `layers` array (e.g., `[4, 6, 4, 1]` for a deeper network)
- **Add more hidden layers**: Insert additional column positions; the layout auto-spaces based on `layers.length`
- **Show weights**: Add edge labels with random weight values to make it more concrete
- **Highlight one path**: Change a specific path of edges to red/bold to trace one neuron's contribution
- **Remove backprop arrows**: Delete the second pass of edge drawing to show only the forward pass
