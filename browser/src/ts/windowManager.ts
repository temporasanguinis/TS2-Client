import { CustomWin } from "./customWindow";
import { EventHook } from "./event";
import { ControlType, LayoutManager } from "./layoutManager";
import { Mapper } from "./mapper";
import { MapperWindow } from "./mapperWindow";
import { Messagebox, messagebox } from "./messagebox";
import { Profile, ProfileManager } from "./profileManager";

export interface WindowData {
    name: string;
    x:number;
    y:number;
    w:number;
    h:number;
    visible:boolean;
    collapsed:boolean;
    docked:boolean;
}

export interface WindowDefinition {
    window: JQuery;
    custom:boolean;
    output: CustomWin;
    data: WindowData;
    created:boolean;
    initialized:boolean;
}

export class WindowManager {
    
    public windows: Map<string, WindowDefinition> = new Map<string, WindowDefinition>();
    public EvtEmitWindowsChanged = new EventHook<string[]>();
    private layoutManager:LayoutManager
    private mapper:Mapper
    
    constructor(private profileManager:ProfileManager) {
        profileManager.evtProfileChanged.handle((ev:{[k: string]: any})=>{
            this.load();
        });
        this.load();
    }

    public setMapper(mapper: Mapper) {
        this.mapper= mapper;
    }

    public setLayoutManager(lay:LayoutManager) {
        this.layoutManager = lay;
    }

    public getLayoutManager(): LayoutManager {
        return this.layoutManager;
    }

    private loading:boolean = false;
    public async load() {
        if (this.loading) return;
        this.loading = true;
        try {
            let cp:string;
            this.profileDisconnected();
            if (!(cp = this.profileManager.getCurrent())) {
                console.log("LOAD no profile")
                await this.deleteWindows();
                return;
            }
            //console.log("LOAD profile " + cp)
            let wnds = [...this.profileManager.getProfile(cp).windows||[]];
            //console.log("LOAD")
            //console.log(wnds)
            await this.deleteWindows();
            //console.log("LOAD Deleted")
            console.log("LOAD " + cp + ": " + wnds.map(v => v.name).join(","))
            if (wnds) for (const iterator of wnds) {
                this.windows.set(iterator.name, {
                    window: null,
                    output: null,
                    custom: null,
                    data: iterator,
                    created:false,
                    initialized: false
                });
            }
            (this.windows as any).loadedFrom = cp;

            await this.showWindows();
            this.triggerChanged();
        } finally {
            this.loading = false;
        }
    }

    public triggerChanged() {
        this.EvtEmitWindowsChanged.fire([...this.windows.keys()]);
    }

    async profileDisconnected() {
        console.log("profileDisconnected: " + this.profileManager.getCurrent())
        for (const w of this.windows) {
            if (w[1].window) {
                const wasVisible = w[1].data.visible;
                this.hide(w[1].data.name);
                (<any>w[1].window).jqxWindow("close");
                w[1].data.visible = wasVisible;
            }
        }
        //this.save()
    }

    async profileConnected() {
        console.log("profileConnected: " + this.profileManager.getCurrent())
        //await this.deleteWindows();
        this.load();
    }

    private async showWindows() {
        let resolve:Function = null;
        let toShow:string[] = [];
        var p = new Promise((rs,rj) => {
            resolve = rs;
        })
        for (const w of this.windows) {
            if (w[1].data.visible) {
                let wnd = this.createWindow(w[1].data.name);
                this.show(w[0]);
                toShow.push(w[0])
            }
        }
        let int:number = null;
        int = setInterval(()=>{
            for (const tw of toShow) {
                if (!$(".win-"+tw.replace(" ","-")).length) {
                    return;
                }
            }
            clearInterval(int);
            resolve();
        },100);
        return p;
    }

