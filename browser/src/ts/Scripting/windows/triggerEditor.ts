import { EventHook } from "../../Core/event";
import { copyData, TrigAlEditBase, TrigAlItem } from "./trigAlEditBase";
import { TriggerManager } from "../triggerManager";
import { ProfileManager } from "../../App/profileManager";
import { JsScript } from "../jsScript";
import { ClassManager } from "../classManager";

export const EvtCopyTriggerToBase = new EventHook<copyData>()

export class TriggerEditor extends TrigAlEditBase {

    constructor(profileManager:ProfileManager, private triggerManager: TriggerManager,  isBase:boolean, script:JsScript, classManager: ClassManager, title?:string) {
        super(isBase, title || "Triggers", script, classManager);
        this.setProfileManager(profileManager)
        triggerManager.changed.handle(()=>{
            if ((<any>this.$win).jqxWindow('isOpen')) super.refresh()
        })
    }

    protected getCount() {
        return (this.triggerManager.triggers || []).length;
    }

    protected getListItems() {
        let triggers = this.triggerManager.triggers;
        let lst = [];
        for (let i = 0; i < triggers.length; i++) {
            lst.push(triggers[i]);
        }

        return lst;
    }

    protected supportsMacro():boolean {
        return false;
    }

    protected copyToOther(item: TrigAlItem): void {
        EvtCopyTriggerToBase.fire({item: item, source: this.title, isBase: this.isBase})
    }

    protected defaultValue: string =
         "Scrivi qui il valore del tuo trigger.\n"
        + "Puo' essere 1 o piu' comandi con certe espressioni (vedi help).\n\n"
        + "Usa $1 $2 etc per catturare pezzi dal mud tra il testo nel pattern.\n"
        + "$1 $2 etc poi possono essere usati nelle azioni. Per riferire a variabili usa @variabile\n\n"
        + "Esempio: \n"
        + "   Pattern: '$1 e' arrivato.'\n"
        + "   Azioni:  'say Ciao $1 io sono @TSPersonaggio'";

    protected defaultScript: string =
    "Scrivi la tua script qui in codice javascript.\n"
    + "Essa verra eseguita quando il trigger scatta.\n"
    + "Usa $1..$N per riferire a parametri del trigger.\n"
    + "Usa @ per riferire a variabili (e.g. @TSRoom).\n"
    + "Usa 'var' o 'let' per creare variabili locali.\nIl codice e' simile a java o C.\n"
    + "\n"
    + "Usa la funzione send('comandi') per lanciare comandi.\n  Es.: send('kill orc');\n"
    + "Usa la funzione print('testo') per per echo locale.\n  Es.: print('Arrivato un avversario!!');\n"
    + "Per altre funzioni dell'Api del client vedi help.";

    protected defaultPattern: string = null;

    protected getList() {
        let triggers = this.triggerManager.triggers;
        let lst = [];
        for (let i = 0; i < triggers.length; i++) {
            lst.push((triggers[i].id || triggers[i].pattern) + (triggers[i].class ? " <" + triggers[i].class + ">": ""));
        }

        return lst;
    }

    protected getItem(ind: number) {
        if (!this.triggerManager) return null;
        
        let triggers = this.triggerManager.triggers;
        if (ind < 0 || ind >= triggers.length) {
            return null;
        } else {
            return triggers[ind];
        }
    }

    protected saveItem(trigger:TrigAlItem): number {
        let ind = this.triggerManager.triggers.indexOf(trigger)
        if (ind < 0) {
            // New trigger
            this.triggerManager.createTrigger(trigger);
            return this.triggerManager.triggers.length-1
        } else {
            // Update trigger
            this.triggerManager.setTrigger(ind, trigger);
            return ind
        }
    }

    protected deleteItem(item:TrigAlItem) {
        this.triggerManager.deleteTrigger(item);
    }
}
