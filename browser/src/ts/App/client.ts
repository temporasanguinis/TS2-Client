import { UserConfig } from "./userConfig";
import { AppInfo } from "../appInfo";
// @ts-ignore
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import {Md5} from 'ts-md5';
import * as aesjs from "aes-js";
import { AliasEditor, EvtCopyAliasToBase } from "../Scripting/windows/aliasEditor";
import { AliasManager } from "../Scripting/aliasManager";
import { CommandInput, ScrollType } from "./commandInput";
import { JsScript, EvtScriptEmitCmd, EvtScriptEmitPrint, EvtScriptEmitEvalError, EvtScriptEmitError, EvtScriptEmitCls, EvtScriptEvent, ScripEventTypes } from "../Scripting/jsScript";
import { JsScriptWin } from "../Scripting/windows/jsScriptWin";
import { clientConfig, MenuBar } from "./menuBar";
import { ClassManager } from "../Scripting/classManager";
import { Mxp } from "../Core/mxp";
import { OutputManager } from "./outputManager";
import { OutputWin } from "./windows/outputWin";
import { Socket } from "../Core/socket";
import { TriggerEditor, EvtCopyTriggerToBase } from "../Scripting/windows/triggerEditor";
import { TriggerManager } from "../Scripting/triggerManager";
import { AboutWin } from "./windows/aboutWin";
import { ConnectWin } from "./windows/connectWin";
import { ContactWin } from "./windows/contactWin";
import { StatusWin } from "./windows/statusWin";
import axios from 'axios';
import * as apiUtil from "../Core/apiUtil";
import { ProfilesWindow } from "./windows/profilesWindow";
import { ProfileManager } from "./profileManager";
import { ProfileWindow } from "./windows/profileWindow";
import { Acknowledge, downloadString, linesToArray, parseSimpleScriptSyntax, raw, rawToHtml } from "../Core/util";
import { WindowManager } from "./windowManager";
import { VariablesEditor } from "../Scripting/windows/variablesEditor";
import { ClassEditor } from "../Scripting/windows/classEditor";
import { EventsEditor } from "../Scripting/windows/eventsEditor";
import { Button, Messagebox, Notification, messagebox } from "./messagebox";
import { LayoutManager } from "./layoutManager";
import { MapperWindow } from "../Mapper/windows/mapperWindow";
import { Mapper } from "../Mapper/mapper";
import {  } from '../Core/cacheServiceWorker'
import { copyData } from "../Scripting/windows/trigAlEditBase";
import { NumpadWin } from "./windows/numpadWin";
import { HelpWin } from "./windows/helpWindow";
import { MapperStorage } from "../Storage/mapperStorage";
import { VersionsWin } from "./windows/versionsWindow";
import { EvtLogExceeded, EvtLogWarning, OutputLogger } from "./outputLogger";
import { LayoutWindow } from "./windows/layoutWindow";
import { KeepAwake } from "../Core/keepAwake";
import hotkeys from "hotkeys-js";
import { WebRTC } from "../Core/webRTC";
import { VoiceWin } from "./windows/voiceWin";
//const corejsClone = require("core-js-pure/actual/structured-clone")
import "core-js-pure/actual/structured-clone";
const corejsClone = structuredClone;

declare global {
    interface JQuery {
        focusable(): JQuery;
    }
}

interface ConnectionTarget {
    host: string,
    port: number
}


export class Client {
    private outputLogger: OutputLogger;
    private aliasEditor: AliasEditor;
    private baseAliasEditor: AliasEditor;
    private aliasManager: AliasManager;
    private baseAliasManager: AliasManager;
    private commandInput: CommandInput;
    private jsScript: JsScript;
    private jsScriptWin: JsScriptWin;
    private profilesWin: ProfilesWindow;
    private mapperWin: MapperWindow;
    private profileWin:ProfileWindow;
    private menuBar: MenuBar;
    private mxp: Mxp;
    private outputManager: OutputManager;
    private outputWin: OutputWin;
    private socket: Socket;
    private triggerEditor: TriggerEditor;
    private baseTriggerEditor: TriggerEditor;
    private triggerManager: TriggerManager;
    private baseTriggerManager: TriggerManager;
    private aboutWin: AboutWin;
    private connectWin: ConnectWin;
    private contactWin: ContactWin;
    private voiceWin: VoiceWin;
    private classManager: ClassManager;
    private mapper: Mapper;
    private layoutWindow: LayoutWindow;
    private serverEcho = false;
    private rtc:WebRTC = null
    private _connected = false;
    windowManager: WindowManager;
    variableEditor: VariablesEditor;
    classEditor: ClassEditor;
    eventsEditor: EventsEditor;
    baseEventsEditor: EventsEditor;
    socketConnected: boolean;
    layoutManager: LayoutManager;
    numpadWin: NumpadWin;
    helpWin: HelpWin;
    changelog: VersionsWin;

    preventNavigate = (e:any) => {
        this.save();
        e.preventDefault();
        e.returnValue = "";
        return "";
    };

    public get connected():boolean {
        return this._connected;
    }
    public set connected(v:boolean) {
        this._connected = v;
    }

