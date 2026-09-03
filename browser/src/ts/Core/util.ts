import { AppInfo } from "../appInfo";
import { EventHook } from "./event";
import { Button, Messagebox, messagebox, Notification } from "../App/messagebox";
import { TrigAlItem } from "../Scripting/windows/trigAlEditBase";
import { TsClient } from "../App/client";
import { UserConfig, UserConfigData } from "../App/userConfig";
import { IsNumeric, JsScript, ScriptEvent, Variable } from "../Scripting/jsScript";
import { Class } from "../Scripting/classManager";


enum BlockType {
    Plain,
    Set,
    If,
    Loop,
    Else,
    End,
    Inc,
    Dec,
    Neg,
    Temp
}

enum conditions {
    equal,
    greater,
    greaterorequal,
    lesser,
    lesserorequal
}

let condSymbols: { [key: string]:string} = {
    "equal": "=",
    "greater": ">",
    "greaterorequal": ">=",
    "lesser": "<",
    "lesserorequal": "<="
}

interface ScriptBlock {
    var1?: string;
    var2?: string;
    condition?:conditions;
    blocks: ScriptBlock[];
    type: BlockType,
    size: number;
    text: string;
}

export function htmlEscape(text:string) {
    return replaceLf(
        replaceLtGt(
        replaceAmp(text)));
}

export function replaceLtGt(text: string): string {
    return (text||"").toString().replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
}

export function replaceAmp(text: string): string {
    return (text||"").toString().replace(/&/g, "&amp;");
}

export function replaceLf(text: string): string {
    // We are presumably already stripping out CRs before this
    return (text||"").toString().replace(/\n/g, "<br>");
}

export function raw(text: string): string {
    if (typeof text == "number") {
        return (<number>text).toString();
    } else if (typeof text != "string") {
        text = JSON.stringify(text);
        text = text.slice(1, text.length-1);
    }
    return text;
}

export interface ConfigIf {
    data: UserConfigData;
    set(key: string, val: any, nosave?:boolean): void;
    get(key:string): any;
    onSet(key: string, cb: (val: any) => void): void;
    onSetRelease(key: string, cb: (val: any) => void): void;
    getDef(key: string, def: any): any;
    evtConfigImport: EventHook<{data: {[k: string]: any}, owner: any}>;
}

export function makeIndeterminate(jqe: JQuery) {
    jqe.on("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        let wasChecked = jqe.prop("checked");
        let wasIndeterminate = (jqe[0] as HTMLInputElement).indeterminate;
        jqe.data("checked", wasChecked);
        jqe.data("indeterminate", wasIndeterminate);
        return false;
    });
    jqe.on("mouseup", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        let wasChecked = jqe.data("checked");
        let wasIndeterminate = jqe.data("indeterminate");
        setTimeout(() => {
            if (wasChecked) {
                jqe.prop("checked", false);
                (jqe[0] as HTMLInputElement).indeterminate = false;
            } else if (wasIndeterminate) {
                (jqe[0] as HTMLInputElement).indeterminate = false;
                jqe.prop("checked", true);
            } else if (!wasIndeterminate) {
                jqe.prop("checked", false);
                (jqe[0] as HTMLInputElement).indeterminate = true;
            } else {
                jqe.prop("checked", true);
                (jqe[0] as HTMLInputElement).indeterminate = false;
            }

        }, 1);
        return false;
    });
}

export function padStart(str:string, targetLength:number, padString:string) {
    targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
    padString = String(typeof padString !== 'undefined' ? padString : ' ');
    if (str.length >= targetLength) {
        return String(str);
    } else {
        targetLength = targetLength - str.length;
        if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
        }
        return padString.slice(0, targetLength) + String(str);
    }
};

export function createPath(cmd: string): string {
    if (cmd[0]!=".") return '';

    let number:string = '';
    let ret = [];

    for (let i = 1; i < cmd.length; i++) {
        const c = cmd[i];
        if (c >= '0' && c <= '9') {
            number += c;
        } else {
            for (let n = 0; n < (number ? parseInt(number) : 1); n++) {
                ret.push(c);
            }
            number = '';
        }
    }

    return ret.join("\n");
}

export function isTrue(v:any):boolean {
    if (typeof v == "boolean") return v;
    if (typeof v == "string") return v == "true";
    return false;
}

export function rawToHtml(text: string): string {
    if (typeof text != "string") {
        text = JSON.stringify(text);
        text = text.slice(1, text.length-1);
    }
    return replaceLf(
            replaceLtGt(
            replaceAmp(text)));
}

export function linesToArray(str:string):string[] {
    let ret:string[] = [];
    ret = str.replace('\r', '').split('\n');
    return ret;
}

export function throttle(fn:Function, threshhold:number, scope?:any):Function {
    threshhold = threshhold || (threshhold = 250);
    var last:number;
    var deferTimer:number;


    return function (this:any) {

        var context = scope || this;
      var now = +new Date,
          args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        /*try {
        console.log("deferring " + JSON.stringify(args))
        } catch (err) {
            return
        }*/
        deferTimer = <number><unknown>setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        //console.log("executing")
        fn.apply(context, args);
      }
    };
  }

export function stripHtml(sText:string):string {
    let intag = false;
    let positions = [];
    for (var i = 0; i < sText.length; i++) {
        if (sText[i] == "<") intag = true;
        if (!intag) {
            positions.push(sText[i]);
        }
        if (sText[i] == ">") intag = false;
    }
    return positions.join("");
}

export function parseScriptVariableAndParameters(value: string, match: RegExpMatchArray, evaluate?:boolean, script?: JsScript) {
    value = value.replace(/(?:\\`|`(?:\\`|[^`])*`|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*')|(?:\$|\%)(\d+)/g, function (m, d) {
        if (d == undefined) {
            m = m.replace(/\`(.*)\$\{(?:\$|\%)(\d+)\}(.*)\`/g, "`$1${(match[$2]||'')}$3`");
            return m;
        }
        return "(match[" + parseInt(d) + "] || '')";
    });
    value = value.replace(/(?:\\`|`(?:\\`|[^`])*`|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*')|\@(\w+)/g, function (m, d: string) {
        if (d == undefined)
            return m;
        let ret = "this." + d;
        if (evaluate) {
            const val = script.getVariableValue(d)
            ret = val != null ? val : m
        }
        return ret
    });
    return value;
}

function parseCondition(text:string) {
    let cond = conditions.equal
    if (text != null) for (const c of Object.values(conditions)) {
        const sm = condSymbols[c]
        if (text.startsWith(sm)) {
            cond = (conditions as any)[c] as conditions
            text = text.slice(sm.length).trimStart()
            break;
        }
    }
    return { condition: cond, text: text}
}