    private async deleteWindows() {
        let resolve:Function = null;
        var p = new Promise((rs,rj) => {
            resolve = rs;
        })

        let toDestroy:string[] = [];
        this.windows.forEach((v, k) => {
            console.log("DEL " + v.data.name)
            if (v.window) {
                toDestroy.push(k);
                const wasVisible = v.data.visible;
                (<any>v.window).jqxWindow("close");
                (<any>v.window).jqxWindow("destroy");
                (<any>v.window).remove();
                v.window = null;
                v.data.visible = wasVisible;
            }
            if (v.output)
                delete v.output;
        });
        //this.save()

        let int:number = null;
        int = setInterval(()=>{
            for (const tw of toDestroy) {
                if ($(".win-"+tw.replace(" ","-")).length) {
                    return;
                }
            }
            clearInterval(int);
            this.windows.clear();
            resolve();
        },100);
        return p;
    }

    public isDocked(window:string, ui:JQuery) {
        let w = ui.parents(".jqx-window");
        return w.data("docked");
    }

    public dock(window:string, ui:JQuery) { 

        if (!this.profileManager.getCurrent()) return;
        if (!this.layoutManager.getCurrent()) {
            return;
        }
        const witm = this.layoutManager.getCurrent().items.find(i => i.type == ControlType.Window && i.content == window);
        let dockPos = $("#window-dock-"+window.replace(" ","-"));
        if (!witm) {
            Messagebox.Show("Info", "Questa finestra non ha una posizione definita nel layout.\nPer poter approdarla devi definire nel layout in che pannello va\napprodata aggiungendo un elemento di tipo 'finestra'\ncon il contenuto '" + window + "'");
            return;
        }
        if (!dockPos.length) {
            Messagebox.Show("Info", "Non trovo la posizione definita nel nel layout.\nPer poter approdarla devi definire nel layout in che pannello va\napprodata aggiungendo un elemento di tipo 'finestra'\ncon il contenuto '" + window + "'");
            return;
        }
        let w = ui.parents(".jqx-window");
        w.hide()
        w.css({
            "position":"relative",
            "left":"unset",
            "top":"unset"
        });
        (<any>$(w)).jqxWindow({ draggable: false });

        w.css({
            "width": "unset",
            "height": "unset",
        });
        $(".jqx-resize", w).css({
            "width": "unset",
            "height": "unset",
        });
        $(".jqx-window-header", w).css({
            "width": "unset",
            "height": "unset",
        });
        $(".jqx-window-content", w).css({
            "width": "unset",
            "height": "unset",
        });
        w.insertAfter(dockPos);
        $(".jqx-window-pin-button",w).addClass("jqx-window-pin-button-pinned");
        w.show();
        w.data("docked", true);
        this.windows.get(window).data.docked = true;
        if ((<any>$(w))[0].sizeChanged) {
            setTimeout(() => (<any>$(w))[0].sizeChanged(), 10);
        }
        this.save();
    }

    public async unDock(window:string, ui:JQuery) {
        let w = ui.parents(".jqx-window");
        $(".jqx-window-pin-button",w).removeClass("jqx-window-pin-button-pinned");
        w.data("docked", false);
        (<any>$(w)).jqxWindow({ draggable: true }); 
        const wnd = this.windows.get(window);
        wnd.data.docked = false;
        if (wnd.output || wnd.custom) {
            delete wnd.output
            wnd.output = null;
            wnd.custom = null;
        }
        //await this.destroyWindow(window,false);
        //this.createWindow(window);
        await this.show(window);
        this.save();
    }
    
    public addDockButton(parent:JQuery, window:string) {
        parent = $(".jqx-window-header", parent);
        let btnBack = $(`<div title="Approda la finestra" class="jqx-window-dock-button-background" style="float: left;visibility: visible; width: 16px; height: 16px; margin-right: 7px; margin-left: 0px;"><div class="jqx-window-pin-button" style="width: 100%; height: 100%; top: 0px;"></div></div>`)
        parent.prepend(btnBack);
        btnBack.click(()=>{
            if (this.isDocked(window, parent)) {
                this.unDock(window, parent);
            } else {
                this.dock(window, parent);
            }
        });
    }

