import * as Util from "./util";
import { JsScript, Variable } from "./jsScript";
import { Class, ClassManager } from "./classManager";
import { Messagebox } from "./messagebox";
import { circleNavigate } from "./util";
declare let CodeMirror: any;

export class ClassEditor {
    protected $win: JQuery;
    protected treeOptions:jqwidgets.TreeOptions = {
        checkboxes: false, keyboardNavigation: true, source: [],
        height: "100%", width: "100%",
        toggleMode: "click", animationShowDuration: 150,
    };
    protected $listBox: JQuery;
    protected $name: JQuery;
    protected $value: JQuery;
    protected $newButton: JQuery;
    protected $deleteButton: JQuery;
    protected $mainSplit: JQuery;
    protected $saveButton: JQuery;
    protected $cancelButton: JQuery;
    $filter: JQuery;
    list: string[];
    values:Class[];
    prevName: string;
    protected jqList: jqwidgets.jqxTree;

    /* these need to be overridden */
    protected getList(): Array<string> {
        this.list = [...this.classManager.classes.keys()];
        return this.list;
    }

    protected getItem(ind: number): Class {
        return this.values[ind];
    }

    protected saveItem(cls: Class): void {
        if (this.prevName != cls.name && this.classManager.classes.has(this.prevName)) {
            this.classManager.Delete(this.prevName);
        }
        this.classManager.classes.set(cls.name, cls);
        this.classManager.saveClasses();
    }
    protected deleteItem(cls: Class): void {
        this.classManager.Delete(cls.name);
        this.classManager.saveClasses();
    }

    protected Filter(str:string) {
        $("li", this.$listBox).each((i,e) => {
            const visible = !str || $(e).text().match(new RegExp(str, 'gi')) != null;
            if (visible) {
                $(e).show();
            }
            else {
                $(e).hide();
            }
        })
    }

