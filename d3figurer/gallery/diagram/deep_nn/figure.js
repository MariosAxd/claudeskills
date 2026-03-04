'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 1000, H = 620;               // canvas size (SVG pixels)
  const R = 16;                           // node circle radius
  const Y_CENTER = 290;                  // vertical centre of node columns
  const LABEL_Y_TOP = 50;               // y position of layer name labels above nodes
  const LABEL_Y_BOT = 536;              // y position of sublabels below nodes
  const BRACKET_Y   = 74;               // y of the "Capas Ocultas" dashed bracket line
  const BRACKET_TEXT_Y = 92;            // y of the "Capas Ocultas" label
  const GRID_X = 24;                    // x origin of input pixel grid (top-left)
  const GRID_Y = Y_CENTER - 18;         // y origin of input pixel grid
  const FONT_LABEL = 22;                // font size for layer name labels
  const FONT_SUBLABEL = 20;             // font size for sublabels and bracket text

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { layers } = require('./data.json');

  function nodeYs(n) {
    const spacing = Math.min(58, 360 / Math.max(n - 1, 1));
    const totalH = spacing * (n - 1);
    const top = Y_CENTER - totalH / 2;
    return d3.range(n).map(i => top + i * spacing);
  }

  // Connections
  for (let li = 0; li < layers.length - 1; li++) {
    const la = layers[li], lb = layers[li + 1];
    const ays = nodeYs(la.n), bys = nodeYs(lb.n);
    ays.forEach(ay => {
      bys.forEach(by => {
        svg.append('line')
          .attr('x1', la.cx + R).attr('y1', ay)
          .attr('x2', lb.cx - R).attr('y2', by)
          .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 0.7).attr('opacity', 0.6);
      });
    });
  }

  // Nodes
  layers.forEach(layer => {
    const ys = nodeYs(layer.n);
    ys.forEach(y => {
      svg.append('circle')
        .attr('cx', layer.cx).attr('cy', y).attr('r', R)
        .attr('fill', layer.color).attr('stroke', S.WHITE).attr('stroke-width', 1.5);
    });
  });

  // Layer labels above
  layers.forEach(layer => {
    svg.append('text').attr('x', layer.cx).attr('y', LABEL_Y_TOP)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_LABEL).attr('font-weight', 700)
      .attr('fill', layer.color === '#cccccc' ? S.GRAY_DARK : (layer.color === S.RED ? S.RED : layer.color))
      .text(layer.label);
  });

  // Sublabels below — data-skip-check: adjacent sublabels at same y are intentionally close
  layers.forEach(layer => {
    svg.append('text').attr('x', layer.cx).attr('y', LABEL_Y_BOT)
      .attr('data-skip-check', '1')
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_SUBLABEL).attr('font-style','italic')
      .attr('fill', S.TEXT_LIGHT)
      .text(layer.sub);
  });

  // Bracket/label "Capas Ocultas"
  const bx1 = layers[1].cx - 20, bx2 = layers[4].cx + 20;
  svg.append('line').attr('x1', bx1).attr('y1', BRACKET_Y).attr('x2', bx2).attr('y2', BRACKET_Y)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1).attr('stroke-dasharray','3,2');
  svg.append('text').attr('x', (bx1+bx2)/2).attr('y', BRACKET_TEXT_Y)
    .attr('text-anchor','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_SUBLABEL)
    .attr('fill', S.GRAY_MID).text('Capas Ocultas (aprendizaje profundo)');

  // Input pixel grid
  [0,1,2].forEach(row => {
    [0,1,2].forEach(col => {
      const shade = (row + col) % 2 === 0 ? S.GRAY_MID : S.GRAY_LIGHT;
      svg.append('rect')
        .attr('x', GRID_X + col*10).attr('y', GRID_Y + row*10)
        .attr('width', 9).attr('height', 9)
        .attr('fill', shade);
    });
  });

  return document.body.innerHTML;
};
