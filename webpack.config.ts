//const fs = require('fs');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    './public/src/initWeb3.js',
    './public/src/monitor.js'
  ],
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './public/dist',
    hot: true,
    port: 8080,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: './public/src/index.html'},
        {from: './public/src/index.js'}
      ]
    }),
  ],
  resolve: {
    extensions: ['.ts', ".js"],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public/dist'),
    publicPath: '/'
  },
};