    public async destroyWindow(name:string, permanent:boolean) {

        let resolve:Function = null;
        var p = new Promise((rs,rj) => {
            resolve = rs;
        })
        let wdef = this.windows.get(name);
        if (wdef) {
            
            console.log("DESTROY " + wdef.data.name)
            wdef.initialized = false;
            wdef.created = false;
            if (wdef.output) delete wdef.output;
            if (wdef.window) {
                (<any>wdef.window).jqxWindow("close");
                (<any>wdef.window).jqxWindow("destroy");
                (<any>wdef.window).remove();
                delete wdef.window;
            }
            wdef.output = null;
            wdef.window = null;
            if (permanent) {
                this.windows.delete(name);
                this.save();
            }
            this.triggerChanged();
            let int:number = null;
            int = setInterval(()=>{
                let tw = wdef.data.name;
                if ($(".win-"+tw.replace(" ","-")).length) {
                    return;
                }
                clearInterval(int);
                console.log("Destroyed " + name)
                resolve();
            },100);
        } else {
            console.log("Destroyed " + name)
            resolve();
        }
        return p;
    }
    public createWindow(name:string,createData?:any):WindowDefinition {

        //console.log("createWindow " + name);
        if (createData) {
            //console.log(createData);
        }
        if (this.windows.has(name)) {
            const def = this.windows.get(name);
            //console.log("OLD " + name);
            //console.log(def);
            return def;
        }
        //console.log("NEW window" + name);

        let win = null;
        let customOutput = null;
        if (name != "Mapper") {

            win = document.createElement("div");
            win.style.display = "none";
            win.className = "win-"+name.replace(" ","-") + " customWindow";
            document.body.appendChild(win);

            win.innerHTML = `
            <!--header-->
            <div>${name}</div>
            <!--content-->
            <div>
                <div class="${$("#winOutput")[0].classList} full scrollable" id="win-${name.replace(" ","-")}"></div>
            </div>
            `;

        } else {
            customOutput = new MapperWindow(this.mapper)
            win = customOutput.Instance();
        }

        const hasLayout = this.profileManager.getCurrent()?this.profileManager.getProfile(this.profileManager.getCurrent()).useLayout:false;
        let defaults = (this.windows.get(name) || createData);

        if (createData) {
            defaults = {
                window: null,
                output: null,
                created:true,
                initialized: false,
                data: {
                    name: name,
                    w: createData.w || 450,
                    h: createData.h || 250,
                    x: createData.x || 100,
                    y: createData.y || 100,
                    visible: createData.visible || true,
                    collapsed: createData.collapsed || false,
                    docked:createData.docked==undefined?(hasLayout?true:false):createData.docked
                }
            }
        }

        let collapse = false, dock = false;
        if (defaults && defaults.data) {
            collapse = defaults.data.collapsed
            dock = defaults.data.docked
        } else {
            dock = (hasLayout?true:false)
        }

        const $win = $(win);
        const w = (<any>$win).jqxWindow({width: (defaults&&defaults.data?defaults.data.w:450), height: (defaults&&defaults.data?defaults.data.h:250), showCollapseButton: true, autoOpen: false});
        let inresize=false;
        new ResizeObserver(()=>{
            if (inresize) return;
            inresize = true;
            window.requestAnimationFrame(() => {
                const size = $(".jqx-window-content",w).height();
                if (size) $(".outputText",w).css({
                    "maxHeight": size + "px"
                });
                inresize = false;
            });
        }).observe(w[0]);

        if (defaults && defaults.data) {
            (<any>$win).jqxWindow('move', defaults.data.x, defaults.data.y);
            (<any>$win).jqxWindow('resize', defaults.data.w, defaults.data.h);
        }

        let self = this;
        w.on('moved', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let data = self.windows.get(name).data;
            data.x = event.args.x;
            data.y = event.args.y;
            self.save();
        });

