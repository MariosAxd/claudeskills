'use strict';
const { JSDOM } = require('jsdom');
const d3 = require('d3');
const S = require('./styles.js');

/**
 * Create a D3 SVG with standard white background.
 * Returns { svg, document } where svg is the D3 selection and document is
 * the jsdom Document — needed to call document.body.innerHTML at the end.
 *
 * Usage:
 *   const { svg, document } = makeSVG(1000, 540);
 *   // ... build figure ...
 *   return document.body.innerHTML;
 */
function makeSVG(W, H) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;
  const svg = d3.select(document.body)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', S.WHITE);
  return { svg, document };
}

/**
 * Add an SVG arrowhead marker to a <defs> selection.
 *
 * @param {d3.Selection} defs  - the <defs> D3 selection (svg.append('defs'))
 * @param {string}       id    - marker id, referenced as url(#id)
 * @param {string}       color - fill color (e.g. S.RED or S.GRAY_MID)
 * @param {string}       dir   - 'fwd' → (default) or 'back' ←
 * @param {number}       size  - markerWidth / markerHeight (default 6)
 *
 * Usage:
 *   const defs = svg.append('defs');
 *   addMarker(defs, 'arr', S.GRAY_MID);          // gray forward arrow, size 6
 *   addMarker(defs, 'red', S.RED, 'fwd', 5);     // red forward arrow, size 5
 *   addMarker(defs, 'back', S.RED, 'back', 5);   // red backward arrow, size 5
 */
function addMarker(defs, id, color, dir = 'fwd', size = 6) {
  const m = defs.append('marker')
    .attr('id', id)
    .attr('viewBox', '0 0 10 10')
    .attr('refX', dir === 'fwd' ? 9 : 1)
    .attr('refY', 5)
    .attr('markerWidth', size)
    .attr('markerHeight', size)
    .attr('orient', 'auto');
  m.append('path')
    .attr('d', dir === 'fwd' ? 'M 0 0 L 10 5 L 0 10 z' : 'M 10 0 L 0 5 L 10 10 z')
    .attr('fill', color);
}

/**
 * Append a text element with standard Montserrat styling.
 * Returns the D3 selection for further chaining.
 *
 * @param {d3.Selection} parent  - D3 selection to append to (svg or a <g>)
 * @param {number}       x       - x position
 * @param {number}       y       - y position
 * @param {string}       text    - text content
 * @param {number}       size    - font-size in SVG px
 * @param {number}       weight  - font-weight (default 400)
 * @param {string}       fill    - fill color (default S.TEXT)
 * @param {string}       anchor  - text-anchor: 'start'|'middle'|'end' (default 'middle')
 * @param {boolean}      italic  - set font-style:italic (default false)
 *
 * Usage:
 *   addText(svg, 500, 40, 'Title', 28, 700, S.RED);
 *   addText(g, x, y, label, 20, 400, S.GRAY, 'start', true);
 */
function addText(parent, x, y, text, size, weight, fill, anchor, italic) {
  const el = parent.append('text')
    .attr('x', x).attr('y', y)
    .attr('text-anchor', anchor || 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', size)
    .attr('font-weight', weight || 400)
    .attr('fill', fill || S.TEXT);
  if (italic) el.attr('font-style', 'italic');
  el.text(text);
  return el;
}

/**
 * Append an MDI (Material Design Icons) SVG path icon, scaled from its 24×24 viewBox.
 * Returns the D3 selection for further chaining.
 *
 * @param {d3.Selection} parent    - D3 selection to append to
 * @param {string}       pathData  - SVG path d attribute (from MDI or similar 24×24 icon set)
 * @param {number}       cx        - icon centre x
 * @param {number}       cy        - icon centre y
 * @param {number}       size      - rendered size in SVG px (icon is scaled from 24×24)
 * @param {string}       fill      - fill color
 * @param {number}       opacity   - opacity 0–1 (omit to leave unset)
 *
 * Usage:
 *   addIcon(svg, MDI.lightbulb, 120, 80, 36, S.GRAY_MID, 0.7);
 */
function addIcon(parent, pathData, cx, cy, size, fill, opacity) {
  const el = parent.append('path')
    .attr('d', pathData)
    .attr('transform', `translate(${cx - size / 2}, ${cy - size / 2}) scale(${size / 24})`)
    .attr('fill', fill);
  if (opacity !== undefined) el.attr('opacity', opacity);
  return el;
}

module.exports = { makeSVG, addMarker, addText, addIcon };
