import { AliasManager } from "../aliasManager";
import { EventHook } from "../../Core/event";
import { copyData, TrigAlEditBase, TrigAlItem } from "./trigAlEditBase";
import { ProfileManager } from "../../App/profileManager";
import { JsScript } from "../jsScript";
import { ClassManager } from "../classManager";
export const EvtCopyAliasToBase = new EventHook<copyData>()

export class AliasEditor extends TrigAlEditBase {
    constructor(profileManager:ProfileManager, protected aliasManager: AliasManager,  isBase:boolean, script:JsScript, classManager:ClassManager, title?:string) {
        super(isBase, title || "Alias", script, classManager);
        this.setProfileManager(profileManager)
        aliasManager.changed.handle(()=>{
            if ((<any>this.$win).jqxWindow('isOpen')) super.refresh()
        })
        this.$isPromptCheckbox.parent().hide();
    }

    protected getCount() {
        return (this.aliasManager.aliases || []).length;
    }

    protected getListItems() {
        let triggers = this.aliasManager.aliases;
        let lst = [];
        for (let i = 0; i < triggers.length; i++) {
            lst.push(triggers[i]);
        }

        return lst;
    }

    protected supportsMacro():boolean {
        return true;
    }

    protected copyToOther(item: TrigAlItem): void {
        EvtCopyAliasToBase.fire({item: item, source: this.title, isBase: this.isBase})
    }

    protected defaultPattern: string = null;

    protected defaultValue: string = 
              "Scrivi qui il valore dell'alias. Un comando mandato al mud per linea. \n"
            + "\n$1 e' il parametro dato all'alias (e.g. in alias 'vai' lanciato con 'vai 150' $1 e' 150).\n"
            + "Per alias regex si possono creare piu parametri e poi vanno da $1 a $N.\n\n"
            + "Esempio per parlare con s: \n"
            + "  Pattern: 's'\n"
            + "  Valore : 'say $1'\n\n"
            + "Usa il @ per espandere variabili\n  Es.: get spada @borsa\n"
            + "Per alias non script c'e' una rudimentale forma di espressioni (vedi help)";

    protected defaultScript: string = 
              "Scrivi la tua script qui. Questo e' il codice\njavascript che verra eseguito.\n"
            + "Usa $1..$N per riferire a parametri dell'alias\nSolo regex puo' averne piu di uno.\n"
            + "Usa @ per riferire a variabili globali (e.g. @TSRoom).\n"
            + "Usa 'var' o 'let' per creare variabili locali.\nIl codice e' simile a java o C.\n"
            + "\n"
            + "Usa la funzione send('comandi') per lanciare\ncomandi al mud. Es.: send('kill orc');\n"
            + "Usa la funzione print('testo') per echo in locale.\nEs.: print('Arrivato un avversario!!');\n"
            + "Per altre funzioni dell'Api del client vedi help\noppure scoprile scrivendo nell'editor.\n";


    protected getList() {
        let aliases = this.aliasManager.aliases;
        let lst = [];
        for (let i = 0; i < aliases.length; i++) {
            lst.push((aliases[i].id || aliases[i].pattern)  + (aliases[i].class ? " <" + aliases[i].class + ">": ""));
        }

        return lst;
    }

    protected getItem(ind: number) {
        if (!this.aliasManager) return null;
        
        let aliases = this.aliasManager.aliases;
        if (ind < 0 || ind >= aliases.length) {
            return null;
        } else {
            return aliases[ind];
        }
    }

    protected saveItem(alias: TrigAlItem):number {
        let ind = this.aliasManager.aliases.indexOf(alias)
        if (ind < 0) {
            // New alias
            this.aliasManager.aliases.push(alias);
            ind = this.aliasManager.aliases.length - 1
        } else {
            // Update alias
            this.aliasManager.aliases[ind] = alias;
        }
        this.aliasManager.saveAliases();
        return ind;
    }

    protected deleteItem(item:TrigAlItem) {
        this.aliasManager.deleteAlias(item)
        this.aliasManager.saveAliases();
    }
}
