import { TsClient } from "../client";

import { CreateCodeMirror, circleNavigate, refreshVariablesInTern } from "../../Core/util";
import { Control, ControlType, DockPane, LayoutDefinition, LayoutManager, populateItemsInPanes } from "../layoutManager";
import { JsScript } from "../../Scripting/jsScript";
import { Messagebox, Notification, messagebox } from "../messagebox";
import { ProfileManager } from "../profileManager";

declare let CodeMirror: any;

export class EditPanelWindow {
    private $win: JQuery;
    private $uiitems: JQuery;
    private $drill: JQuery;
    private $preview: JQuery;
    private $previewCurrent: JQuery;
    private $add: JQuery;
    private $delete: JQuery;
    private $moveup: JQuery;
    private $movedown: JQuery;
    private $backButton: JQuery;
    private $copy: JQuery;
    private $paste: JQuery;

    private $ui_type: JQuery;
    private $ui_content: JQuery;
    private $ui_commands: JQuery;
    private $ui_isscript: JQuery;
    private $ui_tooltip: JQuery;
    
    private $ui_style: JQuery;
    private $ui_color: JQuery;
    private $ui_backcolor: JQuery;
    private $ui_css: JQuery;
    
    private $ui_stack: JQuery;
    private $ui_position: JQuery;
    private $ui_x: JQuery;
    private $ui_y: JQuery;
    private $ui_w: JQuery;
    private $ui_h: JQuery;
    
    private $ui_visible: JQuery;
    private $ui_blink: JQuery;
    private $ui_checkbox: JQuery;
    private $ui_gauge: JQuery;

    fieldDefs:any = []
    fields:JQuery[] = []
    loadFields:Function[] = []
    disableMap: Map<ControlType, JQuery[]>;
    
