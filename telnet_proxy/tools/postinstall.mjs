import fs from "fs-extra";

let flnameConfigServer = "configServer.mjs"
let flnameConfigServerDefault = "configServer.default.mjs"

// Don't want to overwrite existing config file if any
if (!fs.existsSync(flnameConfigServer)) {
    fs.createReadStream(flnameConfigServerDefault).pipe(fs.createWriteStream(flnameConfigServer));
    console.log("Copying " + flnameConfigServerDefault + " to " + flnameConfigServer);
}
