import * as del from "del";
import { htmlEscape } from "../Core/util";

export const ButtonOK = 1;
export const ButtonCancel = 0;
export const ButtonElse = 2;

export enum Button {
    Cancel = ButtonCancel,
    Ok = ButtonOK,
    Else = ButtonElse
}

export interface MessageboxResult {
    button:Button;
    result: string;
    results: string[];
}

export class Notification {
    public static lastNotificationTop: any;
    public static lastNotificationBottom: any;
    public static Show(text: string, top?:boolean, continueLast?:boolean, delay?:number, html?:boolean, opacity?:number, blink?:boolean, callb?:Function) {
        Notification.Notify("info", text, top, continueLast, delay, html, opacity, blink, callb)
    }
    public static Warning(text: string, top?:boolean, continueLast?:boolean, delay?:number, html?:boolean, opacity?:number, blink?:boolean, callb?:Function) {
        Notification.Notify("warning", text, top, continueLast, delay, html, opacity, blink, callb)
    }
    public static Notify(type:string, text: string, top?:boolean, continueLast?:boolean, delay?:number, html?:boolean, opacity?:number, blink?:boolean, callb?:Function) {
        delay = delay || 3000;
        let centralPanel = $(top ? "#notificationTop" : "#notificationBottom");
        let content = $(top ? "#notificationTopContent" : "#notificationBottomContent");
        if (html) 
            content.html(text)
        else
            content.text(htmlEscape(text));
        let lastSetting = {
            appendContainer: top ? "#notification-top" : "#notification-bottom",
            width: "auto", position: top ? "top-right" : "bottom-right", opacity: opacity || 0.9,
            autoOpen: false, animationOpenDelay: Math.min(500,delay/2), autoClose: true, autoCloseDelay: delay, blink: blink,
            height: "auto", template: type
        };
        if (top && this.lastNotificationTop && continueLast) {
            (<any>centralPanel).jqxNotification("closeAll")
        } else if (!top && this.lastNotificationBottom && continueLast) {
            (<any>centralPanel).jqxNotification("closeAll")
        } else {
            if (top)
                this.lastNotificationTop = lastSetting;
            else
                this.lastNotificationBottom = lastSetting;
            (<any>centralPanel).jqxNotification(lastSetting);
        }
        (<any>centralPanel).jqxNotification("open");
        centralPanel.off("click")
        if (callb) {
            centralPanel.on("click", callb as any)
            centralPanel.css({"cursor": "pointer"})
        } else {
            centralPanel.css({"cursor": "inherit"})
        }
    }
}

export class Messagebox {
    public static async Show(title: string, text: string, labelStyle:string = "") {
        return await messagebox(title, text, null, "OK", "", null, false, [""], null, null, false, labelStyle);
    }
    public static async ShowWithButtons(title: string, text: string, okButton:string, cancelButton:string): Promise<MessageboxResult> {
        return await messagebox(title, text, null, okButton, cancelButton, null, false, [""], null, null, false, "");
    }
    public static async Question(text: string): Promise<MessageboxResult> {
        return await messagebox("Domanda", text, null, "Si", "No", null, false, [""], null, null, false, "");
    }
    public static async ShowWithWithCallback(title: string, text: string, callback:(val:string)=>void): Promise<MessageboxResult> {
        return await messagebox(title, text, callback, "OK", "", null, false, [""], null, null, false, "");
    }
    public static async ShowWithWithButtonsAndCallback(title: string, text: string, okButton:string, cancelButton:string, callback:(val:string)=>void): Promise<MessageboxResult> {
        return await messagebox(title, text, callback, okButton, cancelButton, null, false, [""], null, null, false, "");
    }
    public static async ShowFull(title: string, text: string, okButton:string, cancelButton:string, callback:(val:string)=>void, width:number, height:number): Promise<MessageboxResult> {
        return await messagebox(title, text, callback, okButton, cancelButton, null, false, [""], width, height, false, "");
    }
    public static async ShowTriple(title: string, text: string, okButton:string, cancelButton:string, thirdButton:string, width?:number, height?:number): Promise<MessageboxResult> {
        return await messagebox(title, text, null, okButton, cancelButton, thirdButton, false, [""], width, height, false, "");
    }
    public static async ShowInputWithButtons(title: string, text: string, defaultText:string, okButton:string, cancelButton:string): Promise<MessageboxResult> {
        return await messagebox(title, text, null, okButton, cancelButton, null, true, [defaultText], null, null, false, "");
    }
    public static async ShowInput(title: string, text: string, defaultText:string, multiline:boolean=false): Promise<MessageboxResult> {
        let res = await messagebox(title||"Domanda", text, null, "OK", "Annulla", null, true, [defaultText], null, null, false, "", multiline);
        return res;
    }
    public static async ShowMultiInput(title: string, labels: string[], defaultValues:any[]): Promise<MessageboxResult> {
        let res = await messagebox(title||"Domanda", labels.join('\n'), null, "OK", "Annulla", null, true, defaultValues, null, null, true, "");
        return res;
    }
}

