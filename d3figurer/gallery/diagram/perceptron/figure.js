'use strict';
const { makeSVG, addMarker } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function () {
  // ── Layout ──────────────────────────────────────────────────────────────
  // Adjust these to reposition/resize elements without reading render code.
  const W = 800, H = 460;                  // canvas size (SVG pixels)

  const INPUT_CX = 60;                     // x centre of all input node circles
  const INPUT_CYS = [96, 176, 256, 336];  // y centres of the four input nodes
  const INPUT_R = 28;                      // radius of input node circles
  const INPUT_FONT = 24;                   // font size of x₁–x₄ labels inside input nodes
  const INPUT_LINE_X1 = 88;               // x where connection lines leave the input nodes (right edge of circle)
  const INPUT_LINE_X2 = 330;              // x where connection lines arrive at the neuron (approach point)

  const WEIGHT_CX = 192;                   // x centre of weight labels (w₁–w₄)
  const WEIGHT_YS = [125, 170, 212, 268]; // y of each weight label
  const WEIGHT_FONT = 22;                  // font size of weight labels

  const HEADER_Y = 54;                     // y of column header labels ("Entradas", "Pesos", etc.)
  const HEADER_FONT = 20;                  // font size of column headers

  const NEURON_CX = 365;                   // x centre of the summation neuron circle
  const NEURON_CY = 210;                   // y centre of the summation neuron circle
  const NEURON_R = 76;                     // radius of the summation neuron circle
  const SIGMA_FONT = 60;                   // font size of the Σ symbol
  const SIGMA_Y = 200;                     // y of the Σ symbol (dominant-baseline: middle)
  const NEURON_SUBLABEL_Y = 258;           // y of the italic "Neurona" label inside the neuron circle
  const NEURON_SUBLABEL_FONT = 18;         // font size of the "Neurona" sublabel

  const CONN_X1 = NEURON_CX + NEURON_R;   // x where connector line leaves neuron right edge  → 441
  const CONN_X2 = 490;                     // x where connector line arrives at activation box

  const ACT_BOX_X = 490;                   // left edge of activation (φ) box
  const ACT_BOX_Y = 178;                   // top edge of activation box
  const ACT_BOX_W = 96;                    // width of activation box
  const ACT_BOX_H = 64;                    // height of activation box
  const ACT_BOX_RX = 8;                    // corner radius of activation box
  const ACT_CX = ACT_BOX_X + ACT_BOX_W / 2; // x centre of activation box  → 538
  const PHI_FONT = 46;                     // font size of the φ symbol
  const ACT_LABEL_Y1 = 143;               // y of "Función de" label above activation box
  const ACT_LABEL_Y2 = 164;               // y of "Activación" label above activation box
  const ACT_LABEL_FONT = 19;              // font size of activation box label lines

  const OUTPUT_CX = 690;                   // x centre of the output column
  const OUTPUT_FONT = 36;                  // font size of output "1" / "0" values
  const OUTPUT_1_Y = 184;                  // y of output "1" (Activa)
  const OUTPUT_0_Y = 236;                  // y of output "0" (No activa)
  const OUTPUT_SIDE_X = 795;              // x of "Activa" / "No activa" side labels
  const OUTPUT_SIDE_FONT = 19;            // font size of side labels
  const SEP_X1 = 668, SEP_X2 = 714;      // x1/x2 of the separator line between outputs
  const SEP_Y = 210;                       // y of the separator line

  const ARR_X1 = 586;                      // x where the red output arrow starts (activation box right)
  const ARR_X2 = 652;                      // x where the red output arrow ends

  const BOTTOM_LABEL_X = 400;             // x of the bottom "Perceptrón" label
  const BOTTOM_LABEL_Y = 428;             // y of the bottom "Perceptrón" label
  const BOTTOM_LABEL_FONT = 23;           // font size of the bottom label
  // ────────────────────────────────────────────────────────────────────────

  const { svg, document } = makeSVG(W, H);
  S.fontStyle(svg);

  const defs = svg.append('defs');
  addMarker(defs, 'arrp', S.RED);

  const inputLabels = ['x\u2081', 'x\u2082', 'x\u2083', 'x\u2084'];
  const weightLabels = ['w\u2081', 'w\u2082', 'w\u2083', 'w\u2084'];

  // Column header "Entradas"
  svg.append('text')
    .attr('x', INPUT_CX).attr('y', HEADER_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', HEADER_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Entradas');

  // Connection lines
  INPUT_CYS.forEach(cy => {
    svg.append('line')
      .attr('x1', INPUT_LINE_X1).attr('y1', cy)
      .attr('x2', INPUT_LINE_X2).attr('y2', NEURON_CY)
      .attr('stroke', S.GRAY_MID)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.7);
  });

  // Input node circles + labels
  INPUT_CYS.forEach((cy, i) => {
    svg.append('circle')
      .attr('cx', INPUT_CX).attr('cy', cy)
      .attr('r', INPUT_R)
      .attr('fill', S.RED);

    svg.append('text')
      .attr('x', INPUT_CX).attr('y', cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT)
      .attr('font-size', INPUT_FONT)
      .attr('font-weight', 700)
      .attr('fill', S.WHITE)
      .text(inputLabels[i]);
  });

  // Column header "Pesos"
  svg.append('text')
    .attr('x', WEIGHT_CX).attr('y', HEADER_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', HEADER_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Pesos');

  WEIGHT_YS.forEach((wy, i) => {
    svg.append('text')
      .attr('x', WEIGHT_CX).attr('y', wy)
      .attr('text-anchor', 'middle')
      .attr('font-family', S.FONT)
      .attr('font-size', WEIGHT_FONT)
      .attr('font-style', 'italic')
      .attr('fill', S.GRAY_DARK)
      .text(weightLabels[i]);
  });

  // Column header "Neurona"
  svg.append('text')
    .attr('x', NEURON_CX).attr('y', HEADER_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', HEADER_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Neurona');

  // Outer circle
  svg.append('circle')
    .attr('cx', NEURON_CX).attr('cy', NEURON_CY)
    .attr('r', NEURON_R)
    .attr('fill', S.GRAY_LIGHT)
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 2);

  // Sigma symbol
  svg.append('text')
    .attr('x', NEURON_CX).attr('y', SIGMA_Y)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', SIGMA_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.GRAY_DARK)
    .text('\u03A3');

  // "Neurona" label below sigma — moved down to clear sigma (which extends to y≈230)
  svg.append('text')
    .attr('x', NEURON_CX).attr('y', NEURON_SUBLABEL_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', NEURON_SUBLABEL_FONT)
    .attr('font-style', 'italic')
    .attr('fill', S.TEXT_LIGHT)
    .text('Neurona');

  // Connector line: neuron right edge → activation box
  svg.append('line')
    .attr('x1', CONN_X1).attr('y1', NEURON_CY)
    .attr('x2', CONN_X2).attr('y2', NEURON_CY)
    .attr('stroke', S.GRAY_MID)
    .attr('stroke-width', 2);

  // Activation box — tall enough for φ symbol with padding
  svg.append('rect')
    .attr('x', ACT_BOX_X).attr('y', ACT_BOX_Y)
    .attr('width', ACT_BOX_W).attr('height', ACT_BOX_H)
    .attr('rx', ACT_BOX_RX)
    .attr('fill', S.RED);

  // Phi symbol inside box
  svg.append('text')
    .attr('x', ACT_CX).attr('y', NEURON_CY)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', PHI_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.WHITE)
    .text('\u03C6');

  // Label above box — extra separation between "Función de" and "Activación"
  // data-skip-check: intentionally stacked 2-line label for the activation box
  svg.append('text')
    .attr('x', ACT_CX).attr('y', ACT_LABEL_Y1)
    .attr('data-skip-check', '1')
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', ACT_LABEL_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Función de');

  svg.append('text')
    .attr('x', ACT_CX).attr('y', ACT_LABEL_Y2)
    .attr('data-skip-check', '1')
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', ACT_LABEL_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Activación');

  // Column header "Salida"
  svg.append('text')
    .attr('x', OUTPUT_CX).attr('y', HEADER_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', HEADER_FONT)
    .attr('fill', S.TEXT_LIGHT)
    .text('Salida');

  // Arrow from activation box to output
  svg.append('line')
    .attr('x1', ARR_X1).attr('y1', NEURON_CY)
    .attr('x2', ARR_X2).attr('y2', NEURON_CY)
    .attr('stroke', S.RED)
    .attr('stroke-width', 2.5)
    .attr('marker-end', 'url(#arrp)');

  // Output "1" — Activa
  svg.append('text')
    .attr('x', OUTPUT_CX).attr('y', OUTPUT_1_Y)
    .attr('font-family', S.FONT)
    .attr('font-size', OUTPUT_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.RED)
    .attr('text-anchor', 'middle')
    .text('1');

  svg.append('text')
    .attr('x', OUTPUT_SIDE_X).attr('y', OUTPUT_1_Y)
    .attr('text-anchor', 'end')
    .attr('font-family', S.FONT)
    .attr('font-size', OUTPUT_SIDE_FONT)
    .attr('fill', S.GRAY_DARK)
    .text('Activa');

  // Separator
  svg.append('line')
    .attr('x1', SEP_X1).attr('y1', SEP_Y)
    .attr('x2', SEP_X2).attr('y2', SEP_Y)
    .attr('stroke', S.GRAY_LIGHT)
    .attr('stroke-width', 1);

  // Output "0" — No activa
  svg.append('text')
    .attr('x', OUTPUT_CX).attr('y', OUTPUT_0_Y)
    .attr('font-family', S.FONT)
    .attr('font-size', OUTPUT_FONT)
    .attr('font-weight', 700)
    .attr('fill', S.GRAY_MID)
    .attr('text-anchor', 'middle')
    .text('0');

  svg.append('text')
    .attr('x', OUTPUT_SIDE_X).attr('y', OUTPUT_0_Y)
    .attr('text-anchor', 'end')
    .attr('font-family', S.FONT)
    .attr('font-size', OUTPUT_SIDE_FONT)
    .attr('fill', S.GRAY_DARK)
    .text('No activa');

  // Bottom label
  svg.append('text')
    .attr('x', BOTTOM_LABEL_X).attr('y', BOTTOM_LABEL_Y)
    .attr('text-anchor', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', BOTTOM_LABEL_FONT)
    .attr('fill', S.GRAY_DARK)
    .text('Perceptrón');

  return document.body.innerHTML;
};