const rxs = [
    null,
    new RegExp(/^#set ([a-zA-Z0-9]+) ?(.*)?$/gi), // set
    new RegExp(/^#if ([a-zA-Z0-9]+) ?(.*)?$/gi), // if
    new RegExp(/^#loop ([a-zA-Z0-9]+) ?(.*)?$/gi), // loop
    new RegExp(/^#else( .*)?$/gi), // else
    new RegExp(/^#end( .*)?$/gi), // end
    new RegExp(/^#inc ([a-zA-Z0-9]+)(.*)?$/gi), // inc
    new RegExp(/^#dec ([a-zA-Z0-9]+)(.*)?$/gi), // dec
    new RegExp(/^#neg ([a-zA-Z0-9]+)(.*)?$/gi), // neg
    new RegExp(/^#temp ([a-zA-Z0-9]+) ?(.*)?$/gi), // temp
]

function parseBlock(block:ScriptBlock, cmds: string[], script:JsScript) {
        
    if (!cmds) return block;
    let commIndex = -1
    for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        let type = -1
        let match = null
        for (let rx = 1; rx < rxs.length; rx++) {
            const r = rxs[rx];
            r.lastIndex = 0;
            const res = r.exec(cmd.trimStart())
            if (res) {
                type = rx
                match = res
            }
        }
        block.size++
        if (type<0) type = BlockType.Plain
        switch (type) {
            case BlockType.Plain: {
                block.blocks.push({
                    type: 0,
                    blocks:[],
                    size: 0,
                    text: cmd
                })
            }
            break;
            case BlockType.Inc:
            case BlockType.Dec:
            case BlockType.Neg:
            case BlockType.Temp:
            case BlockType.Set: {
                const varN = match[1].trim()
                let varVal = parseVal2(match);
                block.blocks.push({
                    type: type,
                    blocks:[],
                    size: 0,
                    var1: varN,
                    var2: varVal,
                    text: cmd
                })
            }
            break;
            case BlockType.If: {
                const varN = match[1].trim()
                let varVal = parseVal2(match);
                let r = parseCondition(varVal)
                const blk:ScriptBlock = {
                    type: type,
                    blocks: [],
                    size:0,
                    var1: varN,
                    var2: r.text,
                    condition: r.condition,
                    text: cmd
                }
                parseBlock(blk, cmds.slice(i+1), script)
                block.size += blk.size
                block.blocks.push(blk)

                i += blk.size
            }
            break;
            case BlockType.Loop: {
                const varN = match[1].trim()
                let varN2 = parseVal2(match);
                const blk:ScriptBlock = {
                    type: type,
                    blocks: [],
                    size:0,
                    var1: varN,
                    var2: varN2,
                    text: cmd
                }
                parseBlock(blk, cmds.slice(i+1), script)
                block.blocks.push(blk)
                block.size += blk.size
                i += blk.size
            }
            break;
            case BlockType.Else: {
                if (block.type == BlockType.If) {
                    const blk:ScriptBlock = {
                        type: type,
                        blocks: [],
                        size:0,
                        text: cmd
                    }

                    parseBlock(blk, cmds.slice(i+1), script)

                    block.blocks.push(blk)
                    block.size += blk.size
                    i += blk.size
                    return block
                }
            }
            break;
            case BlockType.End: {
                if (block.type == BlockType.If ||
                    block.type == BlockType.Loop ||
                    block.type == BlockType.Else) {
                    return block
                }
            }
            break;
        }
    }
    return block

    function parseVal2(match: RegExpExecArray) {
        let varVal = match[2] ? match[2] : null;
        if (varVal && (commIndex = varVal.indexOf("//")) > -1) {
            varVal = varVal.slice(0, commIndex);
            varVal = varVal == "" ? null : varVal.trim()
        }
        if (varVal != null)
            varVal = varVal.trim()
        return varVal;
    }
}

function compare(v1: string, v2: string, condition: conditions):boolean {
    switch (condition) {
        case conditions.greater:
            return parseInt(v1) > parseInt(v2)
        case conditions.greaterorequal:
            return parseInt(v1) >= parseInt(v2)
        case conditions.lesser:
            return parseInt(v1) < parseInt(v2)
        case conditions.lesserorequal:
            return parseInt(v1) <= parseInt(v2)
        default:
            return (v2 != null ? v1 === v2 : !!v1)
    }
}

function execLine(l:string, sc:JsScript) {
    const rl = l.replace(/(?:\\`|`(?:\\`|[^`])*`|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*')|\@(\w+)/g, function (m, d: string) {
        if (d == undefined)
            return m;
        return sc.getVariableValue(d) || "";
    })
    return rl
}

function execBlock(b:ScriptBlock, sc:JsScript, cmds:string[]) {

    switch (b.type) {
        case BlockType.Plain:
            if (b.text != null && b.text.trimStart()!="") cmds.push(execLine(b.text.trimStart(), sc))
            for (const sb of b.blocks) {
                execBlock(sb, sc, cmds)
            }
            break;
        case BlockType.Inc: {
            let v:Variable = sc.getVariable(b.var1) || {
                name: b.var1,
                class: "",
                temp: false,
                value: null
            }
            v.value++
            sc.setVariable(v)
        }
            break;
        case BlockType.Dec: {
            let v:Variable = sc.getVariable(b.var1) || {
                name: b.var1,
                class: "",
                temp: false,
                value: null
            }
            v.value--
            sc.setVariable(v)
        }
            break;
        case BlockType.Neg: {
            let v:Variable = sc.getVariable(b.var1) || {
                name: b.var1,
                class: "",
                temp: false,
                value: null
            }
            v.value=!v.value
            sc.setVariable(v)
        }
            break;
        case BlockType.Temp:
        case BlockType.Set:
            let v:Variable = sc.getVariable(b.var1) || {
                name: b.var1,
                class: "",
                temp: false,
                value: null
            }
            let nv = b.var2 || ""
            if (nv.startsWith("@")) {
                nv = nv.slice(1)
                nv = sc.getVariableValue(nv)
            }
            v.value = nv
            if (b.type == BlockType.Temp) {
                v.temp = true
            }
            sc.setVariable(v)
            break;
        case BlockType.If:
            let v1 = sc.getVariableValue(b.var1)
            let cmpv = b.var2
            if (cmpv && cmpv.startsWith("@")) {
                cmpv = cmpv.slice(1)
                cmpv = sc.getVariableValue(cmpv)
            }
            let okBlocks:ScriptBlock[] = []
            if (cmpv == null ? !!v1 : compare(v1, cmpv, b.condition)) {
                for (const b2 of b.blocks) {
                    if (b2.type != BlockType.Else) {
                        okBlocks.push(b2)
                    }
                }
            } else {
                let elseB = b.blocks.find(bl => bl.type == BlockType.Else)
                if (elseB) for (const b2 of elseB.blocks) {
                    okBlocks.push(b2)
                }
            }
            for (const sb of okBlocks) {
                execBlock(sb, sc, cmds)
            }
            break;
        case BlockType.Loop:
            let va1 = sc.getVariable(b.var1)
            if (!va1) {
                sc.setVariable({
                    class: "temp",
                    name: b.var1,
                    temp: true,
                    value: null
                })
                va1 = sc.getVariable(b.var1)
            }
            let va2 = b.var2
            let cnt = 1
            if (va2 && va2.startsWith("@")) {
                va2 = va2.slice(1)
                let tmp = sc.getVariable(va2)
                va2 = tmp.value
                cnt = parseInt(va2)
            } else if (va2) {
                cnt = parseInt(va2)
            }
            for (let i = 1; i <= cnt; i++) {
                va1.value = i
                sc.setVariable(va1)
                for (const sb of b.blocks) {
                    execBlock(sb, sc, cmds)
                }
                if (i != va1.value) {
                    i = va1.value
                }
            }
            break;
    }

}

export function parseSimpleScriptSyntax(cmds: string[], script:JsScript) : string[] {
    if (!cmds || !cmds.length) return [];

    let b:ScriptBlock = {
        blocks: [],
        type:BlockType.Plain,
        size: 0,
        text: null
    }

    parseBlock(b, cmds, script)
    cmds = []
    execBlock(b, script, cmds)

    return cmds;
}

export function Acknowledge(ack:string, str:string) {
    const val = localStorage.getItem('ack_'+ack);
    if (val == 'true') return;
    const w = Math.min($(window).width()-20, 400);
    messagebox("Informazione", str, () => {
        localStorage.setItem('ack_'+ack, "true");
    }, "OK", "", null, false, [""], w, null, false, "");
}

export interface Color {
    r:number;
    g:number;
    b:number;
    a:number;
}

export function isAlphaNumeric(str:string) {
    var code, i, len;
  
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
          !(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123) &&
          !(code == 40 || code == 41) &&
          !(code == 91 || code == 93) &&
          !(code == 46) &&
          !(code == "_".charCodeAt(0)) &&
          !(code == "-".charCodeAt(0))) { // lower alpha (a-z)
        return false;
      }
    }
    return true;
  };


export function colorToHex(color:Color, withAlpha:boolean):string {

    if (!color) {
        return "transparent";
    }
    let rHex = color.r.toString(16);
    let gHex = color.g.toString(16);
    let bHex = color.b.toString(16);
    let aHex = (color.a+255).toString(16);

    // Add a leading zero if the hex value is less than 10
    if (rHex.length == 1) rHex = "0" + rHex;
    if (gHex.length == 1) gHex = "0" + gHex;
    if (bHex.length == 1) bHex = "0" + bHex;
    if (aHex.length == 1) aHex = "0" + bHex;

    // Concatenate the hex values with a # symbol
    let hexColor = "#" + rHex + gHex + bHex;

    if (withAlpha) {
        if (color.a) {
            hexColor += aHex;
        } else {
            hexColor += "00"
        }
    }

    // Return the hex color
    return hexColor;
}
export function colorCssToRGB(colorKeyword:string):Color {
    
    if (!colorKeyword) {
        return {
            r: 0,
            g: 0,
            b: 0,
            a: 1
          };
    }

    function parseColor (input:string) {
        var m = input.match (/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+(\.\d+)?)\s*)?\)$/i);
        if (m) {
          return {
            r: parseInt (m [1]),
            g: parseInt (m [2]),
            b: parseInt (m [3]),
            a: m [5] ? parseFloat (m [5]) : 1
          };
        }
        return null;
      }

    if (colorKeyword.endsWith(";")) {
        colorKeyword = colorKeyword.slice(0, colorKeyword.length - 1)
    }
    let el = document.createElement('div');

    el.style.color = colorKeyword;

    document.body.appendChild(el);

    let rgbValue = window.getComputedStyle(el).color;

    document.body.removeChild(el);

    return parseColor(rgbValue);
}

export function waitForVariableValue(obj: any, varName:string, expectedValue:any, timeout?:number) {
    return new Promise<boolean>(resolve => {
      var tmo = timeout || 1000;
      var start_time = Date.now();
      async function checkFlag() {
        if (obj[varName] == expectedValue) {
          resolve(true);
        } else if (Date.now() > start_time + tmo) {
          resolve(false);
        } else {
          await new Promise<boolean>(resolve => setTimeout(resolve, 100));
          checkFlag();
        }
      }
      checkFlag();
    });
}

export function escapeRegExp(string:string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function escapeRegexReplacement(string:string) {
    return string.replace(/\$/g, '$$$$');
}

export function downloadJsonToFile(json:any, filename:string) {
    let jsonstr = JSON.stringify(json, null, 2);
    downloadString(jsonstr, filename);
}

export function downloadString(jsonstr: string, filename: string) {
    let blob = new Blob([jsonstr], { type: "octet/stream" });
    let url = window.URL.createObjectURL(blob);

    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
}

export function importFromFile(callback:(data:string)=>void) {
    if (!callback) return;
    let inp: HTMLInputElement = document.createElement("input");
    inp.type = "file";
    inp.style.visibility = "hidden";

    inp.addEventListener("change", (e: any) => {
        let file = e.target.files[0];
        if (!file) {
            return;
        }

        let reader = new FileReader();
        reader.onload = (e1: any) => {
            let text = e1.target.result;
            callback(text)
        };
        reader.readAsText(file);

    });

    document.body.appendChild(inp);
    inp.click();
    document.body.removeChild(inp);
}

export let importScriptsFunc = async (config:UserConfig) => {
    importFromFile(async (data) => {
        let importObj = <any>null;
        try {
        importObj = JSON.parse(data)
        } catch {
            Messagebox.Show("Errore", "File script non valido")
            return;
        }

        let denyReason = "";
        if ((denyReason = denyClientVersion(importObj))) {
            Messagebox.Show("Errore", `E' impossibile caricare questa versione di script.\nE' richiesta una versione piu' alta del client.\nVersione client richiesta: ${denyReason}\nVersione attuale: ${AppInfo.Version}\n\nAggiorna il client che usi per poter usare questa configurazione.\n\n<a href="https://github.com/temporasanguinis/TS2-Client/releases" target="_blank">Scarica l'ultima versione da qui</a>`)
            return;
        }

        if (!importObj.aliases ||
            !importObj.triggers ||
            !importObj.classes ||
            !importObj.variables ||
            !importObj.events) {
            Messagebox.Show("Errore", "File script non valido")
            return;
        }

        if (importObj.aliases.length +
            importObj.triggers.length +
            importObj.classes.length +
            importObj.variables.length +
            importObj.events.length == 0) {
            Messagebox.Show("Errore", "Il file non contiene scripts (e' vuoto)")
            return;
        }

        const str = `${config.data.name?"["+config.data.name+"]\n":"[preimpostati]\n"}Verranno importati scripts${importObj.description ? " '" + importObj.description + "'": ""}:

Alias: ${importObj.aliases.length}
Triggers: ${importObj.triggers.length}
Classi: ${importObj.classes.length}
Variabili: ${importObj.variables.length}
Eventi: ${importObj.events.length}

${importObj.datetime ? "Esportati in data: " + importObj.datetime + "\n": ""}Vuoi procedere?`
        if ((await Messagebox.Question(str)).button == Button.Ok) {
            const trgs:TrigAlItem[] = config.get("triggers") || [];
            const als:TrigAlItem[] = config.get("aliases") || [];
            const evs = [...(config.get("script_events") || [])];
            const vars = [...(config.get("variables") || [])];
            const cls = [...(config.get("classes") || [])];
            const trgsI:TrigAlItem[] = importObj.triggers
            const alsI:TrigAlItem[] = importObj.aliases
            const varsI:[] = importObj.variables
            const clsI:[] = importObj.classes
            const evsI:[] = importObj.events
            
            const trgMap = new Map<string, TrigAlItem>()
            trgs.forEach((el) => {
                trgMap.set(el.pattern+el.class+el.id, el)
            });
            trgsI.forEach((el) => {
                trgMap.set(el.pattern+el.class+el.id, el)
            });
            const newTr = [...trgMap.values()]

            const alsMap = new Map<string, TrigAlItem>()
            als.forEach((el) => {
                alsMap.set(el.pattern+el.class+el.id, el)
            });
            alsI.forEach((el) => {
                alsMap.set(el.pattern+el.class+el.id, el)
            });
            const newAls = [...alsMap.values()]

            const varMapNew = new Map<string, Variable>(vars)
            varsI.forEach((el:Variable) => {
                varMapNew.set(el.name, el)
            });
            const newVars = [...varMapNew]

            const clsMapNew = new Map<string, Variable>(cls)
            clsI.forEach((el:Variable) => {
                clsMapNew.set(el.name, el)
            });
            const newCls = [...clsMapNew]

            const evMapNew = new Map<string, ScriptEvent[]>(evs)
            evsI.forEach((el:ScriptEvent) => {
                let etype = evMapNew.get(el.type) as ScriptEvent[]
                if (!etype) {
                    etype = []
                    evMapNew.set(el.type, etype)
                }
                const insertIndex = etype.findIndex((v) => v.type + v.condition + v.id + v.class == el.type + el.condition + el.id + el.class)
                if (insertIndex > -1) {
                    etype[insertIndex] = el
                } else {
                    etype.push(el)
                }
            });
            const newEvs = [...evMapNew]
            
            config.set("triggers", newTr, true);
            config.set("aliases", newAls, true);
            config.set("script_events", newEvs, true);
            config.set("variables", newVars, true);
            config.set("classes", newCls, true);

            config.saveConfig()
            
            AskReload()
        }
    })
}
export let exportClassFunc = async (config:UserConfig, className?:string) => {
    const response = await Messagebox.ShowMultiInput("Esporta scripts", ["Nome o regex della classe (richiesto)","Descrizione (opzionale)","Nome file (opzionale)"], [className || "", "", ""])

    function hasDuplicates(array:any[]) {
        return (new Set(array)).size !== array.length;
    }
    if (response.button != Button.Ok || !response.results[0]) return;

    const cfg = JSON.parse(config.saveConfigToString())


    const cls = [...(new Map<string,Class>(cfg.classes))].filter((tr) => !!tr[0].match(new RegExp("^" + response.result + "$", "i"))).map(v => v[1]);
    
    if (!cls || !cls[0]) {
        Messagebox.Show("Errore", "Classi insesistenti con questo filtro, anche se forse hai i trigger con quella classe.\nCreala manualmente oppure disabilita o abilita quella classe almeno una volta.");
        return;
    }

    const flt = (tr:any):boolean => {
        const ret = !!cls.find(v => v.name == tr.class);
        return ret;
    }

    const trgs: TrigAlItem[] = cfg.triggers ? (cfg.triggers).filter(flt) : [];
    const als: TrigAlItem[] = cfg.aliases ? (cfg.aliases).filter(flt) : [];
    const evs: ScriptEvent[] = cfg.script_events ? [...[...(new Map<string,ScriptEvent[]>(cfg.script_events))].map(v => v[1])].flat().filter(flt) : [];
    const vars: Variable[] = cfg.variables ? [...[...(new Map<string,Variable>(cfg.variables))].map(v => v[1])].filter(flt) : [];

    if (!(trgs.length + als.length + evs.length + vars.length)) {
        Messagebox.Show("Errore", "La classe non contiene trigger, alias, variabili o eventi (e' vuota).");
        return;
    }

    {
        if (hasDuplicates(trgs.map(t => t.pattern + t.id))) {
            Messagebox.Show("Errore", "Trigger non univoci (pattern + id).");
            return;
        }
        if (hasDuplicates(als.map(t => t.pattern + t.id))) {
            Messagebox.Show("Errore", "Alias non univoci (pattern + id).");
            return;
        }
        if (hasDuplicates(evs.map(t => t.type + t.condition + t.id))) {
            Messagebox.Show("Errore", "Eventi non univoci (type + condition + id).");
            return;
        }
    }

    const ver = getVersionNumbers(AppInfo.Version)
    const dt = new Date();
    const exportObj = {
        aliases: als,
        triggers: trgs,
        events: evs,
        classes: cls,
        variables: vars,
        requiresClientMajor: (ver[0]),
        requiresClientMinor: (ver[1]),
        requiresClientRevision: (ver[2]),
        description: response.results[1],
        datetime: dt.toDateString() + " " + dt.getHours() + ":" + dt.getMinutes() 
    }

    downloadJsonToFile(exportObj, response.results[2] || "export_scripts.json")
}

// https://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
export function utf8encode(str: string): Uint8Array {
    let utf8: number[] = [];

    for (let i = 0; i < str.length; ++i) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18), 
                      0x80 | ((charcode>>12) & 0x3f), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
    }

    return new Uint8Array(utf8);
}

/* https://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript */
export function utf8decode(array: Uint8Array): { result: string; partial: Uint8Array } {
    let out, i, len, c;
    let char2, char3, char4;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
        c = array[i++];
    
        switch(c >> 4)
        { 
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                if ( (i + 1) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                if ( (i + 2) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                               ((char2 & 0x3F) << 6) |
                               ((char3 & 0x3F) << 0));
                break;
            case 15:
                // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
                if ( (i + 3) > len) {
                    return { result: out, partial: array.slice(i - 1) };
                }
                char2 = array[i++];
                char3 = array[i++];
                char4 = array[i++];
                out += String.fromCodePoint(((c & 0x07) << 18) | ((char2 & 0x3F) << 12) | ((char3 & 0x3F) << 6) | (char4 & 0x3F));

                break;
        }
    }

    return { result: out, partial: null };
}

export function CreateCodeMirror(element:HTMLTextAreaElement, script: JsScript) {
    function bracketFolding(pairs:any) {
        return function(cm:any, start:any) {
          var line = start.line, lineText:string = cm.getLine(line);
      
          function findOpening(pair:any) {
            var tokenType;
            for (let ln = line; ln >= 0; ln--) {
                let lnText:string = cm.getLine(ln)
                let startCh:number = ln == line ? start.ch : lnText.length
                for (let at = startCh, pass = 0;;) {
                    var found = at <= 0 ? -1 : lnText.lastIndexOf(pair[0], at - 1);
                    if (found == -1) {
                        if (pass == 1) break;
                        pass = 1;
                        at = lineText.length;
                        continue;
                    }
                    if (pass == 1 && ln == line && found < start.ch) break;
                    let tk = cm.getTokenAt((window.CodeMirror as any).Pos(ln, found + 1))
                    tokenType = cm.getTokenTypeAt((window.CodeMirror as any).Pos(ln, found + 1));
                    if (!/^(comment|string)/.test(tokenType)) return {ch: found + 1, line:ln, tokenType: tokenType, pair: pair};
                    at = found - 1;
                }
            }
            return null
          }
      
          function findRange(found:any) {
            let foundLine = found.line;
            var count = 1, lastLine = cm.lastLine(), end, startCh = found.ch, endCh
            outer: for (var i = line; i <= lastLine; ++i) {
              var text = cm.getLine(i), pos = i == line ? startCh : 0;
              for (;;) {
                var nextOpen = text.indexOf(found.pair[0], pos), nextClose = text.indexOf(found.pair[1], pos);
                if (nextOpen < 0) nextOpen = text.length;
                if (nextClose < 0) nextClose = text.length;
                pos = Math.min(nextOpen, nextClose);
                if (pos == text.length) break;
                if (cm.getTokenTypeAt((window.CodeMirror as any).Pos(i, pos + 1)) == found.tokenType) {
                  if (pos == nextOpen) ++count;
                  else if (!--count) { end = i; endCh = pos; break outer; }
                }
                ++pos;
              }
            }
      
            if (end == null || line == end) return null
            return {from: (window.CodeMirror as any).Pos(foundLine, startCh),
                    to: (window.CodeMirror as any).Pos(end, endCh)};
          }
      
          var found = []
          for (var i = 0; i < pairs.length; i++) {
            var open = findOpening(pairs[i])
            if (open) found.push(open)
          }
          found.sort(function(a, b) { return a.ch - b.ch })
          for (var i = 0; i < found.length; i++) {
            var range = findRange(found[i])
            if (range) return range
          }
          return null
        }
      }

      function findBraceBlockRange(editor:any, start:any) {
        const doc = editor.getDoc();
        const cursorPos = start//doc.getCursor();
      
        // Initialize stack to track nested braces
        const stack = [];
        let startPos = null;
        let endPos = null;
        outerStart: for (let line = cursorPos.line; line >= 0; line--) {
          const lineContent = doc.getLine(line);
          for (let ch = (line == cursorPos.line ? cursorPos.ch : lineContent.length - 1); ch >= 0; ch--) {
            const char = lineContent[ch];
            if (char === '{' || char === '[') {
              // Check if it's part of a comment
              const token = editor.getTokenAt({ line, ch });
              if (!token.type || !token.type.includes('comment')) {
                if (stack.length === 0) {
                  // Found outermost opening brace
                  startPos = { line, ch };
                  startPos.ch++
                  break outerStart
                }
                stack.pop();
              }
            } else if (char === '}' || char === ']') {
              // Check if it's part of a comment
              const token = editor.getTokenAt({ line, ch });
              if (!token.type || !token.type.includes('comment')) {
                stack.push(char);
              }
            }
          }
        }

        outerEnd: if (startPos) for (let line = cursorPos.line; line < editor.lastLine(); line++) {
            const lineContent = doc.getLine(line);
            for (let ch = (line == cursorPos.line ? cursorPos.ch : 0); ch < lineContent.length; ch++) {
              const char = lineContent[ch];
              if (char === '}' || char === ']') {
                // Check if it's part of a comment
                const token = editor.getTokenAt({ line, ch });
                if (!token.type || !token.type.includes('comment')) {
                  if (stack.length === 0) {
                    // Found outermost opening brace
                    endPos = { line, ch };
                    break outerEnd
                  }
                  stack.pop();
                }
              } else if (char === '{' || char === '[') {
                // Check if it's part of a comment
                const token = editor.getTokenAt({ line, ch });
                if (!token.type || !token.type.includes('comment')) {
                  stack.push(char);
                }
              }
            }
          }
      
        if (startPos && endPos) {
            editor.setCursor(startPos)
            return {from: (window.CodeMirror as any).Pos(startPos.line, startPos.ch),
                to: (window.CodeMirror as any).Pos(endPos.line, endPos.ch)};
        }
        console.log('No opening brace found outside comments.');
        return null;
      }

    (window.CodeMirror as any).braceRangeFinder = function(cm:any, start:any) {
        return findBraceBlockRange(cm, start)
        //return bracketFolding([["{", "}"], ["[", "]"]])(cm, start)
    };

    let mode = {
        name: "javascript",
        globalVars: true,
    };
    let config = {
        mode: mode,
        lineWiseCopyCut: false,
        theme: TsClient.GetCodeMirrorTheme(),
        autoRefresh: true, // https://github.com/codemirror/CodeMirror/issues/3098
        matchBrackets: true,
        lineNumbers: true,
        scrollbarStyle: "overlay",
        tabSize: 2,
        keyMap: "sublime",
        autoCloseBrackets: true,
        foldGutter: true,
        styleActiveLine: true,
        search: { bottom:true},
        foldOptions: {
            rangeFinder: (window.CodeMirror as any).braceRangeFinder
        },
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {"Ctrl-Space": "autocomplete", "Alt-F": "findPersistent"},
        hintOptions: { caseInsensitive: true }
    };
    let cm = (window.CodeMirror as any).fromTextArea(
        element, <any>config
    );
    addIntellisense(cm, script)
    return cm
}
            
export function addIntellisense(editor:CodeMirror.Editor, script:JsScript) {
    if (!$("#editorContextMenu").length) {
        $("<div id='editorContextMenu' style='display:none'>").appendTo(document.body)
    }
    $.ajax("./modules/ecmascript.json?rng="+AppInfo.Version).done(function(code:any) {
        let server = new (window.CodeMirror as any).TernServer({
            ecmaVersion: 10, hintDelay: 4000, allowAwaitOutsideFunction: true, defs: [code],
            queryOptions: {completions: { caseInsensitive: true}}
        });
        (editor as any).Tern = server;
        $.ajax("./modules/browser.json?rng="+AppInfo.Version).done(function(code:any) {
            addIntellisenseDef(editor, "browser", code)
        })
        $.ajax("./modules/jquery.json?rng="+AppInfo.Version).done(function(code:any) {
            addIntellisenseDef(editor, "jQuery", code)
        })
        editor.on("contextmenu", (cm:CodeMirror.Editor, e:MouseEvent) => {
            setTimeout(() => {
                let editorMenu:any = null;
                let menuData:any = {
                    "goDef": ["Vai a definizione","Alt+D"],
                    "findRef": ["Cerca","Ctrl+F / Alt+F / F3"],
                    "highlight": ["Evidenzia","Ctrl+."],
                    "collapse": ["Collassa","Ctrl+Q /Shift+Ctrl+Q"],
                    "rename": ["Rinomina","F2"],
                    "info": ["Info","Ctrl+O"],
                    "copy": ["Copia","Ctrl+C"],
                    "paste": ["Incolla","Ctrl+V"],
                    "complete": ["Completa", "Ctrl-Space"]
                }
                let lis = Object.getOwnPropertyNames(menuData).map(n => {
                    const str = menuData[n];
                    return `<li data-value="${n}">${str[0]} <span style='float:right;opacity:0.5;'>${str[1]}</span></li>`
                }).join("")
                $("#editorContextMenu").html("")
                editorMenu = ($("<div><ul>" + lis + "</ul><div>") as any)
                editorMenu.appendTo($("#editorContextMenu"))
                editorMenu.jqxMenu({ animationShowDelay: 0, popupZIndex: 999999, animationShowDuration : 0, width: '100px', height: null, autoOpenPopup: false, mode: 'popup'});
                const token = cm.getTokenAt(cm.getCursor());
                var scrollTop = e.clientY + $(window).scrollTop();
                var scrollLeft = e.clientX + $(window).scrollLeft();
                editorMenu.on('closed', function () {
                    setTimeout(()=>{
                        editorMenu.jqxMenu('destroy')
                        editorMenu.remove()
                    }, 100)
                });
                editorMenu.on('itemclick', async function (event:any)
                {
                    var val = $(event.args).data("value");
                    
                    editorMenu.jqxMenu('close')
                    switch (val) {
                        case "copy": {
                            var doc = cm.getDoc();
                            let testo = doc.getSelection()
                            if (testo) {
                                if (!navigator.clipboard){
                                    Notification.Show("Impossibile copiare dal menu. Non supportato dal browser.")
                                } else {
                                    navigator.clipboard.writeText(testo).then(()=>{
                                        Notification.Show("Selezione copiata", true);
                                    });
                                }
                            }
                            break;
                        }
                        case "paste": {
                            let selected:string = ""
                            if (!navigator.clipboard){
                                Notification.Show("Impossibile incollare dal menu. Non supportato dal browser.")
                            } else {
                                selected = await navigator.clipboard.readText().catch(()=>{
                                    Notification.Show("Impossibile leggere la clipboard", true);
                                    return ""
                                }) as any;
                            }
                            if (selected.length > 0) {
                                // Fetch the current CodeMirror document.
                                var doc = cm.getDoc();
                            
                                // Insert the text at the cursor position.
                                doc.replaceSelection(selected);
                            
                                // Clear the selection so it isn't copied repeatedly.
                                selected = '';
                              }
                            break;
                        }
                        case "goDef": {
                            server.jumpToDef(cm)
                            break;
                        }
                        case "findRef": {
                            let cursor = (cm as any).getSearchCursor(token.string);
                            cursor.findNext();
                            if (cursor.from() && cursor.to()) cm.setSelection(cursor.from(), cursor.to());
                            (cm as any).execCommand("findPersistent")
                            break;
                        }
                        case "highlight": {
                            server.selectName(cm);
                            break;
                        }
                        case "rename": {
                            server.rename(cm);
                            break;
                        }
                        case "info": {
                            server.showDocs(cm);
                            break;
                        }
                        case "complete": {
                            (cm as any).showHint({hint: server.getHint, completeSingle:true});
                            break;
                        }
                        case "collapse": {
                            let c:any = cm.getCursor();
                            var isFolded = (cm as any).isFolded(c);
                            if (isFolded) {
                                (cm as any).execCommand("unfold")
                            }
                            else {
                                (cm as any).foldCode(c);
                            }
                            break;
                        }
                    }
                });
                editorMenu.jqxMenu('open', scrollLeft, scrollTop);
            }, 50)
            e.stopPropagation()
            e.preventDefault()
            return true
        });
        editor.setOption("extraKeys", {
            "Ctrl-Space": function(cm:any) { /*server.complete(cm);*/ cm.showHint({hint: server.getHint, completeSingle:true}); },
            "Ctrl-I": function(cm:any) { server.showType(cm); },
            "Ctrl-O": function(cm:any) { server.showDocs(cm); },
            "Alt-D": function(cm:any) { server.jumpToDef(cm); },
            "Alt-.": function(cm:any) { server.jumpBack(cm); },
            "F2": function(cm:any) { server.rename(cm); },
            "Ctrl-.": function(cm:any) { server.selectName(cm); },
            "Tab": function(cm:any){
                if (cm.somethingSelected()) cm.indentSelection("add");
                else cm.replaceSelection("  ", "end");
              },
            "Ctrl-Q": function(cm:any) {
                let c:any = cm.getCursor();
                var isFolded = (cm as any).isFolded(c);
                if (isFolded) {
                    //(cm as any).execCommand("unfold")
                    (cm as any).foldCode(c);
                }
                else {
                    (cm as any).foldCode(c);
                }
                return;
            },
            "Shift-Ctrl-Q": function(cm:any) {
                (cm as any).execCommand("foldAll")
            },
            "Alt-F": "findPersistent"
        })
        editor.on("keydown", function(cm:any, event:any) {
            if (event.code == "Escape") {
                $(cm.getTextArea()).closest("div.jqx-window-content").find(":button:visible").last().focus()
                event.preventDefault()
                event.stopPropagation()
                return false 
            }
            return true
        });
        editor.on("cursorActivity", function(cm:any) { server.updateArgHints(cm); });
        var ExcludedIntelliSenseTriggerKeys:{[k: string]: string} =
        {
            "8": "backspace",
            "9": "tab",
            "13": "enter",
            "16": "shift",
            "17": "ctrl",
            "18": "alt",
            "19": "pause",
            "20": "capslock",
            "27": "escape",
            "32": "space",
            "33": "pageup",
            "34": "pagedown",
            "35": "end",
            "36": "home",
            "37": "left",
            "38": "up",
            "39": "right",
            "40": "down",
            "45": "insert",
            "46": "delete",
            "50": "quote",
            "66": "{",
            "67": "}",
            "91": "left window key",
            "92": "right window key",
            "93": "select",
            "107": "add",
            "109": "subtract",
            "110": "decimal point",
            "111": "divide",
            "112": "f1",
            "113": "f2",
            "114": "f3",
            "115": "f4",
            "116": "f5",
            "117": "f6",
            "118": "f7",
            "119": "f8",
            "120": "f9",
            "121": "f10",
            "122": "f11",
            "123": "f12",
            "144": "numlock",
            "145": "scrolllock",
            "186": "semicolon",
            "187": "equalsign",
            "188": "comma",
            "189": "dash",
            /*"190": "period",*/
            "191": "slash",
            "192": "graveaccent",
            "220": "backslash",
            "222": "quote"
        }

        editor.on("keyup", function(editor:any, event:any)
        {
            var __Cursor = editor.getDoc().getCursor();
            var __Token = editor.getTokenAt(__Cursor);

            let prevent = ['[',']','-','+','=','>','<','!','(',')','{','}','`'];

            if (!editor.state.completionActive && !(event.ctrlKey||event.altKey||event.shiftKey) &&
                !ExcludedIntelliSenseTriggerKeys[<string>(event.keyCode || event.which).toString()] && !(prevent.indexOf(__Token.string)!=-1)
                /*(__Token.type == "tag" || __Token.string == " " || __Token.string == "<" || __Token.string == "/")*/)
            {
                editor.showHint({hint: server.getHint, completeSingle:false });
            }
        });
        editor.on("focus", () => {
            refreshApiInTern(editor, script)
            refreshVariablesInTern(editor, script)
        })
    });
}

export function addIntellisenseDef(cm: any, name:string, code: any) {
    cm.Tern.server.deleteDefs(name);
    cm.Tern.server.addDefs(code, false);
}

export function refreshApiInTern(cm: any, script: JsScript) {
    cm.Tern.server.deleteDefs("tsclient-api");
    let defs:any = {
        "!name": "tsclient-api",
        "!define": {
            "color": {
              "!type": "fn(testo: string, foreground: string, background?: string, bold?: bool, underline?: bool, blink?: bool) -> string",
              "!doc": "Colora del testo per visualizzarlo nel client."
            },
            "windowdata": {
              "name": "string",
              "x": "number",
              "y": "number",
              "w": "number",
              "h": "number",
              "visible": "boolean",
              "collapsed": "boolean",
              "docked": "boolean",
              "font": "boolean",
              "fontSize": "boolean"
            },
            "windowdefinition": {
              "window":"{}",
              "custom":"boolean",
              "output":"{}",
              "data":"windowdata",
              "created":"boolean",
              "initialized":"boolean"
            },
            "print": {
            "!type": "fn(testo: string, finestra?: string)",
            "!doc": "Visualizza nella finestra dell'output un testo. La finestra e' opzionale e se non data verra' usata la finestra principale."
            },
            "printRaw": {
            "!type": "fn(testo: string, finestra?: string)",
            "!doc": "Visualizza nella finestra dell'output un testo. La finestra e' opzionale e se non data verra' usata la finestra principale.\n\rIl testo verra mandato puro senza parsing e html."
            },
            "variableChanged": {
                "!type": "fn(id: string, maxDurataMs?: number) -> +Promise[bool]",
                "!doc": "Risolve positivo quando la variabile cambia valore (await).\nSe il tempo scade o la variabile non esiste rejecta e serve usare .catch() per il messaggio d'errore."
            },
            "triggerFired": {
                "!type": "fn(id: string, maxDurataMs?: number) -> +Promise[bool]",
                "!doc": "Funzione asincrona da awaitare. Risolve e ritorna true quando il trigger scatta.\nSe il tempo scade o il trigger non esiste rejecta e serve usare .catch() per il messaggio d'errore."
            },
            "highlight": {
            "!type": "fn(foreground: string, background: string, blink?: bool, bold?: bool, underline?: bool)",
            "!doc": "Evidenzia l'ultima linea di trigger con i colori assegnati e opzionalmente il blink, bold e underline."
            },
            "sub": {
            "!type": "fn(regex: string, conCosa: string)",
            "!doc": "All interno di un trigger viene usato per cambiare 'cosa' con 'conCosa' nell'output a schermo."
            },
            "gag": {
            "!type": "fn()",
            "!doc": "Se usato all interno di un trigger la linea che ha scattato il trigger verra' rimossa dall' output."
            },
            "cap": {
            "!type": "fn(window: string)",
            "!doc": "Se usato all interno di un trigger la linea che ha scattato il trigger verra' mostrata nell'output della finestra 'window'."
            },
            "send": {
            "!type": "fn(command: string, silent: bool)",
            "!doc": "Manda uno o piu' comandi separati da ; al mud. Puo contenere alias che verranno parsati. Se silent e' true non manda a schermo"
            },
            "sendRaw": {
            "!type": "fn(command: string, silent?: bool)",
            "!doc": "Manda uno o piu' comandi separati da ; al mud.\nI comandi non verranno parsati per alias (come prefissare con tilde)\nSe silent e' true non manda a schermo"
            },
            "showWindow": {
            "!type": "fn(window: string)",
            "!doc": "Mostra la finestra window, ma non la crea se non esiste gia'"
            },
            "hideWindow": {
            "!type": "fn(window: string)",
            "!doc": "Nasconde la finestra window. Si puo accedere ad essa dal menu finestre"
            },
            "createWindow": {
            "!type": "fn(window: string, windowData?: windowdata) -> windowdefinition",
            "!doc": "Crea la finestra window, opzionalmente con dati per la creazione windowData"
            },
            "destroyWindow": {
            "!type": "fn(window: string)",
            "!doc": "Distrugge/cancella la finestra window. Scomparira' dal menu finestre."
            },
            "deleteWindow": "destroyWindow",
            "cls": {
                "!type": "fn(window?: string)",
                "!doc": "Cancella il contenuto della finestra window. Se window non e' provveduto allora la finestra principale."    
            },
            "clone": {
                "!type": "fn(obj: ?)",
                "!doc": "Esegue un clone profondo dell' oggetto json obj."    
            },
            "eventEnabled": {
                "!type": "fn(id: string) -> boolean",
                "!doc": "Ritorna lo stato di abilitazione dell'evento con id provveduto."    
            },
            "getWindow": {
                "!type": "fn(window: string) -> windowdefinition",
                "!doc": "Ritorna la finestra di nome window."    
            },
            "toggleTrigger": {
            "!type": "fn(id: string, state: bool)",
            "!doc": "Abilita o disabilita un trigger (id e l'id del trigger e state e' il nuovo stato)."
            },
            "toggleAlias": {
            "!type": "fn(id: string, state: bool)",
            "!doc": "Abilita o disabilita un alias (id e l'id dell'alias e state e' il nuovo stato)."
            },
            "toggleClass": {
            "!type": "fn(id: string, state: bool)",
            "!doc": "Abilita o disabilita una classe di alias o trigger (id e l'id della classe e state e' il nuovo stato)."
            },
            "toggleEvent": {
            "!type": "fn(id: string, state: bool)",
            "!doc": "Abilita o disabilita un evento con ID."
            },
            "append": {
            "!type": "fn(str: string)",
            "!doc": "Da usare nei trigger. Aggiunge a fine riga la stringa str."
            },
            "prepend": {
            "!type": "fn(str: string)",
            "!doc": "Da usare nei trigger. Aggiunge a inizio riga la stringa str."
            },
            "link": {
            "!type": "fn(text: string, click: fn(), hover?: string)",
            "!doc": "Crea a schermo un link clickabile che esegue la funzione 'click'. Opzionalmente 'hover' viene mostrato quando il mouse e' sopra al link."
            },
            "variable": {
            "!type": "fn(name: string)",
            "!doc": "Ritorna il valore della variabile con il nome richiesto. Come getvar."
            },
            "getvar": {
            "!type": "fn(name: string)",
            "!doc": "Ritorna il valore della variabile con il nome richiesto."
            },
            "delvar": {
            "!type": "fn(name: string)",
            "!doc": "Cancella una variabile."
            },
            "setvar": {
            "!type": "fn(name: string, value: ?, class: string, temporary: bool)",
            "!doc": "Crea / assegna o altera una variabile. Ritorna il valore."
            },
            "playAudio": {
            "!type": "fn(url: string)",
            "!doc": "Suona un file audio dall'URL assegnato."
            },
            "stopAudio": {
            "!type": "fn()",
            "!doc": "Interrompe ogni audio che sta suonando al momento."
            },
            "Room": {
            "!doc": "Una locazione (room) del mapper.",
            "id": {
                "!type": "number",
                "!doc": "L'ID della locazione."
            },
            "name": {
                "!type": "string",
                "!doc": "Il nome della locazione."
            },
            "description": {
                "!type": "string",
                "!doc": "La desrizione della locazione."
            },
            "shortName": {
                "!type": "string",
                "!doc": "Il nome breve della locazione usabile con il comando vai."
            },
            "color": {
                "!type": "string",
                "!doc": "Il colore della locazione (formato web - css)."
            }
            },
            "mapper": {
            "!doc": "Per comandare il mapper via script.",
            "current": {
                "!type": "Room",
                "!doc": "La locazione corrente nel mapper."
            },
            "search": {
                "!type": "fn(name: string, desc?: string) -> Room[]",
                "!doc": "Cerca le room per nome e opzionalmente descrizione e visualizza a schermo."
            },
            "searchRooms": {
                "!type": "fn(name: string, desc?: string) -> Room[]",
                "!doc": "Cerca e ritorna le room per nome e opzionalmente descrizione e NON visualizza a schermo."
            },
            "getRoomById": {
                "!type": "fn(id: number) -> Room",
                "!doc": "Cerca e ritorna la room quel quel ID."
            },
            "getRoomByVnum": {
                "!type": "fn(vnum: number) -> Room",
                "!doc": "Cerca e ritorna la room quel quel numero virtuale."
            },
            "walkToId": {
                "!type": "fn(id: number) -> void",
                "!doc": "Vai all'ID di una locazione (crea percorso e lo segue)."
            },
            "walkToVnum": {
                "!type": "fn(vnum: number) -> void",
                "!doc": "Vai al numero virtuale di una locazione (crea percorso e lo segue)."
            },
            "setZoneById": {
                "!type": "fn(id: number) -> void",
                "!doc": "Assegna la zona con ID specificato come la corrente nel mapper."
            },
            "setRoomByVnum": {
                "!type": "fn(vnum: number) -> void",
                "!doc": "Assegna la locazione con numero virtuale come corrente nel mapper."
            },
            "setRoomById": {
                "!type": "fn(id: number) -> void",
                "!doc": "Assegna la locazione con ID come corrente nel mapper."
            }
            },
            "delay": {
            "!type": "fn(id: string, milliseconds: number, function: fn() -> void)",
            "!doc": "Esegue la funzione 'function' dopo 'milliseconds' secondi.\nI'ID e' necessario e se esiste gia' un delay con quell'ID esso verra sovrascritto e anullato."
            },
            "repeat": {
            "!type": "fn(id: string, milliseconds: number, function: fn() -> void)",
            "!doc": "Esegue la funzione 'function' ogni 'milliseconds' secondi e ripete per sempre.\nI'ID e' necessario e se esiste gia' un repeat con quell'ID esso verra sovrascritto e anullato.\nSe function non viene dato, un repeat esistente verra anullato."
            },
            "trigger_o_alias": {
            "!doc": "Un trigger o alias.",
            "pattern": {
                "!type": "string",
                "!doc": "Il pattern che fa scattare il trigger o alias."
            },
            "value": {
                "!type": "string",
                "!doc": "Il valore del trigger o alias (i comandi, o script)"
            },
            "id": {
                "!type": "string",
                "!doc": "L'ID con il quale identificarlo."
            },
            "class": {
                "!type": "string",
                "!doc": "La classe alla quale appartiene."
            },
            "regex": {
                "!type": "bool",
                "!doc": "Se il trigger o alias ha un pattern RegExp o solo testuale."
            },
            "enabled": {
                "!type": "bool",
                "!doc": "Se abilitato o meno."
            },
            "is_script": {
                "!type": "bool",
                "!doc": "Se ha una script o e' composto solo da comandi da lanciare"
            },
            "is_prompt": {
                "!type": "bool",
                "!doc": "Se prompt o meno. Se e' prompt puo' scattare anche se una linea di output non e' finita."
            },
            "temporary": {
                "!type": "bool",
                "!doc": "Un trigger temporary non verra salvato nel profilo"
            }
            },
            "getTrigger": {
            "!type": "fn(id: string) -> trigger_o_alias",
            "!doc": "Accede al triggerManager e cerca il trigger con l'id provveduto e lo ritorna."
            },
            "getEvent": {
            "!type": "fn(id: string) -> trigger_o_alias",
            "!doc": "Accede al eventManager e cerca l'evento con l'id provveduto e lo ritorna."
            },
            "getAlias": {
            "!type": "fn(id: string) -> trigger_o_alias",
            "!doc": "Accede al aliasManager e cerca l'alias con l'id provveduto e lo ritorna."
            },
            "findTrigger": {
            "!type": "fn(line: string) -> trigger_o_alias",
            "!doc": "Accede al triggerManager e cerca il trigger che matcha il line e lo ritorna."
            },
            "findAlias": {
            "!type": "fn(input: string) -> trigger_o_alias",
            "!doc": "Accede al aliasManager e cerca l'alias che matcha l'input e lo ritorna."
            },
            "createTrigger": {
            "!type": "fn(trg: trigger_o_alias) -> bool",
            "!doc": "Crea un trigger e lo salva nel profilo. Ritorna true se creato con successo."
            },
            "createTempTrigger": {
            "!type": "fn(trg: trigger_o_alias) -> bool",
            "!doc": "Crea un trigger temporaneo che non viene salvato nel profilo. Ritorna true se creato con successo."
            },
            "deleteTrigger": {
            "!type": "fn(trg: trigger_o_alias) -> bool",
            "!doc": "Cancella un trigger del profilo. Usa getTrigger o findTrigger per trovarlo. Ritorna true se cancellato con successo."
            },
            "deleteTempTrigger": {
            "!type": "fn(trg: trigger_o_alias) -> bool",
            "!doc": "Cancella un trigger temporaneo. Ritorna true se cancellato con successo."
            },
            "triggerEnabled": {
            "!type": "fn(id: string) -> bool",
            "!doc": "Ritorna lo stato del trigger con ID 'id': true se abilitato, false altrimenti."
            },
            "aliasEnabled": {
            "!type": "fn(id: string) -> bool",
            "!doc": "Ritorna lo stato dell'alias con ID 'id': true se abilitato, false altrimenti."
            },
            "classEnabled": {
            "!type": "fn(id: string) -> bool",
            "!doc": "Ritorna lo stato dellla classe con ID 'id': true se abilitata, false altrimenti."
            },
            "match": {
            "!type": "[string]",
            "!doc": "I risultati della regex del trigger o alias."
            },
            "escapeRegex": {
            "!type": "fn(id: string) -> string",
            "!doc": "Normalizza una stringa per renderla un valido regex."
            },
            "Button": {
                "Ok": "number",
                "Cancel": "number"
            },
            "MessageboxResult": {
            "!doc": "Il risultato di un dialog/formulario/domanda.",
            "button": {
                "!doc": "Il numero del bottone premuto.",
                "!type": "Button"
            },
            "result": {
                "!doc": "Il risultato per domande o input singoli.",
                "!type": "string"
            },
            "results": {
                "!doc": "I risultati per input multipli.",
                "!type": "[string]"
            }
            },
            "Messagebox": {
            "!doc": "Formulario per messaggi e domande.",
            "Show": {
                "!type": "fn(title: string, text: string, labelstyle?: string) -> +Promise[:t=MessageboxResult]",
                "!doc": "Messagebox semplice con titolo e messaggio. Usare con (await Messagebox.Show(...)))"
            },
            "Question": {
                "!type": "fn(text: string) -> +Promise[:t=MessageboxResult]",
                "!doc": "Una domanda e viene ritornata la risposta. Usare con (await Messagebox.Question(...)))"
            },
            "ShowFull": {
                "!type": "fn(title: string, text: string, okButton?: string, cancelButton?: string, callback?: fn(val:string), width?: number, height?: number) -> +Promise[MessageboxResult]",
                "!doc": "Una domanda e viene ritornata la risposta. Usare con (await Messagebox.ShowFull(...)))"
            },
            "ShowInput": {
                "!type": "fn(title: string, text: string, defaultText?: string, multiline?: bool) -> +Promise[MessageboxResult]",
                "!doc": "Una domanda e viene ritornata la risposta, uare multiline per testi lunghi. Usare con (await Messagebox.ShowInput(...)))"
            },
            "ShowInputWithButtons": {
                "!type": "fn(title: string, text: string, defaultText?: string, okButton?: string, cancelButton?: string) -> +Promise[MessageboxResult]",
                "!doc": "Una domanda e viene ritornata la risposta con bottoni specificabili. Usare con (await Messagebox.ShowInputWithButtons(...)))"
            },
            "ShowMultiInput": {
                "!type": "fn(title: string, labels: [string], defaultValues?: [?]) -> +Promise[MessageboxResult]",
                "!doc": "Piu' domande in un pannello, ritorna in .results l'array. Usare con (await Messagebox.ShowMultiInput(...)))"
            }
            },
            "Notification": {
            "!doc": "Notificazione / Toast popup",
            "Show": {
                "!type": "fn(text: string, top?: bool, ripeti?: bool, delay?: number, html?: bool, trasparenza?: number, blink?: bool, callback?: Function) -> void",
                "!doc": "Mostra avviso con <text>. Se <top> e' true, in alto, altrimenti in basso. <ripeti> cancella la notificazione precedente e la ripete con nuovo testo. <delay> e' il tempo di chiusura, <html> se vuoi usare html. <trasparenza> e' da 0.0 a 1.0 e <blink> lampeggia."
            },
            "Warning": {
                "!type": "fn(text: string, top?: bool, ripeti?: bool, delay?: number, html?: bool, trasparenza?: number, blink?: bool, callback?: Function) -> void",
                "!doc": "Mostra avvertimento con <text>. Se <top> e' true, in alto, altrimenti in basso. <ripeti> cancella la notificazione precedente e la ripete con nuovo testo. <delay> e' il tempo di chiusura, <html> se vuoi usare html. <trasparenza> e' da 0.0 a 1.0 e <blink> lampeggia."
            }
            },
            "escapeHTML": {
            "!type": "fn(htmlText: string) -> string",
            "!doc": "Rimpiazza <, > e & con sequenze escape html per renderli testuali anziche' formare elementi html."
            },
            "throttle": {
            "!type": "fn(function: fn(), frequency: number) -> fn()",
            "!doc": "Questa funzione limita la frequenza di esecuzione della funzione di ingresso e ritorna la funzione da usare al suo posto. Quindi se frenquency e' 250 (che e' in millisecondi) chiamando la funzione di ritorno con qualsiasi frequenza 'function' verra eseguita al max ogni 250ms."
            },
            "map": "mapper",
        },
        "api": {
            "!doc": "Funzioni di scripting parte dell'API del client.",
        },
        "custom": {
            "!doc": "Funzioni di scripting dichiarate dall'utente.",
        },
    };

    let api = script.getApi()

    if (api.functions) {
        let keys = Object.keys(api.functions)

        for (const K of keys) {
            defs[K] = K
            defs.api[K] = K
        }
    }
    if (api.private) {

        function getFunctionParameters(func:string) {
            const funcStr = func.toString();
            const result = funcStr.match(/\(([^)]*)\)/);
            if (result && result[1]) {
                return result[1].split(',').map(param => param.trim());
            }
            return [];
        }

        let keys = Object.keys(api.private)

        for (const K of keys) {
            defs[K] = K
            if (typeof api.private[K] == "function") {
                let pr = getFunctionParameters(api.private[K]).map(v => v+ ": ?")
                defs.custom[K] = {
                    "!type": "fn("+pr.join(", ")+") -> ?",
                    "!doc": "Funzione privata definita dalle proprie script."
                }
            } else if (typeof api.private[K] == "string") {
                defs.custom[K] = {
                    "!type": "string",
                    "!doc": "Stringa definita dalle proprie script."
                }
            } else if (typeof api.private[K] == "number") {
                defs.custom[K] = {
                    "!type": "number",
                    "!doc": "Numero definito dalle proprie script."
                }
            } else if (typeof api.private[K] == "object") {
                defs.custom[K] = {
                    "!type": "{}",
                    "!doc": "Oggetto definito dalle proprie script."
                }
            } else if (typeof api.private[K] == "boolean") {
                defs.custom[K] = {
                    "!type": "bool",
                    "!doc": "Booleano definito dalle proprie script."
                }
            } else {
                defs.custom[K] = {
                    "!doc": "Definito dalle proprie script."
                }
            }
        }
    }
    cm.Tern.server.addDefs(defs, false);
}

export function refreshVariablesInTern(cm: any, script: JsScript) {
    cm.Tern.server.deleteDefs("tsclient-variables");
    let variables:any = {
        "!name": "tsclient-variables"
    };
    let vars = script.getVariables().sort((a,b)=> a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    for (const va of vars) {
        let type = "string"
        if (va.value && typeof va.value == "object") {
            type = "{}"
        } else if (IsNumeric(va.value)) {
            type = "number"
        }
        let tmp = va.value
        tmp = tmp==undefined||tmp===""?"<vuota>":va.value
        tmp = type == "{}" ? JSON.stringify(tmp) : tmp
        let val = (tmp||"").toString()
        val = val.length > 30 ? val.slice(0,30) + "..." : val
        variables["@"+va.name] = {
            "!type": type,
            "!doc": `Variabile ${va.name}${va.class?" (classe "+va.class+")":""}${va.temp?" (temporanea)":""}. Ultimo valore: ${val}`
        }
    }
    cm.Tern.server.addDefs(variables, false);
}

export function circleNavigate(first:JQuery|HTMLElement, last:JQuery|HTMLElement, fallback:JQuery|HTMLElement = null, win:JQuery) {
    if (win) (<any>win).jqxWindow("close");
    $(last).on("keydown", (ev) => {
        if (ev.keyCode == 9 && !ev.shiftKey) {
            ev.preventDefault()
            ev.stopPropagation()
            if (!win || (<any>win).jqxWindow("isOpen")) $(first).focus()
        }
    });
    if (fallback) $(fallback).on("keydown", (ev) => {
        if (ev.keyCode == 9 && !ev.shiftKey && $(last).is(":disabled")) {
            ev.preventDefault()
            ev.stopPropagation()
            if (!win || (<any>win).jqxWindow("isOpen")) $(first).focus()
        }
    });
    $(first).on("keydown", (ev) => {
        if (ev.keyCode == 9 && ev.shiftKey) {
            ev.preventDefault()
            ev.stopPropagation()
            if (!win || (<any>win).jqxWindow("isOpen")) $(last).focus()
        }
    });
}

export function AskReload() {
    Messagebox.ShowWithButtons("Configurazione aggiornata",
        "I trigger e alias sono stati importati.\nSarebbe consigliabile riavviare il client, vuoi farlo?",
        "Si", "No").then(v => {
        if (v.button == Button.Ok) {
            window.location.reload()
        }
    });
}

function reverseObject(obj:{ [key: string]: string }) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [value, key])
    );
  }

const shortcutReplacements:{ [key: string]: string } = {
    "⌃":"ctrl",
    "⇧":"shift",
    "⌥":"alt"
}
const inverseShortcutRep = reverseObject(shortcutReplacements)

export function parseShortcutString(key:string) {
    const keys = key.split("+")
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k in inverseShortcutRep) {
            keys[i] = inverseShortcutRep[k]
        }
    }
    console.log("Creata macro: "+ keys.join("+"))
    return keys.join("+")
}

