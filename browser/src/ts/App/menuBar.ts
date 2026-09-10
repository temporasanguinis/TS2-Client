import { EventHook } from "../Core/event";

import { UserConfig } from "./userConfig";

import { AliasEditor } from "../Scripting/windows/aliasEditor";
import { TriggerEditor } from "../Scripting/windows/triggerEditor";
import { JsScriptWin } from "../Scripting/windows/jsScriptWin";
import { AboutWin } from "./windows/aboutWin";
import { Client, TsClient, setupWorkers } from "./client";
import { ProfilesWindow } from "./windows/profilesWindow";
import { WindowManager } from "./windowManager";
import { VariablesEditor } from "../Scripting/windows/variablesEditor";
import { ClassEditor } from "../Scripting/windows/classEditor";
import { EventsEditor } from "../Scripting/windows/eventsEditor";
import { AskReload, circleNavigate, denyClientVersion, downloadJsonToFile, downloadString, exportClassFunc, getVersionNumbers, importFromFile, importScriptsFunc, isTrue } from "../Core/util";
import { LayoutManager } from "./layoutManager";
import { EvtScriptEmitPrint, EvtScriptEvent, JsScript, ScripEventTypes, ScriptEvent, Variable } from "../Scripting/jsScript";
import { OutputWin } from "./windows/outputWin";
import { Button, Messagebox, Notification } from "./messagebox";
import { Class } from "../Scripting/classManager";
import { TrigAlItem } from "../Scripting/windows/trigAlEditBase";
import { AppInfo } from "../appInfo";
import { NumpadWin } from "./windows/numpadWin";
import { HelpWin } from "./windows/helpWindow";
import { Mapper } from "../Mapper/mapper";
import { VersionsWin } from "./windows/versionsWindow";
import { OutputLogger } from "./outputLogger";
import { LayoutWindow } from "./windows/layoutWindow";
import { VoiceWin } from "./windows/voiceWin";
import { debounce } from "lodash";

export type clientConfig = {[k:string]:any};
export let optionMappingToStorage = new Map([
    ["connect", ""],
    ["log", ""],
    ["use-profile", ""],
    ["aliases", ""],
    ["variables", ""],
    ["triggers", ""],
    ["base_triggers", ""],
    ["classes", ""],
    ["script", ""],
    ["config", ""],
    ["text-color", ""],
    ["white-on-black", "text-color"],
    ["green-on-black", "text-color"],
    ["black-on-gray", "text-color"],
    ["black-on-white", "text-color"],
    ["wrap-lines", "wrap-lines"],
    ["enable-color", "colorsEnabled"],
    ["enable-utf8", "utf8Enabled"],
    ["enable-mxp", "mxpEnabled"],
    ["enable-mxp-images", "mxpImagesEnabled"],
    ["enable-aliases", "aliasesEnabled"],
    ["enable-triggers", "triggersEnabled"],
    ["enable-sounds", "soundsEnabled"],
    ["smallest-font", "font-size"],
    ["extra-small-font", "font-size"],
    ["small-font", "font-size"],
    ["normal-font", "font-size"],
    ["large-font", "font-size"],
    ["extra-large-font", "font-size"],
    ["courier", "font"],
    ["consolas", "font"],
    ["monospace", "font"],
    ["lucida", "font"],
    ["vera", "font"],
    ["reset-settings", ""],
    ["import-settings", ""],
    ["export-settings", ""],
    ["splitScrolling", "splitScrolling"],
    ["import-layout", ""],
    ["export-layout", ""],
    ["log-time", "logTime"],
    ["prompt-style", "prompt-style"],
    ["debug-scripts", "debugScripts"],
    ["debug-variables", "debugVariables"],
    ["about", ""],
    ["docs", ""],
    ["contact", ""],
    ["profiles", ""],
    ["scrollbuffer", "maxLines"],
    ["animatescroll", "animatescroll"],
    ["copyOnMouseUp", "copyOnMouseUp"],
]); 

