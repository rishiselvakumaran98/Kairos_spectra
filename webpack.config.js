const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.ts',
    content: './src/content.ts',
    injected: './src/injected.ts',
    popup: './src/popup.ts',
    'vega-sandbox-bundle': './src/vega-sandbox-bundle.ts'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  // CRITICAL: Chrome extensions don't allow eval() due to CSP
  devtool: 'cheap-source-map', // Use source maps without eval
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/content.css', to: 'content.css' },
        { from: 'vega-sandbox.html', to: 'vega-sandbox.html' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true }
      ]
    })
  ],
  optimization: {
    minimize: false // For debugging; set to true for production
  }
};
