'use strict';
const { makeSVG } = require('../../shared/helpers.js');
const d3 = require('d3');
const S = require('../../shared/styles.js');

// country-flag-icons/string/3x2 — SVG strings keyed by ISO 3166-1 alpha-2
// Falls back gracefully to code badges in browser preview (where require is shimmed)
let FLAGS = {};
try { FLAGS = require('country-flag-icons/string/3x2'); } catch (_) {}

// Custom SVGs for non-ISO entities (OECD, UN, UNESCO).
// These are purpose-built for the 70×47 card size (viewBox 3:2).
// No external file injection needed — inline designs render cleanly at any scale.
const CUSTOM_FLAGS = {
  // OECD — dark blue branded badge
  'OC': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">'
      + '<rect width="3" height="2" fill="#003D8F"/>'
      + '<text x="1.5" y="1.05" text-anchor="middle" dominant-baseline="middle" '
      + 'font-size="0.56" font-family="Arial,Helvetica,sans-serif" font-weight="bold" fill="white">OCDE</text>'
      + '</svg>',
  // United Nations — UN blue with simplified globe
  'UN': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">'
      + '<rect width="3" height="2" fill="#4B92DB"/>'
      + '<circle cx="1.5" cy="0.98" r="0.60" fill="none" stroke="white" stroke-width="0.088"/>'
      + '<ellipse cx="1.5" cy="0.98" rx="0.30" ry="0.60" fill="none" stroke="white" stroke-width="0.07"/>'
      + '<line x1="0.90" y1="0.98" x2="2.10" y2="0.98" stroke="white" stroke-width="0.07"/>'
      + '<line x1="1.5" y1="0.38" x2="1.5" y2="1.58" stroke="white" stroke-width="0.07"/>'
      + '</svg>',
  // UNESCO — blue badge with name
  'UC': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">'
      + '<rect width="3" height="2" fill="#0059A4"/>'
      + '<text x="1.5" y="1.05" text-anchor="middle" dominant-baseline="middle" '
      + 'font-size="0.48" font-family="Arial,Helvetica,sans-serif" font-weight="bold" fill="white">UNESCO</text>'
      + '</svg>',
};

