'use strict';

// Book color palette — from aibook.sty
// Chapter red: RGB(228, 0, 59)   #e4003b
// Chapter gray: RGB(120, 120, 120) #787878
// Gray boxes: RGB(225, 225, 225)  #e1e1e1

module.exports = {
  RED:        '#e4003b',  // Primary book red RGB(228,0,59)
  RED_LIGHT:  '#f08090',  // Light red — projections, secondary elements
  RED_DARK:   '#b80030',  // Darker red — emphasis
  GRAY:       '#787878',  // Mid gray RGB(120,120,120)
  GRAY_LIGHT: '#e1e1e1',  // Light gray RGB(225,225,225) — backgrounds
  GRAY_MID:   '#bbbbbb',  // Mid-light gray — grid lines, connectors
  GRAY_DARK:  '#555555',  // Dark gray — secondary text
  TEXT:       '#333333',  // Main body text
  TEXT_LIGHT: '#888888',  // Muted / secondary text
  WHITE:      '#ffffff',
  BLACK:      '#000000',

  // Typography
  FONT: "'Montserrat', Arial, Helvetica, sans-serif",

  // Standard figure widths
  // At 300 DPI print: 137mm textwidth = ~1618px → use 1600px for PNG
  // For PDF: SVG at 900px wide produces clean vector
  PNG_W: 1600,
  PDF_W: 900,

  // Helpers — inject <style> block into SVG for Montserrat font reference
  fontStyle(svgNode) {
    svgNode.append('defs').append('style').text(
      "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap');"
    );
  },
};
