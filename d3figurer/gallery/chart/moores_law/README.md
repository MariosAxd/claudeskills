# ch04_moores_law — Ley de Moore: CPUs vs GPUs (2000–2024)

## Purpose (why it's in the book)

Chapter 4 explains the hardware revolution that made deep learning possible. The key argument: Moore's Law (transistor count doubling every ~18 months) continued in GPUs even after it stalled in CPUs, and this divergence is exactly why AI accelerated from 2012 onward. This figure makes the divergence visually dramatic on a linear scale — the GPU line shoots upward while the CPU line flattens near zero, making the argument without any words needed.

**Book caption:** *Ley de Moore desde 1971 para CPUs (izda.) y GPUs (dcha.) (fuente: figuras propias a partir de datos de Wikipedia).*

**Surrounding text:** "La Figura 11 muestra la famosa Ley de Moore desde 1971, según la cual el número de transistores que podemos integrar en un circuito por el mismo precio se duplica cada año, o año y medio."

---

## What it shows

Real transistor counts for CPU and GPU chips from **2000 to 2024** on a **linear scale**:

- **Blue line + dots** — CPUs (Intel and AMD only, explicitly excluding Apple Silicon which uses AI-specific cores). Ends ~2016 at ~3 billion transistors (Core i7 Kaby Lake). On a 220B scale, CPUs appear nearly flat — that's the point.
- **Red line + area** — GPUs (NVIDIA, AMD). Ends 2024 at ~208 billion transistors (NVIDIA B200). The line shoots dramatically upward.
- **Best-fit curves** — Log-linear regression (not point-to-point interpolation) to show the exponential trend cleanly
- **Annotated chips** — Key GPU milestones labeled: A100 (2020), H100 (2022), B200 (2024)

---

## Data (edit the `rawData` array at the top of figure.js)

```javascript
const rawData = [
  // CPUs (Intel/AMD only — no Apple Silicon)
  { year: 2000, chip: 'Pentium 4',        transistors: 42e6,    cat: 'CPU' },
  { year: 2006, chip: 'Core 2 Duo',       transistors: 291e6,   cat: 'CPU' },
  { year: 2010, chip: 'Core i7 (Gulftown)', transistors: 1170e6, cat: 'CPU' },
  { year: 2012, chip: 'Core i7 (Ivy Bridge)', transistors: 1400e6, cat: 'CPU' },
  { year: 2016, chip: 'Core i7 (Kaby Lake)', transistors: 3000e6, cat: 'CPU' },

  // GPUs (NVIDIA and AMD)
  { year: 2001, chip: 'GeForce 3',        transistors: 57e6,    cat: 'GPU' },
  { year: 2006, chip: 'GeForce 8800',     transistors: 681e6,   cat: 'GPU' },
  { year: 2012, chip: 'GeForce GTX 680',  transistors: 3500e6,  cat: 'GPU' },
  { year: 2016, chip: 'GTX 1080',         transistors: 7200e6,  cat: 'GPU' },
  { year: 2020, chip: 'A100',             transistors: 54200e6, cat: 'GPU' },
  { year: 2022, chip: 'H100',             transistors: 80000e6, cat: 'GPU' },
  { year: 2024, chip: 'B200',             transistors: 208000e6, cat: 'GPU' },
];
```

**Why Apple Silicon is excluded from CPU:** Apple's M-series chips include dedicated Neural Engine cores (AI accelerators), making them hybrid CPU+AI chips not comparable to traditional CPUs. Including them would inflate the CPU line artificially. They are arguably in the GPU/AI accelerator category.

---

## Technical details

### Best-fit curves (log-linear regression)
```javascript
function logReg(pts) {
  // computes m, b such that log10(transistors) = m * year + b
  // doubling time = log10(2) / m
}
```
- CPU curve: fitted to 2000–2016 data (Intel/AMD only)
- GPU curve: fitted to 2001–2024 data
- Curves drawn as smooth lines, not jagged point-to-point

### Y-axis scale
- Linear (not log!) — intentional design choice
- Domain: [0, 220e9] (220 billion)
- The CPU line appearing flat at the bottom is the whole point — it emphasizes the divergence

### Canvas
- W=900, H=520
- x-scale: 2000–2026
- CPU data range visible: 2000–2016 (3B max)
- GPU data range visible: 2001–2024 (208B max)

---

## How to modify

- **Add a new GPU**: Push a new row with `cat: 'GPU'` to `rawData`; best-fit curve updates automatically
- **Extend timeline to 2026**: Change x-scale domain and add 2025–2026 GPU data if available
- **Add CPU data post-2016**: Current CPU data stops at 2016 intentionally; extend if you want to show recent CPUs (note: AMD Threadripper Pro 2023 ≈ 25B transistors, still dwarfed by GPUs)
- **Add doubling time annotation**: Display the computed doubling time (from regression slope) as a text annotation on each curve
- **Switch to log scale**: Change `yScale` to `d3.scaleLog()` to show the full history from 2000 to 2024 with both CPU and GPU readable

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 1000, 700 | Canvas size in SVG pixels |
| `ML` | 110 | Left margin — room for y-axis label and tick labels |
| `MR` | 36 | Right margin |
| `MT` | 36 | Top margin |
| `MB` | 80 | Bottom margin — room for x-axis tick labels |
| `Y_LABEL_X` | 26 | x of the rotated y-axis label (translate-x before rotate(-90)) |
| `LEG_DX`, `LEG_DY` | 20, 18 | Offset from chart top-left corner to legend box top-left |
| `LEG_W`, `LEG_H` | 360, 116 | Legend box width / height |
