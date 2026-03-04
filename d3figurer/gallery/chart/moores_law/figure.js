'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function () {

  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 1000, H = 700;         // canvas size

  // Chart margins
  const ML = 110;                  // left margin (room for y-axis label + tick labels)
  const MR = 36;                   // right margin
  const MT = 36;                   // top margin
  const MB = 80;                   // bottom margin (room for x-axis tick labels)

  // Derived chart area bounds (do not edit — change margins above)
  const x0 = ML, x1 = W - MR;     // left / right x boundary of plot area
  const y0 = MT, y1 = H - MB;     // top  / bottom y boundary of plot area

  // Y-axis label x position (rotated, so this is the translate-x)
  const Y_LABEL_X = 26;            // x of the rotated y-axis label

  // Legend box top-left (offset from x0/y0)
  const LEG_DX = 20, LEG_DY = 18; // offset from chart top-left corner to legend box
  const LEG_W = 360;               // legend box width
  const LEG_H = 116;               // legend box height

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { rawData } = require('./data.json');

  const cpuData = rawData
    .filter(d => d.cat === 'CPU' && d.year >= 2000)
    .sort((a, b) => a.year - b.year);

  const aiData = rawData
    .filter(d => d.cat === 'AI' && d.year >= 2000)
    .sort((a, b) => a.year - b.year);

  const xScale = d3.scaleLinear().domain([2000, 2026]).range([x0, x1]);
  const yScale = d3.scaleLinear().domain([0, 220e9]).range([y1, y0]);

  // "Era LLMs" background band (2022–2026)
  const llmX = xScale(2022);
  svg.append('rect')
    .attr('x', llmX).attr('y', y0)
    .attr('width', x1 - llmX).attr('height', y1 - y0)
    .attr('fill', S.RED).attr('opacity', 0.06)
    .attr('data-skip-check', '1');  // background band — not a label container

  svg.append('line')
    .attr('x1', llmX).attr('y1', y0)
    .attr('x2', llmX).attr('y2', y1)
    .attr('stroke', S.RED).attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4').attr('opacity', 0.5);

  svg.append('text')
    .attr('x', llmX + 8).attr('y', y1 - 16)
    .attr('text-anchor', 'start')
    .attr('font-family', S.FONT).attr('font-size', 22).attr('font-weight', 700)
    .attr('fill', S.RED).attr('opacity', 0.75)
    .text('Era LLMs');

  // Y gridlines & tick labels
  const yTickValues = [0, 50e9, 100e9, 150e9, 200e9];
  const yTickLabels = ['0', '50B', '100B', '150B', '200B'];

  yTickValues.forEach((val, i) => {
    const y = yScale(val);
    if (val > 0) {
      svg.append('line')
        .attr('x1', x0).attr('y1', y).attr('x2', x1).attr('y2', y)
        .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1);
      svg.append('text')
        .attr('x', x0 - 12).attr('y', y)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('font-family', S.FONT).attr('font-size', 22).attr('fill', S.GRAY)
        .text(yTickLabels[i]);
    }
  });

  // X axis ticks, labels & vertical gridlines
  [2000, 2005, 2010, 2015, 2020, 2025].forEach(yr => {
    const x = xScale(yr);
    svg.append('line')
      .attr('x1', x).attr('y1', y1).attr('x2', x).attr('y2', y1 + 8)
      .attr('stroke', S.GRAY_MID).attr('stroke-width', 1);
    svg.append('text')
      .attr('x', x).attr('y', y1 + 26)
      .attr('text-anchor', 'middle')
      .attr('font-family', S.FONT).attr('font-size', 24).attr('font-weight', 700)
      .attr('fill', S.GRAY)
      .text(yr);
    if (yr > 2000 && yr < 2026) {
      svg.append('line')
        .attr('x1', x).attr('y1', y0).attr('x2', x).attr('y2', y1)
        .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 0.8)
        .attr('stroke-dasharray', '3,5');
    }
  });

  // Axis borders
  svg.append('line')
    .attr('x1', x0).attr('y1', y1).attr('x2', x1).attr('y2', y1)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5);
  svg.append('line')
    .attr('x1', x0).attr('y1', y0).attr('x2', x0).attr('y2', y1)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5);

  // Y axis label
  svg.append('text')
    .attr('transform', `translate(${Y_LABEL_X}, ${(y0 + y1) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 22).attr('fill', S.GRAY)
    .text('Miles de millones de transistores');

  // Log-linear regression
  function logReg(pts) {
    const n = pts.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    pts.forEach(d => {
      const ly = Math.log10(d.transistors);
      sx += d.year; sy += ly; sxy += d.year * ly; sxx += d.year * d.year;
    });
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const b = (sy - m * sx) / n;
    return { m, b };
  }

  function drawFitCurve(fit, yearStart, yearEnd, color, strokeWidth, dasharray) {
    const pts = [];
    for (let yr = yearStart; yr <= yearEnd; yr += 0.2) {
      const t = Math.pow(10, fit.m * yr + fit.b);
      pts.push({ yr, t });
    }
    const el = svg.append('path')
      .datum(pts)
      .attr('d', d3.line().x(d => xScale(d.yr)).y(d => yScale(d.t)))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth);
    if (dasharray) el.attr('stroke-dasharray', dasharray);
  }

  const cpuFit = logReg(cpuData);
  const aiFit  = logReg(aiData);

  drawFitCurve(cpuFit, 2000, 2024, S.GRAY_DARK, 2.0);
  drawFitCurve(aiFit,  2000, 2024, S.RED,        2.5);

  // CPU dots
  cpuData.forEach(d => {
    svg.append('circle')
      .attr('cx', xScale(d.year)).attr('cy', yScale(d.transistors))
      .attr('r', 5)
      .attr('fill', S.GRAY_DARK)
      .attr('stroke', S.WHITE).attr('stroke-width', 1.5);
  });

  // AI accelerator dots
  aiData.forEach(d => {
    svg.append('circle')
      .attr('cx', xScale(d.year)).attr('cy', yScale(d.transistors))
      .attr('r', 6)
      .attr('fill', S.RED)
      .attr('stroke', S.WHITE).attr('stroke-width', 1.5);
  });

  // CPU chip labels
  function smallLabel(year, transistors, line1, line2, color, anchor, dx, dy) {
    const cx = xScale(year), cy = yScale(transistors);
    // data-skip-check: name/count are intentionally stacked labels for the same data point
    svg.append('text')
      .attr('x', cx + dx).attr('y', cy + dy - 17)
      .attr('data-skip-check', '1')
      .attr('text-anchor', anchor)
      .attr('font-family', S.FONT).attr('font-size', 18).attr('fill', color)
      .text(line1);
    if (line2) {
      svg.append('text')
        .attr('x', cx + dx).attr('y', cy + dy + 6)
        .attr('data-skip-check', '1')
        .attr('text-anchor', anchor)
        .attr('font-family', S.FONT).attr('font-size', 19).attr('font-weight', 700)
        .attr('fill', color)
        .text(line2);
    }
  }

  smallLabel(2018, 3.02e9, 'i9-9900K', '3B ←14nm aún', S.GRAY_MID, 'end', -10, -6);
  smallLabel(2019, 9.6e9, 'AMD Zen 2', '9.6B', S.GRAY_DARK, 'start', 10, -4);
  smallLabel(2024, 20.9e9, 'AMD Zen 5', '21B', S.GRAY_DARK, 'end', -10, -4);

  // AI chip labels
  function chipLabel(year, transistors, name, count, color, anchor, dx, dyName, dyCount) {
    const cx = xScale(year), cy = yScale(transistors);
    // data-skip-check: name/count are intentionally stacked labels for the same data point
    svg.append('text')
      .attr('x', cx + dx).attr('y', cy + dyName)
      .attr('data-skip-check', '1')
      .attr('text-anchor', anchor)
      .attr('font-family', S.FONT).attr('font-size', 19).attr('font-weight', 400)
      .attr('fill', color).text(name);
    svg.append('text')
      .attr('x', cx + dx).attr('y', cy + dyCount)
      .attr('data-skip-check', '1')
      .attr('text-anchor', anchor)
      .attr('font-family', S.FONT).attr('font-size', 21).attr('font-weight', 700)
      .attr('fill', color).text(count);
  }

  chipLabel(2024, 208e9, 'NVIDIA B200', '208B', S.RED, 'end',   -12, -24, 1);
  chipLabel(2022, 80e9,  'NVIDIA H100', '80B',  S.RED, 'start',  12, -10, 16);
  chipLabel(2020, 54.2e9,'NVIDIA A100', '54B',  S.RED, 'start',  12, -10, 16);

  // Legend
  const LX = x0 + LEG_DX, LY = y0 + LEG_DY;
  svg.append('rect')
    .attr('x', LX - 12).attr('y', LY - 12)
    .attr('width', LEG_W).attr('height', LEG_H)
    .attr('rx', 6)
    .attr('fill', S.WHITE)
    .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1);

  // Row 1: CPUs
  svg.append('line')
    .attr('x1', LX).attr('y1', LY + 14).attr('x2', LX + 28).attr('y2', LY + 14)
    .attr('stroke', S.GRAY_DARK).attr('stroke-width', 2.0);
  svg.append('circle')
    .attr('cx', LX + 14).attr('cy', LY + 14).attr('r', 5)
    .attr('fill', S.GRAY_DARK).attr('stroke', S.WHITE).attr('stroke-width', 1.5);
  svg.append('text')
    .attr('x', LX + 38).attr('y', LY + 14)
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 22).attr('fill', S.GRAY_DARK)
    .text('CPUs (Intel \u0026 AMD)');

  // Row 2: AI accelerators
  svg.append('line')
    .attr('x1', LX).attr('y1', LY + 50).attr('x2', LX + 28).attr('y2', LY + 50)
    .attr('stroke', S.RED).attr('stroke-width', 2.5);
  svg.append('circle')
    .attr('cx', LX + 14).attr('cy', LY + 50).attr('r', 6)
    .attr('fill', S.RED).attr('stroke', S.WHITE).attr('stroke-width', 1.5);
  svg.append('text')
    .attr('x', LX + 38).attr('y', LY + 50)
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 22).attr('fill', S.RED)
    .text('Aceleradoras IA / GPUs');

  // Row 3: LLM era swatch
  svg.append('rect')
    .attr('x', LX).attr('y', LY + 78).attr('width', 28).attr('height', 14)
    .attr('fill', S.RED).attr('opacity', 0.18).attr('rx', 2);
  svg.append('text')
    .attr('x', LX + 38).attr('y', LY + 85)
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 22).attr('fill', S.GRAY_DARK)
    .text('Era LLMs (desde 2022)');

  return document.body.innerHTML;
};
