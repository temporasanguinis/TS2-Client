import path from 'path';
const __dirname = import.meta.dirname;

export default {
  entry: './build/test/browser/test/testMain.js',
  output: {
    path: path.resolve(__dirname + "/static/test/"),
    filename: 'mudslingerTest.js'
  },
  mode: "development"
};
