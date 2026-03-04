'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // DATA — loaded from data.json (edit that file to customise the figure)
  const { allData } = require('./data.json');

  // ── Layout ────────────────────────────────────────────────────────────────
  const W      = 1000;                                        // canvas width (px)
  const H      = 700;                                         // canvas height (px)
  const MARGIN = { top: 100, right: 80, bottom: 100, left: 130 }; // chart margins (px)
  const innerW = W - MARGIN.left - MARGIN.right;              // plot area width
  const innerH = H - MARGIN.top - MARGIN.bottom;              // plot area height
  const ANN_W       = 310;                                    // annotation box width (px)
  const ANN_CX      = innerW - 155;                           // annotation box centre x (within group)
  const ANN_Y       = 34;                                     // annotation box top y (within group)
  const ANN_H       = 130;                                    // annotation box height (px)
  const ANN_Y1      = 70;                                     // y of main ×175 text line (within group)
  const ANN_Y2      = 120;                                    // y of subtitle text line (within group)
  const ANN_Y3      = 150;                                    // y of source note text line (within group)
  const FONT_AXIS        = 22;                                // axis tick label font size
  const FONT_CALLOUT     = 24;                                // callout value label font size
  const FONT_ANN_MAIN    = 48;                                // annotation "×175" font size
  const FONT_ANN_SUB     = 20;                                // annotation subtitle font size
  const FONT_ANN_NOTE    = 18;                                // annotation source note font size
  const FONT_AXIS_LABEL  = 22;                                // y-axis label font size
  const FONT_LEGEND      = 20;                                // legend text font size
  const LEG_X       = MARGIN.left;                            // legend left x (in SVG coords)
  const LEG_Y       = H - 32;                                 // legend baseline y (in SVG coords)
  const DIV_X_YEAR  = 2025.5;                                 // x-domain value for projection divider line

  const { svg, document } = makeSVG(W, H);

  const g = svg.append('g').attr('transform',`translate(${MARGIN.left},${MARGIN.top})`);

  const xScale = d3.scaleLinear().domain([2016, 2031]).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, 260]).range([innerH, 0]);

  // Defs for gradient
  const defs = svg.append('defs');
  const areaGrad = defs.append('linearGradient').attr('id','areaGrad').attr('x1','0%').attr('x2','100%');
  areaGrad.append('stop').attr('offset','0%').attr('stop-color', S.RED).attr('stop-opacity', 0.8);
  areaGrad.append('stop').attr('offset','62%').attr('stop-color', S.RED).attr('stop-opacity', 0.8);
  areaGrad.append('stop').attr('offset','63%').attr('stop-color', S.RED_LIGHT).attr('stop-opacity', 0.5);
  areaGrad.append('stop').attr('offset','100%').attr('stop-color', S.RED_LIGHT).attr('stop-opacity', 0.3);

  // Y gridlines
  [50, 100, 150, 200, 250].forEach(tick => {
    g.append('line').attr('x1',0).attr('x2',innerW).attr('y1',yScale(tick)).attr('y2',yScale(tick))
      .attr('stroke',S.GRAY_LIGHT).attr('stroke-width',1).attr('stroke-dasharray','3,3');
    g.append('text').attr('x',-14).attr('y',yScale(tick))
      .attr('text-anchor','end').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_AXIS).attr('fill',S.TEXT_LIGHT)
      .text(`$${tick}B`);
  });
  // Axes
  g.append('line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1.5);
  g.append('line').attr('x1',0).attr('x2',innerW).attr('y1',innerH).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1.5);

  // Area path
  const area = d3.area()
    .x(d => xScale(d.year))
    .y0(innerH)
    .y1(d => yScale(d.value))
    .curve(d3.curveCatmullRom.alpha(0.3));

  g.append('path').datum(allData).attr('d', area)
    .attr('fill','url(#areaGrad)');

  // Line
  const histData = allData.filter(d => !d.proj);

  const line = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.value))
    .curve(d3.curveCatmullRom.alpha(0.3));

  g.append('path').datum(histData).attr('d', line)
    .attr('fill','none').attr('stroke',S.RED).attr('stroke-width',2.5);

  g.append('path').datum([allData[9], ...allData.filter(d=>d.proj)]).attr('d', line)
    .attr('fill','none').attr('stroke',S.RED_LIGHT).attr('stroke-width',2)
    .attr('stroke-dasharray','6,4');

  // Projection divider
  const divX = xScale(DIV_X_YEAR);
  g.append('line').attr('x1',divX).attr('x2',divX).attr('y1',-40).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1.5).attr('stroke-dasharray','4,3');
  g.append('text').attr('x',divX+8).attr('y',-20).attr('text-anchor','start')
    .attr('font-family',S.FONT).attr('font-size',20).attr('fill',S.GRAY)
    .text('Proyección →');

  // X axis labels
  [2016, 2018, 2020, 2022, 2024, 2026, 2028, 2030].forEach(yr => {
    g.append('text').attr('x',xScale(yr)).attr('y',innerH+24)
      .attr('text-anchor','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_AXIS).attr('fill',S.TEXT_LIGHT)
      .text(yr);
    g.append('line').attr('x1',xScale(yr)).attr('x2',xScale(yr)).attr('y1',innerH).attr('y2',innerH+7)
      .attr('stroke',S.GRAY_MID).attr('stroke-width',1);
  });

  // Key callout labels
  const callouts = [
    { year: 2016, value: 1.4, label: '$1,4B', dy: -18, anchor: 'middle' },
    { year: 2020, value: 10.5,label: '$10,5B', dy: -18, anchor: 'middle' },
    { year: 2025, value: 60,  label: '$60B',   dy: -18, anchor: 'middle' },
    { year: 2031, value: 242, label: '$242B',  dy: -18, anchor: 'end' },
  ];
  callouts.forEach(c => {
    const cx = xScale(c.year), cy = yScale(c.value);
    g.append('circle').attr('cx',cx).attr('cy',cy).attr('r',6)
      .attr('fill', c.year <= 2025 ? S.RED : S.RED_LIGHT)
      .attr('stroke',S.WHITE).attr('stroke-width',1.5);
    g.append('text').attr('x',cx).attr('y',cy+c.dy)
      .attr('text-anchor',c.anchor)
      .attr('font-family',S.FONT).attr('font-size',FONT_CALLOUT).attr('font-weight',700)
      .attr('fill', c.year <= 2025 ? S.RED_DARK : S.TEXT_LIGHT)
      .text(c.label);
  });

  // Big ×175 annotation box
  g.append('rect').attr('x',ANN_CX - ANN_W/2).attr('y',ANN_Y).attr('width',ANN_W).attr('height',ANN_H)
    .attr('rx',10).attr('fill','#fff0f3').attr('stroke',S.RED).attr('stroke-width',1.5);
  g.append('text').attr('x',ANN_CX).attr('y',ANN_Y1)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN_MAIN).attr('font-weight',700)
    .attr('fill',S.RED).text('×175');
  g.append('text').attr('x',ANN_CX).attr('y',ANN_Y2)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN_SUB)
    .attr('fill',S.RED_DARK).text('en 15 años (2016–2031)');
  g.append('text').attr('x',ANN_CX).attr('y',ANN_Y3)
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_ANN_NOTE).attr('font-style','italic')
    .attr('fill',S.TEXT_LIGHT).text('Fuente: IDC / Statista 2025');

  // Y axis label
  g.append('text').attr('transform',`translate(-94,${innerH/2}) rotate(-90)`)
    .attr('text-anchor','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_AXIS_LABEL).attr('fill',S.GRAY)
    .text('Miles de millones USD');

  // Legend
  svg.append('rect').attr('x',LEG_X).attr('y',LEG_Y-8).attr('width',18).attr('height',5).attr('fill',S.RED);
  svg.append('text').attr('x',LEG_X+22).attr('y',LEG_Y).attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_LEGEND).attr('fill',S.TEXT).text('Datos históricos (2016–2025)');
  svg.append('rect').attr('x',LEG_X+310).attr('y',LEG_Y-8).attr('width',18).attr('height',5)
    .attr('fill',S.RED_LIGHT).attr('stroke-dasharray','none');
  svg.append('text').attr('x',LEG_X+332).attr('y',LEG_Y).attr('dominant-baseline','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_LEGEND).attr('fill',S.TEXT_LIGHT)
    .text('Proyección (2026–2031)');

  return document.body.innerHTML;
};