export class MenuBar {
    public EvtChangeDefaultColor = new EventHook<[string, string]>();
    public EvtChangeDefaultBgColor = new EventHook<[string, string]>();
    public EvtContactClicked = new EventHook<void>();
    public EvtConnectClicked = new EventHook<void>();
    public EvtProfileClicked = new EventHook<void>();
    public EvtDisconnectClicked = new EventHook<void>();
    private clickFuncs: {[k: string]: (value:any) => void} = {};
    private windowManager:WindowManager;
    private layout:LayoutManager;
    private config:UserConfig;

    private attachMenuOption(name:string, value:string, element:Element, checkbox:Element) {
        const clickable = name in this.clickFuncs;
        const storageKey = optionMappingToStorage.get(name);
        if (checkbox && storageKey) {
            const storageVal = this.config.get(storageKey);
            const onStorageChanged:(val:string)=>void = (storageValNew) => {
                if (storageValNew) {
                    $(checkbox).attr('checked', storageValNew);
                    $(checkbox).prop('checked', storageValNew);
                    $(element)[0].setAttribute("data-checked", storageValNew);
                    if (clickable) this.clickFuncs[name](storageValNew);
                } else if (storageValNew != undefined) {
                    $(checkbox).removeAttr('checked');
                    $(checkbox).prop('checked', storageValNew);
                    $(element)[0].setAttribute("data-checked", "false");
                    if (clickable) this.clickFuncs[name](storageValNew);
                }
                
                if (storageValNew != undefined) {
                    //console.log(`${name} set to ${storageValNew}`);
                    //this.notify(`${name}: ${storageValNew}`, true)
                }
            };
            onStorageChanged(storageVal);
            this.config.onSet(storageKey, onStorageChanged);
            let config = this.config
            $(checkbox).change((event: JQueryEventObject) => {
                const val = (<any>event.target).checked;
                config.set(storageKey, val);
                if (!clickable) {
                    this.notify(name, val);
                }
                this.closeMenues()
                //if (clickable) this.clickFuncs[name]((<any>event.target).checked);
            });
        } else if (checkbox && !storageKey) {
            $(checkbox).change((event: JQueryEventObject) => {
                if (clickable) this.clickFuncs[name](!(<any>event.target).checked);
                this.closeMenues()
            });
        } else if (storageKey) {
            if (clickable) this.clickFuncs[name](this.config.get(storageKey));
        }
        if (clickable) {
            //console.log(`Attaching menu item ${name}`);
            let x = $(element);
            $(element).click((event: JQueryEventObject) => {
                if (!event.target || (event.target.tagName != "LI")) return;
                if (!checkbox && storageKey) {
                    this.config.set(storageKey, value || name);
                    this.clickFuncs[name](name);
                    //this.notify(`${name}: ${value|| name}`, true)
                } else {
                    const checked = $(element)[0].getAttribute("data-checked");
                    this.clickFuncs[name](checked);
                    //this.notify(`${name}: ${checked}`, true)
                }
                this.closeMenues()
            });
        } else if (value && name && storageKey) {
            $(element).click((event: JQueryEventObject) => {
                if (!event.target || (event.target.tagName != "LI" /*&& event.target.tagName != "LABEL"*/)) return;
                
                this.config.set(storageKey, value);
                this.notify(name, value)
                this.closeMenues()
            });
        } /*else if (name && storageKey) {
            $(element).click((event: JQueryEventObject) => {
                if (!event.target || (event.target.tagName != "LI" )) return;
                
                this.config.set(storageKey, name);
            });
        };*/
    }

    private notify(name: string, val: any) {
        Notification.Show(`${name}: ${typeof val == "boolean" ? (val ? "abilitato" : "disabilitato") : val}`, true, true);
    }

    private detachMenuOption(name:string, element:Element, checkbox:Element) {
        if (element) $(element).off("click");
        const storageKey = optionMappingToStorage.get(name);
        if (storageKey) this.config.onSet(storageKey, null);
        if (checkbox) $(checkbox).off("change");
    }

    private attachMenu() {
        $("document").ready(()=>{
            $("[data-option-name]").each((i, e) => {
                const name = $(e)[0].getAttribute("data-option-name");
                const val = $(e)[0].getAttribute("data-option-value");
                const chk = $(e).find("input[type='checkbox']")[0];
                this.attachMenuOption(name, val, e, chk);
            });
        });
    }

