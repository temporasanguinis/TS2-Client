import { isNumeric, type } from "jquery";
import { CommandInput } from "./commandInput";
import { CustomWin } from "./windows/customWindow";
import { EventHook } from "../Core/event";
import { JsScript, colorize, EvtScriptEmitPrint, EvtScriptEvent, ScripEventTypes, API } from "../Scripting/jsScript";
import { Button, Messagebox, messagebox } from "./messagebox";
import { Profile, ProfileManager } from "./profileManager";
import { isAlphaNumeric, isTrue, parseScriptVariableAndParameters, rawToHtml, throttle } from "../Core/util";
import { WindowDefinition } from "./windowManager";


export let LayoutVersion = 1;

export enum PanelPosition {
    Floating = 0,
    PaneTopLeft = 1,
    PaneTopRight = 2,
    PaneRightTop = 3,
    PaneRightBottom = 4,
    PaneBottomLeft = 5,
    PaneBottomRight = 6,
    PaneLeftTop = 7,
    PaneLeftBottom = 8
}

export interface LayoutDefinition {
    version: number;
    customized: boolean;
    color?: string;
    background?: string;
    panes: DockPane[];
    items: Control[];
}

export interface DockPane {
    id:string;
    position: PanelPosition;
    w?:number;
    h?:number;
    background?:string;
    width?:string;
    height?:string;
    autoexpand?:boolean;
    items?: Control[];
}

export enum ControlType {
    Button,
    Panel,
    Window,
    DropDownButton
}

export enum Position {
    Relative,
    Absolute,
    Fill
}

export enum Direction {
    None,
    Left,
    Right,
    Top,
    Down
}

export interface Control {
    type:ControlType;
    position?:Position;
    id?:string;
    parent?:string;
    visible?:string;
    blink?:string;
    x?:number;
    y?:number;
    w?:number;
    h?:number;
    style?:string;
    css?:string;
    color?: string;
    background?:string;
    paneId:string;
    stack?:Direction;
    content:string;
    commands?:string;
    checkbox?:string;
    gauge?:string,
    is_script?:boolean;
    tooltip?:string;
    items?: Control[];
}

export let populateItemsInPanes = (layout:LayoutDefinition) => {
    let child: Control;
    while ((child = layout.items.find(i => i.parent))) {
        let parentControl = layout.items.find(i => i.id == child.parent)
        if (!parentControl) {
            throw new Error("Missing parent for control " + child.id)
        }
        if (!parentControl.items) {
            parentControl.items = []
        }
        parentControl.items.push(child)
        child.parent = null
        child.paneId = null
        let index = layout.items.indexOf(child)
        if (index > -1) {
            layout.items.splice(index, 1)
        }
    }
    while ((child = layout.items.find(i => i.paneId))) {
        let pane = layout.panes.find(p => p.id == child.paneId)
        if (!pane) {
            throw new Error("Missing pane for control " + child.id)
        }
        if (!pane.items) {
            pane.items = []
        }
        pane.items.push(child)
        child.paneId = null
        let index = layout.items.indexOf(child)
        if (index > -1) {
            layout.items.splice(index, 1)
        }
    }
}

export class LayoutManager {
    askingUser: Profile;
    
    findDockingPositions(window: string):Control[] {

        let ret = []
        let l = this.getCurrent()
        if (l && l.panes) for (const p of l.panes) {
            let dp = (p.items || []).filter(i => i.type == ControlType.Window && (i.content == window || !window));
            if (dp) {
                for (const D of dp) {
                    ret.push(D)   
                }
            }
        }
        return ret
    }

    isDockingVisible(c:Control) {
        let ret = true
        if (c.visible) this.checkExpression(c, c.visible, (ui, res) => {
            ret = res
        })
        return ret
    }

    public EvtEmitLayoutChanged = new EventHook<LayoutDefinition>();
    public onlineBaseLayout:LayoutDefinition;
    public layout:LayoutDefinition;
    public scripts = new Map<number, Function>();
    public controls = new Map<Control, JQuery>();
    public parents = new Map<string, JQuery>();
    public variableChangedMap = new Map<string, Control[]>();
    public variableStyleChangedMap = new Map<string, Control[]>();
    public onVariableChangedThrottled = new Map<string, Function>();
    public controlContentMap = new Map<Control, string>();

    private defaultPanes = [
        {position: PanelPosition.PaneTopLeft, id: "row-top-left"},
        {position: PanelPosition.PaneTopRight, id: "row-top-right"},
        {position: PanelPosition.PaneRightTop, id: "column-right-top"},
        {position: PanelPosition.PaneRightBottom, id: "column-right-bottom"},
        {position: PanelPosition.PaneBottomLeft, id: "row-bottom-left"},
        {position: PanelPosition.PaneBottomRight, id: "row-bottom-right"},
        {position: PanelPosition.PaneLeftTop, id: "column-left-top"},
        {position: PanelPosition.PaneLeftBottom, id: "column-left-bottom"},
    ];

    constructor(private profileManager:ProfileManager, private scripting:JsScript, private cmdInput:CommandInput) {
        
        (async () => {
                this.onlineBaseLayout = await $.ajax(
                {
                    url: "./baseLayout.json?rnd="+Math.random(),
                    headers: {
                        "Pragma": "no-cache",
                        "Expires": -1,
                        "Cache-Control": "no-cache"
                    }
                })
                console.log("New base layout: " + this.onlineBaseLayout.version + " items: " + this.onlineBaseLayout.items?.length)
                if (this.onlineBaseLayout) {
                    this.onlineBaseLayout.customized = false
                }
            }
        )();
        
        profileManager?.evtProfileChanged.handle(async (ev:{[k: string]: any})=>{
            this.profileConnected()
        });
        if (profileManager) this.deleteLayout();
        if (profileManager) this.load();
        
    }

    handleEvent = (e:{event:ScripEventTypes, condition:string, value:any}) => {
        if (e.event != ScripEventTypes.VariableChanged ||
            !this.onVariableChangedThrottled)
            return;
        let func = this.onVariableChangedThrottled.get(e.condition);
        if (!func) {
            func = throttle(this.onVariableChanged, 500, this);
            this.onVariableChangedThrottled.set(e.condition, func)
        }
        func(e.condition);
    }

    public onVariableChanged(variableName:string) {
        let ctrls;
        let numCtrl = 0;
        if (ctrls=this.variableChangedMap.get(variableName)) {
            //console.log("layout variable " + variableName)
            for (const c of ctrls) {
                //console.log(c.content)
                numCtrl++;
                //let t0 = performance.now();        
                let cont = this.createContent(c, false);
                if (this.controlContentMap.get(c) == cont) {
                    continue;
                }
                this.controlContentMap.set(c, cont);
                //let t1 = performance.now();
                //if (variableName != "TickRemaining" && numCtrl>0) console.log(`VarChanged-${numCtrl} ${variableName} ${t1 - t0} ms.`);
                let ui = this.controls.get(c);
                //t0 = performance.now();        
                const ccont = $(".ui-control-content", ui)
                ccont[0].innerHTML = cont;
                if (c.checkbox) this.checkCheckbox(c);
                if (c.gauge) this.checkGauge(c);
                if (c.visible) this.checkVisible(c);
                if (c.blink) this.checkBlink(c);
                //t1 = performance.now();
                //if (variableName != "TickRemaining" && numCtrl>0) console.log(`VarChanged-${numCtrl}/${ccont.length} ${variableName} ${t1 - t0} ms.`);
            }
        }
        if (ctrls=this.variableStyleChangedMap.get(variableName)) {
            for (const c of ctrls) {
                if (c.checkbox) this.checkCheckbox(c);
                if (c.gauge) this.checkGauge(c);
                if (c.visible) this.checkVisible(c);
                if (c.blink) this.checkBlink(c);
            }
        }
    }
    public getCurrent():LayoutDefinition {
        let cp:string;
        if (!(cp = this.profileManager.getCurrent())) {
            return null;
        }
        let prof = this.profileManager.getProfile(cp).layout;
        return prof;
    }

