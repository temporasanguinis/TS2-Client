import { EventHook } from "./event";
import stripAnsi from 'strip-ansi';
import { OutputManager } from "../App/outputManager";
import { OutWinBase } from "../App/windows/outWinBase";
import { CommandInput } from "../App/commandInput";
import { EvtScriptEvent, JsScript, ScripEventTypes } from "../Scripting/jsScript";
import { UserConfig } from "../App/userConfig";
import { htmlEscape } from "./util";


// class DestWin extends OutWinBase {
//     constructor(name: string) {
//         let win = document.createElement("div");
//         win.innerHTML = `
//         <!--header-->
//         <div>${name}</div>
//         <!--content-->
//         <div>
//             <pre class="outputText mxp-dest-output"></pre>
//         </div>
//         `;

//         let cont = win.getElementsByClassName('outputText')[0];

//         (<any>$(win)).jqxWindow({
//             showCloseButton: false,
//             keyboardCloseKey: '' // to prevent close
//         });

//         super($(cont), UserConfig);
//     }
// }

export interface mxpElement {
    name: string;
    regex: RegExp;
    definition:string;
    att:string;
    flag:string;
    tag:string;
    empty:string;
    open:string;
    delete:string;
    closing:string;
}

export interface mxpElementAlt extends mxpElement {
    nameAlt: string;
    definitionAlt:string;
    attAlt:string;
    flagAlt:string;
    tagAlt:string;
    emptyAlt:string;
    openAlt:string;
    deleteAlt:string;
}

export class Mxp {
    public EvtEmitCmd = new EventHook<{value: string, noPrint: boolean}>();

    private openTags: Array<string> = [];
    private elements:mxpElement[] = [];
    private tagHandlers: Array<(tag: string) => boolean> = [];
    private elementRegex:RegExp;
    private entityRegex:RegExp;

    // private destWins: {[k: string]: DestWin} = {};

