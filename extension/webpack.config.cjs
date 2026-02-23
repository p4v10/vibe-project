const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  mode: 'production',
  devtool: 'cheap-source-map',
  entry: {
    content: './src/content/index.ts',
    background: './src/background/service_worker.ts',
    popup: './src/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) =>
      pathData.chunk.name === 'popup' ? 'popup/popup.js' : '[name].js',
    clean: true,
  },
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
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'src/popup/index.html', to: 'popup/index.html' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' },
      ],
    }),
  ],
}
