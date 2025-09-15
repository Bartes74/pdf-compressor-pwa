/* eslint-env node */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  entry: {
    app: './src/js/app.js',
    styles: './src/css/styles.css',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    assetModuleFilename: 'assets/[hash][ext][query]',
  },
  // Bundle libraries locally instead of using CDN externals
  externals: {},
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: '> 0.25%, not dead',
                  useBuiltIns: 'usage',
                  corejs: 3,
                },
              ],
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          process.env.NODE_ENV === 'production'
            ? MiniCssExtractPlugin.loader
            : 'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js',
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      inject: 'body',
      minify: process.env.NODE_ENV === 'production',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/offline.html', to: 'offline.html' },
        { from: 'public/service-worker.js', to: 'service-worker.js' },
        { from: 'src/assets/icons', to: 'assets/icons' },
        { from: 'src/assets/bart_ex.png', to: 'assets/bart_ex.png' },
        // Vendor: local copies of pdf-lib and pdfjs (main and worker)
        { from: 'node_modules/pdf-lib/dist/pdf-lib.min.js', to: 'vendor/pdf-lib.min.js' },
        { from: 'node_modules/pdfjs-dist/build/pdf.min.js', to: 'vendor/pdf.min.js' },
        { from: 'node_modules/pdfjs-dist/build/pdf.worker.min.js', to: 'vendor/pdf.worker.min.js' },
      ],
    }),
    new WebpackPwaManifest({
      name: 'PDF Compressor',
      short_name: 'PDFCompress',
      description: 'A Progressive Web App for compressing PDF files',
      background_color: '#ffffff',
      theme_color: '#4361ee',
      crossorigin: 'use-credentials',
      icons: [
        {
          src: path.resolve('src/assets/icons/icon-192x192.svg'),
          sizes: [96, 128, 192, 256, 384, 512],
          destination: path.join('assets', 'icons'),
        },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE ? 'server' : 'disabled',
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        pdfLib: {
          test: /[\\/]node_modules[\\/](pdf-lib|pdfjs-dist)[\\/]/,
          name: 'pdf-libs',
          priority: 10,
          reuseExistingChunk: true,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
          reuseExistingChunk: true,
        },
        styles: {
          name: 'styles',
          type: 'css/mini-extract',
          chunks: 'all',
          enforce: true,
        },
      },
    },
    sideEffects: false,
  },
  resolve: {
    extensions: ['.js', '.css'],
  },
};
