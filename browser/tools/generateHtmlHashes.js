import fs from "fs";

import pjson from '../package.json' with { type: 'json' };
const inputFile = 'src/html/template_full.html'
const outputFile = 'src/html/template.html'

fs.readFile(inputFile, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/\$\{hash\}/g, pjson.version);

  fs.writeFile(outputFile, result, 'utf8', function (err) {
     if (err) return console.log(err);
  });
});
