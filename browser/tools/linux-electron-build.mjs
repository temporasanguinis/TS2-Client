const fs = require("fs");
var path = require('path');
const { exec } = require("child_process");

let build = process.argv[2].replace("%PWD%", __dirname);
let dockerContainer = process.argv[3];

const currentPath = (path.dirname(fs.realpathSync(build))).replace(/\\/g,"\\\\",)
const commandLine = `docker run -v ${currentPath}\\\\:/project ${dockerContainer} npm run electronLinuxBuild`

console.log("RUNNING: " + commandLine)

exec(commandLine, (error, stdout, stderr) => {
    const buildhash = stdout.trim().toString();
    if (error) {
        console.log(`Could not build linux alectron package: ${error.message}`);
        process.exit(1);
    }
    if (stderr) {
        console.log(`Could not build linux alectron package: ${stderr}`);
        process.exit(1);
    }
});
