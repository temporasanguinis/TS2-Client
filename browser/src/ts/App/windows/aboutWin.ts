import { AppInfo } from "../../appInfo";
import { htmlEscape } from "../../Core/util";

export class AboutWin {
    private $win: JQuery;

    constructor() {
        const inWeb = !!!(<any>window).ipcRenderer;
        const title = inWeb ? AppInfo.AppTitle : AppInfo.AppTitle.replace("Web ","");
        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "winAbout";
        document.body.appendChild(win);

        win.innerHTML = `
        <!--header-->
        <div>INFORMAZIONI CLIENT E VERSIONE</div>
        <!--content-->
        <div style="text-align:center;">
            <h1>${title}</h1>
            Versione: ${AppInfo.Version}
            <br>
            Build: ${AppInfo.Build}
            <br>
            <br>
            Sito: <a href="${AppInfo.RepoUrl}" target="_blank">${AppInfo.RepoUrl}</a>
            <br>
            Bug report: <a href="${AppInfo.BugsUrl}" target="_blank">${AppInfo.BugsUrl}</a>
            <br>
            <br>
            Autore: ${htmlEscape(AppInfo.Author)}
            <br>
            Contributori: ${htmlEscape(AppInfo.Contributors.join(", "))}<br><br>
            <a href="https://github.com/temporasanguinis/TS2-Client/releases" target="_blank">Scarica l'ultima versione da qui</a>
        </div>
        `;

        this.$win = $(win);

        const w = Math.min($(window).width()-20, 480);
        const h = Math.min($(window).height()-20, 290);

        (<any>this.$win).jqxWindow({width: w, height: h});
    }

    public show() {
        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow("bringToFront");
    }
}
