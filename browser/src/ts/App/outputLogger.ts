import { EventHook } from "../Core/event";
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { downloadString } from "../Core/util";
import { JsScript } from "../Scripting/jsScript";

export interface OutputLogDBSchema extends DBSchema {
    lines: {
      value: string;
      key: number;
    };
  }

export let EvtLogExceeded = new EventHook<{owner:string, message:string, silent:boolean, callb: Function}>();
export let EvtLogWarning = new EventHook<{owner:string, message:string, silent:boolean, callb: Function}>();

export class OutputLogger {
    private static instance: OutputLogger;
    private dbName = 'TsOutputLog';
    private dbVersion = 1;
    private numLines = 0;
    private maxLines = 50000;
    private jsScript:JsScript = null;

    private db:IDBPDatabase<OutputLogDBSchema> = null;
    private alerts: string;

    public setAlerts(alerts:string) {
        this.alerts = alerts
    }

    constructor() {
        if (OutputLogger.instance) {
            return OutputLogger.instance;
        }
        OutputLogger.instance = this;
        this.init()
    }

    setScript(jsScript:JsScript) {
        this.jsScript = jsScript
    }

    async init() {
        this.alerts = localStorage.getItem("log-alerts")||"normal";
        this.db = await openDB<OutputLogDBSchema>(this.dbName, this.dbVersion, {
            upgrade(db, oldVersion, newVersion) {
                db.createObjectStore('lines', {autoIncrement:true});
            },
            terminated() {
                console.log("IndexedDB logging failed")
            }
        });
        this.numLines = await (this.db).count("lines");
    }
    
    async log(buffer: string) {
        if (!this.db || !this.isEnabled()) {
            return;
        }

        if (buffer.endsWith('\n')) {
            buffer = buffer.slice(0, buffer.length - 1)
        }

        if (buffer.indexOf('\n') != -1) {
            let lines = buffer.split('\n')
            const tx = this.db.transaction("lines", "readwrite")
            const ops = []
            for (const line of lines) {
                ops.push(tx.store.add(line))
            }
            await Promise.all([...ops,tx.done])
        } else {
            await this.db.add("lines", buffer);
        }
        const numLines = await this.db.count("lines");

        let logWarning = 0
        if (numLines > 0.9 * this.maxLines && this.numLines <= 0.9 * this.maxLines) {
            if (this.alerts == "normal" || this.alerts == "minimal") logWarning = 90
        }
        else if (numLines > 0.95 * this.maxLines && this.numLines <= 0.95 * this.maxLines) {
            if (this.alerts != "none") logWarning = 95
        }

        this.numLines = numLines

        if (logWarning) {
            EvtLogWarning.fire({
                owner: "outputLogger",
                message: "Log al " + logWarning + "%. Se vuoi scaricarlo premi qui'. Quando si riempie perderai le righe vecchie.",
                silent: false,
                callb: async () => {
                    downloadString(await this.content(), `log-${this.jsScript.getVariableValue("TSPersonaggio")||"sconosciuto"}-${new Date().toLocaleDateString()}.txt`)
                    this.clear()
                }
            })
        }

        if (this.lineCount() > this.maxLines) {
            EvtLogExceeded.fire({
                owner: "outputLogger",
                message: "Lunghezza Log superata (" + this.maxLines + " linee). 20% delle righe vecchie verranno troncate.",
                silent: this.alerts != "normal",
                callb: async () => {
                    downloadString(await this.content(), `log-${this.jsScript.getVariableValue("TSPersonaggio")||"sconosciuto"}-${new Date().toLocaleDateString()}.txt`)
                    this.clear()
                }
            })
        }
    }

    async rollLog() {
        if (!this.db || !this.isEnabled()) {
            return;
        }
        const keys = await this.db.getAllKeys("lines", null, Math.trunc(this.lineCount() * 0.2));
        if (keys.length) {
            const maxKey = keys[keys.length-1]
            console.log("RollLog on " + maxKey)
            const tx = this.db.transaction("lines", "readwrite")
            await tx.store.delete(IDBKeyRange.upperBound(maxKey))
            this.numLines = await this.db.count("lines");
        }
    }

    lineCount():number {
        return this.numLines;
    }
    
    clear() {
        if (!this.db) {
            return;
        }
        this.db.clear("lines")
        this.numLines = 0;
    }

    isEnabled() {
        return localStorage.getItem("autologging")=="true";
    }

    start() {
        localStorage.setItem("autologging", true.toString())
    }

    stop() {
        localStorage.setItem("autologging", false.toString())
    }

    empty(): boolean {
        return this.numLines == 0;
    }

    async allLines() {
        return (this.db).getAll("lines")
    }

    async content(): Promise<string> {
        
        let lines:Array<string> = await this.allLines();
        
        if (!lines) {
            return "";
        }

        return lines.join("\n");
    }
}