export async function messagebox(title: string, text: string, callback:(val:string)=>void, okbuttontext:string, cancelbuttontext:string, thirdbuttontext:string, input:boolean, inputDefault:any[], width:number, height:number, multiinput:boolean, labelStyle:string, multiline:boolean=false): Promise<MessageboxResult> {
    let wData = null;
    try {

        let resolveFunc:Function = null;
        let rejectFunc:Function = null;
        let ret:MessageboxResult = {
            button: ButtonCancel,
            result: "",
            results: []
        };
        let promise = new Promise<MessageboxResult>((resolve,reject) => {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "winMessagebox";
        document.body.appendChild(win);
        okbuttontext = okbuttontext == undefined ? "OK" : okbuttontext;
        cancelbuttontext = cancelbuttontext == undefined ? "Annulla" : cancelbuttontext;

        const numInputs = multiinput ? text.split('\n').length : 1
        const inputLabels = multiinput ? text.split('\n') : [typeof text != "string" ? "" : text]

        let innserMessageboxBody = ""

        if (typeof text != "string") {
            innserMessageboxBody = "<div style='display: table-cell;vertical-align: middle;text-align:center;' class='customjq'></div>"
        } else {
            innserMessageboxBody = "<div style='display: table-cell;vertical-align: middle;text-align:center;'>"
            for (let index = 0; index < inputLabels.length; index++) {
                const label = inputLabels[index];
                let type = "text"
                if (inputDefault && typeof inputDefault[index] == "boolean") {
                    type = "checkbox"
                }
                let inputTemplate = `<input type="${type}" style="box-sizing:border-box;width:${numInputs>1?"auto":"100%"};" id="messageboxinput${index}">`
                let rowOrCell = "row"
                let tableorRow = "table;width:100%"
                let innercell = "display: table-cell;"
                let align = "left"
                if (numInputs > 1) {
                    align = "right"
                    rowOrCell = "cell"
                    innercell = ""
                    tableorRow = "table-row"
                }
                if (multiline) {
                    inputTemplate = `<textarea style="min-height:200px;height:100%;box-sizing:border-box;width:100%;" id="messageboxinput${index}"></textarea>`
                }
                const template =`
                <div style="display: ${tableorRow};height:${multiline?'100%':'auto'};">
                    <div style="display: table-${rowOrCell};height:auto;">
                        <div class="messageboxtext" style="${innercell}vertical-align: middle;text-align:${align};padding:5px" id="message${index}"></div>
                    </div>
                    <div style="display: table-${rowOrCell};height:${multiline?100:1}%;padding:5px;">
                        ${rowOrCell=="row"?"<div style='display: table-cell;padding: 5px;'>":""}
                            ${inputTemplate}
                        ${rowOrCell=="row"?"</div>":""}
                    </div>
                </div>
                    `;
                innserMessageboxBody += template
            }
            innserMessageboxBody += "</div>"
        }

        win.innerHTML = `
        <!--header-->
        <div id="title"></div>
        <!--content-->
        <div id="msgboxcontent">
            <div style="display: table;height: 100%;width: 100%;box-sizing: border-box;position:relative;">
                <div style="display: table-row;width: 100%;box-sizing: border-box;position:relative;height:${multiline?'100%':'auto'};">
                ${innserMessageboxBody}
                </div>
                <div style="display: table-row;height:auto">
                    <div class="messageboxbuttons" style="display: table-cell">
                        <button id="third" style="display:none;" class="thirdbutton yellowbutton"></button>
                        <button id="accept" class="acceptbutton greenbutton"></button>
                        <button id="cancel" class="cancelbutton redbutton"></button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        let $win = $(win);

        if (typeof text != "string") {
            $(".customjq", $win).append(text)
        }

        const thirdButton = $("#third", $win);
        const acceptButton = $("#accept", $win);
        const cancelButton = $("#cancel", $win);
        const titleText = $("#title", $win);
        const messageText = [...Array(numInputs).keys()].map((v,i) => $("#message"+i, $win));
        const messageInput = [...Array(numInputs).keys()].map((v,i) => $("#messageboxinput"+i, $win));
        if (!input) {
            messageInput.map(v => v.hide());
        } else if (inputDefault) {
            messageInput.map((v,i) => typeof inputDefault[i] == "boolean" ? v.prop("checked", inputDefault[i]) : v.val(inputDefault[i]));
        }

        if (!multiline) messageInput.map(v => v.keyup(k => {
            if (k.key == "Enter" || k.key == "Return") {
                acceptButton.click();
            }
        }));

        let maxW = width || $(window).width()-20;
        let maxH = height || $(window).height()-20;
        let minW = maxW / 4;
        let minH = maxH / 10;

        wData = {
            minWidth: minW,
            minHeight: minH,
            width: width || "auto",
            height: height || "auto",
            maxWidth: maxW,
            maxHeight: maxH,
            showCollapseButton: false,
            isModal: true,
                resizable: true};
        (<any>$win).jqxWindow(wData);

        if (thirdbuttontext != undefined) {
            $(thirdButton).text(thirdbuttontext);
            $(thirdButton).show()
        }
        $(acceptButton).text(okbuttontext);
        if (!okbuttontext) $(acceptButton).hide();
        $(cancelButton).text(cancelbuttontext);
        if (!cancelbuttontext) $(cancelButton).hide();

        $(acceptButton).click(() => {
            ret.button = ButtonOK;
            ret.result = (okbuttontext);
            (<any>$win).jqxWindow("close");
        });
        $(cancelButton).click(() => {
            ret.result = (cancelbuttontext);
            ret.button = ButtonCancel;
            (<any>$win).jqxWindow("close");
        });

        $(thirdButton).click(() => {
            ret.result = (thirdbuttontext);
            ret.button = ButtonElse;
            (<any>$win).jqxWindow("close");
        });

        $(titleText).text(title);
        messageText.map((v,i) => v.html(`<span style='${labelStyle?labelStyle+";":""}margin:0;padding:0;'>` + inputLabels[i].replace(/\n/g, "<br/>") +"</span>"));

        (<any>$win).jqxWindow("open");
        (<any>$win).jqxWindow('bringToFront');
        (<any>$win).on("close", () => {
            if (callback) callback(ret.result);
            (<any>$win).jqxWindow("destroy");
            if (input) {
                ret.result = messageInput[0].val();
                if (multiinput) {
                    ret.results = messageInput.map((v,i) => typeof inputDefault[i] == "boolean" ? v.prop("checked") : v.val())
                }
            }
            if (resolveFunc) resolveFunc(ret);
            $("#cmdInput").focus();
        });
        
        messageText.forEach(i => i.css({
            "white-space": "nowrap"
        }));

        if (!width) {
            let newWidth = Math.max(...messageText.map(v => v.outerWidth()+10));
            if (numInputs>1) {
                newWidth += Math.max(...messageInput.map(v => v.outerWidth()+10));
            }
            newWidth = Math.max(100, newWidth);
            (<any>$win).jqxWindow({width: Math.min($(window).width()-20, newWidth)}); 
        }
        messageText.forEach(i => i.css({
            "white-space": "wrap"
        }));

        if (!height) {
            (<any>$win).find('.jqx-window-content').append('<div id="bottomOfContent"></div>');
            let offset = (<any>$win).find('.jqx-window-content #bottomOfContent').position();
            $('.jqx-window-content #bottomOfContent', $win).remove();

            /*
            let height = [...messageText.map(v => v.height())].reduce(function(a, b) { return a + b; }, 0);
            let inputheight = [...messageInput.map(v => v.height())].reduce(function(a, b) { return a + b; }, 0);
            // get new height based on position of marker
            var newHeight = height +
                $('.messageboxbuttons', $win).height() +
                $('.jqx-window-header', $win).height() +
                (input ? inputheight : 0)+
                70;
            */
            // apply new height
            const newH = Math.max(100, offset.top + 50);
            (<any>$win).jqxWindow({height: newH}); 
        }

        const left = ($(window).width() - (<any>$win).jqxWindow("width")) / 2;
        const top = ($(window).height() - (<any>$win).jqxWindow("height")) / 2;
        const pos = {x: Math.max(10, left), y: Math.max(10, top)};
        (<any>$win).jqxWindow({position: pos}); 
        

        setTimeout(()=>{
        if (input) {
            messageInput[0].focus();
        } else {
            acceptButton.focus();
        }}, 200);

        return promise;
    }
    catch (er) {
        $("#winOutput").text("error: " + er + "\n" + JSON.stringify(wData, null, 2));
        return null;
    };
}