module.exports = function () {
  // DATA — loaded from data.json (edit that file to customise the figure)
  // Sources: OECD Progress Report 2025, World Privacy Forum, CCIA, Tim Dutton
  const { strategies } = require('./data.json');

  // ── Append a flag as a nested <svg> (no base64, works in jsdom + browser) ──
  // Uniquifies internal SVG ids with a per-call prefix to prevent conflicts
  // when the same flag SVG is embedded more than once in the document.
  let _flagSeq = 0;
  function appendFlag(parentNode, code, x, y, w, h) {
    const svgStr = FLAGS[code] || CUSTOM_FLAGS[code];
    if (!svgStr) return false;

    const vbMatch    = svgStr.match(/viewBox=["']([^"']+)["']/);
    const viewBox    = vbMatch ? vbMatch[1] : '0 0 3 2';
    const innerMatch = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>\s*$/);
    if (!innerMatch) return false;

    const pfx = `fl${_flagSeq++}_`;
    let inner = innerMatch[1]
      .replace(/\bid="([^"]+)"/g,          `id="${pfx}$1"`)
      .replace(/\bxlink:href="#([^"]+)"/g,  `xlink:href="#${pfx}$1"`)
      .replace(/\bhref="#([^"]+)"/g,        `href="#${pfx}$1"`)
      .replace(/url\(#([^)]+)\)/g,          `url(#${pfx}$1)`);

    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'svg');
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    el.setAttribute('viewBox', viewBox);
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    el.innerHTML = inner;
    parentNode.appendChild(el);
    return true;
  }

  // ── Year colors: gray→red (research era → generative AI era) ─────────────
  const yearColors = {
    2017: '#888888',
    2018: '#777777',
    2019: '#666666',
    2020: '#C0704A',
    2021: '#B85A35',
    2022: '#CC2222',
    2023: '#D91515',
    2024: '#E4003B',
    2025: '#B80030',
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const CARD_W      = 88;   // width of each country card (px)
  const CARD_H      = 78;   // height of each country card — flag (47px) + desc (2 lines)
  const GAP_X       = 6;    // horizontal gap between cards in the same year group
  const GAP_Y       = 5;    // vertical gap between card rows
  const MAX_ROWS    = 7;    // maximum cards stacked in a single column
  const TOP         = 75;   // y coordinate where cards start
  const LEFT        = 20;   // x coordinate of the first card column
  const GRP_GAP     = 14;   // extra horizontal gap between year groups
  const TIMELINE_Y  = 42;   // y of the thin horizontal timeline baseline
  const GEN_AI_YEAR = 2022; // year at which the "IA Generativa →" dashed marker appears
  const FONT_BADGE  = 13;   // font size for year badge labels
  const FONT_DESC   = 7.5;  // font size for per-card description text
  const FONT_MARKER = 8;    // font size for "IA Generativa →" annotation

  // Group by year, compute x offsets
  const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const byYear = {};
  years.forEach(y => { byYear[y] = []; });
  strategies.forEach(d => { if (byYear[d.year]) byYear[d.year].push(d); });

  const yearLayout = {};
  let curX = LEFT;
  years.forEach(yr => {
    const n = byYear[yr].length;
    const numCols = Math.ceil(n / MAX_ROWS);
    yearLayout[yr] = { x: curX, numCols, n };
    curX += numCols * CARD_W + (numCols - 1) * GAP_X + GRP_GAP;
  });

  const W = curX - GRP_GAP + LEFT;
  const H = TOP + MAX_ROWS * CARD_H + (MAX_ROWS - 1) * GAP_Y + 20;

  const { svg, document } = makeSVG(W, H);

  // ── Thin horizontal timeline ──────────────────────────────────────────────
  svg.append('line')
    .attr('x1', LEFT).attr('y1', TIMELINE_Y)
    .attr('x2', W - LEFT).attr('y2', TIMELINE_Y)
    .attr('stroke', S.GRAY_LIGHT).attr('stroke-width', 1.5);

  // ── Year groups ───────────────────────────────────────────────────────────
  years.forEach(yr => {
    const { x, numCols } = yearLayout[yr];
    const color = yearColors[yr];
    const countries = byYear[yr];
    const groupW = numCols * CARD_W + (numCols - 1) * GAP_X;
    const badgeCx = x + groupW / 2;
    const badgeW = Math.max(groupW, 44);

    // Year badge
    svg.append('rect')
      .attr('x', badgeCx - badgeW / 2).attr('y', 22)
      .attr('width', badgeW).attr('height', 26)
      .attr('rx', 5).attr('fill', color);
    svg.append('text')
      .attr('x', badgeCx).attr('y', 39)
      .attr('text-anchor', 'middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_BADGE).attr('font-weight', 700)
      .attr('fill', S.WHITE).text(yr);

    // Connector: badge → timeline dot
    svg.append('circle')
      .attr('cx', badgeCx).attr('cy', TIMELINE_Y).attr('r', 4).attr('fill', color);
    svg.append('line')
      .attr('x1', badgeCx).attr('y1', 48)
      .attr('x2', badgeCx).attr('y2', TIMELINE_Y - 4)
      .attr('stroke', color).attr('stroke-width', 1.5);

    // ── Country cards ─────────────────────────────────────────────────────
    countries.forEach((d, i) => {
      const col = Math.floor(i / MAX_ROWS);
      const row = i % MAX_ROWS;
      const cx  = x + col * (CARD_W + GAP_X);
      const cy  = TOP + row * (CARD_H + GAP_Y);

      // Card background
      svg.append('rect')
        .attr('x', cx).attr('y', cy)
        .attr('width', CARD_W).attr('height', CARD_H)
        .attr('rx', 5).attr('fill', '#F7F7F7')
        .attr('stroke', '#DDDDDD').attr('stroke-width', 0.7);

      // ── Flag ─────────────────────────────────────────────────────────────
      // Flag area: 70 × 47px (3:2 ratio), centred horizontally, y+5
      const flagW = 70, flagH = Math.round(flagW * 2 / 3);  // 47px
      const flagX = cx + Math.round((CARD_W - flagW) / 2);  // centred
      const flagY = cy + 5;

      const flagDrawn = appendFlag(svg.node(), d.code, flagX, flagY, flagW, flagH);
      if (!flagDrawn) {
        // Fallback: code badge when flag data unavailable
        svg.append('rect')
          .attr('x', flagX).attr('y', flagY)
          .attr('width', flagW).attr('height', flagH)
          .attr('rx', 3).attr('fill', color).attr('opacity', 0.15);
        svg.append('text')
          .attr('x', cx + CARD_W / 2).attr('y', flagY + flagH / 2 + 4)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-family', S.FONT).attr('font-size', 14).attr('font-weight', 700)
          .attr('fill', color).text(d.code);
      }

      // Description — wrap to two lines (no country name shown; flag identifies)
      const words = d.desc.split(' ');
      let l1 = '', l2 = '';
      words.forEach(w => {
        if ((l1 + ' ' + w).trim().length <= 14) l1 = (l1 + ' ' + w).trim();
        else l2 = (l2 + ' ' + w).trim();
      });
      svg.append('text')
        .attr('x', cx + CARD_W / 2).attr('y', cy + 63)
        .attr('text-anchor', 'middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_DESC).attr('font-style', 'italic')
        .attr('fill', S.GRAY_MID).attr('data-skip-check', '1').text(l1);
      if (l2) {
        svg.append('text')
          .attr('x', cx + CARD_W / 2).attr('y', cy + 73)
          .attr('text-anchor', 'middle')
          .attr('font-family', S.FONT).attr('font-size', FONT_DESC).attr('font-style', 'italic')
          .attr('fill', S.GRAY_MID).attr('data-skip-check', '1').text(l2);
      }
    });
  });

  // ── "IA Generativa →" marker at GEN_AI_YEAR boundary ─────────────────────
  const x2022 = yearLayout[GEN_AI_YEAR].x - GRP_GAP / 2;
  svg.append('line')
    .attr('x1', x2022).attr('y1', 14)
    .attr('x2', x2022).attr('y2', H - 10)
    .attr('stroke', S.RED).attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3').attr('opacity', 0.5);
  svg.append('text')
    .attr('x', x2022 + 5).attr('y', 13)
    .attr('text-anchor', 'start')
    .attr('font-family', S.FONT).attr('font-size', FONT_MARKER).attr('font-weight', 700)
    .attr('fill', S.RED).attr('opacity', 0.75)
    .text('IA Generativa \u2192');

  return document.body.innerHTML;
};
