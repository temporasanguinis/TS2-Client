import { Telnet, NegotiationData, Cmd, CmdName, Opt, OptName, SubNeg, NewEnv, ExtOpt, NewEnvOpt, NewEnvName, NewEnvOptName, SubnegName } from "./telnetlib";
import { EventHook } from "./event";
import { UserConfig } from "../App/userConfig";
import { AppInfo } from "../appInfo";


const TTYPES: string[] = [
    AppInfo.AppTitle + " " + AppInfo.Version,
    "ANSI",
    "-256color"
];


export class TelnetClient extends Telnet {
    public EvtServerEcho = new EventHook<boolean>();

    public clientIp: string;
    public _mxp: boolean = false;
    public serverVars = new Map<string, string>()

    public get mxp():boolean{
        return this._mxp;
    }

    public set mxp(v:boolean){
        this._mxp = v;
        const msg = "[MXP " + (v ? "ABILITATO" : "DISABILITATO") + "]";
        this.EvtData.fire(new Uint8Array( arrayFromString(msg)).buffer);
    }

    private ttypeIndex: number = 0;

    private doNewEnviron: boolean = false;
    
    constructor(writeFunc: (data: ArrayBuffer) => void, private config:UserConfig) {
        super(writeFunc);

        this.EvtNegotiation.handle((data) => this.onNegotiation(data));
    }

    private writeNewEnvVar(varName: string, varVal: string) {
        this.writeArr([
            Cmd.IAC, Cmd.SB, Opt.NEW_ENVIRON,
            NewEnv.IS, NewEnvOpt.VAR
            ].concat(
                arrayFromString(varName),
                [NewEnvOpt.VALUE],
                arrayFromString(varVal),
                [Cmd.IAC, Cmd.SE]));
    }

    private handleEnvSeqReceiveVar(seq: number[]): [number, number, string, string?][] {
        let actions = parseNewEnvSeq(seq);
        for (const act of actions) {
            if (act && act.length > 3) {
                this.serverVars.set(act[2], act[3])
            }
        }
        this.EvtSetVariables.fire(this.serverVars)
        return actions
    }

    private handleNewEnvSeq(seq: number[]): [number, number, string, string?][] {
        let actions = parseNewEnvSeq(seq);

        let varFuncs: {[k: string]: () => string} = {
            'IPADDRESS': () => { return this.clientIp; },
            'CLIENT_NAME': () => { return TTYPES[0]; },
            'CLIENT_VERSION': () => {
                return `${AppInfo.Version}`;
            }
        };

        for (let i = 0; i < actions.length; i++) {
            let [action, varType, varName] = actions[i];
            if (action !== NewEnv.SEND) {
                console.error("Unexpected action:", actions[i]);
                continue;
            }

            if (varName === "") {
                if (varType === null) {
                    /* send all var and uservar */
                    for (let k in varFuncs) {
                        this.writeNewEnvVar(k, varFuncs[k]());
                    }
                    /* we don't support any USERVAR */
                } else if (varType === NewEnvOpt.VAR) {
                    /* send all VAR */
                    for (let k in varFuncs) {
                        this.writeNewEnvVar(k, varFuncs[k]());
                    }
                } else if (varType === NewEnvOpt.USERVAR) {
                    /* we don't support any USERVAR */
                }
            } else if (varType === NewEnvOpt.VAR) {
                if (varName in varFuncs) {
                    this.writeNewEnvVar(varName, varFuncs[varName]());
                }
            } else if (varType === NewEnvOpt.USERVAR) {
                /* we don't support any USERVAR */
            }
        }
        return actions
    }

