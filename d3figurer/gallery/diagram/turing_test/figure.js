'use strict';
const { makeSVG, addMarker, addText, addIcon } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

// Material Design Icons paths (Apache 2.0 license)
const MDI = {
  monitor: 'M20,17H4V5H20M20,3H4C2.89,3 2,3.89 2,5V17A2,2 0 0,0 4,19H10V21H8V23H16V21H14V19H20A2,2 0 0,0 22,17V5C22,3.89 21.11,3 20,3Z',
  person: 'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z',
  keyboard: 'M19,10H17V8H19V10M19,13H17V11H19V13M16,10H14V8H16V10M16,13H14V11H16V13M13,10H11V8H13V10M13,13H11V11H13V13M10,10H8V8H10V10M10,13H8V11H10V13M7,10H5V8H7V10M7,13H5V11H7V13M3,5V19H21V5H3M21,3A2,2 0 0,1 23,5V19A2,2 0 0,1 21,21H3A2,2 0 0,1 1,19V5A2,2 0 0,1 3,3H21Z',
  file: 'M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,0 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z',
};

module.exports = function () {
  // ── Layout ──────────────────────────────────────────────────────────────
  // Adjust these to reposition/resize elements without reading render code.
  const W = 900, H = 620;                   // canvas size (SVG pixels)

  const BOX_W = 248, BOX_H = 228;          // width/height of the A and B contestant boxes
  const BOX_Y = 66;                         // top edge of both contestant boxes
  const BOX_A_X = 20;                       // left edge of box A (Computer)
  const BOX_B_X = 632;                      // left edge of box B (Human)
  const BOX_A_CX = BOX_A_X + BOX_W / 2;   // centre x of box A  → 144
  const BOX_B_CX = BOX_B_X + BOX_W / 2;   // centre x of box B  → 756

  const LABEL_Y = 52;                       // y of "A — Computadora" / "B — Persona" titles
  const LABEL_FONT = 25;                    // font size for box titles

  const MONITOR_CY = 152;                   // cy of monitor icon in box A
  const KEYBOARD_CY = 252;                  // cy of keyboard icon in box A
  const PERSON_CY = 148;                    // cy of person icon in box B (slightly different vertical centre)
  const KEYBOARD_B_CY = 248;               // cy of keyboard icon in box B
  const ICON_MAIN_SIZE = 90;                // size of monitor/person icon
  const ICON_KB_SIZE = 54;                  // size of keyboard icon
  const CAPTION_A_Y = 282;                  // y of "responde en texto" caption in box A
  const CAPTION_B_Y = 278;                  // y of "responde en texto" caption in box B

  const PAPER_X = 300, PAPER_Y = 170;      // top-left of the centre paper/text box
  const PAPER_W = 300, PAPER_H = 148;      // size of the centre paper box
  const PAPER_CX = PAPER_X + PAPER_W / 2; // centre x of paper box  → 450
  const PAPER_CHANNEL_Y = 156;             // y of "Solo texto — sin identidad" label above paper box
  const FILE_ICON_CY = 218;                // cy of file icon inside paper box
  const FILE_ICON_SIZE = 44;               // size of file icon

  const LINE1_Y = 248, LINE2_Y = 264, LINE3_Y = 280;  // y positions of the three fake text lines
  const LINE_X = 338, LINE_W1 = 224, LINE_W2 = 168, LINE_W3 = 196; // x and widths of fake text lines

  // Arrows from A/B boxes to paper box (diagonal)
  const ARR_AB_Y1 = 180;                   // y where the diagonal arrows start (at bottom of boxes)
  const ARR_A_X1 = 268;                    // x of arrow start from box A
  const ARR_B_X1 = 632;                    // x of arrow start from box B
  const ARR_PAPER_X2_L = 302;             // x where left arrow meets the paper box corner
  const ARR_PAPER_X2_R = 598;             // x where right arrow meets the paper box corner
  const ARR_PAPER_Y2 = 216;               // y where the diagonal arrows end

  // Arrow from paper box down to evaluator
  const ARR_DOWN_Y1 = 318;                 // y where the downward arrow starts (paper box bottom)
  const ARR_DOWN_Y2 = 440;                 // y where the downward arrow ends (above evaluator)

  // Evaluator (C) at the bottom
  const EVAL_PERSON_CX = 428;             // cx of evaluator person icon
  const EVAL_PERSON_CY = 480;             // cy of evaluator person icon
  const EVAL_PERSON_SIZE = 72;            // size of evaluator person icon
  const EVAL_Q_X = 502;                   // x of the red "?" glyph
  const EVAL_Q_Y = 480;                   // y of the red "?" glyph (dominant-baseline: middle)
  const EVAL_Q_FONT = 80;                 // font size of the "?" glyph
  const EVAL_LABEL_Y = 546;              // y of "C — Evaluador" label
  const EVAL_CAPTION_Y = 578;            // y of the question caption below evaluator
  // ────────────────────────────────────────────────────────────────────────

  const { svg, document } = makeSVG(W, H);

  const defs = svg.append('defs');
  addMarker(defs, 'arr', S.GRAY_MID);

  // ── A — COMPUTADORA BOX (top-left) ──────────────────────────────────────────
  svg.append('rect')
    .attr('x', BOX_A_X).attr('y', BOX_Y)
    .attr('width', BOX_W).attr('height', BOX_H)
    .attr('rx', 10)
    .attr('fill', '#f5f5f5')
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 1.5);

  addText(svg, BOX_A_CX, LABEL_Y, 'A \u2014 Computadora', LABEL_FONT, 700, S.TEXT, 'middle', false);

  addIcon(svg, MDI.monitor, BOX_A_CX, MONITOR_CY, ICON_MAIN_SIZE, S.GRAY_DARK);
  addIcon(svg, MDI.keyboard, BOX_A_CX, KEYBOARD_CY, ICON_KB_SIZE, S.GRAY_MID);

  addText(svg, BOX_A_CX, CAPTION_A_Y, 'responde en texto', 19, 400, S.GRAY, 'middle', true);

  // ── B — PERSONA BOX (top-right) ─────────────────────────────────────────────
  svg.append('rect')
    .attr('x', BOX_B_X).attr('y', BOX_Y)
    .attr('width', BOX_W).attr('height', BOX_H)
    .attr('rx', 10)
    .attr('fill', '#fff5f7')
    .attr('stroke', S.RED_LIGHT)
    .attr('stroke-width', 1.5);

  addText(svg, BOX_B_CX, LABEL_Y, 'B \u2014 Persona', LABEL_FONT, 700, S.TEXT, 'middle', false);

  addIcon(svg, MDI.person, BOX_B_CX, PERSON_CY, ICON_MAIN_SIZE, S.GRAY_DARK);
  addIcon(svg, MDI.keyboard, BOX_B_CX, KEYBOARD_B_CY, ICON_KB_SIZE, S.GRAY_MID);

  addText(svg, BOX_B_CX, CAPTION_B_Y, 'responde en texto', 19, 400, S.GRAY, 'middle', true);

  // ── CENTER PAPER / TEXT BOX ──────────────────────────────────────────────────
  addText(svg, PAPER_CX, PAPER_CHANNEL_Y, 'Solo texto \u2014 sin identidad', 20, 400, S.GRAY, 'middle', true);

  svg.append('rect')
    .attr('x', PAPER_X).attr('y', PAPER_Y)
    .attr('width', PAPER_W).attr('height', PAPER_H)
    .attr('rx', 4)
    .attr('fill', S.WHITE)
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 1.5);

  addIcon(svg, MDI.file, PAPER_CX, FILE_ICON_CY, FILE_ICON_SIZE, S.GRAY_LIGHT);

  svg.append('rect').attr('x', LINE_X).attr('y', LINE1_Y).attr('width', LINE_W1).attr('height', 8)
    .attr('rx', 2).attr('fill', S.GRAY_MID).attr('opacity', 0.5);
  svg.append('rect').attr('x', LINE_X).attr('y', LINE2_Y).attr('width', LINE_W2).attr('height', 8)
    .attr('rx', 2).attr('fill', S.GRAY_MID).attr('opacity', 0.5);
  svg.append('rect').attr('x', LINE_X).attr('y', LINE3_Y).attr('width', LINE_W3).attr('height', 8)
    .attr('rx', 2).attr('fill', S.GRAY_MID).attr('opacity', 0.5);

  // ── ARROWS from boxes to center paper ─────────────────────────────────────────
  svg.append('line')
    .attr('x1', ARR_A_X1).attr('y1', ARR_AB_Y1)
    .attr('x2', ARR_PAPER_X2_L).attr('y2', ARR_PAPER_Y2)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 2)
    .attr('marker-end', 'url(#arr)');

  svg.append('line')
    .attr('x1', ARR_B_X1).attr('y1', ARR_AB_Y1)
    .attr('x2', ARR_PAPER_X2_R).attr('y2', ARR_PAPER_Y2)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 2)
    .attr('marker-end', 'url(#arr)');

  // ── ARROW from paper box to evaluator ────────────────────────────────────────
  svg.append('line')
    .attr('x1', PAPER_CX).attr('y1', ARR_DOWN_Y1)
    .attr('x2', PAPER_CX).attr('y2', ARR_DOWN_Y2)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 2)
    .attr('marker-end', 'url(#arr)');

  // ── C — EVALUADOR (bottom center) ─────────────────────────────────────────────
  addIcon(svg, MDI.person, EVAL_PERSON_CX, EVAL_PERSON_CY, EVAL_PERSON_SIZE, S.GRAY_DARK);

  svg.append('text')
    .attr('x', EVAL_Q_X).attr('y', EVAL_Q_Y)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', EVAL_Q_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.RED)
    .text('?');

  addText(svg, PAPER_CX, EVAL_LABEL_Y, 'C \u2014 Evaluador', 25, 700, S.TEXT, 'middle', false);

  addText(svg, PAPER_CX, EVAL_CAPTION_Y, '\u00BFCu\u00E1l respuesta proviene de la m\u00E1quina?', 21, 400, S.GRAY, 'middle', true);

  return document.body.innerHTML;
};
