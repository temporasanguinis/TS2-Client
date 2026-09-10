import { EventHook } from "../Core/event";
import { TrigAlItem } from "./windows/trigAlEditBase";
import { ClassManager } from "./classManager";
import { EvtScriptEmitPrint, EvtScriptEmitToggleTrigger, EvtScriptEvent, JsScript, ScripEventTypes } from "./jsScript";
import { ProfileManager } from "../App/profileManager";
import { TsClient } from "../App/client";
import { ConfigIf, escapeRegExp, escapeRegexReplacement, parseScriptVariableAndParameters, parseSimpleScriptSyntax, stripHtml } from "../Core/util";
import { Notification } from "../App/messagebox";

/*export interface ConfigIf {
    set(key: string, val: TrigAlItem[]): void;
    getDef(key: string, def: boolean): boolean;
    get(key:string): TrigAlItem[];
    evtConfigImport: EventHook<{[k: string]: any}>;
}*/

export interface ScriptIf {
    makeScript(owner:string, text: string, argsSig: string): any;
}

export class TriggerManager {
    public EvtEmitTriggerCmds = new EventHook<{orig: string, cmds: string[]}>();
    public EvtEmitTriggerOutputChanged = new EventHook<{line: string, buffer: string}>();
    private triggerLog = new Array<{key:string, time:number}>();
    public triggers: Array<TrigAlItem> = null;
    public tempTriggers: Array<TrigAlItem> = null;
    public allTriggers: Array<TrigAlItem> = null;
    public changed = new EventHook()
    private precompiledRegex = new Map<TrigAlItem, RegExp>()

    constructor(public jsScript: JsScript, private config: ConfigIf, private baseConfig: ConfigIf, private classManager: ClassManager, private profileManager:ProfileManager) {
        /* backward compatibility */
        let savedTriggers = localStorage.getItem("triggers");
        if (savedTriggers && baseConfig) {
            this.config.set("triggers", JSON.parse(savedTriggers));
            localStorage.removeItem("triggers");
        }

        this.loadTriggers(config, true);
        config.evtConfigImport.handle((d) => {
            if (d.owner.data.name != config.data.name) return;
            if (!baseConfig) {
                config.set("triggers", d.data["triggers"], false)
            }
            this.loadTriggers(config, true);
            //this.saveTriggers();
        }, this);
        if (baseConfig) baseConfig.evtConfigImport.handle((d) => {
            if (d.owner.data.name != baseConfig.data.name) return;
            baseConfig.set("triggers", d.data["triggers"], false)
            if (config.data.name == baseConfig.data.name) {
                config.data.cfgVals = baseConfig.data.cfgVals
            }
            this.loadTriggers(config.data.name==baseConfig.data.name ? baseConfig : config, false);
            //this.saveTriggers();
        }, this);
        EvtScriptEmitToggleTrigger.handle(this.onToggle, this);
    }

    private onToggle(data: {owner: string, id:string, state:boolean}) {
        if (data.state == undefined || this.getById(data.id)?.enabled != data.state) 
        {
            this.setEnabled(data.id, data.state);
            if (this.config.getDef("debugScripts", false)) {
                const msg = "Trigger " + data.id + " e' ora " + (this.isEnabled(data.id) ? "ABILITATO" : "DISABILITATO");
                EvtScriptEmitPrint.fire({owner:"TriggerManager", message: msg});
            }
        }
    }

    public setEnabled(id:string, val:boolean) {
        const t = this.getById(id);
        if (!t) {
            if (this.config.getDef("debugScripts", false)) {
                const msg = "Trigger " + id + " non esiste!";
                EvtScriptEmitPrint.fire({owner:"TriggerManager", message: msg});
            }    
            return;
        }
        if (val == undefined) {
            val = !t.enabled;
        }
        const changed = t.enabled != val;
        t.enabled = val;
        if (changed) {
            if (this.config.getDef("debugScripts", false)) EvtScriptEmitPrint.fire({
                owner: "TriggerManager",
                message: "Abilito trigger " + t.id
            })
            this.saveTriggers(true)
        }
    }

    public getById(id:string):TrigAlItem {
        for (let index = 0; index < this.triggers.length; index++) {
            const element = this.triggers[index];
            if (element.id == id) return element;
        }
        for (let index = 0; index < this.allTriggers.length; index++) {
            const element = this.allTriggers[index];
            if (element.id == id) return element;
        }
        return null;
    }

    public isEnabled(id:string):boolean {
        const t = this.getById(id);
        return t && t.enabled;
    }

