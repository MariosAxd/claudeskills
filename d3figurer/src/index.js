/**
 * D3Figurer - Server-side D3.js figure generation
 * 
 * Main API for rendering D3.js figures to PDF/PNG via Puppeteer.
 * Supports both standalone and server modes for optimal performance.
 */

const FigurerServer = require('./server');
const FigurerClient = require('./client');
const StandaloneRenderer = require('./standalone');

class D3Figurer {
  constructor(options = {}) {
    this.options = {
      port: 9229,
      srcDir: null,
      fontCSS: '',     // raw CSS injected into the page <style> block; empty = browser default
      chromeOptions: {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]
      },
      ...options
    };
    
    this.server = null;
    this.client = null;
  }

  /**
   * Start the persistent render server
   * @param {number} port - Port to listen on
   * @returns {Promise<FigurerServer>}
   */
  async startServer(port = this.options.port) {
    if (this.server) {
      throw new Error('Server already running');
    }
    
    this.server = new FigurerServer({
      port,
      srcDir: this.options.srcDir,
      fontCSS: this.options.fontCSS,
      chromeOptions: this.options.chromeOptions
    });
    
    await this.server.start();
    return this.server;
  }

  /**
   * Stop the render server
   */
  async stopServer() {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
  }

  /**
   * Get a client for communicating with the render server
   * @param {number} port - Server port
   * @returns {FigurerClient}
   */
  getClient(port = this.options.port) {
    if (!this.client) {
      this.client = new FigurerClient({ port });
    }
    return this.client;
  }

  /**
   * Render a figure using the best available method
   * @param {string} figureName - Name of the figure to render
   * @param {string} outputPath - Output file path
   * @param {Object} options - Render options
   * @returns {Promise<void>}
   */
  async render(figureName, outputPath, options = {}) {
    // Try server mode first
    const client = this.getClient();
    const serverAvailable = await client.isServerAvailable();
    
    if (serverAvailable) {
      return await client.render(figureName, outputPath, options);
    }
    
    // Fall back to standalone mode
    const standalone = new StandaloneRenderer({
      srcDir: this.options.srcDir,
      fontCSS: this.options.fontCSS,
      chromeOptions: this.options.chromeOptions
    });
    
    return await standalone.render(figureName, outputPath, options);
  }

  /**
   * Render multiple figures in batch
   * @param {Array<{name: string, output: string}>} figures - Array of figure specs
   * @param {Object} options - Render options
   * @returns {Promise<Array<{name: string, success: boolean, error?: string}>>}
   */
  async renderBatch(figures, options = {}) {
    const client = this.getClient();
    const serverAvailable = await client.isServerAvailable();
    
    if (serverAvailable) {
      return await client.renderBatch(figures, options);
    }
    
    // Fall back to standalone mode
    const standalone = new StandaloneRenderer({
      srcDir: this.options.srcDir,
      fontCSS: this.options.fontCSS,
      chromeOptions: this.options.chromeOptions
    });
    
    const results = [];
    for (const figure of figures) {
      try {
        await standalone.render(figure.name, figure.output, options);
        results.push({ name: figure.name, success: true });
      } catch (error) {
        results.push({ name: figure.name, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Check a figure for layout issues
   * @param {string} figureName - Name of the figure to check
   * @param {Object} options - Check options
   * @returns {Promise<Object>} Layout analysis results
   */
  async checkFigure(figureName, options = {}) {
    const client = this.getClient();
    const serverAvailable = await client.isServerAvailable();
    
    if (!serverAvailable) {
      throw new Error('Figure checking requires server mode. Start server first.');
    }
    
    return await client.checkFigure(figureName, options);
  }
}

module.exports = D3Figurer;