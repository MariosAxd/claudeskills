'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function () {
  // ── Layout ──────────────────────────────────────────────────────────────
  // Adjust these to reposition/resize elements without reading render code.
  const W = 820, H = 490;                  // canvas size (SVG pixels)

  // Left panel (XOR Equations)
  const LEFT_X = 20, LEFT_Y = 20;         // top-left corner of left panel rect
  const LEFT_W = 340, LEFT_H = 420;       // size of left panel
  const LEFT_RX = 12;                      // corner radius of left panel
  const LEFT_CX = LEFT_X + LEFT_W / 2;   // centre x of left panel  → 190

  const PANEL_TITLE_Y = 58;               // y of panel title labels
  const PANEL_TITLE_FONT = 24;            // font size of panel titles

  const EQ_START_Y = 155;                 // y centre of first equation row
  const EQ_SPACING = 72;                  // vertical spacing between equation rows
  const EQ_A_X    = 80;                   // x centre of operand A number
  const EQ_OP_CX  = 140;                  // x centre of XOR operator circle badge
  const EQ_OP_R   = 22;                   // radius of XOR operator circle
  const EQ_OP_FONT = 13;                  // font size of "XOR" text inside circle
  const EQ_B_X    = 200;                  // x centre of operand B number
  const EQ_EQ_X   = 250;                  // x centre of "=" sign
  const EQ_RESULT_X = 300;               // x centre of result number
  const EQ_NUM_FONT = 38;                 // font size of operand and result numbers
  const EQ_EQ_FONT  = 34;                 // font size of "=" sign
  // DATA — loaded from data.json (edit that file to customise the figure)
  const { EQ_ROWS, POINTS, FAILED_LINES, X_MARKS } = require('./data.json');

  // Right panel (Scatter plot)
  const RIGHT_X = 420, RIGHT_Y = 20;     // top-left corner of right panel
  const RIGHT_W = 380, RIGHT_H = 420;    // size of right panel
  const RIGHT_RX = 12;                    // corner radius of right panel
  const RIGHT_CX = RIGHT_X + RIGHT_W / 2; // centre x of right panel  → 610

  // Axes origin and extents for the scatter plot
  const AX_OX = 480, AX_OY = 358;        // origin of scatter axes (bottom-left corner)
  const AX_X2 = 780;                      // right end of x-axis
  const AX_Y2 = 114;                      // top end of y-axis

  const AXIS_FONT = 21;                   // font size of axis tick labels and titles
  const AX_LABEL_X = 630;                // x of "Entrada A" axis label (centred below x-axis)
  const AX_LABEL_X_Y = 394;             // y of x-axis label
  const AX_LABEL_Y_X = 450;             // x of "Entrada B" label (rotated, left of y-axis)
  const AX_LABEL_Y_Y = 238;             // y of "Entrada B" label (before rotation)

  const POINT_R = 22;                     // radius of scatter plot data points
  const X_MARK_FONT = 30;                 // font size of ✗ marks

  const FOOTER_Y1 = 448;                  // y of first footer line (italic note)
  const FOOTER_Y2 = 480;                  // y of second footer line (with coloured dots)
  const FOOTER_CX = 600;                  // x centre of both footer lines
  const FOOTER_FONT = 21;                 // font size of footer text
  const FOOTER_DOT_FONT = 26;            // font size of the ● dot glyphs in footer line 2
  // ────────────────────────────────────────────────────────────────────────

  const { svg, document } = makeSVG(W, H);
  S.fontStyle(svg);

  // ── LEFT PANEL: XOR Equations ────────────────────────────────────────────────
  svg.append('rect')
    .attr('x', LEFT_X).attr('y', LEFT_Y)
    .attr('width', LEFT_W).attr('height', LEFT_H)
    .attr('rx', LEFT_RX)
    .attr('fill', '#fafafa')
    .attr('stroke', S.GRAY_LIGHT)
    .attr('stroke-width', 1);

  // Title
  svg.append('text')
    .attr('x', LEFT_CX).attr('y', PANEL_TITLE_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', PANEL_TITLE_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.TEXT)
    .text('Operación XOR');

  EQ_ROWS.forEach((row, i) => {
    const ey = EQ_START_Y + i * EQ_SPACING;
    const isOne = row.result === '1';

    // Operand A
    svg.append('text')
      .attr('x', EQ_A_X).attr('y', ey)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT).attr('font-size', EQ_NUM_FONT).attr('font-weight', 700)
      .attr('fill', S.GRAY_DARK)
      .text(row.a);

    // XOR operator badge
    svg.append('circle')
      .attr('cx', EQ_OP_CX).attr('cy', ey)
      .attr('r', EQ_OP_R)
      .attr('fill', S.GRAY_DARK);
    svg.append('text')
      .attr('x', EQ_OP_CX).attr('y', ey)
      .attr('data-skip-check', '1')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT).attr('font-size', EQ_OP_FONT).attr('font-weight', 700)
      .attr('fill', S.WHITE)
      .text('XOR');

    // Operand B
    svg.append('text')
      .attr('x', EQ_B_X).attr('y', ey)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT).attr('font-size', EQ_NUM_FONT).attr('font-weight', 700)
      .attr('fill', S.GRAY_DARK)
      .text(row.b);

    // Equals sign
    svg.append('text')
      .attr('x', EQ_EQ_X).attr('y', ey)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT).attr('font-size', EQ_EQ_FONT)
      .attr('fill', S.GRAY_MID)
      .text('=');

    // Result (red for 1, gray for 0)
    svg.append('text')
      .attr('x', EQ_RESULT_X).attr('y', ey)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT).attr('font-size', EQ_NUM_FONT).attr('font-weight', 700)
      .attr('fill', isOne ? S.RED : S.GRAY)
      .text(row.result);
  });

  // ── RIGHT PANEL: Scatter plot ─────────────────────────────────────────────────
  svg.append('rect')
    .attr('x', RIGHT_X).attr('y', RIGHT_Y)
    .attr('width', RIGHT_W).attr('height', RIGHT_H)
    .attr('rx', RIGHT_RX)
    .attr('fill', '#fafafa')
    .attr('stroke', S.GRAY_LIGHT)
    .attr('stroke-width', 1);

  // Title
  svg.append('text')
    .attr('x', RIGHT_CX).attr('y', PANEL_TITLE_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', PANEL_TITLE_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.TEXT)
    .text('¿Existe una línea separadora?');

  // Axes
  svg.append('line')
    .attr('x1', AX_OX).attr('y1', AX_OY)
    .attr('x2', AX_X2).attr('y2', AX_OY)
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 1.5);
  svg.append('line')
    .attr('x1', AX_OX).attr('y1', AX_OY)
    .attr('x2', AX_OX).attr('y2', AX_Y2)
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 1.5);

  // Axis labels
  svg.append('text')
    .attr('x', AX_LABEL_X).attr('y', AX_LABEL_X_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', AXIS_FONT)
    .attr('fill', S.GRAY)
    .text('Entrada A');

  svg.append('text')
    .attr('x', AX_LABEL_Y_X).attr('y', AX_LABEL_Y_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', AXIS_FONT)
    .attr('fill', S.GRAY)
    .attr('transform', `rotate(-90, ${AX_LABEL_Y_X}, ${AX_LABEL_Y_Y})`)
    .text('Entrada B');

  // Tick labels
  svg.append('text').attr('x', AX_OX).attr('y', AX_OY + 20)
    .attr('text-anchor', 'middle').attr('font-family', S.FONT)
    .attr('font-size', AXIS_FONT).attr('fill', S.GRAY).text('0');
  svg.append('text').attr('x', 758).attr('y', AX_OY + 20)
    .attr('text-anchor', 'middle').attr('font-family', S.FONT)
    .attr('font-size', AXIS_FONT).attr('fill', S.GRAY).text('1');
  svg.append('text').attr('x', AX_OX - 18).attr('y', AX_OY)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', AXIS_FONT).attr('fill', S.GRAY).text('0');
  svg.append('text').attr('x', AX_OX - 18).attr('y', 132)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', AXIS_FONT).attr('fill', S.GRAY).text('1');

  // Failed separating lines
  FAILED_LINES.forEach(ln => {
    svg.append('line')
      .attr('x1', ln.x1).attr('y1', ln.y1)
      .attr('x2', ln.x2).attr('y2', ln.y2)
      .attr('stroke', S.GRAY_MID)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.5);
  });

  // Red X marks
  X_MARKS.forEach(m => {
    svg.append('text')
      .attr('x', m.x).attr('y', m.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT)
      .attr('font-size', X_MARK_FONT)
      .attr('font-weight', 700)
      .attr('fill', S.RED)
      .text('\u2717');
  });

  // Data point circles
  POINTS.forEach(pt => {
    svg.append('circle')
      .attr('cx', pt.cx).attr('cy', pt.cy)
      .attr('r', POINT_R)
      .attr('fill', pt.isOne ? S.RED : S.GRAY_LIGHT)
      .attr('stroke', pt.isOne ? 'none' : S.GRAY_MID)
      .attr('stroke-width', 2);
  });

  // Footer text — extra line spacing (26px) to avoid overlap at font 21
  // data-skip-check: intentionally stacked 2-line footer label
  svg.append('text')
    .attr('x', FOOTER_CX).attr('y', FOOTER_Y1)
    .attr('data-skip-check', '1')
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', FOOTER_FONT)
    .attr('font-style', 'italic')
    .attr('fill', S.GRAY)
    .text('Ninguna línea recta puede separar');

  const footerLine2 = svg.append('text')
    .attr('x', FOOTER_CX).attr('y', FOOTER_Y2)
    .attr('data-skip-check', '1')
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', FOOTER_FONT)
    .attr('font-style', 'italic')
    .attr('fill', S.GRAY);

  footerLine2.append('tspan').text('los ');
  footerLine2.append('tspan').attr('fill', S.RED).attr('font-style', 'normal').attr('font-size', FOOTER_DOT_FONT).text('\u25CF');
  footerLine2.append('tspan').text(' de los ');
  footerLine2.append('tspan').attr('fill', S.GRAY_MID).attr('font-style', 'normal').attr('font-size', FOOTER_DOT_FONT).text('\u25CF');

  return document.body.innerHTML;
};