    public contains(pattern:string, maxIndex:number, tclass:string, tid:string) {
        for (let index = 0; index < Math.min(maxIndex, this.allTriggers.length); index++) {
            const element = this.allTriggers[index];
            if (element.pattern == pattern && element.class == tclass && element.id == tid) return true;
        }
        return false;
    }

    public createTrigger(trg:TrigAlItem):boolean {
        if (!trg) return false;
        let id = trg.id;
        if (!id && trg.temporary) {
            Notification.Show("Un trigger temporaneo deve avere un ID")
            return false
        }
        
        if (trg.enabled === undefined) {
            trg.enabled = true
        }

        if (trg.temporary) {
            return this.createTempTrigger(trg)
        }

        this.triggers.push(trg)

        this.saveTriggers();
        return true
    }

    public setTrigger(index:number, trg:TrigAlItem):boolean {
        if (!trg) return false;

        if (trg.temporary) {
            Notification.Show("Questa operazione non funziona su trigger temporanei")
            return false
        }

        this.triggers[index] = trg

        this.saveTriggers();
        return true
    }

    public createTempTrigger(trg:TrigAlItem):boolean {
        if (!trg) return false;
        let id = trg.id;
        if (!id) {
            Notification.Show("Un trigger temporaneo deve avere un ID")
            return false
        }
        let idx = this.tempTriggers.findIndex(v => v.id == id)
        if (idx>=0) {
            this.tempTriggers.splice(idx, 1)
        }

        if (trg.enabled === undefined) {
            trg.enabled = true
        }

        trg.temporary = true;

        this.tempTriggers.push(trg)
        this.mergeTriggers()
        return true
    }

    public deleteTempTrigger(trg:TrigAlItem) {
        if (!trg) return false;
        let id = trg.id;
        if (!id) {
            Notification.Show("Un trigger temporaneo deve avere un ID")
            return false
        }
        let idx = this.tempTriggers.findIndex(v => v.id == id)
        if (idx>=0) {
            this.tempTriggers.splice(idx, 1)
            this.mergeTriggers()
            return true
        }
        return false
    }

    public deleteTrigger(trg:TrigAlItem):boolean {
        if (!trg) return false;

        let id = trg.id;
        if (!id && trg.temporary) {
            Notification.Show("Un trigger temporaneo deve avere un ID")
            return false
        }

        if (trg.temporary) {
            return this.deleteTempTrigger(trg)
        }

        let index = this.triggers.indexOf(trg)
        if (index < 0)
            return false;

        this.triggers.splice(index, 1);
        this.saveTriggers();
        return true
    }

    *getTriggersOfClass(name:string) {
        for (const tr of [...this.tempTriggers]) {
            if (tr.class == name) yield (tr)
        }
        for (const tr of [...this.triggers]) {
            if (tr.class == name) yield (tr)
        }
    }

    deleteTriggersWithClass(name: string) {
        for (const tr of [...this.tempTriggers]) {
            if (tr.class == name) this.deleteTempTrigger(tr)
        }
        for (const tr of [...this.triggers]) {
            if (tr.class == name) this.deleteTrigger(tr)
        }
    }

    public precompileTriggers() {
        //console.log("precompile triggers")
        this.precompiledRegex.clear()
        for (const t of this.allTriggers) {
            t.script = null;
            let pattern = t.pattern;
            if (!t.regex) {
                pattern = escapeRegExp(pattern)
                if (pattern.indexOf("\\^")==0) {
                    pattern = ("^" + pattern.substring(2))
                }
                pattern = pattern.replace(/(\\\$|\%)(\d+)/g, function(m, d) {
                    return "(.+)";
                });
            }
            this.precompiledRegex.set(t, new RegExp(pattern));
        }
    }

    public mergeTriggers() {
        const prof = this.profileManager.getProfile(this.profileManager.getCurrent());
        if ((prof && !prof.baseTriggers) || !this.baseConfig) {
            this.allTriggers = $.merge([], this.config.get("triggers") || []);
            this.precompileTriggers()
            return;
        }

        var triggers = $.merge([], this.config.get("triggers") || []);
        triggers = $.merge(triggers, this.tempTriggers || []);
        triggers = $.merge(triggers, this.baseConfig.get("triggers") || []);
        this.allTriggers = triggers;
        for (let index = 0; index < this.allTriggers.length; index++) {
            const element = this.allTriggers[index];
            if (element && index>0 && this.contains(element.pattern, index, element.class, element.id)) {
                this.allTriggers.splice(index, 1);
                index--;
                continue;
            }
        }
        this.precompileTriggers()
    }

