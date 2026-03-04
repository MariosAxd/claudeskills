'use strict';
const { makeSVG, addMarker } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 1000, H = 540;             // canvas size (SVG pixels)
  const BW = 185;                      // box width (wide enough for title font 20, longest title ≈180px)
  const BH = 260;                      // box height
  const RX = 12;                       // box corner radius
  const GAP = 11;                      // horizontal gap between boxes
  const BADGE_R = 16;                  // step number badge circle radius
  const BADGE_OFFSET_X = 22;          // badge centre offset from box right edge
  const BADGE_OFFSET_Y = 22;          // badge centre offset from box top edge
  const ICON_OFFSET_Y = 80;           // icon y offset from box top (centre of upper portion)
  const TITLE_OFFSET_Y = 130;         // title y offset from box top
  const DESC_OFFSET_Y = 175;          // first description line y offset from box top
  const DESC_LINE_SPACING = 28;       // vertical spacing between description lines
  const FONT_BADGE = 22;              // step number badge font size
  const FONT_ICON = 22;               // icon font size
  const FONT_TITLE = 20;              // box title font size
  const FONT_DESC = 16;               // description line font size (fits BW=185, longest line ≈182px)

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { steps } = require('./data.json');

  const totalW = steps.length * BW + (steps.length - 1) * GAP;
  const startX = (W - totalW) / 2;
  const BY = (H - BH) / 2;

  const defs = svg.append('defs');
  addMarker(defs, 'arr3', S.GRAY_MID, 'fwd', 5);

  steps.forEach((step, i) => {
    const x = startX + i * (BW + GAP);
    const cx = x + BW / 2;

    // Arrow between boxes
    if (i > 0) {
      svg.append('line')
        .attr('x1', x - GAP).attr('y1', BY + BH/2)
        .attr('x2', x - 2).attr('y2', BY + BH/2)
        .attr('stroke', S.GRAY_MID).attr('stroke-width', 2)
        .attr('marker-end','url(#arr3)');
    }

    // Drop shadow
    svg.append('rect').attr('x', x+3).attr('y', BY+3)
      .attr('width', BW).attr('height', BH).attr('rx', RX)
      .attr('fill','#00000018');

    // Box
    svg.append('rect').attr('x', x).attr('y', BY)
      .attr('width', BW).attr('height', BH).attr('rx', RX)
      .attr('fill', step.fill);

    // Step number badge
    svg.append('circle').attr('cx', x+BW-BADGE_OFFSET_X).attr('cy', BY+BADGE_OFFSET_Y).attr('r', BADGE_R)
      .attr('fill', step.textFill === S.WHITE ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)');
    svg.append('text').attr('x', x+BW-BADGE_OFFSET_X).attr('y', BY+BADGE_OFFSET_Y)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_BADGE).attr('font-weight', 700)
      .attr('fill', step.textFill).text(i+1);

    // Icon (centered in upper portion)
    svg.append('text').attr('x', cx).attr('y', BY + ICON_OFFSET_Y)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family','monospace').attr('font-size', FONT_ICON).attr('font-weight', 700)
      .attr('fill', step.textFill === S.WHITE ? 'rgba(255,255,255,0.7)' : S.GRAY_MID)
      .text(step.icon);

    // Title — font 20 fits BW=185 (longest title "Texto de entrada"=180px)
    svg.append('text').attr('x', cx).attr('y', BY + TITLE_OFFSET_Y)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_TITLE).attr('font-weight', 700)
      .attr('fill', step.textFill).text(step.title);

    // Description lines — font 16 fits BW=185 (longest line ≈182px)
    step.lines.forEach((line, li) => {
      svg.append('text').attr('x', cx).attr('y', BY + DESC_OFFSET_Y + li*DESC_LINE_SPACING)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_DESC).attr('font-style','italic')
        .attr('fill', step.textFill === S.WHITE ? 'rgba(255,255,255,0.82)' : S.GRAY)
        .text(line);
    });
  });

  return document.body.innerHTML;
};
