const path = require('path');

module.exports = {
  entry: [
    './public/src/initWeb3.js',
    './public/src/createpos.js',
    './public/src/changeprice.js',
    './public/src/liquidate.js',
    './public/src/monitor.js'
  ],
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};