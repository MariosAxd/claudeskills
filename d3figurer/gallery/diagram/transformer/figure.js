'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 920, H = 580;              // canvas size in SVG pixels
  const WY = 310;                      // word row y centre
  const wordBoxH = 56;                 // height of each word box
  const lx = 580, ly = 448;           // legend top-left position
  const ANN_X = 30,  ANN_Y = WY - 210; // annotation box top-left ("Alta atención" callout)
  const ANN_W = 220, ANN_H = 62;       // annotation box width and height (taller to contain 2 text lines)
  const IN_X  = 30,  IN_Y  = WY + 12; // IN label position
  const OUT_X = 880, OUT_Y = WY + 50; // OUT label — moved below word row to avoid "hambre" overlap
  // Font sizes
  const FONT_WORD       = 28;          // word token labels inside boxes
  const FONT_ANNOTATION = 22;          // annotation box text
  const FONT_SUBTITLE   = 20;          // bottom note / subtitle line
  const FONT_LEGEND     = 20;          // legend text labels
  const FONT_IN_OUT     = 20;          // IN / OUT edge labels

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { words, attentionFrom } = require('./data.json');

  // Attention arcs
  const sourceWord = words.find(w => w.text === 'él');
  words.forEach(target => {
    if (target.text === 'él') return;
    const score = attentionFrom[target.text] || 0;
    if (score < 0.01) return;
    const sw = score * 14 + 0.5;
    const opacity = 0.15 + score * 0.8;
    const color = score > 0.5 ? S.RED : (score > 0.15 ? '#cc3355' : S.GRAY_MID);

    const midX = (sourceWord.x + target.x) / 2;
    const arcH = -80 - score * 140;
    const d = `M ${sourceWord.x},${WY-28} Q ${midX},${WY+arcH} ${target.x},${WY-28}`;

    svg.append('path').attr('d', d).attr('fill','none')
      .attr('stroke', color).attr('stroke-width', sw).attr('opacity', opacity);
  });

  // Word boxes
  words.forEach(w => {
    const isSource = w.text === 'él';
    const hasStrong = attentionFrom[w.text] > 0.5;
    const boxW = Math.max(w.text.length * 13 + 18, 44);
    const boxFill = isSource ? S.RED : (hasStrong ? '#fff0f3' : S.GRAY_LIGHT);
    const strokeC = isSource ? S.RED_DARK : (hasStrong ? S.RED : S.GRAY_MID);

    svg.append('rect')
      .attr('x', w.x - boxW/2).attr('y', WY - wordBoxH/2)
      .attr('width', boxW).attr('height', wordBoxH)
      .attr('rx', 8)
      .attr('fill', boxFill).attr('stroke', strokeC)
      .attr('stroke-width', isSource ? 2.5 : 1);

    svg.append('text').attr('x', w.x).attr('y', WY)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_WORD)
      .attr('font-weight', isSource || hasStrong ? 700 : 400)
      .attr('fill', isSource ? S.WHITE : S.TEXT)
      .text(w.text);
  });

  // "El gato" strong attention annotation — box sized to contain text
  svg.append('line').attr('x1', 140).attr('y1', WY-148).attr('x2', 140).attr('y2', WY-128)
    .attr('stroke', S.RED).attr('stroke-width', 1.5).attr('stroke-dasharray','3,2');
  svg.append('rect').attr('x', ANN_X).attr('y', ANN_Y).attr('width', ANN_W).attr('height', ANN_H)
    .attr('rx', 8).attr('fill','#fff0f3').attr('stroke', S.RED).attr('stroke-width', 1.5);
  svg.append('text').attr('x', 140).attr('y', WY-196)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_ANNOTATION).attr('font-weight', 700)
    .attr('fill', S.RED).text('Alta atención (72%)');
  svg.append('text').attr('x', 140).attr('y', WY-162)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_SUBTITLE).attr('font-style','italic')
    .attr('fill', S.RED_DARK).text('"él" se refiere a "gato"');

  // Bottom note
  svg.append('text').attr('x', W/2).attr('y', 402)
    .attr('text-anchor','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_SUBTITLE)
    .attr('fill', S.GRAY_DARK)
    .text('El modelo identifica que «él» se refiere a «gato» — no a «ratón» — resolviendo la ambigüedad');

  // IN / OUT labels
  svg.append('text').attr('x', IN_X).attr('y', IN_Y)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_IN_OUT).attr('font-weight', 700)
    .attr('fill', S.GRAY_MID).text('IN');

  svg.append('text').attr('x', OUT_X).attr('y', OUT_Y)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_IN_OUT).attr('font-weight', 700)
    .attr('fill', S.GRAY_MID).text('OUT');

  // Legend for arc thickness — items are intentionally stacked; data-skip-check suppresses false TOO CLOSE flags
  svg.append('text').attr('x', lx).attr('y', ly)
    .attr('data-skip-check', '1')
    .attr('font-family', S.FONT).attr('font-size', FONT_LEGEND).attr('font-weight', 700)
    .attr('fill', S.TEXT_LIGHT).text('Grosor del arco = peso de atención');
  svg.append('line').attr('x1', lx).attr('y1', ly+18).attr('x2', lx+66).attr('y2', ly+18)
    .attr('stroke', S.RED).attr('stroke-width', 8).attr('opacity', 0.7);
  svg.append('text').attr('x', lx+72).attr('y', ly+22)
    .attr('data-skip-check', '1')
    .attr('font-family', S.FONT).attr('font-size', FONT_LEGEND).attr('fill', S.TEXT_LIGHT).text('alta');
  svg.append('line').attr('x1', lx).attr('y1', ly+40).attr('x2', lx+66).attr('y2', ly+40)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5).attr('opacity', 0.5);
  svg.append('text').attr('x', lx+72).attr('y', ly+44)
    .attr('data-skip-check', '1')
    .attr('font-family', S.FONT).attr('font-size', FONT_LEGEND).attr('fill', S.TEXT_LIGHT).text('baja');

  return document.body.innerHTML;
};