    public async disconnect() {
        try {
            this.manualDisconnect = true;
            await this.socket.closeTelnet();
        } finally {
            this.manualDisconnect = false;
        }
    }

    public detachUnloadListener() {
        window.removeEventListener("beforeunload", this.preventNavigate);
    }
    
    public connect(ct?:ConnectionTarget) {
        this.commandInput.SplitScroll(false)
        if (ct) {
            this.connectionTarget = ct;
            if (!this.connectionTarget.host) {
                this.connectionTarget.host = "mud.temporasanguinis.it"
                this.connectionTarget.port = 4000              
            }
        } else {
            this.connectionTarget = {
                host: "mud.temporasanguinis.it",
                port: 4000 
            }
        }
        if (this.connectionTarget) {
            this.socket.openTelnet(
                this.connectionTarget.host,
                this.connectionTarget.port
            );
        } else {
            const cp = this.profileManager.getProfile(this.profileManager.getCurrent());
            if (cp) this.connect({host: cp.host, port: Number(cp.port)});
            else  this.connect({host: null, port: null});
        }
    }

    private manualDisconnect:boolean = false;

    constructor(private connectionTarget: ConnectionTarget, private baseConfig:UserConfig, private profileManager:ProfileManager, public config:{[k:string]:any}) {
        console.log(config)
        let rtcHost = config.rtcHost
        let rtcPort = config.rtcPort
        this.rtc = (!rtcHost || !rtcPort) ? null : new WebRTC(rtcHost,
                              rtcPort,
                              $("#peerElements","#rtc")[0] as HTMLElement,
                              $("#localElements","#rtc")[0] as HTMLElement) 

        let attachKeepawake = (ms:MouseEvent) => {
            KeepAwake.On();
            document.removeEventListener("click", attachKeepawake)
        }
        if (localStorage.getItem("keepawake"))
            document.addEventListener("click", attachKeepawake);
        
        (<any>window)["Messagebox"] = Messagebox;
        (<any>window)["Notification"] = Notification;
        this.outputLogger = new OutputLogger();
        this.aboutWin = new AboutWin();
        this.mapper = new Mapper(new MapperStorage(), this.profileManager);
        (<any>$.fn).findByContentText = function (text:string) {
            const start = $(this)
            const allEl = start.find(":not(iframe)").addBack().contents().filter(function() {
                return this.nodeType == 3;
            });
            const res = allEl.filter((i,v) => {
                const found = v.textContent.trim().toLowerCase().indexOf(text.trim().toLowerCase())!=-1;
                if (found) {
                    return true;
                }
                return false;
            });
            let nodes = res.map((i,v) => {
                while (v.parentElement && !v.scrollIntoView) {
                    v = v.parentElement
                    if (v == start[0]) {
                        return null;
                    }
                }
                return v;
            })
            nodes = nodes.filter((i,v)=>v!=null)
            let nodesArray = (jQuery.unique(nodes.toArray()))
            let index = 0;
            function isAncestor(descendant:Node,ancestor:Node){
                return descendant.compareDocumentPosition(ancestor) & 
                    Node.DOCUMENT_POSITION_CONTAINED_BY;
            }
            while (index < nodesArray.length - 1) {
                if (isAncestor(nodesArray[index+1],nodesArray[index])) {
                    nodesArray.splice(index,1)
                } else {
                    index++;
                }
            }
            return $(nodesArray);
        };

        this.jsScript = new JsScript(this.profileManager.activeConfig, baseConfig, this.profileManager, this.mapper);
        this.windowManager = new WindowManager(this.profileManager);
        this.mapper.setScript(this.jsScript)
        this.profileManager.evtProfileChanged.handle(async p => {
            this.mapper.loadLastPosition()
        });
        this.contactWin = new ContactWin();
        this.profileWin = new ProfileWindow(this.profileManager);
        this.variableEditor = new VariablesEditor(this.jsScript, this.profileManager);
        this.classManager = new ClassManager(this.profileManager.activeConfig, profileManager, baseConfig);
        this.jsScriptWin = new JsScriptWin(this.jsScript);
        this.triggerManager = new TriggerManager(
            this.jsScript, this.profileManager.activeConfig, baseConfig, this.classManager, profileManager);
        this.aliasManager = new AliasManager(
            this.jsScript, this.profileManager.activeConfig, baseConfig, this.classManager, profileManager);
        this.jsScript.setClassManager(this.classManager);
        this.jsScript.setTriggerManager(this.triggerManager);
        this.jsScript.setAliasManager(this.aliasManager);
        this.outputWin = new OutputWin(this.profileManager.activeConfig, this.triggerManager);

        this.commandInput = new CommandInput(this.aliasManager, this.jsScript, this.profileManager.activeConfig, this.outputWin);
        this.commandInput.EvtEmitCommandsAboutToArrive.handle(v=>{
            //this.mapper.clearManualSteps()
        })
        this.commandInput.EvtEmitPreparseCommands.handle((d)=>{
            d.callback(this.mapper.parseCommandsForDirection(d.commands))
        })


        this.classEditor = new ClassEditor(this.classManager, this.profileManager, this.triggerManager, this.aliasManager, this.jsScript);
        this.aliasEditor = new AliasEditor(this.profileManager, this.aliasManager, false, this.jsScript, this.classManager);
        this.eventsEditor = new EventsEditor(this.jsScript, false, this.profileManager);
        this.triggerEditor = new TriggerEditor(this.profileManager, this.triggerManager, false, this.jsScript, this.classManager);

        this.baseAliasManager = new AliasManager(
            null, baseConfig, null, this.classManager, profileManager);
        this.baseAliasEditor = new AliasEditor(this.profileManager, this.baseAliasManager, true, this.jsScript, this.classManager, "Alias preimpostati (!)");
        this.baseTriggerManager = new TriggerManager(
            null, baseConfig, null, this.classManager, profileManager);
        this.baseTriggerEditor = new TriggerEditor(this.profileManager, this.baseTriggerManager, true, this.jsScript, this.classManager, "Trigger preimpostati (!)");
        
        this.outputManager = new OutputManager(this.outputWin, this.profileManager.activeConfig, this.windowManager, this.jsScript);
        this.mxp = new Mxp(this.outputManager, this.commandInput, this.jsScript, this.profileManager.activeConfig);
        this.socket = new Socket(this.outputManager, this.mxp, this.profileManager.activeConfig);
        this.jsScript.setOutputManager(this.outputManager);
        this.layoutManager = new LayoutManager(this.profileManager, this.jsScript, this.commandInput);
        this.profilesWin = new ProfilesWindow(this.profileManager, this.windowManager,this.layoutManager, this.profileWin, this);

        this.windowManager.setLayoutManager(this.layoutManager);
        this.windowManager.setMapper(this.mapper);

        this.windowManager.setCommandInput(this.commandInput);
        this.windowManager.setRTC(this.rtc);

        this.profileManager.setLayoutManager(this.layoutManager)
        this.profileManager.setWindowManager(this.windowManager)
        this.windowManager.updateWindowList();

        this.connectWin = new ConnectWin(this.socket);
        this.baseEventsEditor = new EventsEditor(this.jsScript, true, this.profileManager);
        this.numpadWin = new NumpadWin(this.profileManager.activeConfig);
        
        this.helpWin = new HelpWin();
        this.changelog = new VersionsWin();
        this.layoutWindow = new LayoutWindow("Editor disposizione schermo", this.jsScript, this.profileManager, this.layoutManager, this.windowManager);
        
        this.SetupRTC();   

        this.menuBar = new MenuBar(this.aliasEditor, this.triggerEditor, this.baseTriggerEditor, this.baseAliasEditor, this.jsScriptWin, this.aboutWin, this.profilesWin, this.profileManager.activeConfig, this.variableEditor, this.classEditor, this.eventsEditor, this.baseEventsEditor, this.numpadWin, this.jsScript, this.outputWin, this.baseConfig, this.helpWin, this.mapper, this.layoutWindow, this.changelog, this.voiceWin, this.config, this);
        this.menuBar.setWIndowManager(this.windowManager);
        this.profileWin.setWindowManager(this.windowManager);

        // MenuBar events
        this.menuBar.EvtChangeDefaultColor.handle((data: [string, string]) => {
            this.outputManager.handleChangeDefaultColor(data[0], data[1]);
        });

        this.menuBar.EvtChangeDefaultBgColor.handle((data: [string, string]) => {
            this.outputManager.handleChangeDefaultBgColor(data[0], data[1]);
        });

        this.menuBar.EvtContactClicked.handle(() => {
            this.contactWin.show();
        });

        this.menuBar.EvtProfileClicked.handle(()=>{
            this.manualDisconnect = false;
            this.profilesWin.show();
        })

        this.menuBar.EvtConnectClicked.handle(() => {
            this.manualDisconnect = false;
            if (this.profileManager.getCurrent()) {
                const cp = this.profileManager.getProfile(this.profileManager.getCurrent());
                if (cp)
                    this.connect({host: cp.host, port: Number(cp.port)});
                else
                    this.connect();
            } else {
                this.connect();
            }
        });

        this.menuBar.EvtDisconnectClicked.handle(() => {
            this.manualDisconnect = true;
            this.disconnect();
        });

        this.profilesWin.EvtClosedClicked.handle(v => {
            this.manualDisconnect = v;
        });

        this.socket.EvtIdentified.handle(s => {
            console.log("Got player name " + s)
            if (this.rtc) this.rtc.SetUsername(s)
        })

        // Socket events
        this.socket.EvtServerEcho.handle((val: boolean) => {
            // Server echo ON means we should have local echo OFF
            this.serverEcho = val;
        });

        this.socket.EvtTelnetTryConnect.handle((val: [string, number]) => {
           this.outputWin.handleTelnetTryConnect(val[0], val[1]); 
        });

        let handleConnectionState = (connected: boolean, type: string) => {
            if (connected) {
                if (type == "telnet") {
                    this.connected = true;
                    this.jsScript.load();
                    EvtScriptEvent.fire({event: ScripEventTypes.ConnectionState, condition: 'telnet', value: true});
                    window.addEventListener("beforeunload", this.preventNavigate);
                    this.menuBar.handleTelnetConnect();
                    this.outputWin.handleTelnetConnect();
                } else if (type == "ws") {
                    this.socketConnected = true;
                    this.outputWin.handleWsConnect();
                    EvtScriptEvent.fire({event: ScripEventTypes.ConnectionState, condition: 'websocket', value: true});
                }
            } else {
                this.save();
                const socketWasConnected = this.socketConnected;
                const telnetWasConnected = this.connected;

                this.connected = false;
                window.removeEventListener("beforeunload", this.preventNavigate);
                if (telnetWasConnected) this.menuBar.handleTelnetDisconnect();
                if (telnetWasConnected) this.outputWin.handleTelnetDisconnect();

                if (type == "telnet") {
                    EvtScriptEvent.fire({event: ScripEventTypes.ConnectionState, condition: 'telnet', value: false});
                } else if (type == "ws") {
                    this.socketConnected = false;
                    if (socketWasConnected) this.outputWin.handleWsDisconnect();
                    EvtScriptEvent.fire({event: ScripEventTypes.ConnectionState, condition: 'websocket', value: false});
                }

                if (telnetWasConnected || socketWasConnected) {
                    this.windowManager.profileDisconnected();
                    this.layoutManager.profileDisconnected();
                }
                this.commandInput.SplitScroll(false);

                if (!this.manualDisconnect) this.profilesWin.show(true);
                
            }
        }

        this.socket.EvtTelnetConnect.handle((val: [string, number]) => {
            
            handleConnectionState(true, "telnet");

            console.log("Telnet connected for profile: " + profileManager.getCurrent())

            if (profileManager.activeConfig.getDef("soundsEnabled", true)) {
                new Audio("./sounds/connect.mp3").play()
            }

            this.serverEcho = false;
            
            apiUtil.clientInfo.telnetHost = val[0];
            apiUtil.clientInfo.telnetPort = val[1];

            apiUtil.apiPostClientConn();

            (async () => {
                await this.profileManager.afterProfileConnected()
                //await this.windowManager.showWindows(false);
            })();
        });

        this.socket.EvtTelnetDisconnect.handle(() => {

            handleConnectionState(false, "telnet");

            if (profileManager.activeConfig.getDef("soundsEnabled", true)) {
                new Audio("./sounds/disconnect.mp3").play()
            }

            apiUtil.clientInfo.telnetHost = null;
            apiUtil.clientInfo.telnetPort = null;
            if (!this.outputLogger.empty()) {
                (async () => {
                    const content = await this.outputLogger.content()
                    const ret = await Messagebox.ShowWithButtons("Registrazione (Log)","Avevi una registrazione in corso.\n\nScegli come continuare:", "Continua registrazione", "Scarica e interrompi")
                    if (ret.button == Button.Cancel) {
                        this.menuBar.triggerAction("downloadlog", content)
                        this.outputLogger.clear()
                        this.outputLogger.stop()
                    }
                })();
            }
        });

        this.socket.EvtTelnetError.handle((data: string) => {
            handleConnectionState(false, "telnet");
            this.outputWin.handleTelnetError(data);
        });

        this.socket.EvtWsError.handle((data) => {
            handleConnectionState(false, "ws");
            this.outputWin.handleWsError();
        });

        this.socket.EvtWsConnect.handle((val: {sid: string}) => {
            handleConnectionState(true, "ws");
            apiUtil.clientInfo.sid = val.sid;
        });

        this.socket.EvtWsDisconnect.handle(() => {
            handleConnectionState(false, "ws");
            apiUtil.clientInfo.sid = null;
        });

        this.socket.EvtSetClientIp.handle((ip: string) => {
            apiUtil.clientInfo.clientIp = ip;
        });

        // CommandInput events
        this.commandInput.EvtEmitCmd.handle((data: {command:string, fromScript:boolean}) => {
            if (true !== this.serverEcho) {
                let cmd = "<span style=\"color:yellow\">"
                + rawToHtml(data.command)
                + "<br>"
                + "</span>"
                this.outputWin.append(cmd, true);//.outputWin.handleSendCommand(data.command, data.fromScript);
                    
                const f = () => {
                    if (!data.fromScript) this.outputWin.scrollLock = false
                    this.outputWin.scrollBottom(!data.fromScript);
                }
                if (true/*data.fromScript*/) {
                    setTimeout(() => {
                        f()
                    }, 0);
                } else {
                    f();
                }
            }
            this.socket.sendCmd(data.command);
        });

        this.commandInput.EvtEmitScroll.handle((type:ScrollType) => {
            switch (type) {
                case ScrollType.Bottom:
                    if (this.commandInput.isSplitScrolling())
                        this.commandInput.SplitScrolBottom()    
                    else
                        this.outputWin.scrollBottom(true);
                break;
                case ScrollType.PageUp:
                    if (this.commandInput.isSplitScrolling())
                        this.commandInput.SplitScrollPageUp()    
                    else {
                        if (this.commandInput.splitScrolling) {
                            this.commandInput.SplitScroll(true)
                        } else {
                            this.outputWin.ScrollPageUp();
                        }
                    }
                break;
                case ScrollType.PageDown:
                    if (this.commandInput.isSplitScrolling())
                        this.commandInput.SplitScrollPageDown()    
                    else
                        this.outputWin.ScrollPageDown();
                break;
                case ScrollType.Top:
                    if (this.commandInput.isSplitScrolling())
                        this.commandInput.SplitScrollTop()    
                    else
                        this.outputWin.ScrollTop();
                break;
            }
            
        });

        this.commandInput.EvtEmitAliasCmds.handle((data) => {
            if (data.commands || data.fromScript) this.outputWin.debugAliasSentCommands(data.orig, data.commands, data.fromScript)
            for (let cmd of data.commands) {
                this.commandInput.execCommand(cmd, cmd, true);
            }
        });

        // Mxp events
        this.mxp.EvtEmitCmd.handle((data) => {
            if (data.noPrint !== true) {
                this.outputWin.handleSendCommand(data.value, true);
            }
            this.socket.sendCmd(data.value);

            // noPrint is used only for MXP <version>, which we don't want to track
            if (data.noPrint !== true) {
                apiUtil.apiPostMxpSend();
            }
        });

        this.outputLogger.setScript(this.jsScript)
        let awaitingLogResponse = false;
        EvtLogExceeded.handle((data:{owner:string, message:string, silent:boolean, callb: Function}) => {
            if (true) {
                if (!this.outputLogger.empty() && !awaitingLogResponse) {
                    awaitingLogResponse = true;
                    (async () => {
                        if (!data.silent) Notification.Show(data.message, true, false, 3000, true, 1.0, false, data.callb)
                        await this.outputLogger.rollLog()
                        awaitingLogResponse = false;
                    })();
                }
            }
        });

        EvtLogWarning.handle((data:{owner:string, message:string, silent:boolean, callb: Function}) => {
            if (!data.silent) {
                if (!this.outputLogger.empty() && !awaitingLogResponse) {
                    awaitingLogResponse = true;
                    (async () => {
                        Notification.Warning(data.message, true, false, 7000, true, 1.0, true, data.callb)
                        awaitingLogResponse = false;
                    })();
                }
            }
        });

        // JsScript events
        EvtScriptEmitCmd.handle((data:{owner:string, message:string, silent:boolean}) => {
            this.outputWin.debugScriptSendingCommand(data.owner, data.message);
            const lines = linesToArray(data.message)
            //console.log(lines)
            try {
                this.serverEcho = data.silent;
                for (const line of lines) {
                    if (this.outputWin.debugScripts)
                        this.outputWin.handleSendCommand(line, true, true)
                    this.commandInput.sendCmd(line.trim(), true, true);    
                }
            } finally {
                this.serverEcho = false;
            }
            //this.socket.sendCmd(data);
        });

        EvtScriptEmitPrint.handle((data:{owner:string, message:string, window?:string, raw?:any}) => {
            //setTimeout(()=>{
            if (data.window) {
                this.outputManager.sendToWindow(data.window, data.message||"", data.message, true);
            } else {
                if (!data.raw) {
                    const msg = "<span style=\"color:orange\">"
                    + raw(data.message||"")
                    + "<br>"
                    + "</span>"
                    this.outputWin.debugScriptPrinting(data.owner, data.message||"");
                    const f = () => {
                        this.outputWin.append(msg, true);
                        this.outputWin.scrollBottom(false);
                    }
                    //setTimeout(() => {
                        f()
                    //}, 0);
                    
                } else {
                    this.outputWin.debugScriptPrinting(data.owner, data.raw||"");
                    this.outputWin.append(data.raw||"", true)
                }
            }
            //},0)
        });

        EvtScriptEmitCls.handle((data:{owner:string, window?:string}) => {
            //setTimeout(() => {
                if (data.window) {
                    this.outputManager.clearWindow(data.window);
                } else {
                    this.outputWin.clearWindow(data.owner);
                }    
            //}, 0);
        });

        EvtScriptEmitError.handle((data: {owner:string, err: any, stack?:string}) => {
            let st = this.jsScript.getStackTrace(data.owner, data.stack)
            data.stack = st
            this.outputWin.handleScriptError(data)
        });

        EvtScriptEmitEvalError.handle((data: {stack: any}) => {
            this.outputWin.handleScriptEvalError(data)
        });

        // TriggerManager events
        this.triggerManager.EvtEmitTriggerCmds.handle((data: {orig:string, cmds:string[]}) => {
            this.outputWin.debugTriggerSentCommands(data.orig, data.cmds);
            for (let cmd of data.cmds) {
                this.commandInput.execCommand(cmd, cmd, true);
            }
            /*for (let cmd of data) {
                this.socket.sendCmd(cmd);
            }*/
        });

        // OutputWin events
        this.outputWin.EvtLine.handle((data:[string, string]) => {
            let newBuffer = null;
            if ((newBuffer = this.triggerManager.handleLine(data[0], data[1]))!=null) {
                data[1] = newBuffer;
                data[0] = this.triggerManager.line;
            }
            this.triggerManager.buffer = ""
        });

        this.outputWin.EvtBuffer.handle((data:[string, string]) => {
            let newBuffer = null;
            if ((newBuffer = this.triggerManager.handleBuffer(data[0], data[1]))!=null) {
                data[1] = newBuffer;
                data[0] = this.triggerManager.line;
            }
        });

        // OutputManager events
        this.outputManager.EvtNewLine.handle(() => {
            this.mxp.handleNewline();
        });

        this.outputManager.EvtMxpTag.handle((data: string) => {
            return this.mxp.handleMxpTag(data);
        });

        EvtCopyAliasToBase.handle(this.copyAliasToOther, this)
        EvtCopyTriggerToBase.handle(this.copyTriggerToOther, this)

        this.socket.open().then((success) => {
            if (!success) { return; }
            
            if (this.connectionTarget) {
                this.socket.openTelnet(
                    this.connectionTarget.host,
                    this.connectionTarget.port);

            } else {
                this.profilesWin.show();
            }
        });

        let loadContrib = async () => {
            /*if (window.matchMedia('(display-mode: standalone)').matches) {
                EvtScriptEmitPrint.fire({
                    message: `Standalone mode`,
                    owner: "keyboard"
                })
              }*/
            if (this.mapper.getOptions().preferLocalMap) {
                this.mapper.useLocal = true;
                console.log("Carico mappe da locale")
                await this.mapper.loadLocalDb()
            } else {
                const mapOnline = await this.mapper.loadVersion(true);
                const mapOffline = await this.mapper.loadVersion(false);
                const mapOnlineIsNewer = mapOnline.version > mapOffline.version;
                let vn = Math.random();
                if (mapOnlineIsNewer && mapOnline.version != 0) {
                    vn = mapOnline.version;
                } else if (!mapOnlineIsNewer && mapOffline.version != 0) {
                    vn = mapOffline.version;
                }
                let prefix  = mapOnlineIsNewer ? "https://temporasanguinis.it/client/" : "";
                console.log("Carico mappe da " + (prefix || "locale"))
                this.mapper.load(prefix + 'mapperData.json?v=' + vn, mapOnlineIsNewer ? mapOnline : mapOffline)
            }

            let remVer: number = await this.profilesWin.checkNewTriggerVersion(true);
            let localVer: number = await this.profilesWin.checkNewTriggerVersion(false);

            console.log("remote trig: " + remVer + " local trig: " + localVer)
            const update = remVer || localVer;

            if (update) {
                const r = await Messagebox.ShowWithButtons("Aggiornamento preimpostati", "C'e' una nuova versione dei trigger preimpostati.\nVuoi aggiornare ora?\n\nP.S. Se rispondi No, salterai la versione e dovrai aggiornare manualmente dal menu Scripting.", "Si", "No");
                if (r.button == Button.Ok) {
                    this.profilesWin.ImportBaseTriggers(remVer > localVer);
                } else {
                    this.baseConfig.set("version", (remVer > localVer ? remVer : localVer));
                }
            }
        }

        setTimeout(loadContrib, 2000);
    }

