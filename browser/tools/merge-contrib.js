import { execSync } from 'child_process';
import { deleteAsync } from 'del';
import fs from 'fs';
import fsx from 'fs-extra';
import path from 'path';

const folders = [
    {
        path: './TS2-Contrib/roomtype',
        regex: /^.*\..*$/i,
        outputFolder: './static/public/images/roomtype'
    },
    {
        path: './TS2-Contrib/help',
        regex: /^.*\..*$/i,
        outputFolder: './static/public/help'
    },
    {
        path: './TS2-Contrib',
        regex: /^.*\.json$/i,
        outputFolder: './static/public'
    }
];

console.log(execSync("git submodule init && git submodule update --recursive --remote && git submodule foreach --recursive git pull origin main").toString());

folders.forEach(folder => {
    fsx.readdirSync(folder.path).forEach(file => {
        if (folder.regex.test(file)) {
            console.log(`copying file ${file}`);
            fsx.copy(`${folder.path}/${file}`, `${folder.outputFolder}/${file}`)
        }
    });
});
