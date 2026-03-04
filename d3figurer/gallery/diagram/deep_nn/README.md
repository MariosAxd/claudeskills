# ch02_deep_nn — Red Neuronal Profunda (Deep Learning)

## Purpose (why it's in the book)

Chapter 2 concludes with the explanation of why deep learning (2012 onward) works so well: each successive layer of a deep network learns increasingly abstract representations — from raw pixels to edges, to shapes, to object parts, to full identities. This figure concretizes that abstract idea with a face recognition example, showing how 6 layers transform pixels into an identity. It's placed just before the AI timeline figure, bookending the chapter's explanation of why neural networks are now dominant.

**Book caption:** *Ejemplo de red neuronal profunda (Deep neural Network) para el procesamiento y análisis de caras en imágenes.*

**Surrounding text:** "...la disponibilidad de grandes cantidades de datos, el aumento de la capacidad de computación, y el desarrollo de redes neuronales profundas y complejas, los modelos llamados de deep learning, son los tres factores que han confluido para instalar hoy día a la Inteligencia Artificial en una 'primavera perpetua'..."

---

## What it shows

A 6-layer deep neural network for **face recognition**, illustrating the hierarchy of learned features:

| Layer | Name | What it detects |
|-------|------|----------------|
| 1 | Entrada (Input) | Raw pixel values |
| 2 | Bordes (Edges) | Simple edges and gradients |
| 3 | Texturas | Textures and patterns |
| 4 | Partes | Eyes, nose, mouth parts |
| 5 | Cara | Full face regions |
| 6 | Identidad (Output) | Person identity |

Each layer has fewer nodes than the previous, representing feature compression. Edges between layers show the fully-connected (or simplified) connections.

---

## Visual structure

| Element | Details |
|---------|---------|
| 6 node columns | Widths taper: 6→5→4→4→3→1 nodes |
| Edges | Gray lines, all-to-all between adjacent layers |
| Layer labels | Below each column: layer name + feature description |
| Node circles | Red (#e4003b) for active/highlighted nodes, gray for others |
| Output node | Single large circle labeled with a face/identity icon |

**Canvas:** W=900, H=460

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 620 | Canvas size in SVG pixels |
| `R` | 16 | Node circle radius |
| `Y_CENTER` | 290 | Vertical centre of all node columns |
| `LABEL_Y_TOP` | 50 | y position of layer name labels above nodes |
| `LABEL_Y_BOT` | 536 | y position of sublabels below nodes |
| `BRACKET_Y` | 74 | y of the dashed "Capas Ocultas" bracket line |
| `BRACKET_TEXT_Y` | 92 | y of the "Capas Ocultas (aprendizaje profundo)" label |
| `GRID_X` | 24 | x origin (top-left) of the input pixel grid |
| `GRID_Y` | Y_CENTER − 18 | y origin (top-left) of the input pixel grid |
| `FONT_LABEL` | 22 | Font size for layer name labels |
| `FONT_SUBLABEL` | 20 | Font size for sublabels and bracket text |

## How to modify

- **Change layer sizes**: Edit the `layerSizes` array — the layout recalculates automatically
- **Change feature labels**: Edit the `layerLabels` array to reflect different task domains (e.g., speech, medical imaging)
- **Add sample images**: Add small thumbnail images above layer 1 nodes to show actual pixel inputs
- **Show activation maps**: Add colored small squares above intermediate layers to show what each layer detects
- **Change network task**: Replace face recognition labels with any other domain (medical scan analysis, speech recognition, etc.)
