'use strict';
const { makeSVG, addMarker, addText } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {

  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 980, H = 900;          // canvas size
  const CX = 490;                  // horizontal centre of the diagram

  // Usuario box
  const USER_X = CX - 130;        // usuario box left edge
  const USER_Y = 20;               // usuario box top edge
  const USER_W = 260;              // usuario box width
  const USER_H = 80;               // usuario box height

  // Arrows between Usuario and agent container
  const ARROW_Y_TOP = 100;         // y where arrows leave the usuario box (bottom edge)
  const ARROW_Y_BOT = 162;         // y where arrows enter the agent container

  // Agent outer container
  const AGENT_X = 16;              // agent container left edge
  const AGENT_Y = 162;             // agent container top edge (= ARROW_Y_BOT)
  const AGENT_W = 948;             // agent container width
  const AGENT_H = 510;             // agent container height

  // Memoria sidebar (left)
  const MX = 26, MY = 194;        // top-left corner of Memoria box
  const MW = 212, MH = 456;       // width / height of Memoria box

  // Conocimiento sidebar (right)
  const KX = 742, KY = 194;      // top-left corner of Conocimiento box
  const KW = 212, KH = 456;      // width / height of Conocimiento box

  // Centre cycle phase boxes: x span 360–620 (width 260), centred at CX
  const PHASE_X = 360;             // left edge of phase boxes
  const PHASE_W = 260;             // width of each phase box

  const P1_Y = 180, P1_H = 94;    // Percibir box: top y, height
  // P2_Y is derived: P1_Y + P1_H + 28
  const P2_H = 148;                // Razonar box height
  // P3_Y is derived: P2_Y + P2_H + 28
  const P3_H = 94;                 // Actuar box height

  const PHASE_GAP = 28;            // vertical gap (with arrow) between phase boxes

  // Observe loop-back path (right side)
  const LOOP_X = 700;              // x of the vertical segment of the loop-back path

  // Herramientas section
  const TOOLS_LABEL_Y = 696;       // y of the "HERRAMIENTAS" section label
  const TOOL_W = 208, TOOL_H = 96; // each tool card width / height
  const TOOL_GAP = (W - 4 * TOOL_W - 2 * 20) / 3; // gap computed from W and card count
  const TOOL_START_X = 20;         // x of the first tool card
  const TOOL_Y = 710;              // y of tool cards top edge

  const { svg, document } = makeSVG(W, H);

  // ── Defs ──────────────────────────────────────────────────────────────────
  const defs = svg.append('defs');
  addMarker(defs, 'ag', S.GRAY_MID);
  addMarker(defs, 'ar', S.RED);

  const grad = defs.append('linearGradient')
    .attr('id', 'llmGrad').attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '100%').attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', S.RED);
  grad.append('stop').attr('offset', '100%').attr('stop-color', S.RED_DARK);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function rect(x, y, w, h, fill, stroke, sw, dash, rx) {
    const r = svg.append('rect').attr('x', x).attr('y', y)
      .attr('width', w).attr('height', h).attr('rx', rx !== undefined ? rx : 8)
      .attr('fill', fill || S.WHITE).attr('stroke', stroke || 'none').attr('stroke-width', sw || 0);
    if (dash) r.attr('stroke-dasharray', dash);
    return r;
  }

  function line(x1, y1, x2, y2, stroke, sw, dash, marker) {
    const l = svg.append('line')
      .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
      .attr('stroke', stroke || S.GRAY_MID).attr('stroke-width', sw || 2);
    if (dash) l.attr('stroke-dasharray', dash);
    if (marker) l.attr('marker-end', `url(#${marker})`);
  }

  function badge(cx, cy, n) {
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 16).attr('fill', S.RED);
    addText(svg, cx, cy, String(n), 20, 700, S.WHITE);
  }

  // ── USUARIO ────────────────────────────────────────────────────────────────
  rect(USER_X, USER_Y, USER_W, USER_H, S.GRAY_LIGHT, S.GRAY_MID, 1.5, null, 8);
  addText(svg, CX, USER_Y + 24, 'Usuario', 28, 700, S.GRAY_DARK);
  addText(svg, CX, USER_Y + 56, 'Objetivo / Solicitud', 20, 400, S.TEXT_LIGHT, 'middle', true);

  // Down arrow
  line(CX - 10, ARROW_Y_TOP, CX - 10, ARROW_Y_BOT, S.GRAY_MID, 2, null, 'ag');
  addText(svg, CX - 22, 132, 'objetivo', 18, 400, S.GRAY_MID, 'end', true);

  // Dashed red arrow up
  svg.append('path')
    .attr('d', `M ${CX + 10},${ARROW_Y_BOT} L ${CX + 10},${ARROW_Y_TOP}`)
    .attr('fill', 'none').attr('stroke', S.RED).attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3').attr('marker-end', 'url(#ar)');
  addText(svg, CX + 22, 132, 'respuesta', 18, 400, S.RED, 'start', true);

  // ── AGENT CONTAINER ────────────────────────────────────────────────────────
  rect(AGENT_X, AGENT_Y, AGENT_W, AGENT_H, S.WHITE, S.RED, 1.5, '7,4', 10);
  addText(svg, AGENT_X + 22, AGENT_Y + 20, 'A G E N T E', 22, 700, S.RED, 'start');

  // ── MEMORIA sidebar (left) ─────────────────────────────────────────────────
  rect(MX, MY, MW, MH, '#fef7f8', S.RED, 1.5, '5,3', 8);
  addText(svg, MX + MW / 2, MY + 28, 'Memoria', 24, 700, S.RED);

  // Short-term sub-box — 22px spacing (was 18) for font-17 items to have 5px gap
  rect(MX + 8, MY + 52, MW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5);
  addText(svg, MX + MW / 2, MY + 80, 'Corto plazo', 22, 700, S.GRAY_DARK).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 104, 'Contexto activo', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 126, 'Conversación actual', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 148, 'Instrucciones del', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 170, 'sistema (system prompt)', 16, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');

  // Long-term sub-box — 22px spacing (was 18)
  rect(MX + 8, MY + 230, MW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5);
  addText(svg, MX + MW / 2, MY + 258, 'Largo plazo', 22, 700, S.GRAY_DARK).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 282, 'Historial de sesiones', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 304, 'Memoria semántica', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 326, 'Episodios pasados', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, MX + MW / 2, MY + 348, 'Perfil de usuario', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');

  // Dashed connector: memory → LLM
  line(MX + MW, MY + 200, 360, MY + 200, S.RED, 1, '4,3');

  // ── CONOCIMIENTO sidebar (right) ───────────────────────────────────────────
  rect(KX, KY, KW, KH, '#fef7f8', S.RED, 1.5, '5,3', 8);
  addText(svg, KX + KW / 2, KY + 28, 'Conocimiento', 24, 700, S.RED);

  // RAG sub-box — 22px spacing (was 18)
  rect(KX + 8, KY + 52, KW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5);
  addText(svg, KX + KW / 2, KY + 80, 'RAG', 22, 700, S.GRAY_DARK).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 104, 'Recuperación semántica', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 126, 'vectorial de textos', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 148, 'Búsqueda híbrida', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 170, 'en documentos propios', 16, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');

  // Docs sub-box — 22px spacing (was 18)
  rect(KX + 8, KY + 230, KW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5);
  addText(svg, KX + KW / 2, KY + 258, 'Documentos', 22, 700, S.GRAY_DARK).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 282, 'Bases de datos', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 304, 'Archivos propios', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 326, 'Fuentes externas', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');
  addText(svg, KX + KW / 2, KY + 348, 'APIs de conocimiento', 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');

  // Dashed connector: LLM → knowledge
  line(620, MY + 200, KX, MY + 200, S.RED, 1, '4,3');

  // ── CENTRE CYCLE ── 3 numbered phases ──────────────────────────────────────
  // Phase boxes: x=360–620 (w=260), centred at CX=490

  // 1. PERCIBIR
  rect(PHASE_X, P1_Y, PHASE_W, P1_H, S.GRAY_LIGHT, S.GRAY_MID, 1.5, null, 8);
  badge(PHASE_X + 20, P1_Y + P1_H / 2, 1);
  addText(svg, CX + 8, P1_Y + 34, 'Percibir', 26, 700, S.TEXT);
  addText(svg, CX + 8, P1_Y + 64, 'Entrada y observaciones', 18, 400, S.GRAY, 'middle', true);

  line(CX, P1_Y + P1_H, CX, P1_Y + P1_H + PHASE_GAP, S.GRAY_MID, 2, null, 'ag');

  // 2. RAZONAR
  const p2y = P1_Y + P1_H + PHASE_GAP; // 302
  rect(PHASE_X, p2y, PHASE_W, P2_H, 'url(#llmGrad)', 'none', 0, null, 10);
  badge(PHASE_X + 20, p2y + P2_H / 2, 2);
  addText(svg, CX + 8, p2y + 32, 'Razonar · Planificar', 26, 700, S.WHITE);
  addText(svg, CX + 8, p2y + 64, 'Modelo de Lenguaje LLM', 18, 400, 'rgba(255,255,255,0.88)', 'middle', true);
  addText(svg, CX + 8, p2y + 90, 'Reflexión · Síntesis', 18, 400, 'rgba(255,255,255,0.72)', 'middle', true);
  addText(svg, CX + 8, p2y + 116, 'Selección de acción', 18, 400, 'rgba(255,255,255,0.72)', 'middle', true);

  line(CX, p2y + P2_H, CX, p2y + P2_H + PHASE_GAP, S.GRAY_MID, 2, null, 'ag');

  // 3. ACTUAR
  const p3y = p2y + P2_H + PHASE_GAP; // 506
  rect(PHASE_X, p3y, PHASE_W, P3_H, '#fff5f7', S.RED, 1.5, null, 8);
  badge(PHASE_X + 20, p3y + P3_H / 2, 3);
  addText(svg, CX + 8, p3y + 34, 'Actuar', 26, 700, S.RED).attr('data-skip-check', '1');
  addText(svg, CX + 8, p3y + 64, 'Llamada a herramienta', 19, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1');

  // ── OBSERVE loop-back (right gap) ─────────────────────────────────────────
  svg.append('path')
    .attr('d', `M 620,${p3y + P3_H/2} L ${LOOP_X},${p3y + P3_H/2} L ${LOOP_X},${P1_Y + P1_H/2} L 620,${P1_Y + P1_H/2}`)
    .attr('fill', 'none')
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')
    .attr('marker-end', 'url(#ag)');
  svg.append('text')
    .attr('transform', `translate(${LOOP_X + 16}, ${(P1_Y + p3y + P3_H) / 2}) rotate(90)`)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 18).attr('font-style', 'italic')
    .attr('fill', S.GRAY_MID)
    .text('observaciones');

  // ── ACTUAR → TOOLS arrow ───────────────────────────────────────────────────
  line(CX, p3y + P3_H, CX, 682, S.RED, 2, null, 'ar');
  addText(svg, CX + 10, 652, 'acciones', 18, 400, S.RED, 'start', true);

  // ── HERRAMIENTAS ──────────────────────────────────────────────────────────
  addText(svg, CX, TOOLS_LABEL_Y, 'H E R R A M I E N T A S', 20, 700, S.GRAY_MID);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { tools } = require('./data.json');

  tools.forEach((t, i) => {
    const tx = TOOL_START_X + i * (TOOL_W + TOOL_GAP);
    const tcx = tx + TOOL_W / 2;
    rect(tx, TOOL_Y, TOOL_W, TOOL_H, S.GRAY_LIGHT, S.GRAY_MID, 1, null, 7);
    addText(svg, tcx, TOOL_Y + 38, t.label, 18, 700, S.GRAY_DARK);  // was 22 — "Ejecución de Código" clips at 22
    addText(svg, tcx, TOOL_Y + 66, t.sub, 16, 400, S.GRAY, 'middle', true);
  });

  return document.body.innerHTML;
};