    private onNegotiation(data: NegotiationData):boolean {
        let {cmd, opt} = data;
        if (this.debugTelnet) console.log("Telnet server negotiate: ", CmdName(cmd), OptName(opt));
        let ret = null
        if (cmd === Cmd.WILL) {
            if (opt === Opt.ECHO) {
                this.EvtServerEcho.fire(true);
                ret = [Cmd.IAC, Cmd.DO, Opt.ECHO]
                this.writeArr(ret);
            } else if (opt === Opt.NEW_ENVIRON) {
                ret = [Cmd.IAC, Cmd.DO, Opt.NEW_ENVIRON]
                this.writeArr(ret);
            } else if (opt === Opt.SGA) {
                ret = [Cmd.IAC, Cmd.DO, Opt.SGA]
                this.writeArr(ret);
            } else if (opt === ExtOpt.MXP) {
                if (this.config.getDef("mxpEnabled", true)) {
                    ret = [Cmd.IAC, Cmd.DO, ExtOpt.MXP]
                    this.writeArr(ret);
                } else {
                    ret = [Cmd.IAC, Cmd.WONT, ExtOpt.MXP]
                    this.writeArr(ret);
                }
            } else {
                ret = [Cmd.IAC, Cmd.WONT, opt]
                this.writeArr(ret);
            }
        } else if (cmd === Cmd.WONT) {
            if (opt === Opt.ECHO) {
                this.EvtServerEcho.fire(false);
                ret = [Cmd.IAC, Cmd.DONT, Opt.ECHO]
                this.writeArr(ret);
            }
        } else if (cmd === Cmd.DO) {
            if (opt === Opt.TTYPE) {
                ret = [Cmd.IAC, Cmd.WILL, Opt.TTYPE]
                this.writeArr(ret);
            } else if (opt == Opt.NEW_ENVIRON) {
                ret = [Cmd.IAC, Cmd.WILL, Opt.NEW_ENVIRON]
                this.writeArr(ret);
                this.doNewEnviron = true;
            } else if (opt === ExtOpt.MXP && this.config.getDef("mxpEnabled", true) === true) {
                ret = [Cmd.IAC, Cmd.WILL, ExtOpt.MXP]
                this.writeArr(ret);
            } else if (opt === ExtOpt.MXP && !this.config.getDef("mxpEnabled", true)) {
                ret = [Cmd.IAC, Cmd.WONT, ExtOpt.MXP]
                this.writeArr(ret);
            } else {
                ret = [Cmd.IAC, Cmd.WONT, opt]
                this.writeArr(ret);
            }
        } else if (cmd === Cmd.DONT) {
            if (opt === Opt.NEW_ENVIRON) {
                ret = [Cmd.IAC, Cmd.WONT, opt]
                this.doNewEnviron = false;
            }
        } else if (cmd === Cmd.SB) {
            let sb = this.readSbArr();
            ret = sb.length ? sb : ["OK"]
        } else if (cmd === Cmd.SE) {
            let sb = this.readSbArr();

            if (sb.length < 1) {
                return false;
            }

            if (sb.length === 1 && sb[0] === ExtOpt.MXP) {
                if (this.config.getDef("mxpEnabled", true)) {
                    this.mxp = true;
                } else {
                    this.mxp = false;
                }
                opt = ExtOpt.MXP
                ret = [Cmd.WILL, ExtOpt.MXP]
            }
            else if (sb.length === 2 && sb[0] === Opt.TTYPE && sb[1] === SubNeg.SEND) {
                opt = Opt.TTYPE
                let ttype: string;
                if (this.ttypeIndex > 0)
                    return false; // support only one TType by joinging all ttypes, legacy telnet clients are not supporter anymore
                ttype = TTYPES.join(", ") + ", IP<" + (this.clientIp || "Missing-IP") + ">";
                this.ttypeIndex++;
                
                ret = ([Cmd.IAC, Cmd.SB, Opt.TTYPE, SubNeg.IS]).concat(
                    arrayFromString(ttype),
                    [Cmd.IAC, Cmd.SE]
                )
                this.writeArr(ret);
                ret = [Cmd.IAC, Cmd.SB, Opt.TTYPE, SubNeg.IS]
                    .concat([ttype as any])
                    .concat([Cmd.IAC, Cmd.SE])
            } else if (this.doNewEnviron && sb.length > 1 && sb[0] == Opt.NEW_ENVIRON && sb[1] == SubNeg.IS) {
                opt = Opt.NEW_ENVIRON
                let seq = sb.slice(1);
                ret = this.handleEnvSeqReceiveVar(seq);
            } else if (this.doNewEnviron && sb.length > 0 && sb[0] == Opt.NEW_ENVIRON) {
                opt = Opt.NEW_ENVIRON
                let seq = sb.slice(1);
                ret = this.handleNewEnvSeq(seq);
            }
        }
        if (ret && this.debugTelnet) {
            let line = ("Telnet response: "+this.logNegotiationResponse(ret, cmd, opt))
            console.log(line)
        }
        return ret != null
    }
    logNegotiationResponse(rsp: any[], cmd:number, opt:number) {
        let str = ""
        let did1 = false
        for (const v of rsp) {
            if (typeof v == "number") {
                let c = "";
                if (cmd == Cmd.SE && opt == Opt.NEW_ENVIRON) {
                    c = (!did1 ? NewEnvName(v) : NewEnvOptName(v)) || CmdName(v) || OptName(v)
                    did1 = true
                } else if (cmd == Cmd.SE && opt == Opt.TTYPE) {
                    c = SubnegName(v) || CmdName(v) || OptName(v)
                } else {
                    c = CmdName(v) || OptName(v)
                }
                str += c + " "
            } else if (typeof v == "string") {
                str += v + " "
            } else if (typeof v == "object") {
                str += this.logNegotiationResponse(v as any, cmd, opt)
            } else {
                str += "?"
            }
        }
        return str
    }
}