export function formatShortcutString(keys:string[]) {
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k in shortcutReplacements) {
            keys[i] = shortcutReplacements[k]
        }
    }
    return keys.join("+")
}

export function getVersionNumbers(ver:string):number[] {
    const rx = new RegExp("(\\d+)\\.(\\d+)\\.(\\d+)( ?beta(\\d*))?");

    let m:RegExpMatchArray = null;
    if (!(m = ver.match(rx)))
        return null;

    return [ parseInt(m[1]),  // major
            parseInt(m[2]),             // minor
            parseInt(m[3]),             // rev.
            m[4] == null ? 100000    // no beta suffix
                    : !m[5] ? 1        // "beta"
                    : parseInt(m[5])    // "beta3"
    ];
}

export function isVersionNewer(current:string, required:string):boolean {

    const testVer:number[] = getVersionNumbers(current);
    const baseVer:number[] = getVersionNumbers(required);

    for (let i = 0; i < testVer.length; i++)
        if (testVer[i] != baseVer[i])
            return testVer[i] > baseVer[i];

    return true;
}

export function denyClientVersion(cfg:any):string {
    const minMajor = cfg.requiresClientMajor || 1;
    const minMinor = cfg.requiresClientMinor || 0;
    const minRev = cfg.requiresClientRevision || 0;
    const ver = AppInfo.Version;
    const required = `${minMajor}.${minMinor}.${minRev}`;
    if (!isVersionNewer(ver, required)) {
        return required;
    }
    return null;
}