    private SetupRTC() {
        this.voiceWin = new VoiceWin(this.rtc, this.commandInput, true)
    }

    copyAliasToOther(data: copyData) {
        var src = data.isBase ? this.baseAliasManager : this.aliasManager
        var dest = !data.isBase ? this.baseAliasManager : this.aliasManager
        const i = dest.aliases.findIndex(a => a.pattern == data.item.pattern)
        const clone = JSON.parse(JSON.stringify(data.item))
        if (i>=0) {
            dest.aliases[i] = clone
        } else {
            dest.aliases.push(clone)
        }
        dest.saveAliases()
    }

    copyTriggerToOther(data: copyData) {
        var src = data.isBase ? this.baseTriggerManager : this.triggerManager
        var dest = !data.isBase ? this.baseTriggerManager : this.triggerManager
        const i = dest.triggers.findIndex(a => a.pattern == data.item.pattern)
        const clone = JSON.parse(JSON.stringify(data.item))
        if (i>=0) {
            dest.triggers[i] = clone
        } else {
            dest.triggers.push(clone)
        }
        dest.saveTriggers()
    }

    public save():void {
        this.jsScript.save();
        this.windowManager.save();
        this.layoutManager.save();
        this.profileManager.saveProfiles(false);
    }
    public readonly UserConfig = UserConfig;
    public readonly AppInfo = AppInfo;
}

