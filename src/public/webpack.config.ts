const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    `${__dirname}/src/initWeb3.js`,
    `${__dirname}/src/index.js`,
    `${__dirname}/src/styles.css`
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
        {from: `${__dirname}/src/index.html`}
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