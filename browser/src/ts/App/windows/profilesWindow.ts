import { Profile, ProfileManager } from "../profileManager";
import { Button, ButtonOK, Messagebox, messagebox } from "../messagebox";
import { ProfileWindow } from "./profileWindow";
import { Client } from "../client";
import { Acknowledge, AskReload, circleNavigate } from "../../Core/util";
import { TsClient } from "../client";
import { EventHook } from "../../Core/event";
import { LayoutManager } from "../layoutManager";
import { WindowManager } from "../windowManager";

const connectText = "Connessione";

export class ProfilesWindow {
    private $win: JQuery;
    public EvtClosedClicked = new EventHook<boolean>();
    private autologinTime:number = -1;
    private profileList: JQuery;
    private createButton: HTMLButtonElement;
    private editButton: HTMLButtonElement;
    private deleteButton: HTMLButtonElement;
    private connectButton: HTMLButtonElement;
    offlineButton: HTMLButtonElement;
    autologinInterval: number;
    manualClose: boolean = true;

    constructor(private manager:ProfileManager, private windowManager:WindowManager, private layoutManager:LayoutManager, private profileWin:ProfileWindow, private client:Client) {
        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "winProfiles";
        document.body.appendChild(win);

        win.innerHTML = `
        <!--header-->
        <div>Profilo / Personaggio</div>
        <!--content-->
        <div>
            <div style="display:flex;flex-direction:column;height:100%">
                <div>
                    <span style="display:inline-block;margin:5px;">Quale profilo vuoi usare?</span>
                </div>
                <div style="display:flex;">
                    <select class="winProfiles-profiles"></select>
                </div>
                <div>
                    <button title="Crea profilo" class="winProfiles-crea greenbutton">✚</button>
                    <button title="Cancella selezionato" class="winProfiles-elimina redbutton">&#10006;</button>
                    <button title="Modifica selezionato" class="winProfiles-modifica yellowbutton">&#9965;</button>
                    <button class="winProfiles-connect bluebutton">Connessione</button>
                    <button title="Carica il profilo senza connettersi (per modificare importazion/trigger)" class="winProfiles-offline button" style="margin:10px !important;float:right;">Offline</button>
                </div>
            </div>
        </div>
        `;

        this.$win = $(win);

        this.profileList = $(win.getElementsByClassName("winProfiles-profiles")[0] as HTMLSelectElement);
        this.createButton = win.getElementsByClassName("winProfiles-crea")[0] as HTMLButtonElement;
        this.editButton = win.getElementsByClassName("winProfiles-modifica")[0] as HTMLButtonElement;
        this.offlineButton = win.getElementsByClassName("winProfiles-offline")[0] as HTMLButtonElement;
        this.deleteButton = win.getElementsByClassName("winProfiles-elimina")[0] as HTMLButtonElement;
        this.connectButton = win.getElementsByClassName("winProfiles-connect")[0] as HTMLButtonElement;
        this.profileList.width("100%");
        
        (<any>this.profileList).jqxDropDownList({closeDelay:1, width: '100%', height:'32px',autoItemsHeight: true, autoDropDownHeight: true, scrollBarSize:8, source: [], displayMember: "label", valueMember: "value"});

        this.profileList = $(win.getElementsByClassName("winProfiles-profiles")[0] as HTMLSelectElement);
        
        this.profileList.on("select", (ev, a) => { 
            var val = this.profileList.val();
            this.handleSelectClick(val);
        });

        this.profileList.on("keyup", (ev, a) => { 
            if (ev.key == "Enter") {
                this.connectButton.click();
            }
        });

        this.load();
        
        $(this.connectButton).text(connectText);

        const left = ($(window).width()-340)/2;
        const top = ($(window).height()-150)/2 - 150;
        
        (<any>this.$win).jqxWindow({width: 340, height: 150, showCollapseButton: true, position: {x: left, y: top}});
        $(this.createButton).click(this.handleNew.bind(this));
        $(this.offlineButton).click(this.handleOfflineButtonClick.bind(this));
        $(this.connectButton).click(() => setTimeout(()=>this.handleConnectButtonClick(),1));
        $(this.editButton).click(this.handleEditButtonClick.bind(this));
        $(this.deleteButton).click(this.handleDeleteButtonClick.bind(this));

        circleNavigate(this.profileList, this.offlineButton, null, this.$win);

        (<any>this.$win).on("close", () => {
            this.EvtClosedClicked.fire(this.manualClose);
            if (this.autologinInterval) clearInterval(this.autologinInterval);
        });
    }

    private load() {
        (<any>this.profileList).jqxDropDownList('clear'); 

        var source = <any>[];

        source.push({ label: '[Profilo Base]', value: '' })

        for (const iterator of this.manager.getProfiles()) {
            source.push({ label: iterator, value: iterator })
        }

        source.push({ label: '... Crea nuovo ...', value: '-1' });

        (<any>this.profileList).jqxDropDownList({source: source});

        this.profileList.val(this.manager.lastProfile);
        
    }