function makeCbLocalConfigSave(): (val: string) => string {
    let localConfigAck = localStorage.getItem("localConfigAck");

    return (val: string):string => {
        localStorage.setItem('userConfig', val);
        if (!localConfigAck) {
            let win = document.createElement('div');
            let profileMessage = ``;
            win.innerHTML = `
                <!--header-->
                <div>INFO</div>
                <!--content-->
                <div>
                <p>
                    Le tue impostazioni verranno salvate in <b>locale</b> nel tuo browser,
                    e non potrai accederci da altri senza esportare e importare.
                </p>
                ${profileMessage}

                </div>
            `;
            (<any>$(win)).jqxWindow({
                closeButtonAction: 'close'
            });

            localConfigAck = "true";
            localStorage.setItem('localConfigAck', localConfigAck);
        }
        return val;
    };
}

export async function setupWorkers(clientConfig: clientConfig) {
    if ((<any>window).ipcRenderer || window.location.host.indexOf("localhost")!=-1) return Promise.resolve(null);

    if ('serviceWorker' in navigator) {
        if (!clientConfig.useServiceWorker) {
            let regs = await navigator.serviceWorker.getRegistrations()
            for(let registration of regs) {
                if(registration.active.scriptURL.indexOf("cacheServiceWorker")>-1){
                     await registration.unregister(); 
                }
            }
        } else {
            return navigator.serviceWorker.register('./cacheServiceWorker.js', {scope: './'}).then(function() {
            // Registration was successful. Now, check to see whether the service worker is controlling the page.
            if (navigator.serviceWorker.controller) {
                // If .controller is set, then this page is being actively controlled by the service worker.
                console.log('Cache service worker installed.');
            } else {
                // If .controller isn't set, then prompt the user to reload the page so that the service worker can take
                // control. Until that happens, the service worker's fetch handler won't be used.
                console.log('Cache service worker installed: Please reload this page to allow the service worker to handle network operations.');
            }
            }).catch(function(error) {
                console.log("Error installing cache service worker.")
            });
        }
      } else {
        console.log("No support for cache service worker.")
      }
      return Promise.resolve(null);
}

