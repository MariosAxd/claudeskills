# ch02_topdown_bottomup

## Purpose
This figure appears in **Chapter 2 (La historia de la IA)** to illustrate the two founding paradigms of Artificial Intelligence research that divided the field from the 1950s onward.

## What it shows
A side-by-side comparison of the two AI schools of thought:

- **Left card — Top-Down (Simbólico · Lógico)**: The "neat" camp. AI built by encoding human knowledge explicitly as rules, logic, and formal representations. Dominated from the 1950s through the 1990s. Examples: ELIZA, Deep Blue, Shredder, Watson.

- **Right card — Bottom-Up (Conexionista · Estadístico)**: The "scruffy" camp. AI that learns patterns from data through training. Has dominated since the 2000s and includes today's deep learning and LLMs. Examples: AlphaGo, ChatGPT, Siri, Face ID, Autopilot.

- **Center badge**: A small "IA" circle connecting both cards, emphasizing that both are approaches to the same goal.

## Design
- W=1000, H=480 — landscape, fits standard textwidth
- Left card: neutral gray theme (`#f7f7f7` bg, `S.GRAY_DARK` border)
- Right card: book-red theme (`#fff5f7` bg, `S.RED` border) — emphasizes current dominance
- Each card: title badge, subtitle/nickname, philosophy sentence, flow formula, 5–6 area chips, example system chips, bottom note
- Center bridge: dashed connector lines + "IA" badge

## Data
No external data — all content is hardcoded in the figure (text strings only).

Area lists and example chips can be updated directly in `figure.js` (arrays `areasL`, `areasR`, `chipsL`, `chipsR`).

## How to modify
```bash
cd figures/d3
# Edit figure.js, then preview:
node generate-previews.js
# Open: preview/index.html

# Render to PDF:
node render-batch.js ../../media ch02_topdown_bottomup
```

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 600 | Canvas size in SVG pixels |
| `DIV_Y` | 282 | Y coordinate of the divider band top edge |
| `DIV_H` | 40 | Height of the divider band |
| `B0` | `DIV_Y + DIV_H` (322) | Y coordinate where the bottom section starts (derived) |
| `LP` | 12 | Left panel x origin |
| `LW` | 170 | Left panel width |
| `RP` | 660 | Right panel x position (start-anchor for capability lists) |
| `bCX`, `bCY` | 480, 128 | Brain illustration centre coordinates |
| `lRX`, `lRY` | 56, 52 | Brain lobe radii (x and y axes) |
| `topExSpacing` | 33 | Vertical spacing between top example rows |
| `topExStart` | 90 | Y of first top example row |
| `botExSpacing` | 33 | Vertical spacing between bottom example rows |
| `botExStart` | `B0 + 30` | Y of first bottom example row |
| `nnCX`, `nnCY` | 480, `B0 + 118` (~440) | Neural network diagram centre coordinates |
| `ar1X` | 930 | X position of the Top-Down directional arc |
| `ar2X` | 964 | X position of the Bottom-Up directional arc |

Font sizes are controlled by the `SZ` object defined outside `module.exports` (above the function):

| Key | Default | Used for |
|-----|---------|----------|
| `SZ.divider` | 36 | "Inteligencia Artificial" divider label |
| `SZ.h1` | 36 | CONOCIMIENTO / DATOS section headers |
| `SZ.h2` | 30 | Panel headers and section labels |
| `SZ.h3` | 26 | Paradigm sub-labels below brain and neural net |
| `SZ.body` | 17 | Bullet list items |
| `SZ.small` | 20 | Layer labels and arc direction labels |
