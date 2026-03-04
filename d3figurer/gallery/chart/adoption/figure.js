'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 900, H = 560;              // canvas size (SVG pixels)
  const MARGIN = { top: 70, right: 180, bottom: 100, left: 175 }; // plot margins
  const BAR_RADIUS = 4;               // bar corner radius
  const HIGHLIGHT_PADDING = 4;        // extra padding around highlighted bar outline
  const HIGHLIGHT_RADIUS = 7;         // corner radius of highlight outline rect
  const BAR_LABEL_OFFSET_X = 10;     // gap between bar end and duration label
  const NAME_OFFSET_X = 12;          // gap between axis and app name label
  const NAME_OFFSET_Y = 16;          // vertical offset of app name above bar centre
  const YEAR_OFFSET_Y = 16;          // vertical offset of launch year below bar centre
  const FONT_BAR_LABEL = 27;         // font size for duration value labels
  const FONT_NAME = 27;              // font size for platform name labels
  const FONT_YEAR = 21;              // font size for launch year labels
  const FONT_AXIS_TICK = 23;         // font size for x-axis tick labels
  const FONT_AXIS_TITLE = 23;        // font size for x-axis title
  const AXIS_TICK_Y = 26;            // y offset below inner bottom for tick labels
  const AXIS_TITLE_Y = 62;          // y offset below inner bottom for axis title
  const BRACKET_OFFSET_X = 24;      // x offset from inner right edge to bracket start
  const BRACKET_ARM = 10;            // horizontal arm length of comparison bracket
  const BRACKET_LABEL_OFFSET_X = 16; // x offset from bracket tip to annotation text
  const BRACKET_LABEL_Y1 = -14;     // y offset of first annotation line from bracket midpoint
  const BRACKET_LABEL_Y2 = 20;      // y offset of second annotation line from bracket midpoint
  const FONT_BRACKET = 22;          // font size for bracket annotation text

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { data } = require('./data.json');

  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const g = svg.append('g').attr('transform',`translate(${MARGIN.left},${MARGIN.top})`);

  const yScale = d3.scaleBand().domain(data.map(d=>d.name)).range([0,innerH]).padding(0.3);
  const xScale = d3.scaleLinear().domain([0,60]).range([0,innerW]);

  // Light gridlines
  [10,20,30,40,50].forEach(t => {
    g.append('line').attr('x1',xScale(t)).attr('x2',xScale(t)).attr('y1',0).attr('y2',innerH)
      .attr('stroke',S.GRAY_LIGHT).attr('stroke-width',1).attr('stroke-dasharray','3,3');
  });

  // Baseline
  g.append('line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',innerH)
    .attr('stroke',S.GRAY_MID).attr('stroke-width',1.5);
  g.append('line').attr('x1',0).attr('x2',innerW).attr('y1',innerH).attr('y2',innerH)
    .attr('stroke',S.GRAY_LIGHT).attr('stroke-width',1);

  // Bars
  data.forEach(d => {
    const y = yScale(d.name), bh = yScale.bandwidth(), bw = xScale(d.months);
    const isChatGPT = d.name === 'ChatGPT';

    g.append('rect').attr('x',0).attr('y',y).attr('width',bw).attr('height',bh)
      .attr('rx',BAR_RADIUS).attr('fill',d.color)
      .attr('opacity', isChatGPT ? 1 : 0.75);

    if (isChatGPT) {
      g.append('rect')
        .attr('x', -HIGHLIGHT_PADDING).attr('y', y-HIGHLIGHT_PADDING)
        .attr('width', bw+HIGHLIGHT_PADDING*2).attr('height', bh+HIGHLIGHT_PADDING*2)
        .attr('rx', HIGHLIGHT_RADIUS).attr('fill','none').attr('stroke',S.RED_DARK).attr('stroke-width',1.5)
        .attr('stroke-dasharray','4,3').attr('opacity',0.5);
    }

    // Duration label
    g.append('text').attr('x', bw + BAR_LABEL_OFFSET_X).attr('y',y+bh/2)
      .attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_BAR_LABEL).attr('font-weight',700)
      .attr('fill', isChatGPT ? S.RED : S.GRAY_DARK)
      .text(`${d.months} ${d.months===1?'mes':'meses'}`);

    // App name on left axis
    g.append('text').attr('x',-NAME_OFFSET_X).attr('y',y+bh/2-NAME_OFFSET_Y)
      .attr('text-anchor','end').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_NAME).attr('font-weight', isChatGPT ? 700 : 600)
      .attr('fill', isChatGPT ? S.RED : S.TEXT).text(d.name);

    // Launch year
    g.append('text').attr('x',-NAME_OFFSET_X).attr('y',y+bh/2+YEAR_OFFSET_Y)
      .attr('text-anchor','end').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_YEAR)
      .attr('fill',S.TEXT_LIGHT).text(`(${d.founded})`);
  });

  // X axis ticks
  [0,10,20,30,40,50].forEach(t => {
    g.append('text').attr('x',xScale(t)).attr('y',innerH+AXIS_TICK_Y)
      .attr('text-anchor','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_AXIS_TICK).attr('fill',S.TEXT_LIGHT)
      .text(t===0 ? '' : t);
  });
  g.append('text').attr('x',innerW/2).attr('y',innerH+AXIS_TITLE_Y)
    .attr('text-anchor','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_AXIS_TITLE).attr('fill',S.GRAY)
    .text('Meses para alcanzar 100 millones de usuarios');

  // Comparison annotation: ChatGPT vs TikTok
  const chatY = yScale('ChatGPT') + yScale.bandwidth()/2;
  const tikY = yScale('TikTok') + yScale.bandwidth()/2;
  const bx = innerW + BRACKET_OFFSET_X;
  g.append('line').attr('x1',bx).attr('y1',chatY).attr('x2',bx+BRACKET_ARM).attr('y2',chatY)
    .attr('stroke',S.RED).attr('stroke-width',1.5);
  g.append('line').attr('x1',bx+BRACKET_ARM).attr('y1',chatY).attr('x2',bx+BRACKET_ARM).attr('y2',tikY)
    .attr('stroke',S.RED).attr('stroke-width',1.5);
  g.append('line').attr('x1',bx).attr('y1',tikY).attr('x2',bx+BRACKET_ARM).attr('y2',tikY)
    .attr('stroke',S.RED).attr('stroke-width',1.5);
  const midBracketY = (chatY + tikY) / 2;
  g.append('text').attr('x',bx+BRACKET_LABEL_OFFSET_X).attr('y',midBracketY+BRACKET_LABEL_Y1)
    .attr('font-family',S.FONT).attr('font-size',FONT_BRACKET).attr('font-weight',700)
    .attr('fill',S.RED).text('4,5× más');
  g.append('text').attr('x',bx+BRACKET_LABEL_OFFSET_X).attr('y',midBracketY+BRACKET_LABEL_Y2)
    .attr('font-family',S.FONT).attr('font-size',FONT_BRACKET).attr('font-weight',700)
    .attr('fill',S.RED).text('rápido');

  return document.body.innerHTML;
};