    private detachMenu() {
        $("document").ready(()=>{
            $("[data-option-name]").each((i, e) => {
                const name = $(e)[0].getAttribute("data-option-name");
                const chk = $(e).find("input[type='checkbox']")[0];
                this.detachMenuOption(name, e, chk);
            });
        });
    }

    private closeMenues:Function;

    constructor(
        private aliasEditor: AliasEditor,
        private triggerEditor: TriggerEditor,
        private baseTriggerEditor: TriggerEditor,
        private baseAliasEditor: AliasEditor,
        private jsScriptWin: JsScriptWin,
        private aboutWin: AboutWin,
        private profileWin: ProfilesWindow,
        config: UserConfig,
        private variableEditor:VariablesEditor,
        private classEditor: ClassEditor,
        private eventEditor: EventsEditor,
        private baseEventEditor: EventsEditor,
        private numpadWin: NumpadWin,
        private jsScript: JsScript,
        private outWin:OutputWin,
        private baseConfig: UserConfig,
        private helpWin: HelpWin,
        private mapper: Mapper,
        private layoutWindowr: LayoutWindow,
        private changelog: VersionsWin,
        private voiceWin:VoiceWin,
        private clientConfig:clientConfig,
        private client: Client
        ) 
    {
        this.notify = debounce(this.notify, 250)
        var userAgent = navigator.userAgent.toLowerCase();
        function toggleFullscreen() {
            let elem = document.documentElement;
          
            if (!document.fullscreenElement) {
              elem.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }

        $("#menuBar>ul").append("<div class='rightMenu'><span class='electron' id='electronMenu'><button id='electronZoomOut'>-</button><span id='electronZoom'></span><button id='electronZoomIn'>+</button></span><span id='currentTime'></span><span id='fullscreenButton' title='Schermo intero'>&#x26F6;</span></div>");
        var currentTimeSpan = $("#currentTime");
        var fsButton = $("#fullscreenButton");
        if (!document.documentElement.requestFullscreen) {
            fsButton.remove()
        } else {
            fsButton.on("click", (ev) => {
                toggleFullscreen();
            })
        }



        if (userAgent.indexOf(' electron/') > -1) {
            console.log("In electron")

            $("#electronZoomOut").on('click', ()=> {
                if ((<any>window).ipcRenderer) (<any>window).ipcRenderer.setZoom('out').then(()=>console.log("Invoked"))
            })
            $("#electronZoomIn").on('click', ()=> {
                if ((<any>window).ipcRenderer) (<any>window).ipcRenderer.setZoom('in').then(()=>console.log("Invoked"))
            })
            $(".electron", "#menuBar").css({"display": "inline-block"}).show();
        } else {
            $(".electron", "#menuBar").remove();
        }

        if (!(<any>window).deferredPrompt) {
            $("#appInstallMenu").remove()
        }

        const mnu:any = <JQuery>((<any>$("#menuBar")).jqxMenu({autoOpen: true, clickToOpen: true, keyboardNavigation: true}));

        circleNavigate($("#connessione",$("#menuBar")), $("#altro",$("#menuBar")), null, null);
        
        this.closeMenues = () => {
            mnu.jqxMenu('closeItem',"connessione")
            mnu.jqxMenu('closeItem',"impostazioni")
            mnu.jqxMenu('closeItem',"scripting")
            mnu.jqxMenu('closeItem',"finestre")
            mnu.jqxMenu('closeItem',"altro")
        }

        $("#menuBar").on('itemclick', (event) =>
        {
            document.getSelection().removeAllRanges();
            if (event.originalEvent instanceof KeyboardEvent) {
                $((<any>event).args).click()
                return;
            }
            if ($((<any>event).args).find(".jqx-icon-arrow-right").length || $((<any>event).args).closest(".jqx-menu-popup").length==0) return;
            this.closeMenues()
        });

        $("#menuBar").on('keyup', (event) =>
        {
            if (event.key == "Escape") {
                event.preventDefault()
                event.stopPropagation()
                this.closeMenues()
                $("#cmdInput").focus()
            }
        });

        $(document).on("keydown", (ev)=>{
            if (ev.altKey && !ev.shiftKey && !ev.ctrlKey && ev.key == "Alt") {
                //ev.preventDefault()
                //ev.stopPropagation()
            }
        });
        window.addEventListener("blur", (ev)=>{
            if (document.activeElement == document.body) setTimeout(()=>{
                if (document.activeElement == document.body)
                     $("#cmdInput").focus()
                },10)
        }, true);
        window.addEventListener("focus", (ev)=>{
            if (document.activeElement == document.body) setTimeout(()=>{
                if (document.activeElement == document.body)
                     $("#cmdInput").focus()
                },10)
        }, true);

        $("#cmdInput").on("keyup", (ev)=>{
            if (!ev.altKey && !ev.shiftKey && !ev.ctrlKey && ev.key == "Alt") {
                const loc = (<any>ev.originalEvent).location || 0;
                if (document.activeElement != mnu[0] && loc == 1) {
                    mnu.jqxMenu('focus');
                    ev.preventDefault()
                    ev.stopPropagation()
                } else {
                    $("#cmdInput").focus()
                    ev.preventDefault()
                    ev.stopPropagation()
                }
            }
        });

        (<any>Date.prototype).timeNow = function () {
            return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
        }

        currentTimeSpan.text((<any>new Date()).timeNow())
        setInterval(()=>{
            currentTimeSpan.text((<any>new Date()).timeNow())
        }, 30000);

        this.makeClickFuncs();
        setTimeout(() => {
            this.setConfig(config)
        }, 0);

        setupWorkers(clientConfig);
    }

    public setWIndowManager(windowM:WindowManager) {
        this.windowManager = windowM;
        this.windowManager.EvtEmitWindowsChanged.handle((v) => this.windowsChanged(v));
        this.layout = this.windowManager.getLayoutManager();
    }

    windowsChanged(windows: string[]) {
        $("#windowList").empty();
        if (windows.length == 0) {
            $("#windowList").append("<li>&lt;nessuna&gt;</li>");
            return;
        }
        for (const iterator of windows) {
            if (iterator == "Mapper") continue;
            let li = $("<li class='jqx-item jqx-menu-item jqx-rc-all' role='menuitem'>" + iterator + "</li>");
            let self = this;
            li.on("click", () => {
                self.windowManager.show(iterator);
                (<any>$("#menuBar")).jqxMenu('closeItem',"finestre")
            });
            $("#windowList").append(li);
        }
    }

    public setConfig(newConfig:UserConfig) {
        if (this.config) {
            this.detachMenu();
            this.config.evtConfigImport.release(this.onImport);
        }
        this.config = newConfig;
        this.handleNewConfig();
        this.attachMenu();
    }

    public triggerAction(action: string, param: string) {
        const f = this.clickFuncs[action]
        if (f instanceof Function) {
            f(param)
        } else {
            this.outWin.handleWindowError(`L'azione ${action} non esiste.`, "menuBar.triggerAction", '', '', null); 
        }
    }

    private onImport = ()=> {
        this.detachMenu();
        this.attachMenu();
    }

    private handleNewConfig() {
        this.config.evtConfigImport.handle(this.onImport);
    }

    private makeClickFuncs() {
        let logger = new OutputLogger();

        this.clickFuncs["installapp"] = (val) => {
            TsClient.AskForInstall(true);
        }
        
        this.clickFuncs["theme-default"] = (val) => {
            this.client.detachUnloadListener();
            TsClient.setTheme("metro", "light", "neat")
        }

        this.clickFuncs["log-time"] = (val) => {
            this.outWin.onLogTime(val)
        }

        this.clickFuncs["debug-scripts"] = (val) => {
            this.outWin.onDebugScripts(val)
        }

        this.clickFuncs["theme-light"] = (val) => {
            this.client.detachUnloadListener();
            TsClient.setTheme("metro", "light", "neat")
        }

        this.clickFuncs["theme-dark"] = (val) => {
            this.client.detachUnloadListener();
            TsClient.setTheme("metrodark", "dark", "material")
        }

        this.clickFuncs["connect"] = (val) => {
            if (isTrue(val)) {
                this.EvtDisconnectClicked.fire();
                this.notify(`Disconnessione`, true)
            }
            else {
                this.EvtConnectClicked.fire();
                this.notify(`Connessione`, true)
            }
        };

        this.clickFuncs["help"] = (val) => {
            this.helpWin.show();            
        };

        this.clickFuncs["keepawake"] = (val) => {
            val = false;
            if (localStorage.getItem("keepawake")) {
                localStorage.removeItem("keepawake")
                val = false;
            } else {
                localStorage.setItem("keepawake", "true")
                val = true;
            }
            this.notify("Prevenzione Sleep della finestra quando in sfondo: ", (val))
            if (val) {
                this.notify("Il computer non andra' in sleep mentre il client e' attivo.","")
                this.notify("Affinche' funzioni il client produrra' rumori inaudibili. Serve rilancio client.","")
            }
        };

        this.clickFuncs["changelog"] = (val) => {
            this.changelog.show();            
        };

        this.clickFuncs["stoplog"] = (val) => {
            logger.clear()
            if (!logger.isEnabled()) {
                return
            }
            this.outWin.log = false
            logger.stop()
            EvtScriptEmitPrint.fire({owner:"TS2Client", message: "Registrazione interrotta"})
            this.notify(`Registrazione interrotta`, true)
        };
        this.clickFuncs["log"] = (val) => {
            logger.clear()
            logger.start()
            this.outWin.log = true
            EvtScriptEmitPrint.fire({owner:"TS2Client", message: "Inizio log. Cancello registrazioni precedenti."})
            this.notify(`Inizio log. Cancello registrazioni precedenti.`, true)
        };

        this.clickFuncs["downloadlog"] = async (val) => {
            if (logger.empty()) {
                this.notify("Nessuna registrazione attiva da interrompere.","")
                return
            }
            if (val || !logger.empty()) {
                downloadString(val || await logger.content(), `log-${this.jsScript.getVariableValue("TSPersonaggio")||"sconosciuto"}-${new Date().toLocaleDateString()}.txt`)
            } else {
                this.notify("Sembra che la registrazione sia vuota...","")
            }
            this.clickFuncs["stoplog"](true)
        };

        this.clickFuncs["reset-settings"] = (val) => {
            this.config.remove(new RegExp("^(?!alias)(?!trigger)"), () => {TsClient.setDefaults(this.config)});
            location.reload();
        };

        this.clickFuncs["export-settings"] = () => {
            this.config.exportToFile(this.mapper);
        };

        this.clickFuncs["import-settings"] = () => {
            this.config.importFromFile(this.mapper);
        };

        this.clickFuncs["export-layout"] = () => {
            this.layout.exportToFile();
        };

        this.clickFuncs["import-layout"] = () => {
            this.layout.importFromFile();
        };

        this.clickFuncs["log-alerts"] = () => {
            let opts = ["normal", "minimal", "none"]
            let la = localStorage.getItem("log-alerts")||opts[0]
            let i = opts.indexOf(la);
            i++;
            if (i>=opts.length) { i = 0 }
            localStorage.setItem("log-alerts",opts[i])
            this.notify("Avvisi log: ", opts[i])
            new OutputLogger().setAlerts(opts[i])
        };

        this.clickFuncs["update-triggers"] = async () => {
            if ((await Messagebox.Question("Sei sicuro di voler aggiornare i script preimpostati?")).button == Button.Ok) {
                localStorage.setItem("old_UserConfig", localStorage.getItem("userConfig"))
                this.profileWin.ImportBaseTriggers(true);
            }
        }

        let showNeve = () => {
            $(".snowflakes", $("#row-center")).remove();
            $("#row-center").append(`
            <div class="snowflakes">
                <div class="snowflake">
            ❅
            </div>
            <div class="snowflake">
            ❅
            </div>
            <div class="snowflake">
            ❆
            </div>
            <div class="snowflake">
            ❄
            </div>
            <div class="snowflake">
            ❅
            </div>
            <div class="snowflake">
            ❆
            </div>
            <div class="snowflake">
            ❄
            </div>
            <div class="snowflake">
            ❅
            </div>
            <div class="snowflake">
            ❆
            </div>
            <div class="snowflake">
            ❄
            </div></div>`);
        };
        this.clickFuncs["snow"] = () => {
            let neve = localStorage.getItem("snow") != "false";
            neve = !neve;
            localStorage.setItem("snow", neve.toString())
            if (!neve) {
                $(".snowflakes", $("#row-center")).remove();
            } else {
                showNeve()
            }
        }

        let neve = localStorage.getItem("snow") != "false";
        if (neve) {
            let data = (new Date());
            if ((data.getUTCMonth() == 11 && data.getDate() >= 22) ||
                (data.getUTCMonth() == 0 && data.getDate() <= 5)) {
                showNeve()
            } else {
                $("[data-option-name=snow]").remove();
            }
        }

        this.clickFuncs["mapper"] = () => {
            this.windowManager.createWindow("Mapper");
            this.windowManager.show("Mapper");
        };

        this.clickFuncs["layoutEditor"] = () => {
            this.layoutWindowr.show();
        };

        this.clickFuncs["wrap-lines"] = (val) => {
            if (!isTrue(val)) {
                $(".outputText").addClass("output-prewrap");
                this.notify(`Capolinea disabilitato`, true)
            } else {
                $(".outputText").removeClass("output-prewrap");
                this.notify(`Capolinea abilitato`, true)
            }
        };

        var removeFontSizes = () => {
            $(".outputText").removeClass("smallest-text");
            $(".outputText").removeClass("extra-small-text");
            $(".outputText").removeClass("small-text");
            $(".outputText").removeClass("normal-text");
            $(".outputText").removeClass("large-text");
            $(".outputText").removeClass("extra-large-text");
        };

        var removeFonts = () => {
            $(".outputText").removeClass("courier");
            $(".outputText").removeClass("consolas");
            $(".outputText").removeClass("monospace");
            $(".outputText").removeClass("lucida");
            $(".outputText").removeClass("vera");
        };

        this.clickFuncs["enable-color"] = (val) => {
            if (isTrue(val)) {
                this.EvtChangeDefaultColor.fire(["white", "low"]);
                this.EvtChangeDefaultBgColor.fire(["black", "low"]);
                this.notify(`Colori ANSI abilitati`, true)
            } else {
                this.notify(`Colori ANSI disabilitati`, true)
            }
        }

        this.clickFuncs["use-profile"] = (val) => {
            this.EvtProfileClicked.fire();
        }

        this.clickFuncs["courier"] = (val) => {
            if (val == "courier") {
                removeFonts();
                $(".outputText").addClass("courier");
                this.notify(`Font: Courier`, true)
            }
        };

        this.clickFuncs["consolas"] = (val) => {
            if (val == "consolas") {
                removeFonts();
                $(".outputText").addClass("consolas");
                this.notify(`Font: Consolas`, true)
            }
        };

        this.clickFuncs["lucida"] = (val) => {
            if (val == "lucida") {
                removeFonts();
                $(".outputText").addClass("lucida");
                this.notify(`Font: Lucida Console`, true)
            }
        };

        this.clickFuncs["numpadconfig"] = (val) => {
            this.numpadWin.show()            
        };

        this.clickFuncs["monospace"] = (val) => {
            if (val == "monospace") {
                removeFonts();
                $(".outputText").addClass("monospace");
                this.notify(`Font: Monospace`, true)
            }
        };

        this.clickFuncs["vera"] = (val) => {
            if (val == "vera") {
                removeFonts();
                $(".outputText").addClass("vera");
                this.notify(`Font: Bitstream Vera Sans`, true)
            }
        };

        this.clickFuncs["extra-small-font"] = (val) => {
            if (val == "extra-small-font") {
                removeFontSizes();
                $(".outputText").addClass("extra-small-text");
                this.notify(`Font: minuscolo`, true)
            }
        };

        this.clickFuncs["smallest-font"] = (val) => {
            if (val == "smallest-font") {
                removeFontSizes();
                $(".outputText").addClass("smallest-text");
                this.notify(`Font: microscopico`, true)
            }
        };

        this.clickFuncs["small-font"] = (val) => {
            if (val == "small-font") {
                removeFontSizes();
                $(".outputText").addClass("small-text");
                this.notify(`Font: piccolo`, true)
            }
        };

        this.clickFuncs["normal-font"] = (val) => {
            if (val == "normal-font") {
                removeFontSizes();
                $(".outputText").addClass("normal-text");
                this.notify(`Font: normale`, true)
            }
        };

        this.clickFuncs["large-font"] = (val) => {
            if (val == "large-font") {
                removeFontSizes();
                $(".outputText").addClass("large-text");
                this.notify(`Font: grande`, true)
            }
        };

        this.clickFuncs["extra-large-font"] = (val) => {
            if (val == "extra-large-font") {
                removeFontSizes();
                $(".outputText").addClass("extra-large-text");
                this.notify(`Font: enorme`, true)
            }
        };

        this.clickFuncs["aliases"] = (val) => {
            this.aliasEditor.show();
        };

        this.clickFuncs["base_aliases"] = (val) => {
            this.baseAliasEditor.show();
        };

        this.clickFuncs["triggers"] = (val) => {
            this.triggerEditor.show();
        };

        this.clickFuncs["base_triggers"] = (val) => {
            this.baseTriggerEditor.show();
        };

        this.clickFuncs["base_events"] = (val) => {
            this.baseEventEditor.show();
        };

        this.clickFuncs["voice"] = (val) => {
            this.voiceWin.show();
        };

        this.clickFuncs["exportclass"] = async (val) => {
            exportClassFunc(this.config);
        };

        this.clickFuncs["importscript"] = (val) => {
            importScriptsFunc(this.config)
        };

        this.clickFuncs["base_exportclass"] = async (val) => {
            exportClassFunc(this.baseConfig);
        };

        this.clickFuncs["base_importscript"] = (val) => {
            importScriptsFunc(this.baseConfig)
        };

        this.clickFuncs["colorsEnabled"] = (val) => {
            if (isTrue(val)) {
                this.config.set("text-color", undefined);
                this.notify(`Colori: abilitati`, true)
            } else {
                this.notify(`Colori: disabilitati`, true)
            }
        };

        this.clickFuncs["green-on-black"] = (val) => {
            if (val == "green-on-black") {
                this.EvtChangeDefaultColor.fire(["green", "low"]);
                this.EvtChangeDefaultBgColor.fire(["black", "low"]);
                this.notify(`Testo: verde su nero`, true)
            }
        };

        this.clickFuncs["white-on-black"] = (val) => {
            if (val == "white-on-black") {
                this.EvtChangeDefaultColor.fire(["white", "low"]);
                this.EvtChangeDefaultBgColor.fire(["black", "low"]);
                this.notify(`Testo: bianco su nero`, true)
            }
        };

        this.clickFuncs["black-on-gray"] = (val) => {
            if (val == "black-on-gray") {
                this.EvtChangeDefaultColor.fire(["black", "low"]);
                this.EvtChangeDefaultBgColor.fire(["white", "low"]);
                this.notify(`Testo: nero su grigio (funziona solo senza colori ansi)`, true)
            }
        };

        this.clickFuncs["variables"] = (val) => {
            
            this.variableEditor.show();
        };

        this.clickFuncs["classes"] = (val) => {
            
            this.classEditor.show();
        };

        this.clickFuncs["events"] = (val) => {
            
            this.eventEditor.show();
        };

        this.clickFuncs["black-on-white"] = (val) => {
            if (val == "black-on-white") {
                this.EvtChangeDefaultColor.fire(["black", "low"]);
                this.EvtChangeDefaultBgColor.fire(["white", "high"]);
                this.notify(`Testo: nero su bianco (funziona solo senza colori ansi)`, true)
            }
        };

        this.clickFuncs["script"] = (val) => {
            this.jsScriptWin.show();
        };

        this.clickFuncs["about"] = (val) => {
            this.aboutWin.show();
        };

        this.clickFuncs["contact"] = (val) => {
            this.EvtContactClicked.fire(null);
        };
    }

    handleTelnetConnect() {
        $("#menuBar-conn-disconn").html("<span style='float: left; margin-right: 5px;width:16px;height:16px;text-align:center;' >&#69464;</span>Disconnetti");
        $("#menuBar-conn-disconn")[0].setAttribute("data-checked", "true");
    }

    handleTelnetDisconnect() {
        $("#menuBar-conn-disconn").html("<span style='float: left; margin-right: 5px;width:16px;height:16px;text-align:center;' >&#128279;</span>Connetti");
        $("#menuBar-conn-disconn")[0].setAttribute("data-checked", "false");
    }
}
