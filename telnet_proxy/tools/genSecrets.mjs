import { exit } from "process";
import fs from "fs";

let token = process.env.CONNECTION_TOKEN
if (!token) try {
    token = fs.readFileSync("token", {encoding: "utf8"}).replace(/[\r\n]+/gm, "")
} catch (ex) {
    console.error("Manca il CONNECTION_TOKEN. Deve essere una variabile environment oppure nel file chiamato token.")
    exit(10)
}
let txt = `export namespace Secrets {
    export let Token: string = "${token}";
}`;
    

fs.writeFileSync('src/secrets.ts', txt);
