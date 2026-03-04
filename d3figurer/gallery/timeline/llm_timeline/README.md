# ch03_llm_timeline — Cronología de los LLMs (2017–2024)

## Purpose (why it's in the book)

Chapter 3 opens with ChatGPT's arrival in November 2022 and then traces back to explain *how we got there* — a 5-year sprint from the Transformer paper to a global cultural phenomenon. This timeline appears at the very start of the chapter, immediately after the description of ChatGPT's impact, to orient the reader in time. It shows that the LLM revolution was not sudden but was the result of rapid, compounding milestones, each building on the last.

**Book caption:** *Línea temporal de hitos en LLMs y IA generativa (2017–2024): desde la arquitectura Transformer hasta ChatGPT, DALL-E y más allá, mostrando la aceleración de la innovación en este campo.*

**Surrounding text:** "No era el primer chatbot conversacional ya que llevábamos años interactuando con asistentes como Siri o Alexa, pero era cualitativamente diferente. ChatGPT podía escribir ensayos, programar código, resolver problemas matemáticos..."

---

## What it shows

A horizontal timeline of **9 key LLM milestones** (2017–2024):

| Year | Milestone |
|------|-----------|
| 2017 | Transformer (Vaswani et al., Google) |
| 2018 | BERT (Google) |
| 2019 | GPT-2 (OpenAI) |
| 2020 | GPT-3 (OpenAI) |
| 2021 | DALL-E 1, GitHub Copilot |
| 2022 | ChatGPT (highlighted) |
| 2023 | GPT-4, Gemini, Claude |
| 2024 | Multimodal / reasoning models |

Visual treatment:
- Gradient strip beneath the timeline showing acceleration (lighter → more intense red)
- **ChatGPT** node is larger and more prominent (highlighted as the breakthrough moment)
- Event labels alternate above/below the timeline to avoid overlap
- Year axis with tick marks

---

## Visual structure

| Element | Details |
|---------|---------|
| Timeline axis | Horizontal, y=240, with year ticks |
| Event dots | Red circles, r=8 standard, r=14 for ChatGPT |
| Event labels | Alternating above/below; title + sub-label (model/company) |
| Gradient strip | Below axis, fades from light pink to deep red left→right |
| ChatGPT box | Highlighted with a red outline box around label |

**Canvas:** W=1000, H=480

---

## Data (edit the `milestones` array at the top of figure.js)

```javascript
{ year: 2017, title: 'Transformer',   sub: 'Vaswani et al.', highlight: false }
{ year: 2022, title: 'ChatGPT',       sub: 'OpenAI',         highlight: true  }
// ...
```

- `highlight: true` → larger dot, outlined label box
- Add/remove rows to update the timeline
- `sub` appears as a smaller gray line below the title

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 540 | Canvas size in SVG pixels |
| `TY` | 260 | Timeline axis y position |
| `X1`, `X2` | 40, 970 | Timeline left/right x extent |
| `DOT_R_NORMAL` | 11 | Dot radius for standard events |
| `DOT_R_KEY` | 18 | Dot radius for highlighted (key) events |
| `DOT_RING_R` | 28 | Outer dashed ring radius for key events |
| `LINE_LEN_NORMAL` | 38 | Stem line length for standard events |
| `LINE_LEN_KEY` | 54 | Stem line length for key events |
| `FONT_YEAR_NORMAL` | 22 | Year label font size for standard events |
| `FONT_YEAR_KEY` | 26 | Year label font size for key events |
| `FONT_TITLE_NORMAL` | 22 | Event title font size for standard events |
| `FONT_TITLE_KEY` | 26 | Event title font size for key events |
| `FONT_SUB` | 16 | Subtitle font size (all events) |
| `YEAR_GAP_ABOVE` | 12 | Gap between stem end and year label (above) |
| `YEAR_GAP_BELOW` | 20 | Gap between stem end and year label (below) |
| `TITLE_GAP_ABOVE` | 38 | Gap between stem end and title (above) |
| `TITLE_GAP_BELOW` | 50 | Gap between stem end and title (below) |
| `SUB_GAP` | 26 | Gap between title and subtitle |
| `ACCEL_LABEL_Y` | TY-14 | Y position of "Aceleración →" label |
| `FONT_ACCEL` | 18 | Font size for acceleration label |
| `BOTTOM_LABEL_Y` | 516 | Y position of bottom caption text |
| `FONT_BOTTOM` | 22 | Font size for bottom caption |

---

## How to modify

- **Add a new milestone**: Push a new object to `milestones` with `year`, `title`, `sub`, `highlight`
- **Extend to 2026**: Change the x-scale domain from `[2017, 2024]` to `[2017, 2026]` and add new entries
- **Change the highlighted event**: Set `highlight: true` on a different milestone
- **Change gradient colors**: Edit the `linearGradient` stop colors