    constructor(private classManager:ClassManager) {
        const title: string = "Classi";
        let myDiv = document.createElement("div");
        myDiv.style.display = "none";
        document.body.appendChild(myDiv);
        this.$win = $(myDiv);
        myDiv.innerHTML = `
        <!--header-->
        <div>${title}</div>
        <!--content-->
        <div>
            <div class="winClass-mainSplit">
                <!--left panel-->
                <div class="left-pane">
                    <div class="buttons">
                        <input class="winClass-filter" type="text" placeholder="<filtro>" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off"/>
                    </div>
                    <div class="list">
                        <div class="winClass-listBox" tabindex="0"></div>
                    </div>
                    <div class="buttons">
                        <button title="Crea nuova" class="winClass-btnNew greenbutton">✚</button>
                        <button title="Elimina selezionata" class="winClass-btnDelete redbutton">&#10006;</button>
                    </div>
                </div>
                <!--right panel-->
                <div class="right-pane">
                    <div class="pane-header">
                        <div class="pane-optional">
                            <label>Nome: <input type="text" class="winClass-name fill-width" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off" disabled></label>
                            <label>
                                Abilitata
                                <input type="checkbox" title="Se disabilitata trigger/alias nella classe sono disabilitati" class="winClass-chkEnabled" disabled />
                            </label>
                        </div>
                    </div>                    
                    <div class="pane-footer">
                        <button class="winClass-btnSave bluebutton" disabled title="Accetta">&#10004;</button>
                        <button class="winClass-btnCancel" disabled title="Annulla">&#10006;</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        this.$mainSplit = $(myDiv.getElementsByClassName("winClass-mainSplit")[0]);
        this.$newButton = $(myDiv.getElementsByClassName("winClass-btnNew")[0]);
        this.$deleteButton = $(myDiv.getElementsByClassName("winClass-btnDelete")[0]);
        this.$listBox = $(myDiv.getElementsByClassName("winClass-listBox")[0]);
        this.$name = $(myDiv.getElementsByClassName("winClass-name")[0]);
        this.$value = $(myDiv.getElementsByClassName("winClass-chkEnabled")[0]);
        this.$saveButton = $(myDiv.getElementsByClassName("winClass-btnSave")[0]);
        this.$cancelButton = $(myDiv.getElementsByClassName("winClass-btnCancel")[0]);
        this.$filter = $(myDiv.getElementsByClassName("winClass-filter")[0]);
        this.$filter.keyup((e)=> {
            this.ApplyFilter();
        });

        const win_w = $(window).innerWidth()-20;
        const win_h = $(window).innerHeight()-20;

        (<any>this.$win).jqxWindow({width: Math.min(400, win_w), height: Math.min(300, win_h), showCollapseButton: true});

        classManager.changed.handle(()=>{
            if ((<any>this.$win).jqxWindow('isOpen')) this.refresh()
        });

        (<any>this.$mainSplit).jqxSplitter({
            width: "100%",
            height: "100%",
            orientation: "vertical",
            panels: [{size: "50%"}, {size: "50%"}]
        });
        
        (<any>this.$listBox).jqxTree(this.treeOptions);
        this.jqList = (<any>this.$listBox).jqxTree("getInstance");
        this.$listBox = $(myDiv.getElementsByClassName("winClass-listBox")[0]);

        circleNavigate(this.$filter, this.$cancelButton, this.$deleteButton, this.$win);

        $(this.$listBox).on("focus", (ev) => {
            setTimeout(() => {
                if (this.jqList.getSelectedItem()) this.scrollIntoView(this.jqList.getSelectedItem());
            }, 1);
        });

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
            if (item) {
                this.select(item)
                this.handleListBoxChange()
                event.preventDefault();
            }
        });
        
        this.$newButton.click(this.handleNewButtonClick.bind(this));
        this.$deleteButton.click(this.handleDeleteButtonClick.bind(this));
        this.$saveButton.click(this.handleSaveButtonClick.bind(this));
        this.$cancelButton.click(this.handleCancelButtonClick.bind(this));

        this.$win.on('open', (event) => {
            this.$win.focusable().focus()
        })
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
            $container.scrollTop(top + height - containerHeight + paddingPx);
        }
    }

    private select(item: jqwidgets.TreeItem) {
        this.$listBox.data("selected", item.value);
        this.jqList.selectItem(item);
        this.jqList.expandItem(item);
        this.scrollIntoView(item);
    }

    private ApplyFilter() {
        this.Filter(this.$filter.val());
    }

    private setEditorDisabled(state: boolean): void {
        this.$name.prop("disabled", state);
        this.$value.prop("disabled", state);
        this.$saveButton.prop("disabled", state);
        this.$cancelButton.prop("disabled", state);
        if (state) {
            this.$filter.focus();
        }
    }

    private selectNone(): void {
        this.$listBox.data("selected", null);
        this.jqList.selectItem(null);
    }

    private clearEditor(): void {
        this.$name.val("");
        this.$value.val("");
    }

    getTreeItem(v:Class) {
        let item = {
            label: (v.name || "[senza nome]"),
            expanded: false,
            value: v
        }
        return item;
    }

    private updateListBox() {
        this.list = this.getList();
        this.values = [...this.classManager.classes.values()];

        this.jqList.clear();
        this.treeOptions.source = this.values.map(v => this.getTreeItem(v));
        this.jqList.setOptions(this.treeOptions);

        this.ApplyFilter();
    };

    private handleSaveButtonClick() {
        let v:Class = this.$listBox.data("selected");

        if (!this.$name.val()) {
            Messagebox.Show("Errore", "La classe deve avere un nome!");
            return;
        }

        if (!v) {
            v = {name: null, enabled: false};
        }

        v.name = this.$name.val();
        v.enabled = this.$value.is(":checked");
        this.saveItem(v);

        this.selectNone();
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
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
    }

    private handleDeleteButtonClick() {
        let v = this.$listBox.data("selected");
        if (!v) return;

        this.deleteItem(v);

        this.clearEditor();
        this.selectNone();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleListBoxChange() {
        let item = this.$listBox.data("selected");
        this.prevName = item.name;

        if (!item) {
            this.clearEditor();
            this.setEditorDisabled(true);
            return;
        }
        this.setEditorDisabled(false);
        this.$name.val(item.name);
        this.$value.prop("checked", item.enabled).trigger("change");
    }

    public show() {
        this.refresh();

        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow("bringToFront");
    }

    private refresh() {
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }
}
