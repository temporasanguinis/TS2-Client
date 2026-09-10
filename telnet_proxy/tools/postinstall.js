import fs from "fs-extra";

let flnameConfigServer = "configServer.js"
let flnameConfigServerDefault = "configServer.default.js"

// Don't want to overwrite existing config file if any
if (!fs.existsSync(flnameConfigServer)) {
    fs.createReadStream(flnameConfigServerDefault).pipe(fs.createWriteStream(flnameConfigServer));
    console.log("Copying " + flnameConfigServerDefault + " to " + flnameConfigServer);
}
