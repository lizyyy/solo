const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: {
    main: './src/main/main.ts',
    preload: './src/renderer/preload.ts',
  },
  target: 'electron-main',
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/main'),
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
