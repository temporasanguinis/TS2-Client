/// <reference path="../../../../node_modules/jqwidgets-framework/jqwidgets-ts/jqwidgets.d.ts"/>

import hotkeys from "hotkeys-js";
import { Button, messagebox, Messagebox, Notification } from "../../App/messagebox";
import * as Util from "../../Core/util";
import { circleNavigate, formatShortcutString } from "../../Core/util";
import { TsClient } from "../../App/client";
import { debounce } from "lodash";
import { ProfileManager } from "../../App/profileManager";
import { JsScript } from "../jsScript";
import { ClassManager } from "../classManager";

declare let CodeMirror: any;

interface ClassTreeItem {
    name: string;
    subclasses: Map<string, ClassTreeItem>;
    items: object[]
};

export interface TrigAlItem {
    pattern: string;
    value: string;
    id: string,
    class: string;
    regex: boolean;
    enabled: boolean;
    is_script: boolean;
    script?: any;
    is_prompt: boolean;
    shortcut?:string;
    temporary?: boolean;
}

export interface copyData {
    item:TrigAlItem, source:string, isBase:boolean
}

export abstract class TrigAlEditBase {
    protected $win: JQuery;
    protected treeOptions:jqwidgets.TreeOptions = {
        checkboxes: false, keyboardNavigation: true, source: [],
        height: "100%", width: "100%",
        toggleMode: "dblclick", animationShowDuration: 150
    };
    protected $listBox: JQuery;
    protected jqList: jqwidgets.jqxTree;
    protected $pattern: JQuery;
    protected $id: JQuery;
    protected $className: JQuery;
    protected $enabledCheckbox: JQuery;
    protected $macroCheckbox: JQuery;
    protected $macroLabel: JQuery;
    protected $isPromptCheckbox: JQuery;
    protected $regexCheckbox: JQuery;
    protected $scriptCheckbox: JQuery;
    protected $textArea: JQuery;
    protected $scriptArea: JQuery;
    protected codeMirror: any;
    protected $codeMirrorWrapper: JQuery;
    protected $newButton: JQuery;
    protected $importButton: JQuery;
    protected $exportButton: JQuery;
    protected $deleteButton: JQuery;
    protected $mainSplit: JQuery;
    protected $saveButton: JQuery;
    protected $cancelButton: JQuery;
    protected $filter: JQuery;
    protected $copyButton: JQuery;
    profileManager: ProfileManager;

    private readonly NOCLASS_LABEL = "[senza classe]";

    /* these need to be overridden */
    protected abstract getCount(): number;
    protected abstract getList(): Array<string>;
    protected abstract getListItems(): Array<TrigAlItem>;
    protected abstract getItem(ind: number): TrigAlItem;
    protected abstract saveItem(item:TrigAlItem): number;
    protected abstract deleteItem(item:TrigAlItem): void;
    protected abstract copyToOther(item: TrigAlItem): void;
    protected abstract supportsMacro(): boolean;

    protected abstract defaultPattern: string;
    protected abstract defaultValue: string;
    protected abstract defaultScript: string;

    protected expandItem = (itm: jqwidgets.TreeItem) => {
        $(itm.element).show();
        if (itm.parentElement) {
            $(itm.parentElement).show();
            this.jqList.expandItem(itm.parentElement);
            this.expandItem(itm.parentElement)
        }
    };

    protected Filter:Function = null;
    protected FilterImpl(str:string) {
        if (str && str.length < 2) {
            str = "";
        }
        if (!str) {
            this.jqList.collapseAll()
        }

        let rx:RegExp
        try {
            if (str[0]=="#") {
                rx  = new RegExp(str.slice(1), 'gi');
            } else {
                rx  = new RegExp(Util.escapeRegExp(str), 'gi');
            }
        } catch {
            rx  = new RegExp("", 'gi');
        }
        let items = this.jqList.getItems()
        for (const itm of items) {
            if (str)
                $(itm.element).hide()
            else
                $(itm.element).show()
        }
        for (const itm of items) {
            if (itm.value && str) {
                const txt = (<any>itm.value).id + "" + (<any>itm.value).pattern;
                const visible = txt.match(rx) != null;
                if (!!visible) {
                    this.expandItem(itm);
                    $(itm.element).show()
                }
            } else if (itm.label && str) {
                const visible = itm.label.match(rx) != null;
                if (!!visible) {
                    this.expandItem(itm);
                    $(itm.element).show()
                    $(".jqx-tree-item-li", itm.element).show()
                }
            }
        }
    }