    public profileConnected() {
        this.unload();
        this.load();
    }

    public profileDisconnected() {
        this.unload();
    }

    static emptyLayout():LayoutDefinition  {
        const ret = {
            "version": LayoutVersion,
            "customized": false,
            "panes": [
              {
                "position": 6,
                "id": "row-bottom-right",
                "background": "rgb(21 106 167 / 77%);"
              }
            ],
            "items": [
              {
                "id": "tap_ui",
                "w": 150,
                "h": 150,
                "paneId": "row-bottom-right",
                "type": 1,
                "css": "margin:0;border:0;padding:0;position:absolute;top:-150px;right:0;background-image:url(css/images/clickUI-small.png) !important;opacity:0.7;",
                "stack": 0,
                "content": "",
                "visible": "ClickControls"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 5,
                "y": 5,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "attack",
                "tooltip": "Assisti gruppo o attacca il primo mob"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 55,
                "y": 5,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "nord"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 105,
                "y": 5,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "up"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 5,
                "y": 55,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "west"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 55,
                "y": 55,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "stoporfleeorlook",
                "tooltip": "Stoppa o flea, o se fuori combat guarda"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 105,
                "y": 55,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "est"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 5,
                "y": 105,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "casta",
                "tooltip": "Cura o casta"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 55,
                "y": 105,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "sud"
              },
              {
                "parent": "tap_ui",
                "background": "transparent",
                "w": 40,
                "h": 40,
                "x": 105,
                "y": 105,
                "paneId": "row-bottom-right",
                "type": 0,
                "css": "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
                "stack": 0,
                "content": "",
                "commands": "down"
              }
            ]
          };
        return ret;
    }

    public load() {
        if (!this.profileManager) return
        let cp:string;
        cp = this.profileManager.getCurrent();

        this.unload();
        
        if (!cp) {
            this.loadLayout(LayoutManager.emptyLayout());
            return;
        }

        let prof = this.profileManager.getProfile(cp);
        if (prof && prof.useLayout && prof.layout) {
             this.loadLayout(prof.layout);
             if (this.askingUser != prof) this.checkNewerLayoutExists(prof);
        } else if (prof && !prof.useLayout) {
            this.loadLayout(LayoutManager.emptyLayout());
        }

        this.triggerChanged();
    }

    redockWindowsWithAnchor() {
        if (this.profileManager) {
            let wm = this.profileManager.windowManager
            let docks = this.findDockingPositions(null)
            for (const dk of docks) {
                const w = wm.windows.get(dk.content)
                if (w && w.data) {
                    w.data.docked = true
                    w.data.collapsed = false
                }
            }
        }
    }

    async checkNewerLayoutExists(prof: Profile) {
        if (!prof || !prof.layout || !this.onlineBaseLayout) return;

        this.askingUser = prof
        const skipped = this.scripting.getScriptThis()["skipLayoutVersion"];

        if ((prof.layout.version||0) < this.onlineBaseLayout.version && (!skipped || skipped < this.onlineBaseLayout.version)) {
            if (prof.layout.customized) {
                const r = await Messagebox.Question(`Questo personaggio sta usando una predisposizione schermo propria\n
creata quando esisteva una versione precedente di quello preimpostato.\n
Scegli No per continuare a usare la corrente.\n
Se invece vuoi aggiornare su quella nuova scegli Si\n\n
N.b. Se scegli Si perderai tutte le proprie modifiche al layout.`);
                if (r.button == Button.Ok) {
                    this.updateLayout(prof, this.onlineBaseLayout)
                    setTimeout(() => {
                        this.reloadLayout()
                    }, 100)
                } else {
                    this.scripting.getScriptThis()["skipLayoutVersion"] = this.onlineBaseLayout.version;
                }
            } else {
                const r = await Messagebox.Question(`C'e' una nuova versione della predisposizione schermo.\n
Vuoi aggiornarla per questo profilo?\n
Se ora rispondi No dovrai aggiornare manualmente dalla finestra Dispisizione schermo.`);
                if (r.button == Button.Ok) {
                    this.updateLayout(prof, this.onlineBaseLayout)
                    setTimeout(() => {
                        this.reloadLayout();
                    }, 100)
                } else {
                    this.scripting.getScriptThis()["skipLayoutVersion"] = this.onlineBaseLayout.version;
                }
            }
        }
        this.askingUser = null
    }

    private async reloadLayout() {
        let ws:WindowDefinition[] = [];
        if (this.profileManager) for (const w of this.profileManager.windowManager.windows) {
            if (w[1].data.visible) {
                ws.push(w[1])
                await this.profileManager.windowManager.destroyWindow(w[0], false)
            }
        }
        this.redockWindowsWithAnchor();
        this.load();
        if (this.profileManager) for (const w of ws) {
            await this.profileManager.windowManager.show(w.data.name)
        }
    }

    public async updateLayoutOfCurrentProfile() {
        let cp:string;
        cp = this.profileManager.getCurrent();

        if (!cp) {
            Messagebox.Show("Errore", "Non e' possibile aggiornare il layout al profilo base.")
            return null;
        }

        if (!this.onlineBaseLayout) {
            Messagebox.Show("Errore", "Non c'e' un layout base.")
            return null;
        }

        let prof = this.profileManager.getProfile(cp);
        if (prof) {
            await this.updateLayout(prof, this.onlineBaseLayout)
        }
        return prof 
    }

    async updateLayout(prof: Profile, newLayout: LayoutDefinition) {
        prof.layout = newLayout;
        this.profileManager.saveProfiles(true);
    }

    public unload() {
        this.deleteLayout();
        this.release();
    }

    public release() {
        EvtScriptEvent.release(this.handleEvent);
        this.layout = null;
        this.scripts.clear();
        this.parents.clear();
        this.variableChangedMap.clear();
        this.variableStyleChangedMap.clear();
        this.controls.clear();
    }