export namespace TsClient {
    let theme_name: string = "metro";
    let theme_brightness: string = "light";
    let theme_codemirror: string = "neat";

    export let client: Client;
    export let baseConfig = new UserConfig();
    export let profileManager:ProfileManager = null;
    export async function GetLocalClientConfig() {
        let axinst = axios.create({
            validateStatus: (status) => {
                return status === 200;
            }
        });
        return axinst.get('./client.config.json');
    };

    export function GetCodeMirrorTheme() {
        return theme_codemirror
    }

    export function setTheme(theme?:string, bright?: string, codem_theme?:string) {

        if (!theme && localStorage.getItem("theme_name")) {
            theme_name = localStorage.getItem("theme_name") || '';
            theme_brightness = localStorage.getItem("theme_brightness") || 'light';
            theme_codemirror = localStorage.getItem("theme_codeMirrorTheme") || 'light';
        } else if (theme) {
            theme_name = theme;
            localStorage.setItem("theme_name", theme_name);
            theme_brightness = bright;
            localStorage.setItem("theme_brightness", theme_brightness);
            theme_codemirror = codem_theme;
            localStorage.setItem("theme_codeMirrorTheme", theme_codemirror);
        }

        $("body").removeClass("light");
        $("body").removeClass("dark");
        $("body").addClass(theme_brightness);

        $.jqx.theme = theme_name;

        if (theme) {
            window.location.reload();
        }
    }