    private saving = false;
    public saveTriggers(noChangeNotification?: boolean) {
        if (this.saving) return;
        try {
            //console.log("Saving triggers")
            this.triggers.forEach(a => delete a.script);
            this.config.set("triggers", this.triggers);
            this.mergeTriggers();
            if (!this.baseConfig) {
                this.saving = true;
                this.config.evtConfigImport.fire({ data: this.config.data.cfgVals, owner: this.config});
            } else if (this.baseConfig && this.baseConfig.data.name == this.config.data.name) {
                this.saving = true;
                this.baseConfig.evtConfigImport.fire({ data: this.config.data.cfgVals, owner: this.config});
            }
            if (!noChangeNotification) this.changed.fire(null)
        } finally {
            this.saving = false;
        }
    }

    private loadTriggers(config:ConfigIf, reload:boolean) {
        if (!this.saving && this.config == config && reload) {
            this.triggers = config.get("triggers") || [];
            this.tempTriggers = [];
        }
        this.mergeTriggers();
    }

    private charSent = false;
    private passSent = false;
    private handleAutologin(line: string) {
        if (!this.profileManager.getCurrent()) {
            return;
        }

        if (line.match(/^Che nome vuoi usare ?/)) {
            const prof = this.profileManager.getProfile(this.profileManager.getCurrent());
            if (prof.autologin && prof.char && !this.charSent) {
                this.charSent = true;
                setTimeout(()=>{ this.charSent = false;}, 1000);
                this.EvtEmitTriggerCmds.fire({orig: 'autologin', cmds: [prof.char]});
            }
        } else if (line.match(/^Inserisci la sua password:/)) {
            const prof = this.profileManager.getProfile(this.profileManager.getCurrent());
            if (prof.autologin && prof.pass && !this.passSent) {
                this.passSent = true;
                setTimeout(()=>{ this.passSent = false;}, 1000);
                const pass = TsClient.decrypt(prof.pass);
                this.EvtEmitTriggerCmds.fire({orig: 'autologin', cmds: [pass]});
            }
        }
    }

    public runTrigger(trig:TrigAlItem, line:string) {
        let fired:boolean = false;
        const jsScript = this.jsScript

        if (trig.regex) {
            if (line.endsWith("\n") && trig.pattern.endsWith("$")) {
                line = line.substring(0, line.length-1);
            }
        }

        let match = line.match(this.precompiledRegex.get(trig));
        if (!match) {
            return;
        }
        /*if (this.checkLoop(trig.pattern)) {
            EvtScriptEmitPrint.fire({ owner: "AliasManager", message: "Trovato possibile ciclo infinito tra i trigger: " +trig.pattern})
            return;
        }
        this.logScriptTrigger(trig.pattern);*/

        if (trig.is_script) {
            if (!trig.script) {
                this.createTriggerScript(trig, match, jsScript);
            }
            if (trig.script) {
                trig.script(match, line); 
                fired = true;
            } else {
                throw `Trigger '${trig.pattern}' e' una script malformata`;
            }
        } else {
            //if (!trig.script) {
                trig.script = this.createSimpleTriggerCommands(trig.value, line, match, jsScript);
            //}
            if (trig.script) {
                this.EvtEmitTriggerCmds.fire({orig: trig.id || trig.pattern, cmds: trig.script});
                fired = true;
            } else {
                throw `Trigger '${trig.pattern}' e' ha comandi malformati`;
            }
        }
        
        if (fired) {
            EvtScriptEvent.fire({event: ScripEventTypes.TriggerFired, condition: trig.id || trig.pattern, value: line});
        }
    }

