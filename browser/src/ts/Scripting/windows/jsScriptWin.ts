import { TsClient } from "../../App/client";
import {JsScript} from "../jsScript";
import { CreateCodeMirror, parseScriptVariableAndParameters, refreshVariablesInTern } from "../../Core/util";

declare let CodeMirror: any;

export class JsScriptWin {
    private $win: JQuery;
    private codeMirror: any = null;
    private $runButton: JQuery;

    constructor(private jsScript: JsScript) {
        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "winJsScript";
        document.body.appendChild(win);

        win.innerHTML = `
        <!--header-->
        <div>Javascript Script</div>
        <!--content-->
        <div>
            <div class="right-pane">
                <div class="pane-header">
                    <span>Il codice della script da eseguire:</span>
                </div>                    
                <div class="pane-content">
                    <textarea class="winJsScript-code"></textarea>
                </div>
                <div class="pane-footer">
                    <button class="winJsScript-btnRun bluebutton">ESEGUI SCRIPT</button>
                </div>
            </div>
        </div>
        `;

        this.$win = $(win);
        this.$runButton = $(win.getElementsByClassName("winJsScript-btnRun")[0]);
        const win_w = $(window).innerWidth()-20;
        const win_h = $(window).innerHeight()-20;
        (<any>this.$win).jqxWindow({keyboardCloseKey :'none',width: Math.min(550, win_w), height: Math.min(400, win_h), showCollapseButton: true});

        this.codeMirror = CreateCodeMirror(win.getElementsByClassName("winJsScript-code")[0] as HTMLTextAreaElement, this.jsScript)

        $(this.codeMirror.getWrapperElement()).css("height","100%");

        this.$runButton.on("blur", () => {
            if ((<any>this.$win).jqxWindow("isOpen")) this.codeMirror.focus()
        })

        this.$win.on('open', (event) => {
            this.$win.focusable().focus()
        })
        this.$win.on('keydown', (event) => {
            if (event.keyCode == 27) {
                (<any>this.$win).jqxWindow("close")
            }
        });

        (<any>this.$win).jqxWindow("close")
        this.$runButton.click(this.handleRunButtonClick.bind(this));
    }

    private handleRunButtonClick() {
        let code_text = this.codeMirror.getValue();
        code_text = parseScriptVariableAndParameters(code_text, {} as any);
        let script = this.jsScript.makeScript("Script", code_text, "");
        if (script) { script(); };
    }

    public show() {
        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow("bringToFront");
        const script = this.jsScript
        const cm = this.codeMirror
        refreshVariablesInTern(cm, script);
    }
    
}