function arrayFromString(str: string): number[] {
    let arr = new Array(str.length);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = str.charCodeAt(i);
    }

    return arr;
}

export function parseNewEnvSeq(seq: number[]): [number, number, string, string?][] {
    let rtn: [number, number, string, string?][] = [];

    let i: number = 0;

    let firstAct: number = null;
    let act: number = null;
    let varType: number = null;
    let varName: string = null;
    let varVal: string = null;
    
    while (true) {
        if (act !== null && varType !== null && varName !== null) {
            if (act == SubNeg.IS && varVal) {
                rtn.push([act, varType, varName, varVal]);
            } else {
                rtn.push([act, varType, varName]);
            }
            act = null;
            varType = null;
            varName = null;
            varVal = null;
        }

        if (i >= seq.length) {
            if (act != null) {
                rtn.push([act, varType, varName || ""]);
            }
            break;
        }
        
        if (act === null) {
            let first = seq[i];
            if (firstAct === null) {
                /* We are at the very start of sequence so it has to be a SEND */
                act = first;
                firstAct = act;
                i++;

                if (act !== NewEnv.SEND && act != NewEnv.IS) {
                    console.error("Only NEW-ENVIRON SEND or IS is supported but got", act);
                    break;
                }
            } else if (first === firstAct) {
                /* Some servers will repeat the SEND for each request, some won't */
                act = firstAct;
                i++;
                continue;
            } else {
                act = firstAct;
                continue;
            }
        } else if (varType === null) {
            varType = seq[i];
            if (varType !== NewEnvOpt.VAR && varType !== NewEnvOpt.USERVAR) {
                console.error("Only NEW-ENVIRON VAR and USERVAR are supported but got", varType);
                break;
            }
            i++;
            continue;
        } else {
            let start = i;
            while (i < seq.length && seq[i] >=32 && seq[i] <= 127) {
                i++;
            }
            let varNameArr = seq.slice(start, i);
            varName = String.fromCharCode.apply(String, varNameArr);

            if (act == SubNeg.IS) {
                i++;
                start = i;
                while (i < seq.length && seq[i] >=32 && seq[i] <= 127) {
                    i++;
                }
                varNameArr = seq.slice(start, i);
                varVal = String.fromCharCode.apply(String, varNameArr);
                i++;
            }
        }
    }

    return rtn;
}