    private createSimpleTriggerCommands(value: string, line: string, match: RegExpMatchArray, jsScript: JsScript) {
        let lines: string[] = (value).replace("\r", "").split("\n");
        let resLines: string[] = []

        for (const l of lines) {
            const rl = l.replace(/(?:\\`|`(?:\\`|[^`])*`|\\"|"(?:\\"|[^"])*"|\\'|'(?:\\'|[^'])*')|(?:\$|\%)(\d+)/g, function (m, d) {
                if (d == undefined)
                    return m;
                return d == 0 ? "" + line + "" : (match[parseInt(d)] || '');
            })
            resLines.push(rl)  
        }

        lines = parseSimpleScriptSyntax(resLines, this.jsScript)
        
        return lines;
    }

    private createTriggerScript(trig: TrigAlItem, match: RegExpMatchArray, jsScript: JsScript) {
        let value = trig.value;
        value = parseScriptVariableAndParameters(value, match)
        trig.script = jsScript.makeScript("(trigger) " + (trig.id || trig.pattern), value, "match, line");
    }

    checkLoop(source: string):boolean {
        let cnt = 0;
        for (const k of this.triggerLog) {
            const alL = k.time
            const now = new Date();
            const diff = Math.abs(now.getTime() -  alL);
            if (diff < 10000 && k.key == source) {
                cnt++;
            }   
        }
        return false;// cnt >= 10;
    }
    logScriptTrigger(alias:string) {
        let index = 0;
        for (const k of [...this.triggerLog]) {
            const alL = k.time
            const now = new Date();
            const diff = Math.abs(now.getTime() -  alL);
            if (diff > 20000) {
                this.triggerLog.splice(index, 1);
            }   
        }
        this.triggerLog.push({key: alias, time: new Date().getTime()})
    }


    public buffer:string;
    public line:string;
    private lineDeleted:boolean = false

    public handleBuffer(line: string, raw:string): string {
        if (this.config.getDef("triggersEnabled", true) !== true) return null;
        this.buffer = raw;
        this.line = line;
        this.handleAutologin(line);
        this.lineDeleted = false

        for (let i = 0; i < this.allTriggers.length; i++) {
            let trig = this.allTriggers[i];
            if (!trig.enabled || (trig.class && !this.classManager.isEnabled(trig.class))) continue;
            if (!trig.is_prompt) continue;
            this.runTrigger(trig, line);
        }

        return this.buffer;
    }

    public findTrigger(line:string) {
        for (let i = 0; i < this.allTriggers.length; i++) {
            let trig = this.allTriggers[i];
            //if (!trig.enabled || (trig.class && !this.classManager.isEnabled(trig.class))) continue;
            
            if (trig.regex) {
                if (line.endsWith("\n") && trig.pattern.endsWith("$")) {
                    line = line.substring(0, line.length-1);
                }
            }
    
            let match = line.match(this.precompiledRegex.get(trig));
            if (match) {
                return trig;
            }
        }
        return null;
    }
    
    public handleLine(line: string, raw:string): string {
        this.line = null;
        this.buffer = null;

        if (this.config.getDef("triggersEnabled", true) !== true) return null;
        this.buffer = raw;
        this.line = line;
        this.lineDeleted = false

        for (let i = 0; i < this.allTriggers.length; i++) {
            let trig = this.allTriggers[i];
            if (!trig.enabled || (trig.class && !this.classManager.isEnabled(trig.class))) continue;
            if (trig.is_prompt) continue;
            this.runTrigger(trig, line);
        }

        return this.buffer;
    }

    private doReplace(sBuffer:string, sText:string, sWhat:string, sWith:string) {
        let rx = new RegExp(sWhat, 'g');
        let matches:RegExpExecArray | null = null;
        let max = 120
        let plainWith = $("<span>"+sWith+"</span>").text() || sWith

        function replaceBetween(str:string, start:number, end:number, newSubStr:string) { 
            if (start < 0 || end > str.length || start > end) {
                 throw new Error('Invalid indices'); 
            }
            return str.slice(0, start) + newSubStr + str.slice(end);
        }

        while (--max > 0 && (matches = rx.exec(sText)) && matches.length) {

            let intag = false;
            let text=sText
            let buffer = sBuffer
            let positions = [];
            let positionsText = [];
            let offset = 0;
            let htmltext = "";

            for (var i = 0; i < text.length; i++) {
                const val = this.htmlEncode(text, i);
                if (val) {
                    htmltext += val[0];
                    positionsText.push(i+offset);
                    offset+=val[0].length-1;
                } else {
                    htmltext += text[i];
                    positionsText.push(i+offset);
                }
            }

            for (var i = 0; i < buffer.length; i++) {
                if (buffer[i] == "<") intag = true;
                if (!intag) {
                    positions.push(i);
                }
                if (buffer[i] == ">") intag = false;
            }
            
            let start = matches.index;
            let end = start + matches[0].length-1;
            let closeTags = [];
            let openTags = [];
            
            let bufferStart = positions[positionsText[start]];
            let bufferEnd = positions[positionsText[end]];
            if (sBuffer[bufferEnd]=="&") bufferEnd+=3;
            let charsBefore = [];
            let chars = [];
            
            for (let i = 0; i < bufferStart; i++) {
                charsBefore.push(sBuffer[i]);
            }
            
            let closingTag = false;
            let tag = "";
            let spaceFound = false;
            for (let i = bufferStart; i < bufferEnd; i++) {
                if (sBuffer[i] == "<") {
                    tag = "";
                    spaceFound = false;
                    intag = true;
                    if (i+1 <= bufferEnd && sBuffer[i+1]=="/") {
                        closingTag = true;
                    i++;
                    }
                    continue;
                }
                if (intag) {
                    if (sBuffer[i] == ">") {
                        if (closingTag) {
                            closeTags.push(tag);
                        } else {
                            openTags.push(tag);
                        }
                        closingTag = false;
                        intag = false;
                    }
                    else {
                        if (sBuffer[i]==" ") {
                            spaceFound = true;
                        }
                        if (!spaceFound) {
                            tag+=sBuffer[i];
                        }
                    }   
                }
            }
            
            chars.push(sWith);
            
            for (let i = 0; i < openTags.length; i++) {
                charsBefore.push("<" + openTags[i] + ">");
            }
            
            for (let i = 0; i < closeTags.length; i++) {
                chars.push("</" + closeTags[i] + ">");
            }
            
            for (let i = bufferEnd+1; i < sBuffer.length; i++) {
                chars.push(sBuffer[i]);
            }
            
            sBuffer = [...charsBefore,...chars].join("");
            sText = replaceBetween(sText, start, end+1, plainWith)
            rx.lastIndex = end+plainWith.length
        }
        if (max<1) {
            EvtScriptEmitPrint.fire({owner:"triggerManager", message: "Replace " + sWhat + " con " + sWith + " fallito in loop."})
        }
        return sBuffer;
    }

    private htmlEscapes = {
        '&lt;': '<',
        '&gt;': '>',
        /*'&#39;': "'",
        '&#34;': '"',*/
        '&amp;': "&"
    };

    htmlDecode(s:string, i:number):[string,string] {
      for (const key in this.htmlEscapes) {
          if (Object.prototype.hasOwnProperty.call(this.htmlEscapes, key)) {
              const element = <string>((<any>this.htmlEscapes)[key]);
                const sub = s.substr(i, key.length);
                if (sub == key) {
                    return [element, key];
                }
          }
      }
      return null;
    }

    htmlEncode(s:string, i:number):[string,string] {
        for (const key in this.htmlEscapes) {
            if (Object.prototype.hasOwnProperty.call(this.htmlEscapes, key)) {
                const element = <string>((<any>this.htmlEscapes)[key]);
                  const sub = s.substring(i, i+1);
                  if (sub == element) {
                      return [key, element];
                  }
            }
        }
        return null;
      }

    public subBuffer(sWhat: string, sWith: string) {
        
        if (this.lineDeleted) return

        //console.log(">"+$(this.buffer).text())

        sWhat = typeof sWhat == "string" ? escapeRegExp(sWhat) : sWhat
        sWith = escapeRegexReplacement(sWith)

        let buffer = this.buffer;
        let text = this.line.split("\n")[0];
        

        this.line = text.replace(new RegExp((sWhat), 'gi'), (sWith.indexOf("<span")!=-1 ? stripHtml(sWith) : sWith));
        this.buffer = this.doReplace(buffer, text, sWhat, sWith);
        this.lineDeleted = this.EvtEmitTriggerOutputChanged.fire({line: this.line, buffer:this.buffer});
        //console.log("<"+$(this.buffer).text())
    }
    
    gag() {
        if (this.lineDeleted) return
        
        this.buffer = "";
        this.line = "";
        this.lineDeleted = this.EvtEmitTriggerOutputChanged.fire({line: this.line, buffer:this.buffer});
    }

    prepend(sWith: string) {
        if (this.lineDeleted) return
        
        this.buffer = "<span>" + sWith + "</span>" + this.buffer;
        this.line = "" + sWith + "" + this.line;
        this.lineDeleted = this.EvtEmitTriggerOutputChanged.fire({line: this.line, buffer:this.buffer});
    }

    append(sWith: string) {
        if (this.lineDeleted) return
        
        const bufWith = "<span>" + sWith + "</span>"

        let breakIndex = this.buffer.indexOf("<br>")
        if (breakIndex > -1) {
            this.buffer = this.buffer.slice(0, breakIndex) +
                          bufWith + "<br>" +
                          this.buffer.slice(breakIndex + 4);
        } else {
            this.buffer += bufWith
        }

        this.line = this.line.endsWith('\n') ? 
                        this.line.slice(0, this.line.length-1) + sWith + "\n" :
                        this.line + sWith;
        this.lineDeleted = this.EvtEmitTriggerOutputChanged.fire({line: this.line, buffer:this.buffer});
    }
}
