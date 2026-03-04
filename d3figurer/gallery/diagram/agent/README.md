# ch03_agent — Arquitectura de un Agente IA (ReAct Loop)

## Purpose (why it's in the book)

Chapter 3's final section introduces AI agents as the next frontier beyond conversational LLMs: systems that don't just answer questions but *take actions* in the world — browsing the web, writing code, sending emails, controlling computers. This figure explains the internal architecture of such an agent, making clear that the LLM is not acting alone but is orchestrating three capabilities (planning, memory, tools) in a continuous loop. This is important for helping readers understand both the power and the risks of agentic AI.

**Book caption:** *Arquitectura conceptual de un agente de IA: un LLM actúa como cerebro central, coordinando tres capacidades fundamentales — planificación (descomposición de tareas complejas), memoria (contexto y preferencias del usuario), y uso de herramientas (interacción con sistemas externos como bases de datos, navegadores o APIs) — para ejecutar tareas de manera autónoma.*

**Surrounding text:** "Anthropic lanzó la capacidad de 'uso del ordenador' para su LLM llamado Claude, permitiéndole controlar un ordenador como lo haría un humano. Estos agentes ya están transformando industrias..."

---

## What it shows

The **ReAct pattern** (Reason + Act) architecture of an AI agent:

- **Center**: LLM "brain" node — receives observations, produces reasoning + actions
- **Top**: Perception — receives input from environment (user query, tool results)
- **Left**: Planning — breaks complex tasks into sub-steps
- **Right**: Memory — stores context (working memory) and long-term user preferences
- **Bottom**: Action — executes tool calls (web search, code execution, APIs, database queries)
- **Loop arrow**: Circular flow showing the perception → reason → act → observe cycle

---

## Visual structure

| Element | Position | Details |
|---------|----------|---------|
| LLM node | Center | Large circle, "LLM" label, red (#e4003b) |
| Perception box | Top center | Receives environment state |
| Planning box | Left | "Planificación" — task decomposition |
| Memory box | Right | "Memoria" — context + preferences |
| Tools box | Bottom | "Herramientas" — external integrations |
| Arrows | All directions | Red arrows showing data flow |
| Loop annotation | Right side | Circular arrow labeled "ReAct Loop" |
| Tool icons | Inside tools box | Web, code, database, API mini-icons |

**Canvas:** W=900, H=600

---

## How to modify

- **Add a specific tool**: Add a mini-box inside the "Herramientas" box (e.g., "GitHub Copilot", "Google Search")
- **Show the loop steps**: Add numbered labels (1. Percibir, 2. Razonar, 3. Actuar, 4. Observar) on the arrows
- **Add a concrete example**: Add a small annotation showing a real task: "Reservar vuelo Madrid→Londres" flowing through each stage
- **Simplify to 3-box**: Remove planning/memory boxes for a simpler "Input → LLM → Action" diagram
- **Add safety layer**: Add a "Guardrails" box between LLM and Action to illustrate safety filtering

---

## Layout parameters

Edit these constants at the top of `figure.js` to adjust placement:

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | 980, 900 | Canvas size in SVG pixels |
| `CX` | 490 | Horizontal centre of the diagram |
| `USER_X`, `USER_Y` | CX-130, 20 | Usuario box top-left corner |
| `USER_W`, `USER_H` | 260, 80 | Usuario box width / height |
| `ARROW_Y_TOP` | 100 | y where arrows leave the Usuario box (bottom edge) |
| `ARROW_Y_BOT` | 162 | y where arrows enter the agent container |
| `AGENT_X`, `AGENT_Y` | 16, 162 | Agent outer container top-left corner |
| `AGENT_W`, `AGENT_H` | 948, 510 | Agent outer container width / height |
| `MX`, `MY` | 26, 194 | Memoria sidebar top-left corner |
| `MW`, `MH` | 212, 456 | Memoria sidebar width / height |
| `KX`, `KY` | 742, 194 | Conocimiento sidebar top-left corner |
| `KW`, `KH` | 212, 456 | Conocimiento sidebar width / height |
| `PHASE_X`, `PHASE_W` | 360, 260 | Centre phase boxes left edge / width |
| `P1_Y`, `P1_H` | 180, 94 | Percibir box top y / height |
| `P2_H` | 148 | Razonar box height (top y derived from P1) |
| `P3_H` | 94 | Actuar box height (top y derived from P2) |
| `PHASE_GAP` | 28 | Vertical gap (with arrow) between phase boxes |
| `LOOP_X` | 700 | x of the vertical segment of the observe loop-back path |
| `TOOLS_LABEL_Y` | 696 | y of the "HERRAMIENTAS" section label |
| `TOOL_W`, `TOOL_H` | 208, 96 | Tool card width / height |
| `TOOL_START_X` | 20 | x of the first tool card |
| `TOOL_Y` | 710 | y of tool cards top edge |
