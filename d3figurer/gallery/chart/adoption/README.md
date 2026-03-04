# ch03_adoption — La Adopción Más Rápida de la Historia

## Purpose (why it's in the book)

Chapter 3 uses ChatGPT's record-breaking adoption as evidence that the LLM revolution is genuinely unprecedented — not hype, but a measurable societal shift. Saying "ChatGPT reached 100M users faster than any platform in history" is a strong claim; this figure turns that claim into an undeniable visual comparison. The bar chart makes it immediately obvious that ChatGPT was not incrementally faster — it was in a completely different category.

**Book caption:** *Tiempo para alcanzar 100 millones de usuarios: ChatGPT logró la adopción más rápida de la historia (2 meses), comparado con TikTok (9 meses), Instagram (30 meses), Netflix (42 meses) y Facebook (54 meses).*

**Surrounding text:** "En enero de 2023, apenas dos meses después de su lanzamiento, ChatGPT alcanzó 100 millones de usuarios activos, convirtiéndose en la aplicación con una adopción más rápida en la historia de la humanidad. Para ponerlo en perspectiva, Instagram tardó dos años y medio en alcanzar esa cifra y TikTok, nueve meses."

---

## What it shows

A horizontal bar chart comparing **time to reach 100 million users** across major platforms:

| Platform | Months to 100M users |
|----------|---------------------|
| ChatGPT | 2 |
| TikTok | 9 |
| Instagram | 30 |
| Netflix | 42 |
| Facebook | 54 |
| Spotify | 55 |

ChatGPT's bar is dramatically shorter and colored bright red to make the contrast unmistakable. Other bars are gray.

---

## Visual structure

| Element | Details |
|---------|---------|
| Horizontal bars | One per platform, sorted shortest→longest (ChatGPT at top) |
| Bar colors | ChatGPT = red (#e4003b), others = gray |
| Bar labels | Platform name on left, months value at bar end |
| X-axis | "Meses para alcanzar 100M usuarios" |
| ChatGPT annotation | "Récord histórico" label or callout arrow |
| Platform icons | Optional: small logo-style icons next to each label |

**Canvas:** W=800, H=420

---

## Data (edit the `platforms` array at the top of figure.js)

```javascript
const platforms = [
  { name: 'ChatGPT',   months: 2,  highlight: true  },
  { name: 'TikTok',    months: 9,  highlight: false },
  { name: 'Instagram', months: 30, highlight: false },
  { name: 'Netflix',   months: 42, highlight: false },
  { name: 'Facebook',  months: 54, highlight: false },
  { name: 'Spotify',   months: 55, highlight: false },
];
```

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 900, 560 | Canvas size in SVG pixels |
| `MARGIN` | top:70, right:180, bottom:100, left:175 | Plot margins |
| `BAR_RADIUS` | 4 | Bar corner radius |
| `HIGHLIGHT_PADDING` | 4 | Extra padding around highlighted bar outline |
| `HIGHLIGHT_RADIUS` | 7 | Corner radius of highlight outline rect |
| `BAR_LABEL_OFFSET_X` | 10 | Gap between bar end and duration label |
| `NAME_OFFSET_X` | 12 | Gap between axis and platform name label |
| `NAME_OFFSET_Y` | 16 | Vertical offset of platform name above bar centre |
| `YEAR_OFFSET_Y` | 16 | Vertical offset of launch year below bar centre |
| `FONT_BAR_LABEL` | 27 | Font size for duration value labels |
| `FONT_NAME` | 27 | Font size for platform name labels |
| `FONT_YEAR` | 21 | Font size for launch year labels |
| `FONT_AXIS_TICK` | 23 | Font size for x-axis tick labels |
| `FONT_AXIS_TITLE` | 23 | Font size for x-axis title |
| `AXIS_TICK_Y` | 26 | Y offset below plot bottom for tick labels |
| `AXIS_TITLE_Y` | 62 | Y offset below plot bottom for axis title |
| `BRACKET_OFFSET_X` | 24 | X offset from plot right edge to bracket start |
| `BRACKET_ARM` | 10 | Horizontal arm length of comparison bracket |
| `BRACKET_LABEL_OFFSET_X` | 16 | X offset from bracket tip to annotation text |
| `BRACKET_LABEL_Y1` | -14 | Y offset of first annotation line from bracket midpoint |
| `BRACKET_LABEL_Y2` | 20 | Y offset of second annotation line from bracket midpoint |
| `FONT_BRACKET` | 22 | Font size for bracket annotation text |

---

## How to modify

- **Add a new platform**: Push a new object to `platforms`; bars auto-sort by months
- **Update ChatGPT's number**: If new data is available, change `months: 2`
- **Change sorting**: Platforms currently sorted ascending (shortest bar at top) — change `.sort()` call if preferred
- **Add a comparison annotation**: Add a `text` element with "4.5× más rápido que TikTok" arrow between ChatGPT and TikTok bars