    export async function GetLocalBaseConfig() {
        let axinst = axios.create({
            validateStatus: (status) => {
                return status === 200;
            }
        });
        return axinst.get('./baseConfig.json');
    };

    function setDefault(cfg:UserConfig, key:string, value:any) {
        if (cfg.get(key) == undefined) {
            cfg.set(key, value);
        }
    }

    export function setDefaults(cfg:UserConfig) {
        setDefault(cfg, "text-color", "white-on-black");
        setDefault(cfg, "wrap-lines", true);
        setDefault(cfg, "utf8Enabled", false);
        setDefault(cfg, "mxpEnabled", true);
        setDefault(cfg, "mxpImagesEnabled", true);
        setDefault(cfg, "aliasesEnabled", true);
        setDefault(cfg, "triggersEnabled", true);
        setDefault(cfg, "soundsEnabled", true);
        setDefault(cfg, "font-size", "small");
        setDefault(cfg, "font", "consolas");
        setDefault(cfg, "colorsEnabled", true);
        setDefault(cfg, "logTime", false);
        setDefault(cfg, "debugScripts", false);
    }

    function onPreloaded() {
        $(".preloading").addClass("preloaded");
        AskForInstall(false);
    }

    export async function AskForInstall(force:boolean) {
        const prompt = (<any>window).deferredPrompt;
        if (!prompt || (!force && localStorage.getItem("ack_AskForInstall")=="true")) return;

        messagebox("Usa come app",
`Vuoi usare il client come fosse un applicazione nativa?

Questo ti permetterebbe di lanciarlo piu facilmente,
averlo disponibile nella barra applicazioni o desktop,
e anche avere piu' spazio verticale nel client.

Se vorrai farlo in futuro puoi farlo dal menu Informazioni.`, async (v) => {
            localStorage.setItem('ack_AskForInstall', "true");
            if (v == "Si") {
                prompt.prompt();
                const { outcome } = await prompt.userChoice;
                console.log("User responded to prompt: " + outcome)
            }
        }, "Si", "No", null, false, [""], 400, null, false, "");
    }

