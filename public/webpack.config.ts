const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    './public/src/initWeb3.js',
    './public/src/index.js',
    './public/src/styles.css'
  ],
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    hot: true,
    port: 8080,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: 'public/src/index.html'}
      ]
    }),
  ],
  resolve: {
    extensions: ['.ts', ".js", ".css"],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
};