    private profileCreateChar:string = `Creare un profilo non vuol dire creare un personaggio.
    I personaggi devono essere creati nel terminale del gioco.
    Se non hai ancora un personaggio, connettiti con il profilo base e crealo prima.
    
    Un profilo viene legato a uno (o piu') personaggi gia' esistenti.
    
    Il profilo base connette sempre al server live.
    Esso puo' contenere alias e trigger preimpostati usabili da tutti gli altri profili.
    
    Premi il bottone per modificare il profilo base per ulteriori informazioni.`;

    private async handleNew() {
        const prof = new Profile();
        this.load();
        this.profileWin.show(prof, async (p) => {
            prof.pass = TsClient.encrypt(prof.pass);
            this.manager.create(p);
            if (p.useLayout)
                await this.setProfileLayout(p.useLayout, p);
            else if (p.layout && p.layout.items && p.layout.items.length) {
                await this.setProfileLayout(false, p);
            }
            this.manager.setCurrent(p.name, true)
            this.load();
            //this.checkBaseProfile(prof).then(async v => await this.checkProfileLayout(prof));
        });
        if (this.manager.getProfiles().length < 1) {
            this.checkBaseProfile(prof)
        }
    }

    private handleSelectClick(val:string) {
        if (val == "-1") {
            this.handleNew();
        }
    }

    private async handleOfflineButtonClick() {
        if (this.autologinInterval) {
            clearInterval(this.autologinInterval);
        }
        if (this.profileList.val() != "-1") {
            await this.manager.loadOfflineProfile(this.profileList.val())
        } else {
            await this.manager.disconnectProfile()
        }
        this.hide(true);
    }

    private async handleConnectButtonClick() {
        if (this.autologinInterval) {
            clearInterval(this.autologinInterval);
        }
        let connectProfile = async () => {
            this.manager.connectCurrentProfile()
            this.hide(false);
        };

        if (this.client.connected) {
            let ret = await Messagebox.Question(`Sei gia' connesso.

Se preferisci disconnetterti in modo normale dal gioco premi No.
Se invece vuoi forzare la disconessione premi Si.

<b>Vuoi forzare la disconessione?</b>
`);

            if (ret.button == ButtonOK) {
                await this.client.disconnect();
                if (this.profileList.val() != "-1") this.manager.setCurrent(this.profileList.val());
                connectProfile();
            }
        }
        else {
            if (this.profileList.val() != "-1") this.manager.setCurrent(this.profileList.val());
            connectProfile();
        }
    }

    public async checkNewTriggerVersion(online: boolean):Promise<number> {
        let prefix = ""
        if ((<any>window).ipcRenderer) {
            prefix = online ? "https://temporasanguinis.it/client/" : ""
        }
        const code = await $.ajax(prefix + "baseUserConfig.json?rnd="+Math.random());
    
        let baseConfigS = localStorage.getItem("userConfig")
        if (!baseConfigS) return 0;
        let baseConfig = JSON.parse(baseConfigS)
        if (!baseConfig || !baseConfig.triggers) return 0;
        if (!code) return 0;
        let baseConfigRemote = typeof code == "string" ? JSON.parse(code) : code;
        if (baseConfigRemote && baseConfigRemote.version > (baseConfig.version||0)) return baseConfigRemote.version;
        return 0;
    }

    public async ImportBaseTriggers(online: boolean) {
        let prefix = ""
        if ((<any>window).ipcRenderer) {
            prefix = online ? "https://temporasanguinis.it/client/" : ""
        }
        await $.ajax(prefix + "baseUserConfig.json?rnd="+Math.random()).done((code:any) => {
            let baseConfig = this.manager.getBaseConfig()
            let config = baseConfig;
            if (!this.manager.getCurrent()) {
                config = this.manager.activeConfig
            }
            
            if (!config.ImportText(code)) return;

            baseConfig.evtConfigImport.fire({
                owner: baseConfig,
                data: baseConfig.data.cfgVals
            })
            AskReload()
        });
    }
    private async handleEditButtonClick() {
        if (!this.profileList.val()) {
            let ret = await Messagebox.Question(`Il profilo base non puo' essere modificato.
            Esso connette al server principale senza nessun autologin.
            Quello che puo' essere fatto e' importare i trigger e alias raccomandati.

            N.b.: Gli alias e trigger del profilo base sono acessibili in tutti i profili/personaggi.
                  Si puo' sopprimere i trigger e alias di base con alias e trigger di pattern identico creati nel profilo privato del personaggio.
                  Oppure scegliendo di non usarli alla creazione di un profilo.

            <b>Vuoi includere/aggiornare i trigger e alias preimpostati nel profilo base?</b>
            `).then(v => {
                if (v.button == ButtonOK) {
                    this.ImportBaseTriggers(true);
                }
            });
        } else {
            const prof = this.manager.getProfile(this.profileList.val());
            const oldName = this.profileList.val();
            const oldPass = prof.pass;
            this.profileWin.show(prof, async (p) => {
                if (!p.layout) {
                    p.layout = null;
                    p.windows = [];
                }
                
                if (p.layout && p.layout.items && p.layout.items.length) {
                    await this.setProfileLayout(false, p);
                } else if (p.useLayout && (!p.layout || !p.layout.panes?.length))
                    await this.setProfileLayout(p.useLayout, p);

                if (oldPass != p.pass) {
                    p.pass = TsClient.encrypt(p.pass);
                }
                if (oldName != p.name) {
                    this.manager.rename(p, oldName);
                } else {
                    this.manager.saveProfiles(false);
                }
                this.manager.setCurrent(p.name, true)
                this.load();
                //this.checkBaseProfile(p).then(async v => await this.checkProfileLayout(p));
            });
        }
    }

