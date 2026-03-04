'use strict';
const { makeSVG, addText, addIcon } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

// Material Design Icons (Apache 2.0 license) — all paths use 24×24 viewBox
const MDI = {
  // mdi-lightbulb-outline
  lightbulb: 'M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z',
  // mdi-cog
  cog: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z',
  // mdi-database
  database: 'M12,3C7.58,3 4,4.79 4,7C4,9.21 7.58,11 12,11C16.42,11 20,9.21 20,7C20,4.79 16.42,3 12,3M4,9V12C4,14.21 7.58,16 12,16C16.42,16 20,14.21 20,12V9C20,11.21 16.42,13 12,13C7.58,13 4,11.21 4,9M4,14V17C4,19.21 7.58,21 12,21C16.42,21 20,19.21 20,17V14C20,16.21 16.42,18 12,18C7.58,18 4,16.21 4,14Z',
  // mdi-chart-bar
  chartBar: 'M22,21H2V3H4V19H6V17H10V19H12V6H16V19H18V14H22V21Z',
};

// ── Font-size scale calibrated for \textwidth print rendering ─────────────────
// At \textwidth (137mm), 1 SVG px ≈ 0.39pt in print.
// Target: min 9pt for body text → 23px SVG; headers 11-14pt → 28-36px SVG.
const SZ = {
  divider:  28,   // "Inteligencia Artificial" — reduced to fit within DIV_H=40 without clipping top
  h1:       36,   // CONOCIMIENTO / DATOS headers ≈ 14pt
  h2:       30,   // panel headers, section labels ≈ 12pt
  h3:       24,   // paradigm sub-labels ≈ 10pt
  body:     17,   // list items — reduced from 22 to keep bullet text within W=1000
  small:    20,   // layer labels, arrow labels ≈ 8pt
};

