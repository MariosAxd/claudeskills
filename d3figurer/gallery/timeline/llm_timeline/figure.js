'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 1000, H = 540;              // canvas size (SVG pixels)
  const TY = 260;                       // timeline axis y (centred higher to give space for labels above/below)
  const X1 = 40, X2 = 970;             // timeline left/right x extent
  const DOT_R_NORMAL = 11;             // dot radius for standard events
  const DOT_R_KEY = 18;               // dot radius for highlighted (key) events
  const DOT_RING_R = 28;              // outer dashed ring radius for key events
  const LINE_LEN_NORMAL = 38;         // stem line length for standard events
  const LINE_LEN_KEY = 54;            // stem line length for key events
  const FONT_YEAR_NORMAL = 22;        // year label font size for standard events
  const FONT_YEAR_KEY = 26;           // year label font size for key events
  const FONT_TITLE_NORMAL = 22;       // event title font size for standard events
  const FONT_TITLE_KEY = 26;          // event title font size for key events
  const FONT_SUB = 16;                // subtitle font size (all events)
  const YEAR_GAP_ABOVE = 12;          // gap between stem end and year label (above)
  const YEAR_GAP_BELOW = 20;          // gap between stem end and year label (below)
  const TITLE_GAP_ABOVE = 38;         // gap between stem end and title (above)
  const TITLE_GAP_BELOW = 50;         // gap between stem end and title (below)
  const SUB_GAP = 26;                 // gap between title and subtitle
  const ACCEL_LABEL_Y = TY - 14;      // y for "Aceleración →" label above arrow
  const FONT_ACCEL = 18;              // font size for acceleration label
  const BOTTOM_LABEL_Y = 516;         // y for bottom caption text
  const FONT_BOTTOM = 22;             // font size for bottom caption

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { events } = require('./data.json');

  // Timeline background gradient strip
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id','tlgrad').attr('x1','0%').attr('x2','100%');
  grad.append('stop').attr('offset','0%').attr('stop-color', S.GRAY_LIGHT);
  grad.append('stop').attr('offset','60%').attr('stop-color','#f5d0d8');
  grad.append('stop').attr('offset','100%').attr('stop-color','#ffccd6');

  svg.append('rect').attr('x', X1).attr('y', TY-5).attr('width', X2-X1).attr('height', 10)
    .attr('rx', 5).attr('fill','url(#tlgrad)');

  svg.append('polygon')
    .attr('points',`${X2},${TY-9} ${X2+16},${TY} ${X2},${TY+9}`)
    .attr('fill', S.RED);

  svg.append('text').attr('x', X2-8).attr('y', ACCEL_LABEL_Y)
    .attr('text-anchor', 'end')
    .attr('font-family', S.FONT).attr('font-size', FONT_ACCEL).attr('fill', S.RED).text('Aceleración →');

  events.forEach(ev => {
    const isAbove = ev.dir === 'above';
    const dotR = ev.key ? DOT_R_KEY : DOT_R_NORMAL;
    const dotFill = ev.key ? S.RED : '#cc3355';
    const dotStroke = ev.key ? S.RED_DARK : 'none';

    svg.append('circle').attr('cx', ev.x).attr('cy', TY).attr('r', dotR)
      .attr('fill', dotFill).attr('stroke', dotStroke).attr('stroke-width', ev.key ? 3 : 0);

    if (ev.key) {
      svg.append('circle').attr('cx', ev.x).attr('cy', TY).attr('r', DOT_RING_R)
        .attr('fill', 'none').attr('stroke', S.RED).attr('stroke-width', 1.5)
        .attr('stroke-dasharray','3,2').attr('opacity', 0.6);
    }

    const lineLen = ev.key ? LINE_LEN_KEY : LINE_LEN_NORMAL;
    svg.append('line')
      .attr('x1', ev.x).attr('y1', isAbove ? TY - dotR : TY + dotR)
      .attr('x2', ev.x).attr('y2', isAbove ? TY - dotR - lineLen : TY + dotR + lineLen)
      .attr('stroke', ev.key ? S.RED : S.GRAY_MID).attr('stroke-width', 1.5);

    // Year label — intentionally stacked with title; skip overlap check
    const yearY = isAbove ? TY - dotR - lineLen - YEAR_GAP_ABOVE : TY + dotR + lineLen + YEAR_GAP_BELOW;
    svg.append('text').attr('x', ev.x).attr('y', yearY)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', ev.key ? FONT_YEAR_KEY : FONT_YEAR_NORMAL).attr('font-weight', 700)
      .attr('fill', ev.key ? S.RED_DARK : S.RED).attr('data-skip-check', '1').text(ev.year);

    // Title — intentionally stacked with year and subtitle; skip overlap check
    const titleY = isAbove ? TY - dotR - lineLen - TITLE_GAP_ABOVE : TY + dotR + lineLen + TITLE_GAP_BELOW;
    svg.append('text').attr('x', ev.x).attr('y', titleY)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', ev.key ? FONT_TITLE_KEY : FONT_TITLE_NORMAL).attr('font-weight', ev.key ? 700 : 600)
      .attr('fill', ev.key ? S.RED : S.TEXT).attr('data-skip-check', '1').text(ev.title);

    // Subtitle — intentionally stacked with title; skip overlap check
    const subY = isAbove ? titleY - SUB_GAP : titleY + SUB_GAP;
    svg.append('text').attr('x', ev.x).attr('y', subY)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_SUB).attr('font-style','italic')
      .attr('fill', S.TEXT_LIGHT).attr('data-skip-check', '1').text(ev.sub);
  });

  // Bottom label — shortened to fit within W=1000
  svg.append('text').attr('x', W/2).attr('y', BOTTOM_LABEL_Y)
    .attr('text-anchor','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_BOTTOM).attr('font-style','italic')
    .attr('fill', S.GRAY)
    .text('En 2023 aparecieron más modelos nuevos que en los 6 años anteriores');

  return document.body.innerHTML;
};
