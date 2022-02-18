var path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
module.exports = {
  entry: './build/browser/src/ts/client.js',
  output: {
    path: path.resolve(__dirname, "static/public"),
    filename: 'mudslinger-[contenthash].js'
  },
  plugins: [
    new CleanWebpackPlugin({
      /*dry: true,*/
      verbose: true,
      cleanOnceBeforeBuildPatterns: ['*.hot-update.json', '*.js', '!jquery*'],
    }),
    new 
    CopyPlugin({
      patterns: [
        {
          // If absolute path is a `glob` we replace backslashes with forward slashes, because only forward slashes can be used in the `glob`
          from: "src/cacheServiceWorker.js",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/template.html",
      filename: path.resolve(__dirname, "static/public", "index.html")
  })],
  mode: 'production'
};