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
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    https: true, // Required for PWA testing
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
    hints: 'warning',
    maxAssetSize: 1000000, // 1MB
    maxEntrypointSize: 1000000 // 1MB
  },
  stats: {
    assets: true,
    chunks: true,
    modules: true,
    reasons: true,
    usedExports: true
  }
});