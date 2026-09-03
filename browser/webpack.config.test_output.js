import path from 'path';
const __dirname = import.meta.dirname;

export default {
  entry: './build/test/browser/test/test_output/main.js',
  output: {
    path: path.resolve(__dirname + "/static/test/"),
    filename: 'mudslingerTestOutput.js'
  },
  mode: "development"
};
