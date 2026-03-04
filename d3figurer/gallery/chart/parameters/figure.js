'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 900, H = 640;           // canvas size in SVG pixels
  const MODEL_POS = [               // GPT circle centres (x, y)
    { cx: 150, cy: 510 },           // GPT-1
    { cx: 430, cy: 440 },           // GPT-2
    { cx: 720, cy: 200 },           // GPT-3
  ];
  const maxR    = 200;              // maximum bubble radius (used for GPT-3)
  const LABEL_DX = 16;             // x gap from circle edge to outside label
  const LABEL_DY = [-20, 14, 46];  // y offsets for outside label lines: [name, count, unit]
  // Font sizes
  const FONT_YEAR         = 26;    // year tick labels on x-axis
  const FONT_INSIDE_NAME  = 38;    // model name inside large circles
  const FONT_INSIDE_COUNT = 42;    // parameter count inside large circles
  const FONT_INSIDE_UNIT  = 22;    // "parámetros" unit label inside large circles
  const FONT_OUTSIDE      = 28;    // model name / count outside small circles
  const FONT_OUTSIDE_UNIT = 21;    // "parámetros" unit label outside small circles

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { models } = require('./data.json');

  const maxParams = 175000;
  function paramR(p) { return Math.sqrt(p / maxParams) * maxR; }

  // Year axis
  svg.append('line').attr('x1', 60).attr('y1', 550).attr('x2', 840).attr('y2', 550)
    .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1.5);

  [2018, 2019, 2020].forEach((yr, i) => {
    const cx = MODEL_POS[i].cx;
    svg.append('line').attr('x1', cx).attr('y1', 548).attr('x2', cx).attr('y2', 558)
      .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5);
    svg.append('text').attr('x', cx).attr('y', 596)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_YEAR).attr('font-weight', 700)
      .attr('fill', S.GRAY_DARK).text(yr);
  });

  // Draw circles (largest first)
  const sorted = [...models].sort((a,b) => b.params - a.params);
  sorted.forEach((m) => {
    const originalIndex = models.indexOf(m);
    const pos = MODEL_POS[originalIndex];
    const r = paramR(m.params);
    const inside = r >= 55;

    svg.append('circle').attr('cx', pos.cx).attr('cy', pos.cy).attr('r', r)
      .attr('fill', m.color).attr('opacity', 0.88);

    if (inside) {
      // data-skip-check: name/count/unit are intentionally stacked labels for the same data point
      svg.append('text').attr('x', pos.cx).attr('y', pos.cy - 28)
        .attr('data-skip-check', '1')
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_INSIDE_NAME).attr('font-weight', 700)
        .attr('fill', m.textColor).text(m.name);
      svg.append('text').attr('x', pos.cx).attr('y', pos.cy + 22)
        .attr('data-skip-check', '1')
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_INSIDE_COUNT).attr('font-weight', 700)
        .attr('fill', m.textColor).text(m.paramsLabel);
      svg.append('text').attr('x', pos.cx).attr('y', pos.cy + 64)
        .attr('data-skip-check', '1')
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_INSIDE_UNIT).attr('font-style','italic')
        .attr('fill', 'rgba(255,255,255,0.75)').text('parámetros');
    } else {
      const lx = pos.cx + r + LABEL_DX;
      const ly = pos.cy;

      svg.append('line')
        .attr('x1', pos.cx + r + 2).attr('y1', ly)
        .attr('x2', lx + 2).attr('y2', ly)
        .attr('stroke', S.GRAY_MID).attr('stroke-width', 1);

      // data-skip-check: name/count/unit are intentionally stacked labels for the same data point
      svg.append('text').attr('x', lx + 5).attr('y', ly + LABEL_DY[0])
        .attr('data-skip-check', '1')
        .attr('text-anchor','start').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_OUTSIDE).attr('font-weight', 700)
        .attr('fill', S.GRAY_DARK).text(m.name);
      svg.append('text').attr('x', lx + 5).attr('y', ly + LABEL_DY[1])
        .attr('data-skip-check', '1')
        .attr('text-anchor','start').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_OUTSIDE).attr('font-weight', 700)
        .attr('fill', S.GRAY_DARK).text(m.paramsLabel);
      svg.append('text').attr('x', lx + 5).attr('y', ly + LABEL_DY[2])
        .attr('data-skip-check', '1')
        .attr('text-anchor','start').attr('dominant-baseline','middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_OUTSIDE_UNIT).attr('font-style','italic')
        .attr('fill', S.GRAY).text('parámetros');
    }
  });

  return document.body.innerHTML;
};
