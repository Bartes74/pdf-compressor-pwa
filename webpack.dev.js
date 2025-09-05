const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 3003,
    hot: true,
    open: true,
    historyApiFallback: true,
    server: 'https',
    proxy: {
      // Example proxy configuration
      '/api': {
        target: 'http://localhost:8080',
        secure: false,
        changeOrigin: true
      }
    }
  },
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
    assetFilter: function(assetFilename) {
      return !assetFilename.endsWith('.pdf');
    }
  },
  stats: {
    assets: true,
    chunks: true,
    modules: true,
    reasons: true,
    usedExports: true
  }
});