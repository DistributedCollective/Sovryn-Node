const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    './public/src/initWeb3.js',
    './public/src/monitor.js'
  ],
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    hot: true,
    port: 8080,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: 'public/src/index.html'}
      ]
    }),
  ],
  resolve: {
    extensions: ['.ts', ".js"],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
};