        w.on('resized', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let data = self.windows.get(name).data;
            data.w = event.args.width;
            data.h = event.args.height;
            self.save();
        });

        w.on('open', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let wd = self.windows.get(name);
            if (!wd) {
                (<any>$(event.target)).jqxWindow("destroy");
                return;
            }
            if (!wd.initialized) {
                wd.initialized = true;
                setTimeout(() => {
                    self.addDockButton($(".win-"+name.replace(" ","-")),name);
                    if (collapse) (<any>w).jqxWindow('collapse'); 
                    if (dock) self.dock(name,$(".jqx-window-header", $win));
                    $("#cmdInput").focus();
                }, 500);
            }
            let data = self.windows.get(name).data;
            data.visible = true;
            self.save();
        });

        w.on('close', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let data = self.windows.get(name).data;
            data.visible = false;
            self.save();
        });

        w.on('collapse', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let data = self.windows.get(name);
            data.data.collapsed = true;
            if (data.window) {
                $(".expand", data.window).css("height","unset")
            }
            self.save();
        });

        w.on('expand', function (event:any) {
            if (!self.windows || !self.windows.get) return;
            let data = self.windows.get(name);
            data.data.collapsed = false;
            /**if (data.window) {
                $(".expand", data.window).css("height","100%")
            }*/
            self.save();
        });

        const def: WindowDefinition = {
            window: w,
            custom: customOutput ? true : false,
            output: customOutput ? null : new CustomWin("win-"+name.replace(" ","-"), this.profileManager.activeConfig),
            created: true,
            initialized: false,
            data: {
                name: name,
                w: 450,
                h: 250,
                x: 100,
                y: 100,
                visible: true,
                collapsed: false,
                docked: createData?createData.docked:(hasLayout?true:false)
            }
        }
        this.windows.set(name, def);

        if ((defaults && defaults.data.visible)||!defaults) {
            this.show(name);
        }

        if (defaults && defaults.data.collapsed) {
            (<any>$win).jqxWindow('collapse');
        }

        def.data.w = w.jqxWindow('width');
        def.data.h = w.jqxWindow('height');
        let pos = w.offset();
        def.data.x = pos.left;
        def.data.y = pos.top;

        def.data.collapsed = ((defaults && defaults.data) ? defaults.data.collapsed : w.jqxWindow('collapsed'));
        def.data.visible = ((defaults && defaults.data) ? defaults.data.visible : true);
        def.data.docked = ((defaults && defaults.data) ? defaults.data.docked : false);

        this.save();

        this.EvtEmitWindowsChanged.fire([...this.windows.keys()]);
        return def;
    }

    public save() {
         var wnds = [...this.windows.values()].map(v => v.data);
         const usr = this.profileManager.getCurrent()
         let loadedFrom = (this.windows as any).loadedFrom
        if (loadedFrom === undefined) {
            (this.windows as any).loadedFrom = usr
            loadedFrom = usr;
        }
         console.log("Save windows " + usr + "/" + loadedFrom  + ": " + wnds.map(v => v.name).join(","))
        if (loadedFrom != usr) {
            return;
        }
        this.profileManager.saveWindows(wnds);
    }

    public async show(window:string) {
        var w = this.windows.get(window);
        //console.log("SHOW " + w.data.name)
        if (!w.output && !w.custom) {
            const data = w.data;
            await this.destroyWindow(window, true);
            w = this.createWindow(window, data);
        }
        (<any>w.window).jqxWindow("open");
        (<any>w.window).jqxWindow('bringToFront');
    }

    private hide(window:string) {
        var w = this.windows.get(window);
        const oldVis = w.data.visible;
        (<any>w.window).jqxWindow("close");
        w.data.visible = oldVis;
        this.save();
    }
}