    export async function runClient() {
        let connectionTarget: ConnectionTarget;
        let params = new URLSearchParams(location.search);
        if (!window.structuredClone) {
            console.log("Adding corejs structuredClone polyfill")
            window.structuredClone = corejsClone
        }
        baseConfig.init("", localStorage.getItem("userConfig"), makeCbLocalConfigSave());
        setDefaults(baseConfig);
        profileManager = new ProfileManager(baseConfig);
        await profileManager.load();
        
        if (params.has('host') && params.get('host').trim()=="auto") {
            connectionTarget = {
                host: null,
                port: 0
            }
        } else if (params.has('host') && params.has('port')) {
            connectionTarget = {
                host: params.get("host").trim(),
                port: Number(params.get("port").trim())
            }
        } else if (profileManager.getCurrent()) {
            const sprof = profileManager.getCurrent();
            const prof = profileManager.getProfile(sprof);
            connectionTarget = {
                host: prof.host.trim(),
                port: Number(prof.port.trim())
            }
        } else {
            connectionTarget = {
                host: "mud.temporasanguinis.it",
                port: 4000
        	}
        }
        profileManager.setTitle();
        let cfg = await apiUtil.apiGetClientConfig()
        client = new Client(null, baseConfig, profileManager, cfg.data);
        profileManager.setClient(client)
        onPreloaded();
    }

