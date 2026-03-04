'use strict';
const { makeSVG, addMarker } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 880, H = 540;               // canvas size (SVG pixels)
  const IX = 140;                        // input layer x centre
  const HX = 440;                        // hidden layer x centre
  const OX = 740;                        // output layer x centre
  const R  = 28;                         // node circle radius
  const inputY  = [110, 200, 290, 380];  // input node y positions
  const hiddenY = [110, 200, 290, 380];  // hidden node y positions
  const outputY = 245;                   // output node y centre
  const LAYER_LABEL_Y = 500;             // y position of layer labels
  const ARROW_LABEL_Y = 46;             // y position of backprop/forward labels
  const BACKPROP_LABEL_X = 290;         // x centre of backprop label
  const FORWARD_LABEL_X  = 590;         // x centre of forward-pass label
  const OUTPUT_R = 42;                   // output node radius (larger than hidden)
  const FONT_NODE = 26;                  // font size for node subscript labels
  const FONT_OUTPUT = 24;               // font size for output node "Salida" label
  const FONT_LAYER = 23;                 // font size for layer name labels
  const FONT_ARROW = 21;                 // font size for direction labels

  const { svg, document } = makeSVG(W, H);

  const defs = svg.append('defs');
  addMarker(defs, 'mf', S.GRAY_MID, 'fwd', 5);
  addMarker(defs, 'mb', S.RED, 'back', 5);

  // Forward connections
  inputY.forEach(iy => {
    hiddenY.forEach(hy => {
      svg.append('line')
        .attr('x1', IX+R).attr('y1', iy)
        .attr('x2', HX-R).attr('y2', hy)
        .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1).attr('opacity', 0.8);
    });
  });
  hiddenY.forEach(hy => {
    svg.append('line')
      .attr('x1', HX+R).attr('y1', hy)
      .attr('x2', OX-R).attr('y2', outputY)
      .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1).attr('opacity', 0.8);
  });

  // Backpropagation arrows
  hiddenY.forEach(hy => {
    svg.append('line')
      .attr('x1', OX-R-2).attr('y1', outputY)
      .attr('x2', HX+R+2).attr('y2', hy)
      .attr('stroke', S.RED).attr('stroke-width', 1.2)
      .attr('stroke-dasharray','5,3').attr('opacity', 0.35)
      .attr('marker-end','url(#mb)');
  });
  [[inputY[0], hiddenY[0]], [inputY[1], hiddenY[1]], [inputY[2], hiddenY[2]], [inputY[3], hiddenY[3]]].forEach(([iy,hy]) => {
    svg.append('line')
      .attr('x1', HX-R-2).attr('y1', hy)
      .attr('x2', IX+R+2).attr('y2', iy)
      .attr('stroke', S.RED).attr('stroke-width', 1.2)
      .attr('stroke-dasharray','5,3').attr('opacity', 0.25)
      .attr('marker-end','url(#mb)');
  });

  // Input nodes
  inputY.forEach((y, i) => {
    svg.append('circle').attr('cx', IX).attr('cy', y).attr('r', R)
      .attr('fill', S.GRAY_LIGHT).attr('stroke', S.GRAY_MID).attr('stroke-width', 2);
    svg.append('text').attr('x', IX).attr('y', y)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_NODE).attr('font-weight', 700)
      .attr('fill', S.GRAY_DARK).text(`x${['\u2081','\u2082','\u2083','\u2084'][i]}`);
  });

  // Hidden nodes
  hiddenY.forEach((y, i) => {
    svg.append('circle').attr('cx', HX).attr('cy', y).attr('r', R)
      .attr('fill', S.GRAY_MID).attr('stroke', S.GRAY).attr('stroke-width', 2);
    svg.append('text').attr('x', HX).attr('y', y)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_NODE).attr('font-weight', 700)
      .attr('fill', S.WHITE).text(`a${['\u2081','\u2082','\u2083','\u2084'][i]}`);
  });

  // Output node
  svg.append('circle').attr('cx', OX).attr('cy', outputY).attr('r', OUTPUT_R)
    .attr('fill', S.RED).attr('stroke', S.RED_DARK).attr('stroke-width', 2);
  svg.append('text').attr('x', OX).attr('y', outputY)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_OUTPUT).attr('font-weight', 700)
    .attr('fill', S.WHITE).text('Salida');

  // Layer labels
  [
    { x: IX,  label: 'Capa de Entrada' },
    { x: HX,  label: 'Capa Oculta' },
    { x: OX,  label: 'Capa de Salida' },
  ].forEach(l => {
    svg.append('text').attr('x', l.x).attr('y', LAYER_LABEL_Y)
      .attr('text-anchor','middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_LAYER).attr('font-weight', 700)
      .attr('fill', S.GRAY_DARK).text(l.label);
  });

  // Backpropagation label
  svg.append('text').attr('x', BACKPROP_LABEL_X).attr('y', ARROW_LABEL_Y)
    .attr('text-anchor','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_ARROW).attr('font-style','italic')
    .attr('fill', S.RED).attr('opacity', 0.7)
    .text('\u2190 Retropropagación del error');

  // Forward pass label
  svg.append('text').attr('x', FORWARD_LABEL_X).attr('y', ARROW_LABEL_Y)
    .attr('text-anchor','middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_ARROW).attr('font-style','italic')
    .attr('fill', S.GRAY)
    .text('Paso hacia adelante \u2192');

  return document.body.innerHTML;
};