    constructor(private outputManager: OutputManager, private commandInput: CommandInput, private script: JsScript, private config: UserConfig) {
        this.elementRegex = (/<!ELEMENT (?<name>[\w_]+) +((")+(?<definition>([^"])*)?(")+)? ?(ATT='?(?<att>[^" ']*)'? ?)?(TAG='?(?<tag>[^" ']*)'? ?)?(FLAG=('|")?(?<flag>[^"']*)('|")? ?)?(?<open>OPEN)? ?(?<empty>EMPTY)? ?(?<delete>DELETE)? ?[^>]*>(?=$|\<|\n|\r)|<!ELEMENT (?<nameAlt>[\w_]+) +((')+(?<definitionAlt>([^'])*)?(')+)? ?(ATT='?(?<attAlt>[^" ']*)'? ?)?(TAG='?(?<tagAlt>[^" ']*)'? ?)?(FLAG=('|")?(?<flagAlt>[^"']*)('|")? ?)?(?<openAlt>OPEN)? ?(?<emptyAlt>EMPTY)? ?(?<deleteAlt>DELETE)? ?[^>]*>(?=$|\<|\n|\r)/gi);
        this.entityRegex = (/<!ENTITY +(?<name>[\w_]+) +((")+(?<definition>([^>])*)?(")+)? ?(?<private>PRIVATE)? ?(?<delete>DELETE)? ?(?<remove>REMOVE)? ?(?<add>ADD)?>(?=$|\<|\n|\r)|<!ENTITY +(?<nameAlt>[\w_]+) +((')+(?<definitionAlt>([^>])*)?(')+)? ?(?<privateAlt>PRIVATE)? ?(?<deleteAlt>DELETE)? ?(?<removeAlt>REMOVE)? ?(?<addAlt>ADD)?>(?=$|\<|\n|\r)/gi);
        this.makeTagHandlers();
    }

    private addElement(e:mxpElementAlt):mxpElement {
        let ret:mxpElement = {
            name: e.nameAlt || e.name,
            regex: null,
            att: e.attAlt || e.att,
            definition: e.definitionAlt || e.definition,
            delete: e.deleteAlt || e.delete,
            empty: e.emptyAlt || e.empty,
            flag: e.flagAlt || e.flag,
            open: e.openAlt || e.open,
            tag: e.tagAlt || e.tag,
            closing: null
        };
        ret = this.parseElement(ret);
        const existingIndex = this.elements.findIndex(ee => ee.name == ret.name);
        if (existingIndex != -1) {
            this.elements.splice(existingIndex, 1)   
        }
        this.elements.push(ret);
        return ret;
    }

    private parseElement(e: mxpElement):mxpElement {
        
        if (e.definition && e.definition.indexOf("<") > -1) {
            // replacement tags
            const tags = e.definition.match(/<([^>]+)>/g);
            if (tags && tags.length) {
                e.closing = ''; 
                for (let index = tags.length - 1; index >= 0; index--) {
                    let closeTag = "</" + tags[index].slice(1).split(" ")[0];
                    if (!closeTag.endsWith(">")) {
                        closeTag += ">"
                    }
                    e.closing += closeTag;
                }
            }
        }
        let closeTag = e.empty == "EMPTY" ? "" : '<\/' + e.name + '>'
        e.regex = new RegExp('<' + e.name + '\\b[^>]*>([\\s\\S]*?)' + closeTag, 'i');
        return e;
    }

    private makeTagHandlers() {

        this.elements = [];
        this.tagHandlers.push((t) => {
            if (t.match(/<!element/i)) {
                var re = this.elementRegex; // (/<!ELEMENT (?<name>(\w|_)+) +(('|")+(?<definition>([^"'])*)?('|")+)? ?(ATT='?(?<att>[^" ']*)'? ?)?(TAG='?(?<tag>[^" ']*)'? ?)?(FLAG=('|")?(?<flag>[^"']*)('|")? ?)?(?<open>OPEN)? ?(?<empty>EMPTY)? ?(?<delete>DELETE)? ?[^>]*>/gi);
                re.lastIndex = 0;
                let m = re.exec(t);

                if (m) {
                    let ele = this.addElement(<mxpElementAlt>(<any>m).groups);
                    //console.debug("Element: ", ele);
                    while (m = re.exec(t)) {
                        ele = this.addElement(<mxpElementAlt>(<any>m).groups);
                        //console.debug("MXP Element: ", ele);
                    }
                    return true;
                }
            };
            return false;
        });

        this.tagHandlers.push((t) => {
            if (t.match(/<!entity/i)) {
                var re = this.entityRegex;
                re.lastIndex = 0;
                let m = re.exec(t);

                if (m) {

                    if (m.groups.nameAlt && !m.groups.name) {
                        m.groups.name = m.groups.nameAlt;
                    }

                    if (m.groups.definitionAlt && !m.groups.definition) {
                        m.groups.definition = m.groups.definitionAlt;
                    }

                    if (m.groups.privateAlt && !m.groups.private) {
                        m.groups.private = m.groups.privateAlt;
                    }

                    if (m.groups.deleteAlt && !m.groups.delete) {
                        m.groups.delete = m.groups.deleteAlt;
                    }

                    if (m.groups.removeAlt && !m.groups.remove) {
                        m.groups.remove = m.groups.removeAlt;
                    }

                    if (m.groups.addAlt && !m.groups.add) {
                        m.groups.add = m.groups.addAlt;
                    }

                    const def = (<any>m).groups.definition || '';
                    if (!this.script.getScriptThis()[(<any>m).groups.name]) {
                        this.script.getScriptThis()[(<any>m).groups.name] = "";
                    }
                    if ((<any>m).groups.delete) {
                        delete this.script.getScriptThis()[(<any>m).groups.name];
                    }
                    else if ((<any>m).groups.add) {
                        if (this.script.getScriptThis()[(<any>m).groups.name].length) {
                            this.script.getScriptThis()[(<any>m).groups.name] += "|";
                        }
                        this.script.getScriptThis()[(<any>m).groups.name]+=unescape(def.replace(/\\"/g, '"'));
                    }
                    else if ((<any>m).groups.remove) {
                        const prev = (this.script.getScriptThis()[(<any>m).groups.name] || "") as string;
                        const remove = unescape(def.replace(/\\"/g, '"'));
                        const newVal = prev.split("|").filter(v => v != remove).join("|");
                        this.script.getScriptThis()[(<any>m).groups.name] = newVal;
                    }
                    else {
                        this.script.getScriptThis()[(<any>m).groups.name] = unescape(def.replace(/\\"/g, '"'));
                    }
                    if ((<any>m).groups.name == "STARTPROMPT") {
                        this.outputManager.markCurrentTargetAsPrompt()
                    }
                    EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: m.groups.name, value: 
                        {
                            type: htmlEscape((<any>m).groups.name),
                            element: null,
                            value: htmlEscape(this.script.getScriptThis()[(<any>m).groups.name])
                        }
                    });
                
                    return true;
                }
            };
            return false;
        });

        this.tagHandlers.push((tag) => {
            let re = /^<version>$/i;
            let match = re.exec(tag);
            if (match) {
                this.EvtEmitCmd.fire({
                    value: "\x1b[1z<VERSION CLIENT=TS2 Client MXP=0.01>", // using closing line tag makes it print twice...
                    noPrint: true});
                    //console.debug("MXP Version");
                EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: "version", value:
                    {
                        type: "version",
                        element: null,
                        value: htmlEscape(match[0])
                    }
                });
                
                return true;
            }
            return false;
        });

        this.tagHandlers.push((tag) => {
            /* hande image tags */
            let re = /^<(tsimg|tsimage|image|img) ?(FName=["|']?([^ '"]+)["|']?)? ?url="([^">]*)"? ?(W=\"?(\d+)\"?)? ?(H=\"?(\d+)\"?)? ?(ALIGN=\"?([^\"\>]+)\"?)?>/i;
            let match = re.exec(tag);
            if (match) {
                if (this.config.getDef("mxpImagesEnabled", true)) {
                    /* push and pop is dirty way to do this, clean it up later */
                    const mw = (match[6] || "90") + (match[6] ? "px" : "%")
                    const mh = (match[8] || "70") + (match[8] ? "px" : "%")
                    const va = match[10] || "unset"
                    const url = match[4] && match[3] ? match[4] + match[3] : match[4]

                    //let elem = $("<img style=\"width:"+mw+";height:"+mh+";float:"+va+";\" src=\"" + url + "\">");
                    let elem = $(`<img style="width:${mw};height:${mh};float:${va.toLowerCase()};clear:both;${va=="unset"?"margin:10px;display:block;":"display:inline;margin-left:1px;margin-right:4px;vertical-align:middle;"}" src='${url}'/>`)
                    this.outputManager.pushMxpElem(elem);
                    this.outputManager.popMxpElem();
                    EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: match[1], value:
                        {
                            type: htmlEscape(match[1]),
                            element: elem,
                            value: htmlEscape(match[0])
                        }
                    });
                
                    //console.debug("MXP Image: ", match[2] + match[1]);
                }
                return true;
            }

            return false;
        });

        // this.tagHandlers.push((tag: string): boolean => {
        //     /* handle dest tags */
        //     let re = /^<dest (\w+)>$/i;
        //     let match = re.exec(tag);
        //     if (match) {
        //         let destName = match[1];
        //         this.openTags.push("dest");
        //         if (!this.destWins[destName]) {
        //             this.destWins[destName] = new DestWin(destName);
        //         }
        //         this.outputManager.pushTarget(this.destWins[destName]);
        //         return true;
        //     }

        //     re = /^<\/dest>$/i;
        //     match = re.exec(tag);
        //     if (match) {
        //         if (this.openTags[this.openTags.length - 1] !== "dest") {
        //             /* This may happen often for servers sending newline before closing dest tag */
        //         } else {
        //             this.openTags.pop();
        //             this.outputManager.popTarget();
        //         }
        //         return true;
        //     }

        //     return false;            
        // });

        this.tagHandlers.push((tag) => {
            let re = /^<a /i;
            let match = re.exec(tag);
            if (match) {
                this.openTags.push("a");
                let elem = $(tag);
                elem.attr("target", "_blank");
                elem.addClass("underline");

                this.outputManager.pushMxpElem(elem);
                EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: "a", value:
                    {
                        type: "a",
                        element: elem,
                        value: htmlEscape(match[0])
                    }
                });
                
                return true;
            }

            re = /^<\/a>/i;
            match = re.exec(tag);
            if (match) {
                if (this.openTags[this.openTags.length - 1] !== "a") {
                    /* We actually expect this to happen because the mud sends newlines inside DEST tags right now... */
                    console.log("Got closing a tag with no opening tag.");
                } else {
                    this.openTags.pop();
                    this.outputManager.popMxpElem();
                }
                return true;
            }

            return false;
        });
        this.tagHandlers.push((tag) => {
            let re = /^<([bius])>/i;
            
            const checkClosing = (re:RegExp) => {
                match = re.exec(tag);
                if (match) {
                    if (this.openTags[this.openTags.length - 1] !== match[1]) {
                        console.log("Got closing " + match[1] + " tag with no opening tag.");
                    } else {
                        this.openTags.pop();
                        this.outputManager.popMxpElem();
                    }
                    return true;
                }
                return false;
            }

            let match = re.exec(tag);
            if (match) {
                this.openTags.push(match[1]);
                let elem = $(tag);
                this.outputManager.pushMxpElem(elem);
                checkClosing(/<\/([bius])>$/i)
                EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: match[1], value:
                    {
                        type: htmlEscape(match[1]),
                        element: elem,
                        value: htmlEscape(match[0])
                    }
                });
                    
                return true;
            }

            checkClosing(/^<\/([bius])>/i);

            return false;
        });
        this.tagHandlers.push((tag) => {
            let re = /^<send/i;
            let match = re.exec(tag);
            if (match) {
                
                /* just the tag */
                let tag_re = /^<send ?(?:href=)?(["']([^'>]*)["'])? ?(?:hint=)?(["']([^'>]*)["'])?([^>]*)?>(.+?)<\/send>/i;
                let tag_m = tag_re.exec(tag);
                if (tag_m) {
                    this.openTags.push("send");

                    let html_tag = "<a style='display:inline-block;vertical-align:middle;'>";
                    let elem = $(html_tag);
                    const tagCommand = stripAnsi(tag_m[2] ? tag_m[2] : tag_m[6]).split("|");
                    const title = (tag_m[4] || tagCommand[0]).split("|");
                    const content = tag_m[6];

                    elem[0].setAttribute("title", title[0]);
                    elem[0].setAttribute("aria-label", title[0]);
                    
                    // elem[0].setAttribute("aria-live", "off");
                    elem.addClass("underline");
                    elem.addClass("clickable");
                    const isPrompt = (tag_m[5] && tag_m[5].match(/prompt/i)) ? true : false;
                    this.createLinkClickAction(isPrompt, elem, tagCommand, title);
                    this.outputManager.pushMxpElem(elem);
                    this.outputManager.handleTelnetData(this.str2ab(content), false);
                    this.openTags.pop();
                    this.outputManager.popMxpElem();
                    EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: "send", value: 
                        {
                            type: "send",
                            element: elem,
                            value: htmlEscape(tag)
                        }
                    });
                    return true;
                } else {
                    let tag_re = /^<send ?(?:href=)?(["']([^'>]*)["'])? ?(?:hint=)?(["']([^'>]*)["'])?([^>]*)?>(.+?)?/i;
                    let tag_m = tag_re.exec(tag);
                    if (tag_m) {
                        let html_tag = "<a style='display:inline-block;vertical-align:middle;'>";
                        let elem = $(html_tag);
                    
                        const tagCommand = stripAnsi(tag_m[2] ? tag_m[2] : tag_m[6]).split("|");
                        const title = (tag_m[4] || tagCommand[0]);
                        const content = tag_m[6];
                        elem[0].setAttribute("title", title);
                        elem[0].setAttribute("aria-label", title);
                        const isPrompt = tag_m[5] && tag_m[5].match(/prompt/i);
                        elem[0].setAttribute("data-prompt", isPrompt ? "true" : "false");
                        // elem[0].setAttribute("aria-live", "off");
                        elem.addClass("underline");
                        elem.addClass("clickable");
                        this.openTags.push("send");
                        this.outputManager.pushMxpElem(elem);
                        if (content) this.outputManager.handleTelnetData(this.str2ab(content), false);
                        return true;
                    }
                }
            }

            re = /^<\/send>/i;
            match = re.exec(tag);
            if (match) {
                if (this.openTags.length && this.openTags[this.openTags.length - 1] !== "send") {
                    console.log("Got closing send tag with no opening tag.");
                } else {
                    this.openTags.pop();
                    let elem = this.outputManager.popMxpElem();
                    if (!elem[0].hasAttribute("title")) {
                        /* didn"t have explicit href so we need to do it here */
                        let txt = elem.text();
                        elem[0].setAttribute("title", txt);
                        elem.click(() => {
                            this.EvtEmitCmd.fire({value: txt, noPrint: false});
                        });
                    }
                    const isPrompt = elem[0].getAttribute("data-prompt") === "true";
                    const tagCommand = (elem[0].getAttribute("title") || "").split("|");
                    const title = (elem[0].getAttribute("title") || "").split("|");
                    this.createLinkClickAction(isPrompt, elem, tagCommand, title);
                    
                    EvtScriptEvent.fire({event: ScripEventTypes.MXP_EntityArrived, condition: "send", value: 
                        {
                            type: "send",
                            element: elem,
                            value: htmlEscape(tag)
                        }
                    });
                }
                return true;
            }

            return false;
        });
    }

    private createLinkClickAction(isPrompt: boolean, elem: JQuery, tagCommand: string[], title: string[]) {
        if (isPrompt) {
            elem.click(() => {
                this.commandInput.setInput(tagCommand[0]);
            });
        }
        else {
            elem.click((event) => {
                if (tagCommand.length == 1) {
                    this.EvtEmitCmd.fire({ value: tagCommand[0], noPrint: false });
                } else {
                    const rng = (Math.trunc(Math.random() * 10000));
                    let items = "";
                    const start = tagCommand.length == title.length - 1 ? 1 : 0;

                    for (let i = start; i < title.length; i++) {
                        items += `<li class='custom' style="white-space: nowrap;" data-command="${tagCommand[i - start]}">${title[i]}</li>`;
                    }

                    let menu = `<div id='mxpSendMenu${rng}' style="display:none;">
                                    <ul style="overflow:visible;">
                                    ${items}
                                    </ul>
                                </div>`;
                    const cmenu = <JQuery>((<any>$(menu))).jqxMenu({ autoSizeMainItems: false, minimizeWidth: null, animationShowDelay: 0, animationShowDuration: 0, width: null, height: null, autoOpenPopup: false, mode: 'popup' });
                    var scrollTop = $(window).scrollTop();
                    var scrollLeft = $(window).scrollLeft();
                    (<any>cmenu).jqxMenu('open', (event.clientX) + 5 + scrollLeft, (event.clientY) + 5 + scrollTop);
                    (<any>cmenu).on("close", () => {
                        (<any>cmenu).jqxMenu('destroy');
                    });
                    (<any>cmenu).on("shown", () => {
                        cmenu.attr("style", cmenu.attr("style") + ";width:auto !important;");
                        $("li", cmenu).click(ev => {
                            this.EvtEmitCmd.fire({ value: $(ev.target).data("command"), noPrint: false });
                        });
                        $("ul", cmenu).css('overflow', "unset");
                        setTimeout(() => {
                            $("ul", cmenu).css('overflow', "visible");
                        }, 200);
                    });
                }
            });
        }
    }

    str2ab(str:string) {
        var buf = new ArrayBuffer(str.length); // 2 bytes for each char
        var bufView = new Uint8Array(buf);
        for (var i=0, strLen=str.length; i < strLen; i++) {
          bufView[i] = str.charCodeAt(i);
        }
        return buf;
      }

    handleMxpTag(data: string):boolean {
        let handled = false;
        let anyVarChanged = false

        for (var i = 0; i < this.elements.length; i++) {
            let tmp:RegExpMatchArray;
            if (this.elements[i].regex && !this.elements[i].empty && (tmp = data.match(this.elements[i].regex))) {
                tmp[0] = tmp[0].substring(0, tmp[0].indexOf(tmp[1]))
                const attrs:any = {};
                if (this.elements[i].att) {
                    for (let att of this.elements[i].att.split(",")) {
                        const re = new RegExp(`${att}="([^"]*)"`, 'gi')
                        let m = re.exec(tmp[0])
                        if (!m) {
                            const reAlt = new RegExp(`${att}='([^']*)'`, 'gi')
                            m = reAlt.exec(tmp[0])
                        }
                        if (m && m[1]) {
                            attrs[att] = m[1];
                        }
                    }
                }

                data = '';
                if (this.elements[i].definition) {
                    let temp = this.elements[i].definition;
                    for (let att of Object.keys(attrs)) {
                        const re = new RegExp(`&${att}\;?`, 'gi')
                        temp = temp.replace(re, attrs[att])
                    }
                    data += temp;
                }
                handled = true;
                data += tmp[1];
                
                if (this.elements[i].closing) {
                    data += this.elements[i].closing;
                }
                if (this.elements[i].flag) {
                    const varName = this.elements[i].flag.replace(/^set /i, "");
                    tmp[1] = stripAnsi(tmp[1]);
                    tmp[1] = this.stripMxpTags(tmp[1])
                    this.script.forceVariable(varName, tmp[1]);
                    anyVarChanged = true
                    EvtScriptEvent.fire({event: ScripEventTypes.MXP_VariableArrived, condition: varName, value:
                        {
                            type: htmlEscape(varName),
                            element: null,
                            value: htmlEscape(tmp[1])
                        }
                    });
            
                    //console.debug("MXP set var: ", varName, tmp[1]);
                }
                //console.debug("MXP Parse Element: ", this.elements[i].name, data);
            }
        }

        if (handled) {
            this.outputManager.handleTelnetData(this.str2ab(data), false);
            return anyVarChanged;
        }

        for (let ti = 0; ti < this.tagHandlers.length; ti++) {
            /* tag handlers will return true if it"s a match */
            if (this.tagHandlers[ti](data)) {
                handled = true;
                break;
            }
        }

        if (!handled) {
            console.log("Unsupported MXP tag: " + data);
            const re = /^<([a-zA-Z0-9]*)\b[^>]*>([\s\S]*?)<\/\1>/;
            const m = data.match(re);
            if (m && m.length >= 2) {
                data = m[2];
                this.outputManager.handleTelnetData(this.str2ab(data), false);
            }
        }

        return anyVarChanged
    }

    escapes = ["&quot;","&lt;","&gt;","&amp;"]
    escapeTo = ['"',"<",">","&"]
        
    stripMxpTags(arg0: string): string {
        if (arg0 == '') return arg0

        for (const el of this.elements) {
            arg0 = arg0.replace(el.regex, "")    
        }

        for (let i = 0; i < this.escapes.length; i++) {
            const element = this.escapes[i];
            arg0 = arg0.replaceAll(element, this.escapeTo[i])
        }
        return arg0
    }

    // Need to close any remaining open tags whe we get newlines
    public handleNewline() {
        if (this.openTags.length < 1) {
            return;
        }

        for (let i = this.openTags.length - 1; i >= 0; i--) {
            if (this.openTags[i] === "dest") {
                this.outputManager.popTarget();
            } else {
                this.outputManager.popMxpElem();
            }
        }
        this.openTags = [];
    };
}
