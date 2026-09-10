import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from "copy-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";
const __dirname = import.meta.dirname;
export default {
  entry: './build/browser/src/ts/App/client.js',
  output: {
    path: path.resolve(__dirname, "static/public"),
    filename: 'mudslinger-[contenthash].js',
    clean: {
      keep: /^jquery.*|.*(?!\.hot-update\.json|\.js)(?<!\.hot-update\.json|\.js)$/,
    },
  },
  performance: {
    maxEntrypointSize: 1024000,
    maxAssetSize: 1024000
  },
  plugins: [
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
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: {
          condition: /^\**!|@preserve|@license|@cc_on/i,
          filename: (fileData) => {
            // The "fileData" argument contains object with "filename", "basename", "query" and "hash"
            return `LICENSE.txt`;
          },
          banner: false,
        },
      }),
    ],
  },
  mode: 'production'
};
