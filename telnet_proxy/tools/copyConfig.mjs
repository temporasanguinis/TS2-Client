import fs from "fs-extra";

let flnameConfigServer = "configServer.mjs"
let flnameConfigPath = "./dist/telnet_proxy/configServer.js"

fs.createReadStream(flnameConfigServer).pipe(fs.createWriteStream(flnameConfigPath));
console.log("Copying " + flnameConfigServer + " to " + flnameConfigPath);

