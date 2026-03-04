'use strict';
const { makeSVG, addMarker } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

module.exports = function() {

  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 1000, H = 580;         // canvas size

  const PW = 222;                  // panel width
  const GAP = 10;                  // gap between panels

  // Staircase heights for revolutions 1–4 (index 0–3)
  const baseH = [290, 335, 380, 440];

  // Derived left edge of the four-panel group (centred on canvas)
  const startX = (W - (4 * PW + 3 * GAP)) / 2;

  // Font sizes
  const FONT_NUM    = 38;          // revolution number inside badge
  const FONT_ERA    = 20;          // era date-range label
  const FONT_TITLE  = 18;          // revolution title (reduced from 24 to fit within PW=222)
  const FONT_DRIVER = 18;          // key technology driver (reduced from 22 to fit within PW=222)
  const FONT_TECH   = 20;          // individual tech items
  const FONT_NOW    = 22;          // "Actualidad" label

  // Badge radius
  const BADGE_R = 28;              // radius of the revolution-number circle badge

  // Text y offsets within each panel (relative to panel top y)
  const Y_NUM          = 36;       // revolution number badge centre y
  const Y_ERA          = 80;       // era label centre y
  const Y_TITLE        = 115;      // title centre y
  const Y_DRIVER       = 148;      // driver centre y
  const Y_DIVIDER      = 168;      // divider line y
  const Y_TECH_START   = 196;      // first tech item centre y
  const Y_TECH_SPACING = 28;       // spacing between tech items

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.json (edit that file to customise the figure)
  const { revs } = require('./data.json');

  const baseY = revs.map((_, i) => H - baseH[i] - 50);

  // Connection arrows between panels — SVG lines fit within the 10px gap (text glyphs would spill over)
  const defs = svg.append('defs');
  addMarker(defs, 'gapArrow', S.GRAY_MID, 'fwd', 4);
  revs.forEach((rev, i) => {
    if (i < revs.length - 1) {
      const gapLeft  = startX + (i + 1) * (PW + GAP) - GAP;  // right edge of panel i
      const gapRight = startX + (i + 1) * (PW + GAP);         // left edge of panel i+1
      const ay = (baseY[i] + baseY[i + 1]) / 2;               // midpoint between adjacent panel tops
      svg.append('line')
        .attr('x1', gapLeft).attr('x2', gapRight - 3)
        .attr('y1', ay).attr('y2', ay)
        .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#gapArrow)');
    }
  });

  revs.forEach((rev, i) => {
    const x = startX + i * (PW + GAP);
    const y = baseY[i];
    const h = baseH[i];
    const cx = x + PW / 2;

    // Drop shadow
    svg.append('rect').attr('x',x+3).attr('y',y+3).attr('width',PW).attr('height',h)
      .attr('rx',10).attr('fill','#00000015');

    // Main panel
    svg.append('rect').attr('x',x).attr('y',y).attr('width',PW).attr('height',h)
      .attr('rx',10).attr('fill',rev.fill);

    // Revolution number badge
    svg.append('circle').attr('cx',cx).attr('cy',y+Y_NUM).attr('r',BADGE_R)
      .attr('fill', rev.numFill === S.WHITE ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)');
    svg.append('text').attr('x',cx).attr('y',y+Y_NUM)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_NUM).attr('font-weight',700)
      .attr('fill',rev.textFill).text(rev.n);

    // Era label
    svg.append('text').attr('x',cx).attr('y',y+Y_ERA)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_ERA).attr('font-style','italic')
      .attr('fill', rev.textFill === S.WHITE ? 'rgba(255,255,255,0.75)' : S.GRAY)
      .text(rev.era);

    // Title
    svg.append('text').attr('x',cx).attr('y',y+Y_TITLE)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_TITLE).attr('font-weight',700)
      .attr('fill',rev.textFill).text(rev.title);

    // Driver (key technology)
    svg.append('text').attr('x',cx).attr('y',y+Y_DRIVER)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-family',S.FONT).attr('font-size',FONT_DRIVER).attr('font-weight',600)
      .attr('fill', rev.textFill === S.WHITE ? 'rgba(255,255,255,0.9)' : S.GRAY_DARK)
      .text(rev.driver);

    // Divider line
    svg.append('line').attr('x1',x+20).attr('y1',y+Y_DIVIDER).attr('x2',x+PW-20).attr('y2',y+Y_DIVIDER)
      .attr('stroke', rev.textFill === S.WHITE ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)')
      .attr('stroke-width',1);

    // Tech items — spaced to stay within panel bottom
    rev.tech.forEach((tech, ti) => {
      svg.append('text').attr('x',cx).attr('y',y+Y_TECH_START+ti*Y_TECH_SPACING)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-family',S.FONT).attr('font-size',FONT_TECH)
        .attr('fill', rev.textFill === S.WHITE ? 'rgba(255,255,255,0.82)' : S.TEXT_LIGHT)
        .text(tech);
    });
  });

  // "Ahora" indicator — x derived from startX so it tracks panel layout
  svg.append('text').attr('x', startX + 3.5 * (PW + GAP)).attr('y', 44)
    .attr('text-anchor','middle')
    .attr('font-family',S.FONT).attr('font-size',FONT_NOW).attr('font-weight',700)
    .attr('fill',S.RED).text('◀ Actualidad');

  return document.body.innerHTML;
};