    export function decrypt(text: string):string {
        if ((<any>window).ipcRenderer) return text;
        var key = aesjs.utils.hex.toBytes(localStorage.getItem("browserHash"));
        var encryptedBytes = aesjs.utils.hex.toBytes(text);
    
        // The counter mode of operation maintains internal state, so to
        // decrypt a new instance must be instantiated.
        var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
        var decryptedBytes = aesCtr.decrypt(encryptedBytes);
        
        // Convert our bytes back into text
        var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
        //console.log(decryptedText);
        return decryptedText;
    }

    export function encrypt(text: string):string {
        if ((<any>window).ipcRenderer) return text; 
        var key = aesjs.utils.hex.toBytes(localStorage.getItem("browserHash"));

        var textBytes = aesjs.utils.utf8.toBytes(text);
        
        var aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
        var encryptedBytes = aesCtr.encrypt(textBytes);
        
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        //console.log(encryptedHex);
        return encryptedHex;
    }

    export async function initEncryption(browserHash:string) {
        const prevHash = localStorage.getItem("browserHash");
        if (prevHash==null) {
            localStorage.setItem("browserHash", browserHash);
            return;
        } else {
            return;
        }
        if (prevHash!=null && prevHash != browserHash) {
            Acknowledge("hashChanged", `La configurazione del PC o del browser e' cambiata.
            Le password che erano state salvate per i profili sono state invalidate e dovrai rimetterle.
            
            <b>E' una misura di sicurezza</b> per prevenire furti di password
            che vengono salvate nel browser e criptate con il suo numero identificativo.`);
            localStorage.removeItem("ack_hashChanged");
        }
        localStorage.setItem("browserHash", browserHash);
    }

    export async function initClient() {
        return GetLocalClientConfig().then(resp => {
            if (resp && resp.data) {
                const cfg = resp.data;
                if (cfg.apiBaseUrl) {
                    // enable api and override base url
                    apiUtil.setApiBaseUrl(cfg.apiBaseUrl);
                    apiUtil.setEnabled(true);
                } else {
                    // local config with no api url means api disabled
                    apiUtil.setEnabled(false);
                }
            } else {
                // we got nothing, work as before
                apiUtil.setEnabled(true);
            }
        }, () => {
            // we got error fetching client config, work the API as normal
            apiUtil.setEnabled(true);
        }).then(() => {
            runClient();
        },
        (err) => {
            console.log("Failed loading local config: " + err);
            runClient(); // run even if fetching the local config fails and fallback to previous behavior with the API
        });
    }

    export async function init() {
        hotkeys.filter = function(event) { return true;};
        jQuery.fn.extend({
            focusable: function() {
                const inputs = this.find('input:visible, div:not(.CodeMirror) textarea:visible').first()
                if (inputs.length) return  {
                    focus: () => {
                        setTimeout(()=>{
                            let el = this.find('input:visible, div:not(.CodeMirror) textarea:visible').first()[0]
                            if (el) (el as HTMLElement).focus()
                        }, 150)
                    }
                };
                const codemirror = this.find('.CodeMirror').first()
                if (codemirror.length && (codemirror[0] as any).CodeMirror) {
                    return {
                        focus: () => {
                            setTimeout(()=>{
                                let cm = (this.find('.CodeMirror').first()[0] as any)?.CodeMirror
                                if (cm) {
                                    cm.focus()
                                    cm.setCursor({line: 1, ch: 0})
                                }
                            }, 150)
                        }
                    }
                }
                return  {
                    focus: () => {
                        setTimeout(()=>{
                            this.find(':button:visible, a:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"]):visible').first().focus()
                        }, 150)
                    }
                };
            }
        })

        let componentsFetched = async (hashStr:string) => {
            if (!(<any>window).ipcRenderer) await initEncryption(hashStr);
            await initClient();
        };
        
        const fpPromise = FingerprintJS.load();
        
        (async () => {
          const fp = await fpPromise
          const result = await fp.get()
          componentsFetched(result.visitorId)
        })()
    }
}

(<any>window).Mudslinger = TsClient;