    constructor(private jsScript: JsScript, private layout:LayoutDefinition, private panel:DockPane, private profileM: ProfileManager) {
        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "editPanelWindow";
        document.body.appendChild(win);

        win.innerHTML = `
        <!--header-->
        <div>Modifica elemento UI</div>
        <!--content-->
        <div>
            <div style="width: 100%;height: 100%;display: flex;flex-direction: row;">
                <div class="left-pane" style="flex:1;padding:5px;;min-width: 170px;">
                    <div class="pane-header">
                        <span>Elementi contenuti:</span>
                    </div>                    
                    <div class="pane-content ui-items" style="flex:1;padding:5px;border: 1px solid #0000003b;border-radius: 5px;overflow-y: auto;">
                        
                    </div>
                    <div class="pane-footer" style="padding: 5px;text-align:center;">
                        <button title="Crea nuovo" class="editPanel-btnNew greenbutton">✚ Nuovo</button>
                        <button title="Elimina selezionato" class="editPanel-btnDelete redbutton">&#10006; Cancella</button>
                        <br>
                        <button title="Muovi in alto" class="editPanel-moveup">⬆️</button>
                        <button title="Muovi in basso" class="editPanel-movedown">⬇️</button>
                        <button title="Copia elemento selezionato" class="editPanel-copy">📄</button>
                        <button title="Incolla in questo elemento" class="editPanel-paste">📋</button>
                    </div>
                </div>
                <div class="right-pane" style="flex:3;">
                    <div class="pane-header">
                        <span>Impostazioni selezionato:</span>
                    </div>                    
                    <div class="pane-content" style="display:flex;flex-direction:column;flex:1;border: 1px solid #0000003b;border-radius: 5px;">
                        <div class="jqxTabs ui-active">
                            <ul>
                                <li>Definizione</li>
                                <li>Stile</li>
                                <li>Posizionamento</li>
                                <li>Avanzate</li>
                            </ul>
                            <div>
                                <div style="margin:5px;display: flex;flex-direction: column;overflow-y:auto">
                                    <table>
                                        <tr title="Il tipo di elemento nell'UI. Finestra serve per dare una posizione per ancorare a una finestra. In Modello dai il nome della finestra.">
                                            <td class="editpanel-firsttd">
                                                Tipo
                                            </td>
                                            <td style="display:flex;">
                                                <select class="ui-type" style="flex:1">
                                                    <option value="0">Pulsante</option>
                                                    <option value="1">Pannello</option>
                                                    <option value="2">Ancora finestra</option>
                                                    <option value="3">Pulsante a discesa</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr title="Il codice per renderizzare il contenuto dell'elemento - vedi help">
                                            <td class="editpanel-firsttd">
                                                Modello
                                            </td>
                                            <td style="display:flex;">
                                                <textarea class="ui-content" style="flex:1;font-size:small;height:50px;"></textarea>
                                            </td>
                                        </tr>
                                        <tr title="I comandi mandati al gioco quando si preme con il mouse">
                                            <td class="editpanel-firsttd">
                                                Comandi<br><span style="font-size:xx-small;opacity:0.7;">Script <input class="ui-isscript" title="E' una script JS o comandi testuali?" type="checkbox"></span>
                                            </td>
                                            <td style="display:flex;">
                                                <textarea class="ui-commands" style="flex:1;font-size:small;height:50px;"></textarea>
                                            </td>
                                        </tr>
                                        <tr title="Il tooltip quando si mette il mouse sopra l'elemento">
                                            <td class="editpanel-firsttd">
                                                Tooltip
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-tooltip" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div style="margin:5px;display: flex;flex-direction: column;overflow-y:auto">
                                    <table>
                                        <tr title="Il stile base per l'elemento, dai stili provveduti dal client">
                                            <td class="editpanel-firsttd">
                                                Stile predefinito
                                            </td>
                                            <td style="display:flex;">
                                                <select class="ui-style" style="flex:1">
                                                    <option value="">Non assegnato</option>
                                                    <option value="blue">Blu</option>
                                                    <option value="red">Rosso</option>
                                                    <option value="green">Verde</option>
                                                    <option value="yellow">Giallo</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr title="Il colore per il testo - formato html/css. Usato anche come colore sfondo per Indicatori">
                                            <td class="editpanel-firsttd">
                                                Colore testo
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-color" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Il colore di sfondo - formato html/css">
                                            <td class="editpanel-firsttd">
                                                Colore sfondo
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-backcolor" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="CSS da applicare all'elemento per stili speciali">
                                            <td class="editpanel-firsttd">
                                                CSS personalizzato
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-css" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div style="margin:5px;display: flex;flex-direction: column;overflow-y:auto">
                                    <table>
                                        <tr title="Se il posizionamento e' relativo x e y partono dalla fine dell'elemento precedente, altrimenti dall'origine dell'elemento padre">
                                            <td class="editpanel-firsttd">
                                                Posizionamento
                                            </td>
                                            <td style="display:flex;">
                                                <select class="ui-position" style="flex:1">
                                                    <option value="">Predefinito</option>
                                                    <option value="0">Relativo</option>
                                                    <option value="1">Assoluto</option>
                                                    <option value="2">Riempi spazio</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr title="Come verranno ordinati gli elementi contenuti dentro a questo">
                                            <td class="editpanel-firsttd">
                                                Ordinamento contenuto
                                            </td>
                                            <td style="display:flex;">
                                                <select class="ui-stack" style="flex:1">
                                                    <option value="">Predefinito</option>
                                                    <option value="1">Sinistra -&gt; destra</option>
                                                    <option value="2">Destra -&gt; sinistra</option>
                                                    <option value="3">Alto -&gt; basso</option>
                                                    <option value="4">Basso -&gt; alto</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr title="Dislocazione in coordinata X dall'origine">
                                            <td class="editpanel-firsttd">
                                                Posizione manuale X
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-x" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Dislocazione in coordinata Y dall'origine">
                                            <td class="editpanel-firsttd">
                                                Posizione manuale Y
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-y" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Larghezza manuale, altrimenti e' dinamica al contenuto">
                                            <td class="editpanel-firsttd">
                                                Larghezza manuale
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-w" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Altezza manuale, altrimenti e' dinamica al contenuto">
                                            <td class="editpanel-firsttd">
                                                Altezza manuale
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-h" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div style="margin:5px;display: flex;flex-direction: column;overflow-y:auto">
                                    <table>
                                        <tr title="Se vuoi che si nasconda o mostri su condizione - espressione, vedi help. Es.: TsMob!='*'">
                                            <td class="editpanel-firsttd">
                                                Visibilita'
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-visible" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Se vuoi che blinki su condizione - espressione, vedi help. Es.: TSHp<TSMaxHp/4">
                                            <td class="editpanel-firsttd">
                                                Blink
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-blink" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Se vuoi che abbia stato premuto/non premuto su condizione - espressione, vedi help. Es.: autobash">
                                            <td class="editpanel-firsttd">
                                                Stato
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-checkbox" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                        <tr title="Se vuoi che l'elemento mostri il progresso/valore di qualcosa - due variabili separate da virgola: attuale, massimo. Es.: TSHp,TSMaxHp">
                                            <td class="editpanel-firsttd">
                                                Indicatore
                                            </td>
                                            <td style="display:flex;">
                                                <input class="ui-gauge" type="text" style="flex:1;">
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="ui-active" style="padding:5px">
                            <button class="button ui-edit-drill">Modifica contenuto</button>
                            <button class="button ui-edit-preview">Anteprima</button>
                        </div>
                        <p class="ui-inactive" style="margin:20px">
                            Seleziona un elemento a sinistra per modificarlo.<br><br>
                            Ogni elemento ha delle impostazioni per come visualizzarlo e puo' avere altri elementi contenuti in se stesso.<br><br>
                            Es. un pannello con una lista di bottoni.<br><br>
                            Per ulteriori informazioni consulta il help del client e leggi la sezione per la disposizione schermo / layout.<br><br>
                            Per aggiungere / rimuovere o spostare gli elementi contenuti usa i bottoni in fondo a sinistra.<br><br>
                            <button class="button ui-edit-previewcurrent">Anteprima</button>
                        </p>
                    </div>
                    <div class="pane-footer">
                        <button class="bluebutton back">⏴Indietro</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        this.$win = $(win);
        this.$drill = $(".button.ui-edit-drill", this.$win)
        this.$preview = $(".button.ui-edit-preview", this.$win)
        this.$previewCurrent = $(".button.ui-edit-previewcurrent", this.$win)
        this.$add = $(".editPanel-btnNew", this.$win)
        this.$delete = $(".editPanel-btnDelete", this.$win)
        this.$moveup = $(".editPanel-moveup", this.$win)
        this.$movedown = $(".editPanel-movedown", this.$win);
        this.$copy = $(".editPanel-copy", this.$win);
        this.$paste = $(".editPanel-paste", this.$win);

        this.$copy.on("click", this.copyItem)
        this.$paste.on("click", this.pasteItem)
        
        this.initFields();
        
        this.$drill.on("click", () => {
            this.DrillDown()
        })

        this.$preview.on("click", () => {
            this.Preview()
        })

        this.$previewCurrent.on("click", () => {
            this.Preview(this.current as any)
        })

        this.$add.on("click", () => {
            this.AddElement()
        })
        this.$delete.on("click", () => {
            this.DeleteElement()
        })
        this.$moveup.on("click", () => {
            this.MoveUp()
        })
        this.$movedown.on("click", () => {
            this.MoveDown()
        })
        
        this.$uiitems = $(".pane-content.ui-items", this.$win)
        this.$backButton = $(".bluebutton.back", this.$win);
        const win_w = $(window).innerWidth()-20;
        const win_h = $(window).innerHeight()-20;
        (<any>this.$win).jqxWindow({resizable: false, keyboardCloseKey :'none',width: Math.min(565, win_w), height: Math.min(400, win_h), showCollapseButton: false, isModal: true});
        (<any>$('.jqxTabs',this.$win)).jqxTabs({ height: '100%', width: '360px' });

        this.$win.on('open', (event) => {
            this.$win.focusable().focus()
        })
        this.$win.on('keydown', (event) => {
            if (event.key == "Escape") {
                this.handleBackButtonClick()
            }
        });

        (<any>this.$win).jqxWindow("close")
        this.$backButton.click(this.handleBackButtonClick.bind(this));

        if (this.layout.items?.length) {
            populateItemsInPanes(this.layout)
        }

        circleNavigate(this.$win, this.$backButton, null, this.$win);
        
        this.$win.on("keyup", async (k) => {
            if (k.key.toLowerCase() == "c" && k.ctrlKey) {
                if (await this.copyItem()) {
                    k.preventDefault()
                    return false
                }
            } else if (k.key.toLowerCase() == "v" && k.ctrlKey) {
                if (await this.pasteItem()) {
                    k.preventDefault()
                    return false
                }
            }
            return true
        })

        this.unloadUiElement()
        this.startEditing(this.panel)
    }
    async Preview(c:Control = null) {
        c ||= this.editing
        if (!c) return
        let inx = {
            index: 0
        }
        let pr = $("<div class='content-wrapper' style='display:block;position:relative;font-family: Consolas, monospace;'></div>")
        let cmStub = {
            sendCmd: (cmd: string, nohistory:boolean, script:boolean) => {}
        }
        let lm:LayoutManager
        try {
            lm = new LayoutManager(null, this.jsScript, cmStub as any) 
            let pw = lm.createHierarchicalControl(inx, c, null, null)
            if (pw) {
                pw.css("flex", 1)
                if (c as any == this.panel) {
                    let el = pw.children().first()
                    el.css("flex", 1)
                    el.css("display", "flex")
                    el.css("flex-direction", "column")
                    const element = document.querySelector('#'+this.panel.id);
                    const computedStyle = getComputedStyle(element);
                    let copy = ["display","flexDirection","alignItems"]
                    for (const k of Object.keys(computedStyle)) {
                        if (copy.includes(k)) {
                            el.css(k, computedStyle[k as any])
                        }
                    }
                    el.css("height", "auto")
                    el.css("width", "auto")
                }
                pr.append(pw)
                pr.append("<div style='display:block;position:relative;width:0;height:0;clear:both;'>")
            } else {
                lm.release()
                Notification.Show("Impossibile creare l'anteprima per qualche errore nel rendering")
                return
            }
            let cc = (this.current as any)?.color
            cc ||= LayoutManager.getForecolor(this.layout)
            pr.css("color", cc)
            let bc = (this.current as any)?.background
            bc = (this.panel as any)?.background
            bc ||= LayoutManager.getBackcolor(this.layout)
            pr.css("backgroundColor", bc)
            let jc = $("<div style='min-height:32px;'>").append(pr)
            await messagebox("Anteprima", jc as any, null, "OK", "", null, false, [""], null, null, false, "");    
            lm.release()
            this.Focus()
        } catch (ex) {
            if (lm) lm.release()
             Messagebox.Show("Errore", "Impossibile creare anteprima. Creazione fallita con errore:\n\n" + ex)
         }
        pr.remove()
    }
    Focus() {
        this.$win.focus()
    }

    isInputElement() {
        if (document.activeElement?.tagName == "INPUT" ||
            document.activeElement?.tagName == "TEXTAREA" ||
            document.activeElement?.tagName == "SELECT") {
                return true
            }
        return false
    }
    copyItem = async () => {
        if (!navigator.clipboard || this.isInputElement()) {
            return false
        }
        if (!this.editing) {
            Notification.Show("Seleziona prima un elemento", true);
            return false
        }
        
        return await navigator.clipboard.writeText(JSON.stringify(this.editing, null, 2)).then(()=>{
            Notification.Show("Elemento copiato", true);
            return true
        });
    }
    
    pasteItem = async () =>  {
        if (!navigator.clipboard || this.isInputElement()) {
            return false
        }
        return navigator.clipboard.readText().then((v)=>{
            if (v && isControl(v)) {
                this.AddElement(JSON.parse(v) as Control)
                Notification.Show("Elemento incollato", true);
                return true
            } else {
                Notification.Show("La clipboard non contiene elementi validi", true);
                return false
            }
        });
    }

    private initFields() {

        this.fieldDefs = [
            [((v:JQuery) => this.$ui_type = v), '.ui-type', 'number', "type"],
            [((v:JQuery) => this.$ui_content = v), '.ui-content', 'string', "content"],
            [((v:JQuery) => this.$ui_commands = v), '.ui-commands', 'string', "commands"],
            [((v:JQuery) => this.$ui_isscript = v), '.ui-isscript', 'boolean', "is_script"],
            [((v:JQuery) => this.$ui_tooltip = v), '.ui-tooltip', 'string', "tooltip"],
            [((v:JQuery) => this.$ui_style = v), '.ui-style', 'string', "style"],
            [((v:JQuery) => this.$ui_color = v), '.ui-color', 'string', "color"],
            [((v:JQuery) => this.$ui_backcolor = v), '.ui-backcolor', 'string', "background"],
            [((v:JQuery) => this.$ui_css = v), '.ui-css', 'string', "css"],
            [((v:JQuery) => this.$ui_position = v), '.ui-position', 'number', "position"],
            [((v:JQuery) => this.$ui_stack = v), '.ui-stack', 'number', "stack"],
            [((v:JQuery) => this.$ui_x = v), '.ui-x', 'number', "x"],
            [((v:JQuery) => this.$ui_y = v), '.ui-y', 'number', "y"],
            [((v:JQuery) => this.$ui_w = v), '.ui-w', 'number', "w"],
            [((v:JQuery) => this.$ui_h = v), '.ui-h', 'number', "h"],
            [((v:JQuery) => this.$ui_visible = v), '.ui-visible', 'string', "visible"],
            [((v:JQuery) => this.$ui_blink = v), '.ui-blink', 'string', "blink"],
            [((v:JQuery) => this.$ui_checkbox = v), '.ui-checkbox', 'string', "checkbox"],
            [((v:JQuery) => this.$ui_gauge = v), '.ui-gauge', 'string', "gauge"],
        ]

        this.loadFields = []
        this.fields = []
        for (const f of this.fieldDefs) {
            this.initField(f[0], f[1], f[2], f[3]);
        }
        let ct = ControlType
        let disableMap = new Map<ControlType, JQuery[]>()
        for (const K of Object.keys(ct)) {
            disableMap.set(parseInt(K), [])
        }

        let wnds = disableMap.get(ControlType.Window)
        wnds.push(this.$ui_commands)
        wnds.push(this.$ui_isscript)
        wnds.push(this.$ui_tooltip)
        wnds.push(this.$ui_style)
        wnds.push(this.$ui_color)
        wnds.push(this.$ui_backcolor)
        wnds.push(this.$ui_css)
        wnds.push(this.$ui_position)
        wnds.push(this.$ui_stack)
        wnds.push(this.$ui_x)
        wnds.push(this.$ui_y)
        wnds.push(this.$ui_blink)
        wnds.push(this.$ui_checkbox)
        wnds.push(this.$ui_gauge)
        this.disableMap = disableMap
    }

    private initField(setUi:Function, selector:string, type:string, field:string) {
        const ui = $(selector, this.$win)
        setUi(ui);
        this.fields.push(ui)
        ui.on("blur", () => {
            if (this.editing) {
                let edt = (this.editing as any)
                if (type == "number") {
                    edt[field] = ui.val() ? parseInt(ui.val()) : null;
                } else if (type == "boolean") {
                    edt[field] = ui.prop("checked")
                } else {
                    edt[field] = ui.val() ? ui.val() : null;
                }
                if (field == "type") {
                    this.fillSubElements();
                    this.editing = this.editing;
                }
            }
        });
        this.loadFields.push(() => {
            let edt = (this.editing as any)
            if (type == "boolean") {
                ui.prop("checked", edt[field]??"")
            } else {
                ui.val(edt[field]??"")
            }
        })
    }

    MoveDown() {
        let itm = this.editing
        if (!itm) {
            Notification.Show("Devi prima selezionare l'elemento")
            return
        }
        let ind = this.current.items.findIndex(c => c == itm)
        if (ind<this.current.items.length-1) {
            this.current.items.splice(ind, 1)
            this.current.items.splice(ind+1, 0, itm)
        }
        this.startEditing(this.current)
        this.editing = itm
    }
    MoveUp() {
        let itm = this.editing
        if (!itm) {
            Notification.Show("Devi prima selezionare l'elemento")
            return
        }
        let ind = this.current.items.findIndex(c => c == itm)
        if (ind>0) {
            this.current.items.splice(ind, 1)
            this.current.items.splice(ind-1, 0, itm)
        }
        this.startEditing(this.current)
        this.editing = itm
    }
    DeleteElement() {
        let itm = this.editing
        if (!itm) {
            Notification.Show("Devi prima selezionare l'elemento")
            return
        }
        let ind = this.current.items.findIndex(c => c == itm)
        this.editing = null
        if (ind>-1) this.current.items.splice(ind, 1)
        this.startEditing(this.current)
    }
    AddElement(itm:Control = {
        type: ControlType.Button,
        paneId: "",
        content: ""
    }) {
        itm.paneId = null;
        this.current.items = this.current.items || []
        this.current.items.push(itm)
        this.startEditing(this.current)
        this.editing = itm
    }
    DrillDown() {
        if (this.editing) {
            if (this.current) {
                this.backStack.push(this.current as Control)
            }
            if (!this.editing.items?.length) {
                this.editing.items = []
            }
            this.startEditing(this.editing)
        }
    }

    current: {items?:Control[]};
    private _editing: Control;
    public get editing(): Control {
        return this._editing;
    }
    public set editing(value: Control) {
        this._editing = value;
        this.fields.forEach(f => {
            f.prop('disabled', true);
        })
        if (value) {
            this.loadUiElements();
            $(".uielement",this.$uiitems).removeClass("selected")
            this.$drill.text("Modifica contenuto (" + (value.items?.length || 0) + ")")
            let hl = $(".uielement",this.$uiitems).filter((i,f) => {
                let data = $(f).data("item")
                return data == value 
            })
            hl.addClass("selected")
            for (const f of this.fields) {
                let dv = this.disableMap.get(value.type)
                if (!dv.includes(f)) {
                    f.prop('disabled', false);
                }
            }
        } else {
            this.unloadUiElement();
            $(".uielement",this.$uiitems).removeClass("selected")
        }
    }

    backStack:Control[] = []

    private loadUiElements() {
        $(".ui-active", this.$win).show()
        $(".ui-inactive", this.$win).hide()

        for (const lf of this.loadFields) {
            lf()
        }
    }

    private unloadUiElement() {
        $(".ui-active", this.$win).hide()
        $(".ui-inactive", this.$win).show()
    }

    startEditing(o: {items?:Control[]}) {
        
        this.unloadUiElement()
        this.editing = null
        this.current = o

        const ctype = (o as any)?.type || ""

        switch (ctype) {
            case ControlType.Button:
                (<any>this.$win).jqxWindow("setTitle","Modifica elemento UI (Pulsante)")
                break
            case ControlType.Panel:
            case "":
                (<any>this.$win).jqxWindow("setTitle","Modifica elemento UI (Pannello)")  
                break
            case ControlType.Window:
                (<any>this.$win).jqxWindow("setTitle","Modifica elemento UI (Finestra)")     
                break
            case ControlType.DropDownButton:
                (<any>this.$win).jqxWindow("setTitle","Modifica elemento UI (Pulsante a discesa)")
                break
            default:
                (<any>this.$win).jqxWindow("setTitle","Modifica elemento UI")
        }

        this.fillSubElements();
        this.Focus()
    }

    private fillSubElements() {
        this.$uiitems.empty();
        
        let items = this.current.items || [];

        for (const e of items) {
            let type = "";
            let icon = "";
            switch (e.type) {
                case ControlType.Button:
                    type = "Pulsante";
                    icon = "🅱️";
                    break;
                case ControlType.Panel:
                    type = "Pannello";
                    icon = "🅿️";
                    break;
                case ControlType.Window:
                    type = "Ancora: " + e.content;
                    icon = "⏹️";
                    break;
                case ControlType.DropDownButton:
                    type = "Pulsante a discesa";
                    icon = "⏬";
                    break;
                default:
                    type = "Elemento";
                    icon = "?";
            }

            let scnt = (e.items || []).length;
            let subitems = scnt ? "<span title='Contiene altri " + scnt + " elementi' style='font-weight:bolder;opacity:0.75;float:right'>⤷" + scnt + "</span>" : "";
            $(`<div class='uielement'><span style="color:darkred;font-weight:bolder;">${icon}</span>&nbsp;${type}${subitems}</div>`).appendTo(this.$uiitems).data("item", e).on("click", (ev) => {
                let it = $(ev.target).data("item");
                if (this.editing == it)
                    this.editing = null
                else 
                    this.editing = it;
            });
        }
        setTimeout(()=>{
            $($(".jqx-tabs-title-container li", <any>$('.jqxTabs',this.$win))[0]).trigger("click");
        },1)
    }

    private handleBackButtonClick() {
        if (!this.backStack.length) {
            this.close()
        } else {
            let next = this.backStack.pop()
            this.startEditing(next)
        }
    }

    public show() {
        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow("bringToFront");
    }

    public close() {
        (<any>this.$win).jqxWindow("close");
        (<any>this.$win).jqxWindow("destroy");
    }
    
}

function isControl(v: string) {
    try {
        let c = JSON.parse(v) as Control
        if (c && Object.getOwnPropertyNames(c).includes("type") &&
            Object.getOwnPropertyNames(c).includes("content")) {
            return true
        }
    } catch {}
    return false
}
