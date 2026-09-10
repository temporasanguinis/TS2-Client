import { OutWinBase } from "./outWinBase";
import { ConfigIf, stripHtml } from "../../Core/util";
import { IBaseWindow } from "../windowManager";

export class CustomWin extends OutWinBase implements IBaseWindow {
    constructor(elementName:string, config: ConfigIf) {
        const parent = $("#"+elementName);
        super(elementName, parent, config);
    }

    public write(text:string, buffer:string) {
        this.lineText = text.indexOf("<span")!=-1 ? stripHtml(text) : text;
        this.appendBuffer = buffer;
        this.appendToCurrentTarget(this.appendBuffer);
        //this.newLine();
        this.outputDone();
    }

    public writeLine(text:string, buffer:string) {
        this.lineText = text.indexOf("<span")!=-1 ? stripHtml(text) : text;
        this.appendBuffer = buffer+"<br>";
        this.appendToCurrentTarget(this.appendBuffer);
        this.newLine();
        this.outputDone();
    }
}
