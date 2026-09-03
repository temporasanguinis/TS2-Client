import fs from "fs";

import pjson from '../package.json' with { type: 'json' };


let build = process.argv[2];
import { exec } from "child_process";
import { exit } from "process";

exec(build, (error, stdout, stderr) => {
    const buildhash = stdout.trim().toString();
    if (error) {
        console.log(`Could not fetch build version: ${error.message}`);
        process.exit(1);
    }
    if (stderr) {
        console.log(`Could not fetch build version: ${stderr}`);
        process.exit(1);
    }
    let token = process.env.CONNECTION_TOKEN
    if (!token) {
        try {
            token = fs.readFileSync("token", {encoding: "utf8"}).replace(/[\r\n]+/gm, "")
        } catch {
            console.error("Se non usi l'environment variable CONNECTION_TOKEN, devi avere un file chiamato token nella cartella con il contenuto del CONNECTION_TOKEN per poter conetterti al proxy.")
            exit(10)
        }
    }
    let txt = `export namespace AppInfo {
        export let AppTitle: string = "${pjson.description}";
        export let RepoUrl: string = "${pjson.repository.url}";
        export let BugsUrl: string = "${pjson.bugs.url}";
        export let Version: string = "${pjson.version}";
        export let Build: string = "${buildhash}";
        export let Author: string = "${pjson.author}";
        export let Contributors: string[] = ["${pjson.contributors.join("\",\"")}"];
        export let Token: string = "${token}";
    }`;
    
    fs.writeFileSync('src/ts/appInfo.ts', txt);

    generateVersions();
});

function generateVersions() {
    const ver = pjson.version

    let versions = fs.readFileSync("./static/public/versions.txt").toString()
    let latest = fs.readFileSync("./latestVersion.txt").toString()
    const currentVersionStart = versions.indexOf(ver)
    console.log(ver + " " + currentVersionStart)

    if (currentVersionStart==-1 || currentVersionStart!=0) {
        versions = addLatestVersion(latest, versions)
        fs.writeFileSync("./static/public/versions.txt", versions)
    } else {
        let lines = versions.split(/\r\n|\r|\n/g)
        const index = lines.findIndex((v)=>{
            const m = v.match(/^v?\d+\.\d+\.\d+$/gi)
            const ok = v != ver && m
            return ok
        })
        console.log(index)
        if (index > 0 && index<lines.length) {
            lines.splice(0, index)
            versions = lines.join("\n")
            versions = addLatestVersion(latest, versions)
            fs.writeFileSync("./static/public/versions.txt", versions)
        }
    }

    function addLatestVersion(latest, versions) {
        return `${ver}
${latest}
____________________________________________________________
${versions}`;
    }
}
