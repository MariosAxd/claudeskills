# ch02_turing_test — La Prueba de Turing

## Purpose (why it's in the book)

Chapter 2 opens the history of AI with Alan Turing's 1950 thought experiment, which gave the field its first operational definition of machine intelligence: a machine is intelligent if a human interrogator cannot tell it apart from another human through text conversation alone. This figure makes that abstract definition concrete and visual — reader immediately grasps the three-party structure (machine A, human B, evaluator C) before the text explains it.

**Book caption:** *La prueba de Turing (fuente: Wikipedia).*

**Surrounding text:** "El ejercicio consiste en que un humano (C en la figura), conocido como el interrogador, interacciona vía texto con un sistema al que puede hacer preguntas. Si el humano no logra discernir cuándo su interlocutor es una máquina (A en la figura), y cuándo otra persona (B en la figura), entonces el sistema supera la prueba de Turing: es inteligente."

---

## What it shows

The Turing Test (imitation game) as a **message-passing flow**:

- **Left box** — Computer (A): monitor icon + keyboard icon
- **Right box** — Human (B): person icon + keyboard icon
- **Center channel** — Anonymous printed responses (document icon), with diagonal arrows from both A and B
- **Evaluator (C)** — Person icon at the bottom with a large red "?" indicating uncertainty about which is the machine

Both A and B send responses upward into the center, the evaluator only sees the anonymous text and must decide.

---

## Visual structure

| Element | Position | Details |
|---------|----------|---------|
| Left box (Computer A) | x=20, y=66, w=248, h=228 | Gray border, monitor + keyboard MDI icons |
| Right box (Human B) | x=632, y=66, w=248, h=228 | Red-tinted border, person + keyboard MDI icons |
| Center paper box | x=300, y=170, w=300, h=148 | Light fill, document icon |
| Evaluator C | cx=428, cy=480 | Person icon + red "?" label at x=502 |
| Diagonal arrows | (268,180)→(302,216) and (632,180)→(598,216) | Gray arrows, from A and B to center |
| Down arrow | (450,318)→(450,440) | Gray arrow, center box to evaluator |

**Canvas:** W=900, H=620

---

## Icons used

Material Design Icons (Apache 2.0 license), SVG paths embedded directly:
- `mdi-monitor` — represents computer terminal
- `mdi-account` — represents human participant
- `mdi-keyboard` — represents text input
- `mdi-file-document` — represents the anonymous printed responses

Icon placement helper:
```javascript
function icon(path, cx, cy, size, fill) {
  svg.append('path')
    .attr('d', path)
    .attr('transform', `translate(${cx - size/2}, ${cy - size/2}) scale(${size/24})`)
    .attr('fill', fill);
}
```

---

## How to modify

- **Change labels**: Edit the `svg.append('text')` blocks for "A (Máquina)", "B (Humano)", "C (Interrogador)"
- **Add speech bubbles**: Add `rect` + `text` elements between arrows and center box
- **Change layout**: Adjust `BOX_A_X`, `BOX_B_X`, `PAPER_X` in the layout block to reflow panels
- **Icon size**: Change `ICON_MAIN_SIZE` (monitor/person) or `ICON_KB_SIZE` (keyboards) in the layout block

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 900, 620 | Canvas size in SVG pixels |
| `BOX_W`, `BOX_H` | 248, 228 | Width/height of the A and B contestant boxes |
| `BOX_Y` | 66 | Top edge of both contestant boxes |
| `BOX_A_X` | 20 | Left edge of box A (Computer) |
| `BOX_B_X` | 632 | Left edge of box B (Human) |
| `BOX_A_CX` | derived (144) | Centre x of box A — derived from `BOX_A_X + BOX_W / 2` |
| `BOX_B_CX` | derived (756) | Centre x of box B — derived from `BOX_B_X + BOX_W / 2` |
| `LABEL_Y` | 52 | y of "A — Computadora" / "B — Persona" titles above boxes |
| `LABEL_FONT` | 25 | Font size for box titles |
| `MONITOR_CY` | 152 | cy of monitor icon in box A |
| `KEYBOARD_CY` | 252 | cy of keyboard icon in box A |
| `PERSON_CY` | 148 | cy of person icon in box B |
| `KEYBOARD_B_CY` | 248 | cy of keyboard icon in box B |
| `ICON_MAIN_SIZE` | 90 | Size of monitor/person main icon |
| `ICON_KB_SIZE` | 54 | Size of keyboard icon |
| `CAPTION_A_Y` | 282 | y of "responde en texto" caption in box A |
| `CAPTION_B_Y` | 278 | y of "responde en texto" caption in box B |
| `PAPER_X`, `PAPER_Y` | 300, 170 | Top-left of the centre paper/text box |
| `PAPER_W`, `PAPER_H` | 300, 148 | Size of the centre paper box |
| `PAPER_CX` | derived (450) | Centre x of paper box — derived from `PAPER_X + PAPER_W / 2` |
| `PAPER_CHANNEL_Y` | 156 | y of "Solo texto — sin identidad" label above paper box |
| `FILE_ICON_CY` | 218 | cy of file icon inside paper box |
| `FILE_ICON_SIZE` | 44 | Size of file icon |
| `LINE1_Y`, `LINE2_Y`, `LINE3_Y` | 248, 264, 280 | y positions of the three fake text lines in the paper box |
| `LINE_X` | 338 | x of all three fake text lines |
| `LINE_W1`, `LINE_W2`, `LINE_W3` | 224, 168, 196 | Widths of the three fake text lines |
| `ARR_AB_Y1` | 180 | y where diagonal arrows start (from A/B to paper) |
| `ARR_A_X1` | 268 | x start of arrow from box A |
| `ARR_B_X1` | 632 | x start of arrow from box B |
| `ARR_PAPER_X2_L` | 302 | x where left diagonal arrow meets paper box |
| `ARR_PAPER_X2_R` | 598 | x where right diagonal arrow meets paper box |
| `ARR_PAPER_Y2` | 216 | y where both diagonal arrows end |
| `ARR_DOWN_Y1` | 318 | y where the downward arrow starts (paper box bottom) |
| `ARR_DOWN_Y2` | 440 | y where the downward arrow ends (above evaluator) |
| `EVAL_PERSON_CX` | 428 | cx of evaluator person icon |
| `EVAL_PERSON_CY` | 480 | cy of evaluator person icon |
| `EVAL_PERSON_SIZE` | 72 | Size of evaluator person icon |
| `EVAL_Q_X` | 502 | x of the red "?" glyph |
| `EVAL_Q_Y` | 480 | y of the red "?" glyph |
| `EVAL_Q_FONT` | 80 | Font size of the "?" glyph |
| `EVAL_LABEL_Y` | 546 | y of "C — Evaluador" label |
| `EVAL_CAPTION_Y` | 578 | y of the question caption below evaluator |
