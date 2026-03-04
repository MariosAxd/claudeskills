'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // DATA — loaded from data.json (edit that file to customise the figure)
  const { data } = require('./data.json');

  // ── Layout ────────────────────────────────────────────────────────────────
  const W      = 900;                                              // canvas width (px)
  const H      = 680;                                              // canvas height (px)
  const MARGIN = { top: 80, right: 150, bottom: 90, left: 165 };  // chart margins (px)
  const innerW = W - MARGIN.left - MARGIN.right;                   // plot area width
  const innerH = H - MARGIN.top - MARGIN.bottom;                   // plot area height
  const ANN_AT_X    = 5;      // x-scale domain value where annotation box starts
  const ANN_OFFSET_Y = -70;   // y offset (px) above China band for annotation box top
  const ANN_W       = 280;    // annotation box width (px)
  const ANN_H       = 66;     // annotation box height (px)
  const ANN_TEXT_DY = [18, 50]; // dy offsets from annY for the two annotation text lines
  const LEG_X       = innerW - 240; // legend top-left x (within chart group)
  const LEG_Y       = innerH - 70;  // legend top-left y (within chart group)
  const FONT_COUNTRY    = 23;  // country label font size (non-highlighted)
  const FONT_COUNTRY_HL = 26;  // country label font size (highlighted)
  const FONT_VALUE      = 22;  // value label font size (non-highlighted)
  const FONT_VALUE_HL   = 26;  // value label font size (highlighted)
  const FONT_TICK       = 22;  // x-axis tick label font size
  const FONT_AXIS_LABEL = 23;  // x-axis title font size
  const FONT_ANN        = 20;  // annotation text font size
  const DOT_R           = 8;   // radius of "Con IA" total dot (non-highlighted)
  const DOT_R_HL        = 11;  // radius of "Con IA" total dot (highlighted)
  const BASE_DOT_R      = 7;   // radius of "Sin IA" base dot

  const { svg, document } = makeSVG(W, H);

  const g = svg.append('g').attr('transform',`translate(${MARGIN.left},${MARGIN.top})`);

  const yScale = d3.scaleBand().domain(data.map(d=>d.country)).range([0,innerH]).padding(0.3);
  const xScale = d3.scaleLinear().domain([0, 9]).range([0, innerW]);

  // Gridlines
  [1,2,3,4,5,6,7,8].forEach(t => {
    g.append('line').attr('x1',xScale(t)).attr('x2',xScale(t)).attr('y1',0).attr('y2',innerH)
      .attr('stroke',S.GRAY_LIGHT).attr('stroke-width',1).attr('stroke-dasharray','3,3');
  });

  // Axes
  g.append('line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1.5);
  g.append('line').attr('x1',0).attr('x2',innerW).attr('y1',innerH).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1);

  // Dumbbell rows
  data.forEach(d => {
    const cy = yScale(d.country) + yScale.bandwidth()/2;
    const x1 = xScale(d.base);
    const x2 = xScale(d.total);
    const isHighlight = d.highlight;

    // Connecting line
    g.append('line').attr('x1',x1).attr('x2',x2).attr('y1',cy).attr('y2',cy)
      .attr('stroke', isHighlight ? S.RED : S.GRAY_MID)
      .attr('stroke-width', isHighlight ? 2.5 : 1.5)
      .attr('opacity', isHighlight ? 1 : 0.7);

    // Base dot (sin IA) — hollow gray circle
    g.append('circle').attr('cx',x1).attr('cy',cy).attr('r',BASE_DOT_R)
      .attr('fill',S.WHITE).attr('stroke', isHighlight ? S.GRAY_DARK : S.GRAY_MID)
      .attr('stroke-width',2);

    // Total dot (con IA) — filled red circle
    g.append('circle').attr('cx',x2).attr('cy',cy).attr('r', isHighlight ? DOT_R_HL : DOT_R)
      .attr('fill', isHighlight ? S.RED : '#cc3355')
      .attr('opacity', isHighlight ? 1 : 0.8);

    // Total value label
    g.append('text').attr('x',x2+16).attr('y',cy)
      .attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size', isHighlight ? FONT_VALUE_HL : FONT_VALUE).attr('font-weight', isHighlight ? 700 : 400)
      .attr('fill', isHighlight ? S.RED : S.TEXT_LIGHT)
      .text(`+${d.total.toFixed(1)}%`);

    // Country name on left
    g.append('text').attr('x',-12).attr('y',cy)
      .attr('text-anchor','end').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size', isHighlight ? FONT_COUNTRY_HL : FONT_COUNTRY)
      .attr('font-weight', isHighlight ? 700 : 400)
      .attr('fill', isHighlight ? S.RED : S.TEXT)
      .text(d.country);
  });

  // X axis ticks
  [0,1,2,3,4,5,6,7,8,9].forEach(t => {
    g.append('text').attr('x',xScale(t)).attr('y',innerH+24)
      .attr('text-anchor','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_TICK).attr('fill',S.TEXT_LIGHT)
      .text(t===0 ? '' : `${t}%`);
  });

  g.append('text').attr('x',innerW/2).attr('y',innerH+60)
    .attr('text-anchor','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_AXIS_LABEL).attr('fill',S.GRAY)
    .text('Crecimiento acumulado del PIB 2025–2035 (%)');

  // Legend
  g.append('circle').attr('cx',LEG_X+8).attr('cy',LEG_Y+8).attr('r',BASE_DOT_R)
    .attr('fill',S.WHITE).attr('stroke',S.GRAY_MID).attr('stroke-width',2);
  g.append('text').attr('x',LEG_X+22).attr('y',LEG_Y+8).attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN).attr('fill',S.TEXT).text('Sin adopción de IA');
  g.append('circle').attr('cx',LEG_X+8).attr('cy',LEG_Y+36).attr('r',DOT_R)
    .attr('fill','#cc3355');
  g.append('text').attr('x',LEG_X+22).attr('y',LEG_Y+36).attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN).attr('fill',S.TEXT).text('Con adopción de IA');

  // Annotation box — ensure it stays within chart area, well padded
  const annX = xScale(ANN_AT_X);
  const annY = yScale('China') + ANN_OFFSET_Y;
  g.append('rect').attr('x',annX).attr('y',annY).attr('width',ANN_W).attr('height',ANN_H)
    .attr('rx',8).attr('fill','#fff0f3').attr('stroke',S.RED).attr('stroke-width',1.5);
  g.append('text').attr('x',annX+ANN_W/2).attr('y',annY+ANN_TEXT_DY[0])
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN).attr('font-weight',700)
    .attr('fill',S.RED).text('La IA puede doblar');
  g.append('text').attr('x',annX+ANN_W/2).attr('y',annY+ANN_TEXT_DY[1])
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN).attr('font-weight',700)
    .attr('fill',S.RED).text('el crecimiento económico');

  return document.body.innerHTML;
};