module.exports = function () {
  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 1000, H = 600;          // canvas size in SVG pixels
  const DIV_Y = 282, DIV_H = 40;   // divider band: top-y and height
  const B0    = DIV_Y + DIV_H;     // 322 — start of bottom section (derived)
  const LP = 12, LW = 170;         // left panel: x origin and width
  const RP = 660;                   // right panel x (start-anchor); moved from 730 so bullet text fits within W=1000
  const bCX = 480, bCY = 128;      // brain centre coordinates
  const lRX = 56,  lRY = 52;       // brain lobe radii (x and y)
  const topExSpacing = 33, topExStart = 90;       // top examples: row spacing and first-row y
  const botExSpacing = 33, botExStart = B0 + 30;  // bottom examples: row spacing and first-row y
  const nnCX = 480, nnCY = B0 + 90;               // neural net centre — raised from B0+118 to clear DATOS label
  const ar1X = 930, ar2X = 964;    // right-edge arc x positions (top-down and bottom-up arcs)

  const { svg, document } = makeSVG(W, H);

  // ── Color palette ─────────────────────────────────────────────────────────
  const BLUE       = '#2980B9';
  const BLUE_MED   = '#5DADE2';
  const BLUE_LIGHT = '#D6EAF8';
  const ORANGE     = '#CA6F1E';    // text (darker for contrast)
  const ORANGE_ICO = '#E67E22';    // icons / strokes
  const ORANGE_LT  = '#FDEBD0';

  // ── Defs ──────────────────────────────────────────────────────────────────
  const defs = svg.append('defs');

  const gTop = defs.append('linearGradient')
    .attr('id', 'gTop').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
  gTop.append('stop').attr('offset', '0%').attr('stop-color', '#EAF2FB');
  gTop.append('stop').attr('offset', '100%').attr('stop-color', '#D6EAF8');

  const gBot = defs.append('linearGradient')
    .attr('id', 'gBot').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
  gBot.append('stop').attr('offset', '0%').attr('stop-color', '#FDEBD0');
  gBot.append('stop').attr('offset', '100%').attr('stop-color', '#FAD7A0');

  const mk1 = defs.append('marker').attr('id', 'arcBlue')
    .attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto');
  mk1.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', BLUE);

  const mk2 = defs.append('marker').attr('id', 'arcOrange')
    .attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto');
  mk2.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', ORANGE_ICO);

  // ── Backgrounds ───────────────────────────────────────────────────────────
  svg.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', DIV_Y)
    .attr('fill', 'url(#gTop)');
  svg.append('rect').attr('x', 0).attr('y', B0).attr('width', W).attr('height', H - B0)
    .attr('fill', 'url(#gBot)');
  svg.append('rect').attr('x', 0).attr('y', DIV_Y).attr('width', W).attr('height', DIV_H)
    .attr('fill', '#1A5276');

  // ── Divider ───────────────────────────────────────────────────────────────
  addText(svg, W / 2, DIV_Y + DIV_H / 2, 'Inteligencia Artificial', SZ.divider, 700, S.WHITE);

  // ── LEFT PANEL — Examples ─────────────────────────────────────────────────
  svg.append('rect').attr('x', LP).attr('y', 16).attr('width', LW).attr('height', H - 32)
    .attr('rx', 8).attr('fill', 'rgba(255,255,255,0.55)').attr('stroke', 'rgba(255,255,255,0.8)')
    .attr('stroke-width', 1);
  addText(svg, LP + LW / 2, 36, 'Ejemplos', SZ.h2, 700, S.GRAY_DARK);

  // Top examples — vertically centred in the top section (y=55 to DIV_Y-15)
  // DATA — loaded from data.json (edit that file to customise the figure)
  const { topEx, botEx, topDownCapabilities, bottomUpCapabilities } = require('./data.json');
  topEx.forEach((e, i) =>
    addText(svg, LP + LW / 2, topExStart + i * topExSpacing, e, SZ.body, 400, BLUE, 'middle', true));

  svg.append('line')
    .attr('x1', LP + 10).attr('y1', DIV_Y - 4).attr('x2', LP + LW - 10).attr('y2', DIV_Y - 4)
    .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1);

  // Bottom examples — vertically centred in the bottom section (B0+20 to H-30)
  botEx.forEach((e, i) =>
    addText(svg, LP + LW / 2, botExStart + i * botExSpacing, e, SZ.body, 400, ORANGE_ICO, 'middle', true));

  // ── TOP SECTION — brain ────────────────────────────────────────────────────
  addText(svg, W / 2, 32, 'C O N O C I M I E N T O', SZ.h1, 700, BLUE);  // y=32 to clear top edge

  // Glow
  svg.append('ellipse').attr('cx', bCX).attr('cy', bCY + 5).attr('rx', 140).attr('ry', 92)
    .attr('fill', 'rgba(93,173,226,0.09)');

  // Left lobe
  svg.append('ellipse').attr('cx', bCX - 30).attr('cy', bCY)
    .attr('rx', lRX).attr('ry', lRY)
    .attr('fill', BLUE_LIGHT).attr('stroke', BLUE).attr('stroke-width', 2.5);

  // Right lobe
  svg.append('ellipse').attr('cx', bCX + 30).attr('cy', bCY)
    .attr('rx', lRX - 4).attr('ry', lRY)
    .attr('fill', BLUE_LIGHT).attr('stroke', BLUE).attr('stroke-width', 2.5);

  // Stem
  svg.append('ellipse').attr('cx', bCX).attr('cy', bCY + lRY - 2)
    .attr('rx', 20).attr('ry', 11)
    .attr('fill', BLUE_LIGHT).attr('stroke', BLUE).attr('stroke-width', 2);

  // Center groove
  svg.append('path')
    .attr('d', `M ${bCX} ${bCY - lRY + 6} C ${bCX - 8},${bCY - 6} ${bCX + 8},${bCY + 6} ${bCX},${bCY + lRY - 7}`)
    .attr('fill', 'none').attr('stroke', BLUE).attr('stroke-width', 2);

  // Cortex folds — left
  [
    `M ${bCX - 72} ${bCY - 20} Q ${bCX - 52} ${bCY - 34} ${bCX - 22} ${bCY - 16}`,
    `M ${bCX - 78} ${bCY + 9} Q ${bCX - 57} ${bCY - 3} ${bCX - 30} ${bCY + 20}`,
    `M ${bCX - 62} ${bCY + 32} Q ${bCX - 46} ${bCY + 25} ${bCX - 18} ${bCY + 38}`,
  ].forEach(d => svg.append('path').attr('d', d).attr('fill', 'none')
    .attr('stroke', BLUE_MED).attr('stroke-width', 1.5).attr('opacity', 0.65));

  // Cortex folds — right
  [
    `M ${bCX + 22} ${bCY - 16} Q ${bCX + 52} ${bCY - 34} ${bCX + 72} ${bCY - 20}`,
    `M ${bCX + 30} ${bCY + 20} Q ${bCX + 57} ${bCY - 3} ${bCX + 78} ${bCY + 9}`,
    `M ${bCX + 18} ${bCY + 38} Q ${bCX + 46} ${bCY + 25} ${bCX + 62} ${bCY + 32}`,
  ].forEach(d => svg.append('path').attr('d', d).attr('fill', 'none')
    .attr('stroke', BLUE_MED).attr('stroke-width', 1.5).attr('opacity', 0.65));

  // Flanking icons
  addIcon(svg, MDI.lightbulb, bCX - 124, bCY + 5, 36, BLUE, 0.70);
  addIcon(svg, MDI.cog,       bCX + 124, bCY + 5, 36, BLUE, 0.70);
  addIcon(svg, MDI.cog,       bCX - 108, bCY + 65, 24, BLUE_MED, 0.48);
  addIcon(svg, MDI.lightbulb, bCX + 108, bCY + 65, 24, BLUE_MED, 0.48);

  // Sub-label below brain — data-skip-check: center label intentionally spans into right-panel x-range
  addText(svg, bCX, bCY + lRY + 20, 'Top-Down  ·  Simbólico  ·  Lógico', SZ.h3, 700, BLUE)
    .attr('data-skip-check', '1');

  // ── TOP RIGHT — capabilities ──────────────────────────────────────────────
  addText(svg, RP, 90, 'Top-Down', SZ.h2, 700, BLUE, 'start');
  topDownCapabilities.forEach((c, i) => {
    svg.append('text').attr('x', RP).attr('y', 123 + i * 30)
      .attr('dominant-baseline', 'middle').attr('font-family', S.FONT)
      .attr('font-size', SZ.body).attr('fill', S.GRAY_DARK).text('\u2022 ' + c);
  });

  // ── BOTTOM SECTION — neural network ───────────────────────────────────────
  addText(svg, W / 2, H - 22, 'D A T O S', SZ.h1, 700, ORANGE_ICO);

  // Neural net: 3 layers
  const nnSpec = [
    { x: nnCX - 140, n: 5, r: 10, fill: ORANGE_LT,  stroke: ORANGE_ICO },
    { x: nnCX,       n: 4, r: 12, fill: '#FAD7A0',   stroke: ORANGE_ICO },
    { x: nnCX + 140, n: 2, r: 15, fill: ORANGE_LT,   stroke: S.RED      },
  ];

  function nnYs(n) {
    const spacing = 34;
    const total = spacing * (n - 1);
    const top = nnCY - total / 2;
    return d3.range(n).map(i => top + i * spacing);
  }

  const nnPos = nnSpec.map(l => nnYs(l.n));

  // Connections
  for (let li = 0; li < nnSpec.length - 1; li++) {
    const la = nnSpec[li], lb = nnSpec[li + 1];
    nnPos[li].forEach(ay => nnPos[li + 1].forEach(by => {
      svg.append('line')
        .attr('x1', la.x + la.r).attr('y1', ay)
        .attr('x2', lb.x - lb.r).attr('y2', by)
        .attr('stroke', '#F0B27A').attr('stroke-width', 1).attr('opacity', 0.4);
    }));
  }

  // Nodes
  nnSpec.forEach((layer, li) => {
    nnPos[li].forEach(y => {
      svg.append('circle').attr('cx', layer.x).attr('cy', y).attr('r', layer.r)
        .attr('fill', layer.fill).attr('stroke', layer.stroke).attr('stroke-width', 2);
    });
  });

  // Layer labels
  addText(svg, nnCX - 140, nnCY + 88, 'Entrada', SZ.small, 700, ORANGE_ICO);
  addText(svg, nnCX,       nnCY + 88, 'Ocultas', SZ.small, 700, ORANGE_ICO);
  addText(svg, nnCX + 140, nnCY + 88, 'Salida',  SZ.small, 700, S.RED);

  // Flanking icons
  addIcon(svg, MDI.database,  nnCX - 128, nnCY - 36, 32, ORANGE_ICO, 0.70);
  addIcon(svg, MDI.chartBar,  nnCX + 128, nnCY - 36, 32, ORANGE_ICO, 0.70);

  // Sub-label — data-skip-check: center label intentionally spans into right-panel x-range
  addText(svg, nnCX, nnCY + 120, 'Bottom-Up  ·  Conexionista  ·  Estadístico', SZ.h3, 700, ORANGE)
    .attr('data-skip-check', '1');

  // ── BOTTOM RIGHT — capabilities ────────────────────────────────────────────
  addText(svg, RP, B0 + 28, 'Bottom-Up', SZ.h2, 700, ORANGE_ICO, 'start');
  bottomUpCapabilities.forEach((c, i) => {
    svg.append('text').attr('x', RP).attr('y', B0 + 62 + i * 24)
      .attr('dominant-baseline', 'middle').attr('font-family', S.FONT)
      .attr('font-size', SZ.body).attr('fill', S.GRAY_DARK).text('\u2022 ' + c);
  });

  // ── RIGHT EDGE — directional arcs ─────────────────────────────────────────
  // Top-Down: downward arc (blue)
  svg.append('path')
    .attr('d', `M ${ar1X} 48 C ${ar1X + 30} 140, ${ar1X + 30} 440, ${ar1X} 530`)
    .attr('fill', 'none').attr('stroke', BLUE).attr('stroke-width', 3)
    .attr('marker-end', 'url(#arcBlue)');

  // Bottom-Up: upward arc (orange)
  svg.append('path')
    .attr('d', `M ${ar2X} 530 C ${ar2X + 30} 440, ${ar2X + 30} 140, ${ar2X} 48`)
    .attr('fill', 'none').attr('stroke', ORANGE_ICO).attr('stroke-width', 3)
    .attr('marker-end', 'url(#arcOrange)');

  addText(svg, ar1X, 28, 'Top-Down', SZ.small, 700, BLUE);
  // "Bottom-Up" at ar2X=964 with middle-anchor clips right edge (1018>W=1000); use end-anchor instead
  svg.append('text').attr('x', W - 8).attr('y', H - 22)
    .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', SZ.small).attr('font-weight', 700)
    .attr('fill', ORANGE_ICO).text('Bottom-Up');

  return document.body.innerHTML;
};