    public async checkBaseProfile(p: Profile) {
        let resolve:Function = null;
        const ret = new Promise((res,rj)=>{
            resolve = res;
        });

        const trgs = this.manager.getBaseConfig().get("triggers");
        if (!trgs || !trgs.length || trgs.length < 17) {
            Messagebox.Question(`Sembra che non hai caricati i trigger preimpostati.
Ti serviranno se vuoi usare la disposizione schermo e il mapper e le funzionalita' automatiche.
Senza di essi avrai un client puro ma potrai comunque fare dei tuoi trigger e alias.
Potrai ad ogni modo farlo in futuro premendo il bottone giallo sul profilo base.

Vuoi caricare i trigger e alias preimpostati nel profilo base?`).then(async v => {
                if (v.button == 1) {
                    await this.ImportBaseTriggers(true).then(v => {
                        this.profileWin.load()
                    });
                }
                resolve();
            })
        } else {
            resolve();
        }

        return ret;
    }

    public async checkProfileLayout(p: Profile) {
        let resolve:Function = null;
        const ret = new Promise((res,rj)=>{
            resolve = res;
        });

        if (!p.layout || !p.layout.items || !p.layout.items.length) {
            const trgs = this.manager.getBaseConfig().get("triggers");
            if (trgs && trgs.length && trgs.length > 17) {
                Messagebox.Question(`Sembra che hai i trigger base caricati.
Ma sei senza layout...

Vuoi caricare il layout predefinito in questo profilo?`).then(async v => {
                    let loadBase = v.button == 1;
                    await this.setProfileLayout(loadBase, p);
                    resolve();
                })
            } else {
                resolve();
            }
        } else {
            resolve();
        }
        
        return ret;
    }

    private async setProfileLayout(loadBase: boolean, p: Profile) {
        if (loadBase) {
            await this.layoutManager.loadBaseLayout(p);
            if (p.layout) {
                this.layoutManager.loadLayout(p.layout);
            } else {
                this.layoutManager.unload();
            }
        } else {
            if (!p.layout || !p.layout.items || !p.layout.items.length)
                this.layoutManager.createLayout(p);
            if (p.layout) {
                this.layoutManager.loadLayout(p.layout);
            } else {
                this.layoutManager.unload();
            }
        }
    }

    private async handleDeleteButtonClick() {
        if (this.profileList.val()=="-1") { return;}
        if (!this.profileList.val()) {
            Messagebox.Show("Avvertenza",
            `Il profilo base non puo' essere cancellato.
            Se volevi cancellare un'altro profilo, prima selezionalo.
            `);
        } else {
            let ret = await Messagebox.Question(`<b>Sei sicuro di voler cancellare
            il profilo <u>${this.profileList.val()}</u></b>?

            N.B: un profilo cancellato cancella anche i trigger e gli alias in esso.
                 Non c'e' modo di recuperarlo una volta cancellato.
            `);
            if (ret.button == ButtonOK) {
                this.manager.delete(this.manager.getProfile(this.profileList.val()));
                this.load();
            }
        }
    }

    
    public show(autologin?:boolean) {
        this.manualClose = true;
        this.load();
        Acknowledge("profileCreateChar", this.profileCreateChar);
        $(this.connectButton).text(connectText);
        let wasReconnecting = this.autologinInterval
        if (autologin) {
            this.startAutoreconnect();
        } else {
            if (this.autologinInterval) {
                clearInterval(this.autologinInterval);
            }
        }
        if (!autologin || document.activeElement == $("#cmdInput")[0]) {
            (<any>this.$win).jqxWindow("open");
            (<any>this.$win).jqxWindow('bringToFront');
            setTimeout(() => $(this.profileList).focus(), 500);
        }
    }

    private startAutoreconnect() {
        this.autologinTime = 80;
        if (this.autologinInterval) {
            clearInterval(this.autologinInterval);
        }
        this.autologinInterval = <number><any>setInterval(() => {
            this.autologinTime--;
            $(this.connectButton).text(connectText + " (" + this.autologinTime + ")");
            if (this.autologinTime == 0 && this.client.socketConnected && !this.client.connected) {
                this.handleConnectButtonClick();
                if (this.autologinInterval) clearInterval(this.autologinInterval);
            } else if (this.autologinTime == 0) {
                this.startAutoreconnect();
            }
        }, 1000);
    }

    public destroy() {
        (<any>this.$win).jqxWindow("destroy");
    }

    private hide(manual:boolean) {
        this.manualClose = manual;
        (<any>this.$win).jqxWindow("close");
    }
}