    setProfileManager(profileManager:ProfileManager) {
        this.profileManager = profileManager
        if (profileManager) {
            profileManager.evtProfileChanged.handle(async c => {
                this.refresh()
                if (this.isOpen()) {
                    this.bringToFront()
                }
            })
        }
    }

    constructor(protected isBase:boolean, protected title: string, private script:JsScript, protected classManager: ClassManager) {
        this.Filter = debounce(this.FilterImpl, 500)
        let myDiv = document.createElement("div");
        myDiv.style.display = "none";
        document.body.appendChild(myDiv);
        this.$win = $(myDiv);
        myDiv.innerHTML = `
        <!--header-->
        <div>${title}</div>
        <!--content-->
        <div>
            <div class="winEdit-mainSplit">
                <!--left panel-->
                <div class="left-pane">
                    <div class="buttons">
                        <input class="winEdit-filter" type="text" placeholder="<filtro>"/>
                    </div>
                    <div class="list">
                        <div class="winEdit-listBox" tabindex="0" style="overflow-y: auto;"></div>
                    </div>
                    <div class="buttons">
                        <button title="Crea nuovo" class="winEdit-btnNew greenbutton">✚</button>
                        <button title="Copia in privato o preimpostato" class="winEdit-btnCopy">&#8644;</button>
                        <button title="Elimina selezionato" class="winEdit-btnDelete redbutton">&#10006;</button>
                    </div>
                </div>
                <!--right panel-->
                <div class="right-pane">
                    <div class="pane-header">
                        <div class="pane-optional">
                            <label>Modello:
                                <input spellcheck="false" autocomplete="false" type="text" class="winEdit-pattern" disabled>
                            </label>
                        </div>
                        <div class="pane-optional">
                            <label>ID: <input spellcheck="false" autocomplete="false"  size="5" type="text" class="winEdit-id" disabled placeholder="(opzionale)" title="Per visualizzare meglio nella lista o per poter usare toggleTrigger(id, stato) o toggleAlias(id, stato) in script"></label>
                            <label>Classe: <input spellcheck="false" autocomplete="false"  size="5" type="text" class="winEdit-className" disabled placeholder="(opzionale)" title="Se appartiene a una classe disablitata sara' inattivo (usare toggleClass(id, stato)"></label>
                        </div>
                        <div class="pane-options">
                            <label class="macroContainer">
                                Macro <span class="lblAliasShortcut"></span>
                                <input type="checkbox" title="Configura macro per tastiera (shortcut)" class="winEdit-chkMacro" disabled />
                            </label>
                            <label>
                                Abilitato
                                <input type="checkbox" title="Se disabilitato non scatta" class="winEdit-chkEnabled" disabled />
                            </label>
                            <label>
                                Prompt
                                <input type="checkbox" title="Scatta anche se non arriva un capolinea" class="winEdit-chkIsPrompt" disabled />
                            </label>
                            <label>
                                Regex
                                <input type="checkbox" title="Il pattern e' una regular expression" class="winEdit-chkRegex" disabled />
                            </label>
                            <label>
                                Script
                                <input type="checkbox" title="Il trigger contiene una script javascript" class="winEdit-chkScript" disabled />
                            </label>
                        </div>
                    </div>                    
                    <div class="pane-content-title">
                        <label>Azioni:</label>
                    </div>
                    <div class="pane-content">
                        <textarea spellcheck="false" autocomplete="false" class="winEdit-textArea" disabled></textarea>
                        <textarea class="winEdit-scriptArea" disabled></textarea>
                    </div>
                    <div class="pane-footer">
                        <button class="winEdit-btnImport" disabled style="min-width: 32px;float: left;" title="Importa da file">📄</button>
                        <button class="winEdit-btnExport" disabled style="min-width: 32px;float: left;" title="Esporta in file">💾</button>
                        <button class="winEdit-btnSave bluebutton" disabled title="Accetta">&#10004;</button>
                        <button class="winEdit-btnCancel" disabled title="Annulla">&#10006;</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        if (!this.supportsMacro()) {
            $(myDiv.getElementsByClassName("macroContainer")[0]).hide();
        }
        this.$mainSplit = $(myDiv.getElementsByClassName("winEdit-mainSplit")[0]);
        this.$newButton = $(myDiv.getElementsByClassName("winEdit-btnNew")[0]);
        this.$importButton = $(myDiv.getElementsByClassName("winEdit-btnImport")[0]);
        this.$exportButton = $(myDiv.getElementsByClassName("winEdit-btnExport")[0]);
        this.$copyButton = $(myDiv.getElementsByClassName("winEdit-btnCopy")[0]);
        this.$deleteButton = $(myDiv.getElementsByClassName("winEdit-btnDelete")[0]);
        this.$listBox = $(myDiv.getElementsByClassName("winEdit-listBox")[0]);
        this.$pattern = $(myDiv.getElementsByClassName("winEdit-pattern")[0]);
        this.$id = $(myDiv.getElementsByClassName("winEdit-id")[0]);
        this.$className = $(myDiv.getElementsByClassName("winEdit-className")[0]);
        this.$enabledCheckbox = $(myDiv.getElementsByClassName("winEdit-chkEnabled")[0]);
        this.$macroCheckbox = $(myDiv.getElementsByClassName("winEdit-chkMacro")[0]);
        this.$macroLabel = $(myDiv.getElementsByClassName("lblAliasShortcut")[0]);
        this.$regexCheckbox = $(myDiv.getElementsByClassName("winEdit-chkRegex")[0]);
        this.$isPromptCheckbox = $(myDiv.getElementsByClassName("winEdit-chkIsPrompt")[0]);
        this.$scriptCheckbox = $(myDiv.getElementsByClassName("winEdit-chkScript")[0]);
        this.$saveButton = $(myDiv.getElementsByClassName("winEdit-btnSave")[0]);
        this.$cancelButton = $(myDiv.getElementsByClassName("winEdit-btnCancel")[0]);
        this.$textArea = $(myDiv.getElementsByClassName("winEdit-textArea")[0]);
        this.$scriptArea = $(myDiv.getElementsByClassName("winEdit-scriptArea")[0]);
        this.$filter = $(myDiv.getElementsByClassName("winEdit-filter")[0]);
        this.$filter.keyup((e)=> {
            this.ApplyFilter();
        });

        const win_w = $(window).innerWidth()-20;
        const win_h = $(window).innerHeight()-20;

        (<any>this.$win).jqxWindow({width: Math.min(600, win_w), height: Math.min(400, win_h), showCollapseButton: true});

        (<any>this.$listBox).jqxTree(this.treeOptions);
        this.jqList = (<any>this.$listBox).jqxTree("getInstance");
        this.$listBox = $(myDiv.getElementsByClassName("winEdit-listBox")[0]);

        this.$win.on('open', (event) => {
            this.$win.focusable().focus()
            if (this.$filter.val()) this.ApplyFilter()
        })

        this.$win.on('close', (event) => {
            if (this.isDirty()) {
                Messagebox.ShowWithButtons("Salvataggio", `Sono stati rilevati cambiamenti.
Vuoi salvare prima di uscire?`, "Si", "No").then(mr => {
                if (mr.button == 1) {
                        this.handleSaveButtonClick();
                } else {
                        this.handleCancelButtonClick();
                        this.hide();
                }
                });
                this.show(true);
            }
        });

        this.$win.on("open", () => {
            let w = this.$win;
            if ((<any>this.$win).jqxWindow("collapsed")) {
                let padding = $(".jqx-window-content",(w)).css("padding")
                $(".jqx-window-content",(w)).css("padding", "0")
                setTimeout(() => {$(".jqx-window-content",(w)).css("padding", padding)}, 150)
            }
        });


        (<any>this.$mainSplit).jqxSplitter({
            width: "100%",
            height: "100%",
            orientation: "vertical",
            panels: [{size: "30%"}, {size: "70%"}]
        });

        this.codeMirror = Util.CreateCodeMirror(this.$scriptArea[0] as HTMLTextAreaElement, this.script)
        
        this.$codeMirrorWrapper = $(this.codeMirror.getWrapperElement());
        this.$codeMirrorWrapper.css("height","100%");
        this.$codeMirrorWrapper.hide();

        $(this.$filter).on("keydown", (ev) => {
            if (ev.key == "Tab" && !ev.shiftKey) {
                ev.preventDefault()
                ev.stopPropagation();
                let item = this.jqList.getSelectedItem() || this.jqList.getItems()[0];
                if (item) {
                    (<any>this.$listBox).focus()
                    this.select(item)
                    this.handleListBoxChange()
                } else {
                    (<any>this.$listBox).focus()
                }
            }
        });

        (<any>this.$listBox).on('select', (event:any) =>
        {
            var args = event.args;
            var item = this.jqList.getItem(args.element);
            this.select(item)
            this.handleListBoxChange()
        });

        this.$newButton.click(this.handleNewButtonClick.bind(this));
        this.$importButton.click(this.handleImportButtonClick.bind(this));
        this.$exportButton.click(this.handleExportButtonClick.bind(this));
        this.$copyButton.click(this.handleCopyButtonClick.bind(this));
        this.$deleteButton.click(this.handleDeleteButtonClick.bind(this));
        this.$saveButton.click(this.handleSaveButtonClick.bind(this));
        this.$cancelButton.click(this.handleCancelButtonClick.bind(this));
        this.$scriptCheckbox.change(this.handleScriptCheckboxChange.bind(this));
        this.$macroCheckbox.change(this.handleMacroCheckboxChange.bind(this));
        circleNavigate(this.$filter, this.$cancelButton, this.$deleteButton, this.$win);

    }

    private isOpen() {
        return (<any>this.$win).jqxWindow("isOpen");
    }

    private bringToFront() {
        console.log("!!! Bring to front " + this.title);
        (<any>this.$win).jqxWindow("bringToFront");
    }

    copyProperties(item:TrigAlItem) {
        if (!item) return;
        Util.importFromFile((str) => {
            if (str) {
                const tr:TrigAlItem = JSON.parse(str)
                if (tr) {
                    for (var prop in item) {
                        if (Object.prototype.hasOwnProperty.call(item, prop)) {
                            (item as any)[prop] = (tr as any)[prop];
                        }
                    }
                }
                this.handleListBoxChange();
            }
        })
    }

    async handleImportButtonClick(ev: any) {
        let item = this.$listBox.data("selected");
        if (!item || this.isDirty()) {
            if ((await Messagebox.Question("Devi prima salvare le modifiche per continuare. Vuoi farlo?")).button == Button.Ok) 
            {
                this.handleSaveButtonClick()
                setTimeout(()=>{
                    // reimport after save
                    this.handleImportButtonClick(ev)
                }, 1)
            }
            return
        }
        const ans = await Messagebox.Question("Sei sicuro di voler sovrascrivere il trigger corrente?")
        if (ans.button == Button.Ok) {
            this.copyProperties(item);
        }
    }

    async handleExportButtonClick(ev: any) {
        let item = this.$listBox.data("selected");
        if (!item) return;
        if (this.isDirty()) {
            await Messagebox.Show("Errore","Devi prima salvare le modifiche!")
            return
        }
        Util.downloadJsonToFile(item, "trigger_export_" + (item.id ? item.id : "no_id") + ".json")
    }

    async handleCopyButtonClick(ev: any) {
        let ind = this.$listBox.data("selected");
        if (!ind) {
            Notification.Show("Devi selezionare un trigger o alias.", true)
            return;
        }
        if (this.isDirty()) {
            await Messagebox.Show("Errore","Devi prima salvare le modifiche!")
            return
        }
        const ans = await Messagebox.Question("Sei sicuro di voler copiare nel profilo " + (this.isBase ? "PRIVATO":"BASE") + "?\nQuesta azione potrebbe sovrascrivere quello esistente.")
        if (ans.button == Button.Ok) {
            this.copyToOther(ind);
        }
    }

    private scrollIntoView(ti:jqwidgets.TreeItem) {
        var $container = this.$listBox;      // Only scrolls the first matched container

        var pos = $(ti.element).position(), height = $(ti.element).outerHeight();
        var containerScrollTop = $container.scrollTop(), containerHeight = $container.height();
        var top = pos.top + containerScrollTop;     // position.top is relative to the scrollTop of the containing element

        var paddingPx = $(ti.element).height() + 5;      // padding keeps the target from being butted up against the top / bottom of the container after scroll

        if (top < containerScrollTop) {     // scroll up                
            $container.scrollTop(top - paddingPx);
        }
        else if (top + height > containerScrollTop + containerHeight) {     // scroll down
            if (top + height < containerHeight) {
                $container.scrollTop(top + height - containerHeight + paddingPx);
            } else {
                $container.scrollTop(top);
            }
        }
    }

    private select(item: jqwidgets.TreeItem) {
        this.$listBox.data("selected", item.value);
        this.$listBox.data("selectedListItem", item);
        this.jqList.selectItem(item);
        this.jqList.expandItem(item);
        this.scrollIntoView(item);
    }

    protected isDirty():boolean {

        let item = this.$listBox.data("selected");

        if (!item && !this.$cancelButton.prop("disabled")) {
            return true;
        }

        if (!item) return false;

        let modified:boolean = false;
        modified = modified || (this.$pattern.val() != item.pattern);
        modified = modified || (this.$id.val() != item.id);
        modified = modified || (this.$className.val() != item.class);
        if (this.$scriptCheckbox.prop("checked")) {
            modified = modified || (this.codeMirror.getValue() != item.value);
        } else {
            modified = modified || (this.$textArea.val() != item.value);
        }
        modified = modified || (item.is_prompt != undefined && this.$isPromptCheckbox.prop("checked") != item.is_prompt)
        modified = modified || (item.enabled != undefined && this.$enabledCheckbox.prop("checked") != item.enabled);
        modified = modified || (item.shortcut != undefined && this.$macroLabel.text() != item.shortcut);
        modified = modified || (item.regex != undefined && this.$regexCheckbox.prop("checked") != item.regex);
        modified = modified || (item.is_script != undefined && this.$scriptCheckbox.prop("checked") != item.is_script);
        return modified;
    }

    private ApplyFilter() {
        if (!this.isOpen()) {
            return
        }
        this.Filter(this.$filter.val());
    }

    private setEditorDisabled(state: boolean): void {
        this.$pattern.prop("disabled", state);
        this.$id.prop("disabled", state);
        this.$className.prop("disabled", state);
        this.$enabledCheckbox.prop("disabled", state);
        this.$macroCheckbox.prop("disabled", state);
        this.$isPromptCheckbox.prop("disabled", state);
        this.$regexCheckbox.prop("disabled", state);
        this.$scriptCheckbox.prop("disabled", state);
        this.$textArea.prop("disabled", state);
        this.$codeMirrorWrapper.prop("disabled", state);
        this.$saveButton.prop("disabled", state);
        this.$importButton.prop("disabled", state);
        this.$exportButton.prop("disabled", state);
        this.$cancelButton.prop("disabled", state);
        if (state) {
            $(".right-pane", this.$win).addClass("grayed-out")
        } else {
            $(".right-pane", this.$win).removeClass("grayed-out")
        }
        this.showTextInput();
    }

    private selectNone(): void {
        this.$listBox.data("selected", null);
        this.$filter.focus();
        this.jqList.selectItem(null);
    }

    private clearEditor(): void {
        this.$pattern.val("");
        this.$textArea.val("");
        this.$id.val("");
        this.$className.val("");
        this.codeMirror.setValue("");
        this.$enabledCheckbox.prop("checked", false);
        this.$macroCheckbox.prop("checked", false);
        this.$macroLabel.text("");
        this.$regexCheckbox.prop("checked", false);
        this.$scriptCheckbox.prop("checked", false);
        this.showTextInput();
    }

    private addToClassTree(map:Map<string, ClassTreeItem>, classes:string[], item:object, trg:TrigAlItem) {
        
        if (classes.length == 1) {
            const cls = (classes[0] || this.NOCLASS_LABEL);
            let parentClass = map.get(cls);
            if (!parentClass) {
                const newCls: ClassTreeItem = {
                    name: cls,
                    items: [],
                    subclasses: new Map<string, ClassTreeItem>()
                };
                map.set(cls, newCls)
                parentClass = newCls;
            }
            (<any>item).value = trg;
            parentClass.items.push(item)
        } else {
            const cls = classes[0];
            classes.splice(0, 1)
            let parentClass = map.get(cls);
            if (!parentClass) {
                const newCls: ClassTreeItem = {
                    name: cls,
                    items: [],
                    subclasses: new Map<string, ClassTreeItem>()
                };
                map.set(cls, newCls)
                parentClass = newCls;
            }
            this.addToClassTree(parentClass.subclasses, classes, item, trg)
        }
    }

    getItemTree(parent:ClassTreeItem) {
        let item = {
            label: (parent.name || "[senza classe]"),
            expanded: false,
            items: <any>[]
        }
        if (parent.subclasses.size) {
            for (let index = 0; index < parent.subclasses.size; index++) {
                const key = [...parent.subclasses.keys()][index]
                const element = parent.subclasses.get(key);
                item.items.push(this.getItemTree(element))
            }
        }
        if (parent.items) {
            for (const itm of parent.items) {
                item.items.push(itm)
            }
        }
        return item;
    }

    private updateListBox(nofilter = false) {
        let lst = this.getListItems();

        this.jqList.clear();
        const itemMap = new Map<string, ClassTreeItem>();
        let items: object[] = []

        for (let i = 0; i < lst.length; i++) {
            this.addToClassTree(itemMap, (lst[i].class||"").split("|"), { label: lst[i].id || Util.rawToHtml(lst[i].pattern) }, lst[i])
        }

        for (const [key, value] of itemMap) {
            items.push(this.getItemTree(value))
        }
        this.treeOptions.source = items;
        this.jqList.setOptions(this.treeOptions);
        
        if (!this.$filter.val() && oneClass(lst)) {
            this.jqList.expandAll();
        } else if (!nofilter) {
            this.ApplyFilter();
        }

        return items
    };

    private saving = false;
    private handleSaveButtonClick() {
        let trg:TrigAlItem = this.$listBox.data("selected");
        if (!trg)
        {
            // new item
            trg = {
                class: '',
                enabled: true,
                id: '',
                is_prompt: false,
                is_script: true,
                pattern: '',
                regex: false,
                value: '',
                shortcut: null,
                script: null
            };    
        }

        let is_script = this.$scriptCheckbox.is(":checked");

        if (this.$macroCheckbox.is(":checked") && !this.$macroLabel.text()) {
            this.$macroCheckbox.prop("checked", false);
        }

        if (this.$regexCheckbox.is(":checked") && this.$macroCheckbox.is(":checked")) {
            //Messagebox.Show("Errore", "Un alias regex non puo' essere usato come una macro.");
            //return;
        }

        trg.pattern = this.$pattern.val()
        trg.id = this.$id.val()
        trg.value = is_script ? this.codeMirror.getValue() : this.$textArea.val()
        trg.regex = this.$regexCheckbox.is(":checked")
        trg.is_script = is_script
        trg.class = this.$className.val()
        trg.enabled = this.$enabledCheckbox.is(":checked")
        trg.is_prompt = this.$isPromptCheckbox.is(":checked")
        trg.shortcut = this.$macroLabel.text()
        trg.script = null;

        let newItem:TrigAlItem = null;
        try {
            this.saving = true
            let newIndex = this.saveItem(
                trg
            );
 
            if (newIndex>-1) {
                newItem = this.getItem(newIndex)
                if (newItem?.class && !this.classManager.HasClass(newItem.class)) {
                    this.classManager.Create(newItem.class, true)
                }
            }
        } finally {
            this.saving = false
        }

        this.selectNone();
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox(true);

        if (newItem) {
            let items = this.jqList.getItems();
            let newVal = items.find(i => (i.value as any) == newItem)
            if (newVal) this.jqList.selectItem( newVal.element )
            Notification.Show("Salvato!", false, true, 500, false, 0.5, true)
        }
    }

    private handleCancelButtonClick() {
        this.clearEditor();
        this.selectNone();
        this.setEditorDisabled(true);
    }

    private handleNewButtonClick() {
        this.clearEditor();
        this.setEditorDisabled(false);
        this.selectNone();
        this.$enabledCheckbox.prop("checked", true);
        let item = this.$listBox.data("selectedListItem");
        if (item && !item.value && item.label && item.label != this.NOCLASS_LABEL) {
            this.$className.val(item.label)
        }
        this.$pattern.attr('placeholder', this.defaultPattern || "Scrivi qui il modello (pattern)");
        this.$textArea.attr('placeholder', this.defaultValue || "Scrivi qui il contenuto");
        this.codeMirror.setOption('placeholder', this.defaultScript);
    }

    private handleDeleteButtonClick() {
        let ind = this.$listBox.data("selected");
        if (!ind) return;

        this.deleteItem(ind);

        this.clearEditor();
        this.selectNone();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private showScriptInput() {
        this.$textArea.hide();
        this.$codeMirrorWrapper.show();
        this.codeMirror.refresh();
    }

    private showTextInput() {
        this.$codeMirrorWrapper.hide();
        this.$textArea.show();
    }

    private handleListBoxChange() {
        //let ind = this.$listBox.data("selectedIndex");
        let item = this.$listBox.data("selected"); //this.getItem(ind);

        if (!item) {
            this.clearEditor();
            this.showTextInput();
            this.setEditorDisabled(true);
            return;
        }
        this.setEditorDisabled(false);
        this.$pattern.val(item.pattern);
        this.$id.val(item.id);
        this.$className.val(item.class);
        if (item.is_script) {
            this.showScriptInput();
            this.codeMirror.setValue(item.value);
            this.$textArea.val("");
        } else {
            this.showTextInput();
            this.$textArea.val(item.value);
            this.codeMirror.setValue("");
        }
        this.$isPromptCheckbox.prop("checked", item.is_prompt ? true : false)
        this.$enabledCheckbox.prop("checked", item.enabled ? true : false);
        this.$macroCheckbox.prop("checked", item.shortcut && item.shortcut.length ? true : false);
        this.$macroLabel.text(item.shortcut||'');
        this.$regexCheckbox.prop("checked", item.regex ? true : false);
        this.$scriptCheckbox.prop("checked", item.is_script ? true : false);
        //this.$pattern.focus()
    }

    private handleScriptCheckboxChange() {
        let checked = this.$scriptCheckbox.prop("checked");
        if (checked) {
            this.showScriptInput();
        } else {
            this.showTextInput();
        }
    }

    private handleMacroCheckboxChange() {
        let checked = this.$macroCheckbox.prop("checked");
        if (checked) {
            this.readShortcut();
        } else {
            this.$macroLabel.text("");
        }
    }

    async readShortcut() {

        hotkeys.deleteScope("macroInput");
        let keys:string[] = [];
        let keyStr:string = "";

        hotkeys('*', "macroInput", (evn) => {
            evn.preventDefault();
            keys = hotkeys.getPressedKeyString()
            keyStr = formatShortcutString(keys)
            $("#message0").text(keyStr);
        });

        hotkeys.setScope("macroInput");
        const res = await Messagebox.ShowWithButtons("Configurazione Macro", "Premi i tasti per attivare questo alias e poi premi Ok.\nCerte combinazioni potrebbero essere usate dal tuo navigatore.\nNon usare un tasto singolo che e' una lettera, ma usa combinazioni.\nLe macro si possono attivare solo quando ti trovi nella linea comandi.", "Ok", "Annulla");
        hotkeys.deleteScope("macroInput");
        hotkeys.setScope("macro");

        if (res.button == Button.Ok && keyStr && keyStr.length) {
            this.$macroLabel.text(keyStr)
        } else {
            this.$macroLabel.text("");
            this.$macroCheckbox.prop("checked", false);
        }
    }

    public hide(noload:boolean=false) {
        (<any>this.$win).jqxWindow("close");
    }

    public show(noload:boolean=false) {
        if (!noload) {
            this.refresh();
        }

        (<any>this.$win).jqxWindow("open");
        this.bringToFront();
    }

    public refresh() {
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox(this.saving);
    }
}

function oneClass(lst: TrigAlItem[]):boolean {
    let r:{ [key:string]:number } = {}
    lst.map(l => r[l.class]!=undefined ? r[l.class]++ : r[l.class]=0 )
    return (Object.keys(r).length <= 1)
}