    public exportToFile() {
        let json = JSON.stringify(this.layout, null, 2);
        let blob = new Blob([json], {type: "octet/stream"});
        let url = window.URL.createObjectURL(blob);

        let link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "layout.json");
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }

    public ImportText(text: any) {
        if (!this.profileManager.getCurrent()) {
            Messagebox.Show("Errore", "Impossibile caricare layout nel profilo base.");
            return;
        }
        let vals = typeof text == "string" ? JSON.parse(text) : text;
        this.profileManager.getProfile(this.profileManager.getCurrent()).layout = vals;
        this.profileManager.evtProfileChanged.fire({current:this.profileManager.getCurrent()});
        this.unload();
        this.layout = vals;
        this.loadLayout(this.layout);
        this.triggerChanged();
    }

    public importFromFile() {
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
                this.ImportText(text);
            };
            reader.readAsText(file);

        });

        document.body.appendChild(inp);
        inp.click();
        document.body.removeChild(inp);
    }

    loadLayout(layout: LayoutDefinition) {
        this.variableChangedMap.clear();
        this.variableStyleChangedMap.clear();
        if (!layout) return;
        EvtScriptEvent.handle(this.handleEvent);
        
        this.layout = layout;
        
        const foreColor = LayoutManager.getForecolor(layout)
        $(".content-wrapper").css("color", foreColor);
        const backColor = LayoutManager.getBackcolor(layout)
        $(".content-wrapper").css("background-color", backColor);
        const cmdBack = layout.panes.find(p => p.position == PanelPosition.PaneBottomLeft)?.background || backColor;
        $("#row-input").css("background-color", cmdBack);
        
        for (const p of layout.panes) {

            let cssObj:any = {
                background: (p.background || "transparent")
            };
            if (p.autoexpand && p.width) {
                cssObj.maxWidth = (p.width)
            } else {
                cssObj.width = (p.width || "auto")
            }
            if (p.autoexpand && p.height) {
                cssObj.maxHeight = (p.height)
            } else {
                cssObj.height = (p.height || "auto")
            }
            $("#"+p.id).css(cssObj);
        }

        if (this.layout.items?.length) {
            //this.loadFlatItems();
            populateItemsInPanes(this.layout)
        }

        this.loadHierarchical();
    }

    static getForecolor(layout: LayoutDefinition) {
        const isDarkTheme = $("body").hasClass("dark")
        return layout.color || isDarkTheme ? "#C5BFB1" : "#C5BFB1";
    }

    static getBackcolor(layout: LayoutDefinition) {
        const isDarkTheme = $("body").hasClass("dark")
        return layout.background || isDarkTheme ? "#203C20" : "#156AA7"
    }

    createHierarchicalControl(indexer:{index:number}, c:Control, parent:Control, parentControl:JQuery):JQuery {
        let control: JQuery;
        this.controls.set(c, null);
        if (c.type == ControlType.Button) {
            control = this.createButton(c);
            if (c.id)
                this.parents.set(c.id, control);
        }
        else if (c.type == ControlType.DropDownButton) {
            control = this.createDropDownButton(c);
            if (c.id)
                this.parents.set(c.id, control);
        }
        else if (c.type == ControlType.Window) {
            control = this.createWindow(c);
            if (c.id)
                this.parents.set(c.id, control);
        }
        else {
            control = this.createPanel(c);
            if (c.id)
                this.parents.set(c.id, control);
        }

        if (c.tooltip) {
            control.attr("title", c.tooltip);
        }
        this.controls.set(c, control);

        if (parent && parentControl) {
            $(".ui-control-content", parentControl).first().append(control);
        }

        if (c.checkbox) {
            for (const v of c.checkbox.split(",")) {
                let variables = this.parseVariables(v);
                for (let variable of variables) {
                    variable = this.getVariableName(v)
                    if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                    if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                        this.variableStyleChangedMap.get(variable).push(c);
                }
            }
            this.checkCheckbox(c);
        }

        if (c.gauge) {
            for (const v of c.gauge.split(",").map(v => this.getVariableName(v))) {
                if (!this.variableStyleChangedMap.has(v)) this.variableStyleChangedMap.set(v, []);
                if (this.variableStyleChangedMap.get(v).indexOf(c)==-1)
                    this.variableStyleChangedMap.get(v).push(c);
            }
            this.checkGauge(c);
        }

        if (c.visible) {
            for (const v of c.visible.split(",")) {
                let variables = this.parseVariables(v);
                for (let variable of variables) {
                    variable = this.getVariableName(v)
                    if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                    if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                        this.variableStyleChangedMap.get(variable).push(c);
                }
            }
            this.checkVisible(c);
        }

        if (c.blink) {
            for (const v of c.blink.split(",")) {
                let variables = this.parseVariables(v);
                for (let variable of variables) {
                    variable = this.getVariableName(v)
                    if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                    if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                        this.variableStyleChangedMap.get(variable).push(c);
                }
            }
            this.checkBlink(c);
        }

        indexer.index++

        for (const ci of (c.items||[])) {
            this.createHierarchicalControl(indexer, ci, c, control)
        }
        return control
    }

    loadHierarchical() {
        let indexer = {index: 0}
        for (const pane of this.layout.panes) {
            for (const c of (pane.items || [])) {
                let instance = this.createHierarchicalControl(indexer, c, null, null)
                $("#" + pane.id).append(instance);
            }
        }
    }

    private loadFlatItems() {
        let index = 0;
        for (const c of this.layout.items) {
            let control: JQuery;
            this.controls.set(c, null);
            if (c.type == ControlType.Button) {
                control = this.createButton(c);
                if (c.id)
                    this.parents.set(c.id, control);
            }
            else if (c.type == ControlType.DropDownButton) {
                control = this.createDropDownButton(c);
                if (c.id)
                    this.parents.set(c.id, control);
            }
            else if (c.type == ControlType.Panel) {
                control = this.createPanel(c);
                if (c.id)
                    this.parents.set(c.id, control);
            }
            else if (c.type == ControlType.Window) {
                control = this.createWindow(c);
                if (c.id)
                    this.parents.set(c.id, control);
            }

            if (c.tooltip) {
                control.attr("title", c.tooltip);
            }
            this.controls.set(c, control);
            if (c.parent && this.parents.has(c.parent)) {
                $($(".ui-control-content", this.parents.get(c.parent))[0]).append(control);
            } else { $("#" + c.paneId).append(control); }

            if (c.checkbox) {
                for (const v of c.checkbox.split(",")) {
                    let variables = this.parseVariables(v);
                    for (let variable of variables) {
                        variable = this.getVariableName(v)
                        if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                        if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                            this.variableStyleChangedMap.get(variable).push(c);
                    }
                }
                this.checkCheckbox(c);
            }

            if (c.gauge) {
                for (const v of c.gauge.split(",").map(v => this.getVariableName(v))) {
                    if (!this.variableStyleChangedMap.has(v)) this.variableStyleChangedMap.set(v, []);
                    if (this.variableStyleChangedMap.get(v).indexOf(c)==-1)
                        this.variableStyleChangedMap.get(v).push(c);
                }
                this.checkGauge(c);
            }

            if (c.visible) {
                for (const v of c.visible.split(",")) {
                    let variables = this.parseVariables(v);
                    for (let variable of variables) {
                        variable = this.getVariableName(v)
                        if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                        if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                            this.variableStyleChangedMap.get(variable).push(c);
                    }
                }
                this.checkVisible(c);
            }

            if (c.blink) {
                for (const v of c.blink.split(",")) {
                    let variables = this.parseVariables(v);
                    for (let variable of variables) {
                        variable = this.getVariableName(v)
                        if (!this.variableStyleChangedMap.has(variable)) this.variableStyleChangedMap.set(variable, []);
                        if (this.variableStyleChangedMap.get(variable).indexOf(c)==-1)
                            this.variableStyleChangedMap.get(variable).push(c);
                    }
                }
                this.checkBlink(c);
            }

            index++;
        }
    }

    parseVariables(v: string):string[] {
        let ret = v.split(/!|==|!=|<=|>=|<|>|\/|\*|\+|-/);
        ret = ret.filter(v => v.length && !isNumeric(v) && isAlphaNumeric(v));
        return ret;
    }

    checkGauge(c: Control) {
        let ui = this.controls.get(c);
        let color = c.color || "red";
        let sthis = this.getScriptThis();
        let vars = c.gauge.split(",");
        vars = vars.map(v => this.evalExpression(v, sthis))
        const max = parseInt(vars[1]);
        const val = parseInt(vars[0]);
        let percent = Math.ceil((val/max)*100);
        percent = Math.max(0, Math.min(100, percent))
        ui.css({
            "background-image": `linear-gradient(90deg, ${color} 0 ${percent}%, transparent ${percent}% 100%)`
        });
    }

    checkVisible(c: Control) {
        this.checkExpression(c, c.visible, (ui, passed) => {
            if (c.type == ControlType.Window) {
                this.toggleDockedWindow(c.content, passed)
            } else {
                if (passed) {
                    ui.css({
                        "display": "block"
                    });
                } else {
                    ui.css({
                        "display": "none"
                    });
                }
            }
        });
    }
    toggleDockedWindow(name: string, visible: boolean) {
        let wm = this.profileManager?.windowManager
        if (!wm) return

        let w = wm.windows.get(name) || (visible ? wm.createWindow(name) : null)
        if (!w || !w.window || !w.data.docked || !w.data.visible) return

        wm.toggleWinVisibility(visible, w.window)
    }

    getValue(obj:any, path:string) {

        const pathParts = path.split(/\.|(\[[^\]]+\])/).filter(Boolean);
    
        return pathParts.reduce((acc:Object, part:string) => {
            const isFunctionCall = part.endsWith(")") && part.lastIndexOf("(")>0
            if (part.startsWith('[') && part.endsWith(']')) {
                part = part.slice(1, -1);
    
                if (part.startsWith('"') && part.endsWith('"') ||
                    part.startsWith("'") && part.endsWith("'")) {
                    part = part.slice(1, -1);
                } else {
                    part = this.getValue(obj, part);
                }
            }
    
            let param = ""
            if (isFunctionCall) {
                param = part.substring(part.lastIndexOf("(")+1, part.length-1)
                part = part.substring(0, part.lastIndexOf("("))
            }
            if (acc && (acc.hasOwnProperty(part) || isNumeric(part))) {
                let ret = (acc as any)[part];
                if (ret && isFunctionCall) {
                    ret = ret(param)
                }
                return ret
            }
            return undefined;
        }, obj);
    }
    
    getSubExpression(sthis:any, varExpression:string):any {
        const parts = varExpression.split(/\.|\[/g);
        let val = sthis[parts[0]];
        if (val == undefined) return val;

        if (parts.length>1) {
            val = this.getValue(sthis, varExpression)
        } else if (typeof val == "function") {
            val = val()
        }
        return val;
    }

    getVariableName(varExpression:string):any {
        const parts = varExpression.split(/\.|\[/g);
        return parts[0].replace("()","");
    }

    checkExpression(c:Control, expression:string, func:(ui:JQuery, result:boolean)=>void) {
        if (!c || !expression) return;
        let ui = this.controls.get(c);
        let sthis = this.getScriptThis();
        const tmpExp = expression.split(",");
        const vars = tmpExp.map(v => {
            let r = v
            if (r[0] == "!") {
                r = r.slice(1)
            }
            return r
        });
        const isNegated = tmpExp.map(v => v.startsWith("!"));

        let allTrue = true;
        let i = 0;
        for (const v of vars) {
            const res = this.evalExpression(v, sthis);
            allTrue = allTrue && isNegated[i] ? !!!res : !!res;
            if (!allTrue) break;
            i++;
        }
        func(ui, allTrue);
    }

    private evalExpression(v: string, sthis: any) {
        let vr = this.parseVariables(v);
        let expr = v;
        vr.forEach(vrb => {
            let value = this.getSubExpression(sthis, vrb);
            value = (value ?? "")
            if (typeof value == "string" &&
                (!value.startsWith('"') || !!value.startsWith('"')) &&
                (!value.endsWith("'") || !!value.endsWith("'"))) {
                value = '"' + value + '"'
            }
            expr = expr.replace(vrb, value);
        });
        try {
            const res = eval(expr);
            return res;
        } catch {
            return ""
        }
    }

    checkBlink(c: Control) {
        this.checkExpression(c, c.blink, (ui, passed) => {
            if (passed) {
                ui.addClass("blink");
            } else {
                ui.removeClass("blink");
            }
        });
    }

    checkCheckbox(c: Control) {
        this.checkExpression(c, c.checkbox, (ui, passed) => {
            if (passed) {
                ui.addClass("toggled");
            } else {
                ui.removeClass("toggled");
            }
        });
    }

    deleteLayout() {
        for (const p of this.defaultPanes) {
            $("#"+p.id).empty();
            $("#"+p.id).attr("style","");
            $("#"+p.id).attr("class","");
        }
    }

    public createWindow(ctrl:Control):JQuery 
    {
        if (this.profileManager)
            return $(`<div id="window-dock-${ctrl.content.replace(/ /g,"-")}" style="display:none;"></div>`)
        else 
            return $(`<div id="window-dock-${ctrl.content.replace(/ /g,"-")}" style="background-color:black;color:white;border: 1px solid white;">Ancora per '${ctrl.content}'</div>`)
    }

    public createButton(ctrl:Control):JQuery {
        let style = "";
        let cls = "";
        if (ctrl.style) {
            switch (ctrl.style) {
                case "blue":
                    cls += "bluebutton ";                    
                    break;
                case "red":
                    cls += "redbutton ";
                    break;
                case "green":
                    cls += "greenbutton ";
                    break;
                case "yellow":
                    cls += "yellowbutton ";
                    break;
                case "":
                    break;
                default:
                    EvtScriptEmitPrint.fire({owner:"Layout", message: "Bottone con stile invalido: " + ctrl.content})
                    break;
            }
        }
        if (ctrl.color) {
            style+= "color:"+ctrl.color+";";
        }
        if (ctrl.background) {
            style+= "background-color:"+ctrl.background+";";
        }
        if (ctrl.x) {
            style+= "left:"+ctrl.x+"px !important;";
        }
        if (ctrl.y) {
            style+= "top:"+ctrl.y+"px !important;";
        }
        if (ctrl.w) {
            if (ctrl.w != 160) {
                // hack todo
                style+= "width:"+ctrl.w+"px !important;";
            }
        }
        if (ctrl.h) {
            style+= "height:"+ctrl.h+"px !important;";
        }
        if (ctrl.position) {
            style+= "position:"+(ctrl.position == Position.Absolute ? "absolute":"relative")+" !important;";
            if (ctrl.position == Position.Fill) {
                style+= "flex: 1;";
            }
        }

        if ((ctrl.stack == Direction.None) || !ctrl.stack) {
            style+= "clear:both !important;";
        }

        switch (ctrl.stack) {
            case Direction.Right:
                style+= "text-align:right !important;";
                break;
            case Direction.Left:
                style+= "text-align:left !important;";
                break;
            default:
                style+= "text-align:center !important;";
        }

        if (ctrl.css) {
            style+= ctrl.css + ";";
        }

        const btn = `<button tabindex="-1" style="${style}" class="${cls}"><div class="ui-control-content" style="white-space: pre;">${this.createContent(ctrl,true)}</div></button>`;
        const b = $(btn);
        if (ctrl.commands) {
            const index = [...this.controls.keys()].indexOf(ctrl);
            if (ctrl.is_script) {
                let cmd = parseScriptVariableAndParameters(ctrl.commands, {} as any);
                let scr = this.scripting.makeScript("button "+index, cmd, "");
                this.scripts.set(index, scr);
                b.click(()=>{
                    this.scripts.get(index)();
                });
            } else {
                b.click(()=>{
                    let cmd = parseScriptVariableAndParameters(ctrl.commands, {} as any, true, this.scripting);
                    this.cmdInput.sendCmd(cmd,true, false);
                });
            }
        }
        return b;
    }

    public createDropDownButton(ctrl:Control):JQuery {
        let style = "";
        let cls = "";
        if (ctrl.style) {
            switch (ctrl.style) {
                case "blue":
                    cls += "bluebutton ";                    
                    break;
                case "red":
                    cls += "redbutton ";
                    break;
                case "green":
                    cls += "greenbutton ";
                    break;
                case "yellow":
                    cls += "yellowbutton ";
                    break;
                case "":
                    break;
                default:
                    EvtScriptEmitPrint.fire({owner:"Layout", message: "Bottone con stile invalido: " + ctrl.content})
                    break;
            }
        }
        if (ctrl.color) {
            style+= "color:"+ctrl.color+";";
        }
        if (ctrl.background) {
            style+= "background-color:"+ctrl.background+";";
        }
        if (ctrl.x) {
            style+= "left:"+ctrl.x+"px !important;";
        }
        if (ctrl.y) {
            style+= "top:"+ctrl.y+"px !important;";
        }
        if (ctrl.w) {
            if (ctrl.w != 160) {
                // hack todo
                style+= "width:"+ctrl.w+"px !important;";
            }
        }
        if (ctrl.h) {
            style+= "height:"+ctrl.h+"px !important;";
        }
        if (ctrl.position) {
            style+= "position:"+(ctrl.position == Position.Absolute ? "absolute":"relative")+" !important;";
            if (ctrl.position == Position.Fill) {
                style+= "flex: 1;";
            }
        }

        if ((ctrl.stack == Direction.None) || !ctrl.stack) {
            style+= "clear:both !important;";
        }

        switch (ctrl.stack) {
            case Direction.Right:
                style+= "text-align:right !important;";
            case Direction.Left:
                style+= "text-align:left !important;";
            default:
                style+= "text-align:center !important;";
        }

        if (ctrl.css) {
            style+= ctrl.css + ";";
        }

        const btn = `<button tabindex="-1" style="${style}" class="${cls}"><div class="ui-control-content" style="white-space: pre;">${this.createContent(ctrl,true)}</div></button>`;
        const b = $(btn);
        
        if (ctrl.commands) {
            let layout = this.layout || {} as any
            b.click((e)=>{
                let controlCommands:string[] = [];
                let controlCommandsValues:string[]  = [];

                if (ctrl.is_script) {
                    const realName = this.getVariableName(ctrl.commands);
                    if (!this.variableChangedMap.has(realName)) this.variableChangedMap.set(realName, []);
                    if (this.variableChangedMap.get(realName).indexOf(ctrl)==-1)
                        this.variableChangedMap.get(realName).push(ctrl);
    
                    const optionsVar = ctrl.commands
                    if (!optionsVar) {
                        EvtScriptEmitPrint.fire({owner:"Layout", message: "Bottone multiopzione script manca la variabile per le opzioni in commands: " + ctrl.content})
                    }
                    const cOptVar = this.scripting.getVariableValue(optionsVar)
                    if (cOptVar) {
                        if (typeof cOptVar == "object" && cOptVar.constructor === Array) {
                            for (const iterator of cOptVar) {
                                controlCommands.push(iterator.toString())
                                controlCommandsValues.push(iterator.toString())
                            }
                        } else if (typeof cOptVar == "object" && cOptVar.constructor != Array) {
                            for (const key in cOptVar) {
                                if (Object.prototype.hasOwnProperty.call(cOptVar, key)) {
                                    const element = cOptVar[key];
                                    controlCommands.push(key.toString())
                                    controlCommandsValues.push(element.toString())
                                }
                            }
                        } else if (typeof cOptVar != "string" && Symbol.iterator in Object(cOptVar)) {
                            for (const it of cOptVar) {
                                controlCommands.push(it.toString())
                                controlCommandsValues.push(it.toString())
                            }
                        } else {
                            controlCommands.push(ctrl.commands)
                            controlCommandsValues.push(cOptVar.toString())
                        }
                    } else {
                        controlCommands.push(ctrl.commands)
                        controlCommandsValues.push("???")
                    }
                } else {
                    controlCommands = ctrl.commands.split("|")
                    controlCommandsValues = ctrl.commands.split("|")
                }

                if (!controlCommands.length) {
                    EvtScriptEmitPrint.fire({owner:"Layout", message: "Bottone multiopzione senza valori da mostrare: " + ctrl.content})
                }

                const cmdIndex = [...this.controls.keys()].indexOf(ctrl);
                var offset = b.offset();
                var posY = offset.top - $(window).scrollTop();
                var posX = offset.left - $(window).scrollLeft();
                
                let btnCnt = 0;
                let cmds = controlCommands;
                let cmdsval = controlCommandsValues;

                let col = ctrl.color ? ctrl.color : layout.color ? layout.color : "white"
                let bckc = ctrl.background ? ctrl.background : layout.background ? layout.background : "#00000077";
                
                let dropdownStyle = ""
                if (ctrl.color) {
                    dropdownStyle+= "color:"+ctrl.color+";";
                }
                if (ctrl.background) {
                    dropdownStyle+= "background-color:"+ctrl.background+";";
                }

                let cmdBtns = cmds.map(v => {
                    return `<button id="ctrl-${cmdIndex}-btn${btnCnt++}" style="display:block;width:100%;${dropdownStyle}"><div class="ui-control-content"><span>&nbsp;${v}&nbsp;</span></div></button>`;
                })
                let popup = $(`<div tabindex='0' class="ui-control-content" style='${ctrl.css};padding:1px;border-radius: 3px;box-shadow: 0 0 3px #00000077;z-index:1999;background-color:${bckc};color:${col};display:none;white-space:normal;'>${cmdBtns.join("\n")}</div>`);
                popup.on("blur", (ev) => {
                    if ((ev.originalEvent as FocusEvent).relatedTarget && popup.find((ev.originalEvent as FocusEvent).relatedTarget as Element).length) {
                        return;
                    }
                    setTimeout(() => popup.remove(), 100);
                })
                for (let I = 0; I < btnCnt; I++) {
                    let index = I;
                    $(`#ctrl-${cmdIndex}-btn${I}`, popup).click(() => {
                        let cmd = parseScriptVariableAndParameters(cmdsval[index], {} as any, true, this.scripting);
                        this.cmdInput.sendCmd(cmd,true, false);
                        popup.remove()
                    })
                }
                popup.insertAfter(b);
                popup.css("position", "fixed");
                popup.css("min-width", b.width()+"px");
                popup.show(0, () => {
                    if (posX < 2) posX = 2;
                    if (posY < 2) posY = 2;

                    let top = posY;
                    let left = posX;

                    let h = popup.height();
                    let w = popup.width();

                    if (posX + w > window.visualViewport.width) {
                        left = posX - w
                    }

                    if (posY + h + b.outerHeight() > window.visualViewport.height) {
                        top = posY - h
                    } else {
                        top += b.outerHeight()
                    }

                    var o = {
                        left: left,
                        top: top
                    };

                    popup.offset(o);
                    popup.focus();
                });
            });
        }
        return b;
    }

    public createPanel(ctrl:Control):JQuery {
        let containerStyle = "";
        let style = "";
        let cls = "";
        if (ctrl.style) {
            switch (ctrl.style) {
                case "blue":
                    cls += "bluepanel ";                    
                    break;
                case "red":
                    cls += "redpanel ";
                    break;
                case "green":
                    cls += "greenpanel ";
                    break;
                case "yellow":
                    cls += "yellowpanel ";
                    break;
                case "":
                    break;
                default:
                    EvtScriptEmitPrint.fire({owner:"Layout", message: "Pannello con stile invalido: " + ctrl.content})
                    break;
            }
        }
        if (ctrl.color) {
            style+= "color:"+ctrl.color+" !important;";
        }
        if (ctrl.background) {
            style+= "background-color:"+ctrl.background+" !important;";
        }
        if (ctrl.x) {
            style+= "left:"+ctrl.x+"px !important;";
        }
        if (ctrl.y) {
            style+= "top:"+ctrl.y+"px !important;";
        }
        if (ctrl.w) {
            style+= "width:"+ctrl.w+"px !important;";
        }
        if (ctrl.h) {
            style+= "height:"+ctrl.h+"px !important;";
        }
        if (ctrl.position) {
            style+= "position:"+(ctrl.position == Position.Absolute ? "absolute":"relative")+" !important;";
            if (ctrl.position == Position.Fill) {
                style+= "flex: 1;";
                containerStyle+= "width: 100%;height: 100%;";
            }
        }
        
        let align = "text-align:center;"
            
        if (ctrl.stack != Direction.None && ctrl.stack) {
            containerStyle += "font-family:inherit;"
            containerStyle += "font-size:inherit;"
            containerStyle += "font-weight:inherit;"
            containerStyle += "color:inherit;"

            containerStyle+= "display:flex !important;";
            if (ctrl.stack == Direction.Left) {
                containerStyle+= "flex-direction: row;";
                align = "text-align:left;"
            }
            else if (ctrl.stack == Direction.Right) {
                containerStyle+= "flex-direction: row-reverse;";
                align = "text-align:right;"
            }
            else if (ctrl.stack == Direction.Top) {
                containerStyle+= "flex-direction: column;";
            }
            else if (ctrl.stack == Direction.Down) {
                containerStyle+= "flex-direction: column-reverse;";
            }
        }

        style += align;

        if (ctrl.stack == Direction.None) {
            style+= "clear:both !important;";
        } else if (ctrl.stack && ctrl.stack <= Direction.Right) {
            style+=(ctrl.stack == Direction.Left ? "float:left !important;" :"float:right !important;");
        }

        if (ctrl.css) {
            style+= ctrl.css +";";
        }

        if (ctrl.commands) {
            style += "cursor:pointer;"
        }

        const btn = `<div tabindex="-1" style="${style}" class="${cls}"><div class="ui-control-content" style="white-space: pre;${containerStyle}">${this.createContent(ctrl,true)}</div></div>`;
        const b = $(btn);
        if (ctrl.commands) {
            const index = [...this.controls.keys()].indexOf(ctrl);
            if (ctrl.is_script) {
                let cmd = parseScriptVariableAndParameters(ctrl.commands, {} as any);
                let scr = this.scripting.makeScript("panel "+index, cmd, "");
                this.scripts.set(index, scr);
                b.click(()=>{
                    this.scripts.get(index)();
                });
            } else {
                b.click(()=>{
                    let cmd = parseScriptVariableAndParameters(ctrl.commands, {} as any, true, this.scripting);
                    this.cmdInput.sendCmd(cmd,true, false);
                });
            }
        }
        return b;
    }

    createContent(ctrl: Control, parseVariable:boolean) {
        let content = ctrl.content || "";
        content=rawToHtml(content);
        let sthis = this.getScriptThis();
        if (content.indexOf("%color(")!=-1) {
            content = content.replace(/\%color\([^\)]+?\)/gi,(s,a)=>{
                let colorStr = s.substring(7, s.length-1);
                let params = colorStr.split(",");
                return colorize.apply(this, ["", ...params]);
            });
        }
        if (content.indexOf("%closecolor")!=-1) {
            content = content.replace(/\%closecolor/gi,(s,a)=>{
                return "</span>";
            });
        }
        let varPos = -1;
        while ((varPos = content.lastIndexOf("%var("))!=-1) {
            varPos+= 4;
            let openBracket = 0;
            let endPos = -1;
            for (let index = varPos; index < content.length; index++) {
                if (content[index]=="(") openBracket++;
                if (content[index]==")") openBracket--;
                if (openBracket == 0) {
                    endPos = index;
                    break;
                }
            }
            let replaceWith = (s:string)=>{
                let params = s.split(",");
                let variable=params[0];
                let compare = null;
                let compareOP = (v1:any,v2:any)=>v1==v2;
                if (variable.indexOf("==")!=-1) {
                    compare = variable.split("==")[1];
                    variable = variable.split("==")[0];
                }
                if (variable.indexOf("!=")!=-1) {
                    compare = variable.split("!=")[1];
                    variable = variable.split("!=")[0];
                    compareOP = (v1:any,v2:any)=>v1!=v2;
                }
                if (variable.indexOf("&lt;=")!=-1) {
                    compare = variable.split("&lt;=")[1];
                    variable = variable.split("&lt;=")[0];
                    compareOP = (v1:any,v2:any)=>parseFloat(v1)<=parseFloat(v2);
                }
                if (variable.indexOf("&gt;=")!=-1) {
                    compare = variable.split("&gt;=")[1];
                    variable = variable.split("&gt;=")[0];
                    compareOP = (v1:any,v2:any)=>parseFloat(v1)>=parseFloat(v2);
                }
                if (variable.indexOf("&lt;")!=-1) {
                    compare = variable.split("&lt;")[1];
                    variable = variable.split("&lt;")[0];
                    compareOP = (v1:any,v2:any)=>parseFloat(v1)<parseFloat(v2);
                }
                if (variable.indexOf("&gt;")!=-1) {
                    compare = variable.split("&gt;")[1];
                    variable = variable.split("&gt;")[0];
                    compareOP = (v1:any,v2:any)=>parseFloat(v1)>parseFloat(v2);
                }
                if (isNumeric(compare)) {
                    compare = Number(compare);
                }
                variable=variable.trim()
                let val = this.evalExpression(variable, sthis); // this.getSubExpression(sthis, variable);
                if (parseVariable) {
                    let vars = this.parseVariables(variable)
                    for (const variable of vars) {
                        const realName = this.getVariableName(variable);
                        if (!this.variableChangedMap.has(realName)) this.variableChangedMap.set(realName, []);
                        if (this.variableChangedMap.get(realName).indexOf(ctrl)==-1)
                            this.variableChangedMap.get(realName).push(ctrl);
                    }
                }
                if (params.length>2) {
                    if (compare) {
                        return ((compareOP(val,compare)) ? params[1] : params[2]);
                    } else {
                        return (val) ? params[1] : params[2];
                    }
                } else if (params.length==2) {
                    return (val==undefined?"-":val).toString().substring(0,parseInt(params[1])).padStart(parseInt(params[1]), ' ');
                } else {
                    return (compare ? (compareOP(val,compare)) : val);
                }
            };
            let replacement = content.substring(varPos+1, endPos);
            if (endPos>-1 && endPos!=varPos) {
                replacement = replaceWith(content.substring(varPos+1, endPos))
            } else {
                EvtScriptEmitPrint.fire({owner:"Layout", message:"Invalid variable in template of Control: " + ctrl.content})
                break;
            }
            replacement = replacement ?? "?"
            content = content.substring(0,varPos-4) + replacement + content.substring(endPos+1);
        }
        return content;
    }

    private getScriptThis() {
        let sthis = Object.assign({}, this.scripting.getScriptThis());
        sthis = Object.assign(sthis, {api: API.functions ?? {}});
        sthis = Object.assign(sthis, {custom: API.private ?? {}});
        return sthis;
    }

    public async loadBaseLayout(prof:Profile) {
        var ly = await $.ajax("./baseLayout.json?rnd="+Math.random());
        if (ly) {
            prof.layout = ly;
            return;
        }
        this.createLayout(prof);
        prof.layout.color = "#bbbbbb"
        for (const p of prof.layout.panes) {
            p.background = "rgb(21 106 167 / 77%);";
        }
        prof.layout.items.push({
            paneId: "column-right-top",
            type: ControlType.Window,
            position: Position.Relative,
            content: "Social",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-right-bottom",
            type: ControlType.Window,
            position: Position.Relative,
            content: "Mapper",
            is_script: true
        });
        prof.layout.items.push({
            id: "btnrow1",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "btnrow2",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "btnrow3",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "btnrow4",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "btnrow5",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "btnrow6",
            paneId: "column-left-top",
            type: ControlType.Panel,
            css: "margin:0;display:flex;flex-direction:column;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow6",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoKill%color(black)%var(autokill,%color(white) ON,%color(black) OFF)`,
            commands: "autokill",
            checkbox: "autokill",
            tooltip: "Uccidi a vista",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow6",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `SelfSanc%color(black)%var(selfsanc,%color(white) ON,%color(black) OFF)`,
            commands: "selfsanc",
            checkbox: "selfsanc",
            tooltip: "Tieni sancato se stesso",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow6",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `SelfShield%color(black)%var(selfshield,%color(white) ON,%color(black) OFF)`,
            commands: "selfshield",
            checkbox: "selfshield",
            tooltip: "Tieniti scudato",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow4",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoGroup%color(black)%var(autogroup,%color(white) ON,%color(black) OFF)`,
            commands: "autogroup",
            checkbox: "autogroup",
            tooltip: "Nel momento quando qualcuno inizia a seguirti lo grupperai automaticamente",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow4",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoOrder%color(black)%var(autoorder,%color(white) ON,%color(black) OFF)`,
            commands: "autoorder",
            checkbox: "autoorder",
            tooltip: "Appena entri in gruppo il client ascoltera' gli ordini del capogruppo",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow4",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoFollow%color(black)%var(autofollow,%color(white) ON,%color(black) OFF)`,
            commands: "autofollow",
            checkbox: "autofollow",
            tooltip: "Segue in stagni e portali automaticamente",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow5",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoLoot%color(black)%var(autoloot,%color(white) ON,%color(black) OFF)`,
            commands: "autoloot",
            checkbox: "autoloot",
            tooltip: "Raccoglie soldi e altro automaticamente dai corpi morti",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow5",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `Antispalm%color(black)%var(antispalm,%color(white) ON,%color(black) OFF)`,
            commands: "antispalm",
            checkbox: "antispalm",
            tooltip: "Cambia scudi automaticamente se vede che si sta spalmando su uno scudo elementale (o ci sono draghi vicino)",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow5",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoArmi%color(black)%var(autoarmi,%color(white) ON,%color(black) OFF)`,
            commands: "autoarmi",
            checkbox: "autoarmi",
            tooltip: "Cambia le armi automaticamente se vede che non colpiscono",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow1",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `Autoassist%color(black)%var(autoassist,%color(white) ON,%color(black) OFF)`,
            commands: "autoassist",
            checkbox: "autoassist",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow1",
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            type: ControlType.Button,
            content: `AutoStop%color(black)%var(autostop,%color(white) ON,%color(black) OFF)`,
            commands: "autostop",
            checkbox: "autostop",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow2",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoBash%color(black)%var(autobash,%color(white) ON,%color(black) OFF)`,
            commands: "autobash",
            checkbox: "autobash",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow2",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoStab%color(black)%var(autostab,%color(white) ON,%color(black) OFF)`,
            commands: "autostab",
            checkbox: "autostab",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow2",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoFury%color(black)%var(autofury,%color(white) ON,%color(black) OFF)`,
            commands: "autofury",
            checkbox: "autofury",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow1",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoRescue%color(black)%var(autorescue,%color(white) ON,%color(black) OFF)`,
            commands: "autorescue",
            checkbox: "autorescue",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow3",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoCast%color(black)%var(autocast,%color(white) ON,%color(black) OFF)`,
            commands: "autocast",
            checkbox: "autocast",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow3",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoCleric%color(black)%var(autocleric,%color(white) %var(aclMinimum)%,%color(black) OFF)`,
            commands: "autocleric",
            checkbox: "autocleric",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            parent: "btnrow3",
            type: ControlType.Button,
            style:"",
            css:"flex:1;white-space:pre;margin:2px;",
            content: `AutoSanc%color(black)%var(autosanc,%color(white) ON,%color(black) OFF)`,
            commands: "autosanc",
            checkbox: "autosanc",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-top",
            type: ControlType.Panel,
            style:"",
            content: `%color(lightgray) Divini:%closecolor %color(yellow)%var(TSSigDivini,5)%closecolor  PQ/h:  %color(white) %var(_stat_pqh,4)%closecolor   MXP/h:%color(white)  %var(_stat_xph,6)%closecolor
%color(lightgray) Aria:  %closecolor %color(white)%var(TSSigAria,5)%closecolor  5 min: %color(yellow) %var(_stat_pq5m,4)%closecolor   5 min:%color(green)  %var(_stat_xp5m,6)%closecolor
%color(lightgray) Acqua: %closecolor %color(lightblue)%var(TSSigAcqua,5)%closecolor  15 min:%color(yellow) %var(_stat_pq15m,4)%closecolor   15 min:%color(green) %var(_stat_xp15m,6)%closecolor
%color(lightgray) Terra: %closecolor %color(brown)%var(TSSigTerra,5)%closecolor  1 ora: %color(yellow) %var(_stat_pq1h,4)%closecolor   1 ora:%color(green)  %var(_stat_xp1h,6)%closecolor
%color(lightgray) Fuoco: %closecolor %color(red)%var(TSSigFuoco,5)%closecolor  Sess.: %color(yellow) %var(_stat_pqsess,4)%closecolor   Sess.:%color(green)  %var(_stat_xpsess,6)%closecolor
%color(yellow) Gold:%closecolor %color(yellow)%var(TSGoldK,7)%closecolor  %color(orange)Bank:%closecolor%color(orange)%var(TSBankK,7)%closecolor`,
            css: "background-color:rgba(0,0,0,0.3);box-shadow: 0px 0px 1px 1px rgba(0,0,255,0.3);color:lightgray;",
            stack: Direction.None
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(255, 255, 255)",
            type: ControlType.Panel,
            content: `%var(TSPersonaggio) %color(white)%var(TSHp)/%var(TSMaxHp)%closecolor %var(afk,%color(black)[AFK],)`,
            css:"margin:1px;margin-left:4px;padding:1px;font-size:12px;color:lightgray !important;",
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(255, 255, 255)",
            background: "rgba(0,0,0,0.5)",
            type: ControlType.Panel,
            content: `%var(sancato,%color(white)Sancato,%color(yellow,transparent,true,true,false)NON SANCATO!)%var(scadenzaSanc,%color(yellow,transparent,true,false,true)(!),)`,
            css:"margin:1px;margin-left:3px;padding:1px;font-size:12px;color:lightgray !important;",
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(255, 255, 255)",
            background: "rgba(0,0,0,0.5)",
            type: ControlType.Panel,
            content: `%var(scudato,%color(red)Scudato,%color(yellow,transparent,true,true,false)NON Scudato!)%var(scadenzaScudo,%color(yellow,transparent,true,false,true)(!),)`,
            css:"margin:1px;margin-left:3px;padding:1px;font-size:12px;color:lightgray !important;",
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(35, 200, 35)",
            background: "red",
            type: ControlType.Button,
            content: `%color(white,transparent,true)%var(tankKey): %var(tankPercent<50,%color(yellow,transparent,true,false,true)%var(TSTankCond),%color(white,transparent,true)%var(TSTankCond))`,
            css:"text-align:center;margin:2px;margin-left:3px;padding:1px;font-size:12px;min-width:170px;",
            gauge:"tankPercent,tankMax",
            commands: "if (this.TSTank!=this.TSPersonaggio) send('assist ' + this.tankKey)",
            visible: "TSTank!='*'",
            is_script:true
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(35, 200, 35)",
            background: "black",
            type: ControlType.Button,
            content: `%color(white,transparent,true)%var(mobKey): %var(TSMobCond)`,
            css:"text-align:center;margin:2px;margin-left:3px;padding:1px;font-size:12px;min-width:170px;",
            gauge:"mobPercent,mobMax",
            commands: "send('attack ' + this.mobKey)",
            visible: "TSMob!='*'",
            is_script:true
        });
        prof.layout.items.push({
            paneId: "row-bottom-left",
            color: "rgb(185, 185, 185)",
            background: "rgba(0,0,0,0.5)",
            type: ControlType.Button,
            content: `Spell:(%var(spells))`,
            css:"text-align:center;margin:2px;margin-left:3px;padding:1px;font-size:13px;",
            commands: "attr",
        });
        prof.layout.items.push({
            paneId: "row-bottom-right",
            color: "rgb(255, 255, 255, 0.3)",
            type: ControlType.Button,
            content: `%var(TSSettore==Chiuso,%color(white)Al CHIUSO,%color(black,yellowgreen)All'APERTO)`,
            css:"margin:2px;margin-left:3px;margin-bottom: 0;margin-top: 4px;padding:1px;font-size:12px;",
            commands: `if (this.healtype=="C") { if (this.TSSettore!="Chiuso") { send("cast 'control w' worse") } } else if (this.healtype=="D") { if (this.TSSettore!="Chiuso") { send("cast 'control w' worse") } else { send("bloom") } }`,
            is_script: true
        });
        prof.layout.items.push({
            paneId: "row-bottom-right",
            background: "blue",
            type: ControlType.Button,
            content: `%var(TSPosizione!=In piedi,%color(white)Seduto,%color(yellowgreen)In piedi)`,
            css:"margin:2px;margin-left:3px;margin-bottom: 0;margin-top: 4px;padding:1px;font-size:12px;",
            commands: `if (this.TSPosizione!='In piedi') { send('stand') } else { send('sit') }`,
            is_script: true
        });
        prof.layout.items.push({
            paneId: "row-bottom-right",
            background: "blue",
            type: ControlType.Panel,
            content: `%var(TSLag==+,%color(white)Laggato,%color(yellowgreen)Reattivo)`,
            css:"margin:2px;margin-left:3px;margin-bottom: 0;margin-top: 4px;padding:3px !important;font-size:12px;",
        });
        prof.layout.items.push({
            id: "tick_and_btn",
            paneId: "column-left-bottom",
            type: ControlType.Panel,
            css: "margin:0;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "mv_and_btn",
            paneId: "column-left-bottom",
            type: ControlType.Panel,
            css: "margin:0;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "mn_and_btn",
            paneId: "column-left-bottom",
            type: ControlType.Panel,
            css: "margin:0;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            id: "hp_and_btn",
            paneId: "column-left-bottom",
            type: ControlType.Panel,
            css: "margin:0;",
            stack: Direction.Left,
            content: "",
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "yellow",
            parent: "hp_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "BLUNT",
            commands: "send('blunt')",
            checkbox: "usiBlunt",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "blue",
            parent: "tick_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "EXTRA",
            commands: "send('extra')",
            checkbox: "usiExtra",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "red",
            parent: "mn_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            position: Position.Relative,
            stack: Direction.Left,
            css:"margin:1px;padding:1px;",
            content: "SLASH",
            commands: "send('slash')",
            checkbox: "usiSlash",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "white",
            parent: "mv_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "PIERCE",
            commands: "send('pierce')",
            checkbox: "usiPierce",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "white",
            background: "#AAAAFF",
            parent: "mv_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "ImmuCOLD",
            commands: "send('immucold')",
            checkbox: "usiImmuCold",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "white",
            background: "#FF9999",
            parent: "tick_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "ImmuFIRE",
            commands: "send('immufire')",
            checkbox: "usiImmuFire",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            parent: "tick_and_btn",
            color: "rgb(221 221 221)",
            css:"margin:1px;padding:1px;font-size:11px;background-color:rgba(255,255,255,0.5) !important; color:black !important;",
            w: 180,
            h:20,
            type: ControlType.Button,
            position: Position.Fill,
            content: `Tick: %var(TickRemaining) sec.`,
            commands: "tick",
            gauge: "TickRemaining,currentTickLenght",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            parent: "mv_and_btn",
            color: "rgb(210 151 90)",
            css:"margin:1px;padding:1px;font-size:11px;background-color:rgba(255,255,255,0.5) !important; color:black !important;",
            w: 180,
            h:20,
            type: ControlType.Button,
            position: Position.Fill,
            content: `Move: %var(TSMov)/%var(TSMaxMov)`,
            commands: "feast",
            gauge: "TSMov,TSMaxMov",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "white",
            background: "#33AA33",
            parent: "hp_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "ImmuACID",
            commands: "send('immuacid')",
            checkbox: "usiImmuAcid",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            parent: "hp_and_btn",
            color: "#33AA33",
            css:"margin:1px;padding:1px;font-size:11px;background-color:rgba(255,0,0,0.5) !important; color:white !important;",
            w: 180,
            h:20,
            type: ControlType.Button,
            position: Position.Fill,
            content: `HP: %var(TSHp)/%var(TSMaxHp)`,
            commands: "heal",
            gauge: "TSHp,TSMaxHp",
            blink: "TSHp<TSMaxHp/4",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            color: "white",
            background: "#4444FF",
            parent: "mn_and_btn",
            h:20,
            w:70,
            type: ControlType.Button,
            stack: Direction.Left,
            position: Position.Relative,
            css:"margin:1px;padding:1px;",
            content: "ImmuELE",
            commands: "send('immuele')",
            checkbox: "usiImmuEle",
            is_script: true
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            parent: "mn_and_btn",
            color: "rgb(129 129 210)",
            css:"margin:1px;padding:1px;font-size:11px;background-color:rgba(0,0,255,0.5) !important; color:white !important;",
            w: 180,
            h:20,
            type: ControlType.Button,
            position: Position.Fill,
            content: `Mana: %var(TSMana)/%var(TSMaxMana)`,
            commands: "cani",
            gauge: "TSMana,TSMaxMana",
            is_script: false
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            type: ControlType.Window,
            position: Position.Relative,
            content: "Gruppo",
        });
        prof.layout.items.push({
            paneId: "column-left-bottom",
            type: ControlType.Window,
            position: Position.Relative,
            content: "Group Tell",
        });
        prof.layout.items.push({
            id: "tap_ui",
            w:150,
            h:150,
            paneId: "row-bottom-right",
            type: ControlType.Panel,
            css: "margin:0;border:0;padding:0;position:absolute;top:-150px;right:0;background-image:url(css/images/clickUI-small.png) !important;opacity:0.7;",
            stack: Direction.None,
            content: "",
            visible: "ClickControls"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:5,
            y:5,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "attack",
            tooltip: "Assisti gruppo o attacca il primo mob"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:55,
            y:5,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "nord"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:105,
            y:5,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "up"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:5,
            y:55,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "west"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:55,
            y:55,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "stoporfleeorlook",
            tooltip: "Stoppa o flea, o se fuori combat guarda"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:105,
            y:55,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "est"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:5,
            y:105,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "casta",
            tooltip: "Cura o casta"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:55,
            y:105,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "sud"
        });
        prof.layout.items.push({
            parent: "tap_ui",
            background: "transparent",
            w:40,
            h:40,
            x:105,
            y:105,
            paneId: "row-bottom-right",
            type: ControlType.Button,
            css: "position:absolute;margin:0;border:0;border:0 !important;outline:none !important;background-image:none !important;",
            stack: Direction.None,
            content: "",
            commands: "down"
        });
    }

    public createLayout(prof:Profile) {
        prof.layout = {
            "version": LayoutVersion,
            "customized": false,
            panes: [...this.defaultPanes],
            items: []
        }
    }

    public triggerChanged() {
        this.EvtEmitLayoutChanged.fire(this.layout);
    }

    public save() {
        const cp = this.profileManager.getCurrent()
        this.profileManager.saveProfiles(true);
        if (cp) {
            this.layout = this.profileManager.getProfile(cp).layout;
        }
    }

}
