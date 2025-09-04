const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    app: './src/js/app.js',
    styles: './src/css/styles.css'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    assetModuleFilename: 'assets/[hash][ext][query]'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: '> 0.25%, not dead',
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/i,
        use: [
          process.env.NODE_ENV === 'production' 
            ? MiniCssExtractPlugin.loader 
            : 'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js'
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      inject: 'body',
      minify: process.env.NODE_ENV === 'production'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/service-worker.js', to: 'service-worker.js' },
        { from: 'public/offline.html', to: 'offline.html' },
        { from: 'src/assets/icons', to: 'assets/icons' }
      ]
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
          destination: path.join('assets', 'icons')
        }
      ]
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    })
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    },
    sideEffects: false
  },
  resolve: {
    extensions: ['.js', '.css']
  }
};