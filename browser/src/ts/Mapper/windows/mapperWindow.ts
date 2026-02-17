import { ExitDir, Favorite, MapDatabase, Mapper, MapperOptions, MapVersion, Room, RoomExit, Zone } from "../mapper";
import { Messagebox, MessageboxResult, messagebox, Button, Notification } from "../../App/messagebox";
import { isNumeric } from "jquery";
import { IBaseWindow, WindowManager } from "../../App/windowManager";
import { EvtScriptEmitCmd, EvtScriptEmitPrint, EvtScriptEvent, ScripEventTypes } from "../../Scripting/jsScript";
import { EditMode, MapperDrawing } from "../mapperDrawing";
import { ResizeSensor } from 'css-element-queries'
import { downloadJsonToFile, importFromFile, padStart } from '../../Core/util'
import { NewLineKind } from "typescript";
import { EditRoomWin } from './editRoomWin'
import { MapperOptionsWin } from './mapperOptionsWin'
import { off } from "process";
import { Point } from "../mapperDrawing"
import { MapperMoveToZoneWin } from "./mapperMoveToZoneWin"
import { EditZoneWin } from "./editZoneWin"
import { MoveRoomsWin } from "./moveRoomsWin"
import { PropertyChanged } from "../../Scripting/jsScript"
import { AudioFader } from "../../App/audioFader";

export enum UpdateType { none = 0, draw = 1 }
export function createZoneLabel(useLabels: boolean, useId: boolean, item: Zone) {
    if (!item) {
        return "Zona sconosciuta"
    }
    return (useLabels ? (item.label || item.name) : item.name) + (useId ? " (" + (item.id ? "#"+item.id.toString() : "nuova") + ")" : "");
}

interface ClipboardItem {
    readonly types: string[];
    readonly presentationStyle: "unspecified" | "inline" | "attachment";
    getType(): Promise<Blob>;
  }
  
  interface ClipboardItemData {
    [mimeType: string]: Blob | string | Promise<Blob | string>;
  }
  
  declare var ClipboardItem: {
    prototype: ClipboardItem;
    new (itemData: ClipboardItemData): ClipboardItem;
  };


export class MapperWindow implements IBaseWindow {
    $audio:HTMLAudioElement;
    $audio2:HTMLAudioElement;
    $audio3:HTMLAudioElement;
    $audio4:HTMLAudioElement;
    fader:AudioFader = null;
    setZoneMusic(zoneId: number) {
        let opt = this.mapper.getOptions()
        if (zoneId == null) {
            this.fader?.stopAll()
            return
        }
        if (!(opt.zoneMusic??true)) return;

        let zone = this.mapper.idToZone.get(zoneId)
        if (zone?.musicUrl) {
            this.fader?.play(zone.musicUrl)
        } else {
            this.fader?.fadeOutAll()
        }
    }
    optionsWindow: MapperOptionsWin;
    editMode: EditMode = EditMode.Drag;
    allowMove: boolean = false;
    font: string;
    fontSize: number;
    roomSeen: boolean;
    requestRemap: boolean;
    requestSync: boolean;
    setMapFont() {
        const mdef = this.windowManager.windows.get("Mapper")
        if (!mdef || !mdef.data) return;
        this.font = mdef.data.font
        this.fontSize = mdef.data.fontSize
    }

    private $win: JQuery;
    private ctx: CanvasRenderingContext2D;
    private $bottomMessage:JQuery;
    private $zoneList:JQuery;
    private $menu:JQuery;
    private musicOn = true
    canvas: JQuery;
    drawing: MapperDrawing;
    private zones:Zone[] = []
    private _zoneId: number = -1;
    public get zoneId(): number {
        return this._zoneId;
    }
    public set zoneId(value: number) {
        if (this._zoneId === value) {
            this.drawing && (this.drawing.zoneId = value)
            return
        }
        this._zoneId = value >-1 ? value : null;
        if (this.drawing) {
            this.drawing.zoneId = this.zoneId
        }
        console.log("Zone id " + this._zoneId)
        if (this._zoneId >= 0 && this._zoneId != null) {
            const newSelItem = (<any>this.$zoneList).jqxDropDownList('getItemByValue', this._zoneId.toString());
            if (newSelItem && (<any>this.$zoneList).jqxDropDownList('selectedIndex')!=newSelItem.index) {
                (<any>this.$zoneList).jqxDropDownList('selectIndex', newSelItem.index );
            }
            this.setZoneMusic(this.zoneId)
        } else {
            let v = (<any>this.$zoneList).jqxDropDownList('getSelectedItem');
            if (v) (<any>this.$zoneList).jqxDropDownList('unselectItem', v ); 
            this.setZoneMusic(null)
        }
        
    }
    $zoom: JQuery;
    $level: JQuery;
    $contextMenu: JQuery;

    onEmitMapperMessage = (d:string) => {
        return this.setBottomMessage(d)
    }

    onEmitMapperSearch = (d:string) => {
        //return this.searchNameDesc(d, "")
    }

    onEmitMapperZoneChanged = (d:{id:number; zone:Zone}) => {
        if (this.drawing && this.drawing.zoneId != d.id) {
            console.log("drawing ZoneChanged ", d.id)
        }
        this.zones = [...this.mapper.idToZone.values()]
        this.loadZonesIfNeeded(!d || !d.zone)
        this.zoneId = d?.id
        if (this.drawing) {
            const rooms = this.mapper.zoneRooms.get(this.zoneId)
            if (this.zoneId!=undefined && this.zoneId>=0 && (!rooms || !rooms.length)) {
                 this.drawing.clear()
                 this.setBottomMessage("La zona non contiene stanze")
            } else if (this.zoneId == undefined || this.zoneId < 0) {
                this.drawing.clear()
                 this.setBottomMessage("Nessuna zona")
            }
            this.drawing.refresh();
        }
    }

    onEmitMapperRoomChanged = (d:{id: number, vnum:number, room:Room}) => {
        if (d.id === 0 && d.vnum === 0) return;
        if (this.drawing && this.drawing.active != d.room) {
            console.log("drawing roomChanged id:", d.id," vnum:", d.vnum, " zone:", d.room?.zone_id)
        }
        this.zoneId = d.room?.zone_id
        if (!d.room || this.zoneId < 0) {
            this.setBottomMessage("Zona sconosciuta " + (d.room?.zone_id || "?"))
        } else if (d.room) {
            const labels = this.mapper.getOptions().preferZoneAbbreviations
            const zoneName = createZoneLabel(labels, false, this.mapper.getRoomZone(d.room.id))
            let message = `[${d.room?.id}] ${d.room?.name}`
            if (labels) {
                message += " (" + zoneName + ")"
            }
            this.setBottomMessage(message)
        }

        if (this.drawing) this.drawing.setActiveRoom(d.room);
    }

    onZoomChange = (zoom: number) => {
        const zmp = ((100 - 0) * (zoom - 0.5) / (4 - 0.5)) + 0;
        this.$zoom.text("Zoom " + zmp.toFixed(0) + "%")
        this.mapper.getOptions().mapperScale = this.drawing.scale;
        this.mapper.saveOptions();
    }

    showContextMenu = (data:{x:number,y:number}) => {
        var scrollTop = $(window).scrollTop();
        var scrollLeft = $(window).scrollLeft();
        scrollLeft += this.canvas.offset().left;
        scrollTop += this.canvas.offset().top;
        const fav = !this.drawing.contextRoom ? null : this.mapper.getFavorites().find(f => f.roomId == this.drawing.contextRoom.id)
        if (fav) {
            $("[data-option-name='addfavorite']", this.$contextMenu).addClass("disabled");
            $("[data-option-name='removefavorite']", this.$contextMenu).removeClass("disabled");
        } else {
            $("[data-option-name='removefavorite']", this.$contextMenu).addClass("disabled");
            $("[data-option-name='addfavorite']", this.$contextMenu).removeClass("disabled");
        }
        if (this.mapper.mapmode || this.drawing.mapmode) {
            $("[data-option-name='edit']", this.$contextMenu).removeClass("disabled");
            $("[data-option-name='toolbox-delete']", this.$contextMenu).removeClass("disabled");
        } else {
            $("[data-option-name='edit']", this.$contextMenu).addClass("disabled");
            $("[data-option-name='toolbox-delete']", this.$contextMenu).addClass("disabled");
        }
        this.openContextMenu(data, scrollLeft, scrollTop);
        return false;
    }
    resizeSensor: ResizeObserver;
    windowTitle = "Mapper";
    selecting = false

    constructor(private mapper:Mapper,private windowManager: WindowManager) {
        const me = this
        this.optionsWindow = new MapperOptionsWin(mapper, (op:MapperOptions) => {
            const currZone = me.zoneId
            if (me.drawing) {
                me.drawing.refresh()
            }
            if (this.mapper.getOptions().zoneMusic ?? true) {
                this.setFader()
                this.fader.setVolume(this.mapper.getOptions().zoneVolume ?? 30)
            } else {
                this.destroyFader()
            }
            me.fillZonesDropDown(mapper.getZones())
            me.zoneId = currZone
        });
        let finishRoomRemapTimeout: number = 0
        EvtScriptEvent.handle(d=>{
            if (d && d.event == ScripEventTypes.VariableChanged &&
                (d.condition == me.mapper.vnumVariable ||
                 d.condition == me.mapper.roomNameVariable ||
                 d.condition == me.mapper.roomDescVariable ||
                 d.condition == me.mapper.exitsVariable)) {
                me.roomSeen = true
                const val = d.value as PropertyChanged
                if (me.requestRemap && val?.newValue != undefined) {
                    if (finishRoomRemapTimeout) {
                        clearTimeout(finishRoomRemapTimeout)
                    }
                    finishRoomRemapTimeout = setTimeout(() => {
                        me.remapRoomEnd()                 
                    }, 50) as any;
                }
            }
        });
        let win = document.createElement("div");
        win.style.display = "none";
        win.className = "win-Mapper";
        document.body.appendChild(win);

        win.innerHTML = `
        <!--header-->
        <div>${this.windowTitle}</div>
        <!--content-->
        <div id="win-Mapper" class="expand">
            <audio autoplay="false" class="mapper-audio" style="display:none"></audio>
            <audio autoplay="false" class="mapper-audio2" style="display:none"></audio>
            <audio autoplay="false" class="mapper-audio3" style="display:none"></audio>
            <audio autoplay="false" class="mapper-audio4" style="display:none"></audio>
            <div class="toprow">
                <div id="mapperMenubar" class="menuBar">
                    <ul class='custom'>
                        <li id="dati" class='custom' data-option-type="mapper" data-option-name="load">Dati
                            <ul  class='custom'>
                            <li  class='custom' data-option-type="mapper" data-option-name="mapmode">Modalita' mappaggio</li>
                            <li type='separator'></li>
                            <li  class='custom' data-option-type="mapper" data-option-name="reload">Usa mappa pubblica</li>
                            <li  class='custom' data-option-type="mapper" data-option-name="reloadLocal">Usa mappa privata</li>
                            <li  class='custom electron' data-option-type="mapper" data-option-name="reloadweb">Usa mappa online</li>
                            <li type='separator'></li>
                            <li  class='custom' data-option-type="mapper" data-option-name="exportall">Scarica la mappa</li>
                            <li  class='custom' data-option-type="mapper" data-option-name="exportzone">Scarica zona corrente</li>
                            <li  class='custom' data-option-type="mapper" data-option-name="importzone">Carica zona o zone</li>
                            </ul>
                        </li>
                        <li id="azioni" class='custom'>Azioni
                            <ul  class='custom'>
                            <li  class='custom' data-option-type="mapper" data-option-name="pathfind">Vai a num. locazione</li>
                            <li  class='custom' data-option-type="mapper" data-option-name="search">Cerca locazione</li>
                            <li type='separator'></li>
                            <li  class='custom' data-option-type="mapper" data-option-name="sync">Sincronizza mappa</li>
                            <li  class='custom' data-option-type="mapper" data-option-name="export">Esporta immagine</li>
                            <li type='separator'></li>
                            <li  class='custom' data-option-type="mapper" data-option-name="mapperroom">Modifica stanza</li>
                            </ul>
                        </li>
                        <li id="mapperaltro" class='custom'>Altro
                            <ul  class='custom'>
                                <li id="favorites" class='custom'>Favoriti
                                    <ul  class='custom' id="mapFavorites">
                                        <li class='custom jqx-item jqx-menu-item jqx-rc-all' role='menuitem'>&lt;nesuno&gt;</li> 
                                    </ul>
                                </li>
                                <li  class='custom' data-option-type="mapper" data-option-name="legend">Leggenda</li>
                                <li type='separator'></li>
                                <li  class='custom' data-option-type="mapper" data-option-name="info">Informazioni</li>
                                <li  class='custom' data-option-type="mapper" data-option-name="mapversion">Versione mappa</li>
                                <li type='separator'></li>
                                <li  class='custom' data-option-type="mapper" data-option-name="impostazioni">Impostazioni</li>
                            </ul>
                        </li>
                    </ul>
                    <div id="mappertoolbar">
                        <button title="Livello inferiore" class="maptoolbarbutton" data-option-type="mapper" data-option-name="leveldown">&#9660;</button>
                        <span id="level">Lv. 0</span>
                        <button title="Livello superiore" class="maptoolbarbutton" data-option-type="mapper" data-option-name="levelup">&#9650;</button>
                        <!--<button title="Sincronizza mappa" class="maptoolbarbutton" data-option-type="mapper" data-option-name="sync">&#128269;</button>-->
                        <button title="Abbassa zoom (mouse scroll down)" class="maptoolbarbutton" data-option-type="mapper" data-option-name="zoomout">-</button>
                        <span id="zoom">Zoom 100%</span>
                        <button title="Ingrandisci (mouse scroll up)" class="maptoolbarbutton" data-option-type="mapper" data-option-name="zoomin">+</button>
                        <button title="Musica" class="maptoolbarbutton toggled music gray-emoji" data-option-type="mapper" data-option-name="music">🎶</button>
                    </div>
                </div>
                <div id="zonemessage">
                    <select id="zonelist"></select>
                </div>
            </div>
            <div class="mapperworkarea midrow">
                <div class="mappertoolbox draggable">
                    <div class="mappertoolbox-header">
                        <div class="mappertoolbox-title draghandle">Tools
                            <div title="Espandi" class="attrezziexpand draggable-expand" style="display:none;pointer-events:none;">▾</div>
                            <div title="Collassa" class="attrezzicollapse draggable-collapse" style="display:inline-block;pointer-events:none;">▴</div>
                        </div> 
                    </div>
                    <div class="mapperworkarea-toolboxbuttons draggable-content">
                        <span style="">Mouse</span>
                        <button title="Sposta visuale o selezione singola" class="maptoolboxbutton selected" data-option-type="mapper" data-option-name="toolbox-pan">🤚</button>
                        <button title="Selezione rettangolare (Shift[+Ctrl])" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-select">⛶</button>
                        <button title="Consenti movimento stanze" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-move">✣</button>
                        <button title="Crea uscita" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-createlink">↦</button>
                        <span style="margin-top:3px;">Azioni</span>
                        <button title="Rimappa stanza corrente" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-remap">&check;</button>
                        <button title="Aggiungi nuova stanza" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-add">➕</button>
                        <button title="Cancella selezionate" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-delete">❌</button>
                        <button title="Muovi selezionate" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-movewindow">↔️</button>
                        <button title="Sposta selezionate in altra zona" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-movetozone">✂️</button>
                        <button title="Modifica proprieta' delle stanze selezionate" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-editrooms">🔧</button>
                        <span style="margin-top:3px;">Zone</span>
                        <button title="Crea nuova zona" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-newzone">🏘️</button>
                        <button title="Cancella zona corrente" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-deletezone">🗑️</button>
                        <button title="Modifica proprieta' della zona" class="maptoolboxbutton" data-option-type="mapper" data-option-name="toolbox-editzone">⚙️</button>
                    </div>
                </div>
                <div class="midrow"><canvas tabindex="999" id="mapcanvas"></canvas></div>
            </div>
            <div class="bottomrow"><span id="mapmessage"></span></div>
            <div id='mapperContextMenu' style="display:none">
                <ul style="overflow:visible;">
                <li  class='custom' data-option-type="mapper" data-option-name="addfavorite">Aggiungi a favoriti</li>
                <li  class='custom' data-option-type="mapper" data-option-name="removefavorite">Rimuovi da favoriti</li>
                <li type='separator'></li>
                <li  class='custom' data-option-type="mapper" data-option-name="vai">Vai</li>
                <li  class='custom' data-option-type="mapper" data-option-name="set">Posiziona</li>
                <li type='separator'></li>
                <li  class='custom' data-option-type="mapper" data-option-name="edit">Modifica</li>
                <li  class='custom' data-option-type="mapper" data-option-name="toolbox-delete">Cancella</li>
                </ul>
            </div>
        </div>
        `;

        this.$win = $(win);
        var userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.indexOf(' electron/') > -1) {
            $(".electron", this.$win).css({"display": "inline-block"}).show();
        } else {
            $(".electron", this.$win).remove();
        }

        const mnu:any = <JQuery>(<any>$("#mapperMenubar",this.$win)).jqxMenu({autoOpen: false, clickToOpen: true});
        this.$menu = mnu;
        $("#mapperMenubar", this.$win).on('itemclick', (event: any) => {
            document.getSelection().removeAllRanges();
            if ($((<any>event).args).find(".jqx-icon-arrow-left").length || $((<any>event).args).find(".jqx-icon-arrow-right").length || $((<any>event).target).closest(".jqx-menu-popup").length==0)
                return;
            this.closeMenues(mnu);
        });

        if (this.mapper.mapmode) this.showMapToolbar()
        
        this.$bottomMessage = $("#mapmessage", this.$win);
        this.$zoneList = $("#zonelist", this.$win);
        <JQuery>((<any>this.$zoneList)).jqxDropDownList({autoItemsHeight: false,searchMode:'containsignorecase', width:'100%',filterable:true, itemHeight: 20, filterPlaceHolder:'Filtra per nome:',scrollBarSize:8});
        mnu.jqxMenu('setItemOpenDirection', 'favorites', 'left', 'up');
        this.$zoom = $("#zoom", this.$win);
        this.$level = $("#level", this.$win);
        
        $("#zonelist", this.$win).on("select", (ev:any) => {
            if (this.selecting || ev.args.type == "api") return;
            this.selecting = true
            try {
                var selection = ev.args.item.value
                if (selection) {
                    (<any>$("#zonelist", this.$win)).jqxDropDownList('clearFilter');
                    if (!this.mapper.loading) {
                        this.mapper.current = null
                        this.mapper.setZoneById(parseInt(selection))
                    }
                }
            } finally {
                this.selecting = false
            }
        })

        $("#zonelist", this.$win).on("open", (ev:any) => {
            (<any>$("#zonelist", this.$win)).jqxDropDownList('clearFilter');
            $("input.jqx-listbox-filter-input", $("#listBoxzonelist")).focus();
        })

        this.canvas = <JQuery>((<any>$("#mapcanvas",this.$win)));

        const ctx = (<HTMLCanvasElement>this.canvas[0]).getContext('2d');
        this.ctx = ctx;
        (<any>this.ctx).mozImageSmoothingEnabled = false;
        (<any>this.ctx).webkitImageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
        
        const ww = Math.min($(window).width()-20, 400);
        const wh = Math.min($(window).height()-20, 300);

        (<any>this.$win).jqxWindow({showAnimationDuration: 0, width: ww, height: wh, showCollapseButton: true, isModal: false});
        const w = (<any>this.$win);
        this.$contextMenu = <JQuery>((<any>$("#mapperContextMenu", this.$win))).jqxMenu({ animationShowDelay: 0, animationShowDuration : 0, width: '100px', height: null, autoOpenPopup: false, mode: 'popup'});
        this.$audio = $(".mapper-audio", this.$win)[0] as HTMLAudioElement
        this.$audio2 = $(".mapper-audio2", this.$win)[0] as HTMLAudioElement
        this.$audio3 = $(".mapper-audio3", this.$win)[0] as HTMLAudioElement
        this.$audio4 = $(".mapper-audio4", this.$win)[0] as HTMLAudioElement
        
        this.refreshFavorites();
        var self = this;
        w.on('open', function (evt:any) {
            
            if (self.drawing) {
                self.drawing.zoomChanged.release(self.onZoomChange)
                self.drawing.showContext.release(self.showContextMenu)
                self.drawing.levelChanged.release(self.onLevelChange)
                self.drawing.destroy()
                delete self.drawing;  
            }
            self.attachHandlers(mapper, self.windowManager);
            self.detachMenu()
            self.attachMenu()
            self.drawing = new MapperDrawing(self.mapper, self.mapper.getOptions(), <HTMLCanvasElement>self.canvas[0], self.ctx);
            self.drawing.gridSize = mapper.getOptions().useGrid ? mapper.getOptions().gridSize : 1;
            self.drawing.scale = mapper.getOptions().mapperScale;
            self.drawing.allowMove = self.allowMove
            self.drawing.editMode = self.editMode
            self.drawing.mapmode = self.mapper.mapmode
            self.drawing.font = self.font
            self.drawing.fontSize = self.fontSize
            self.drawing.setFocus(true);
            self.canvas.focus()
            self.drawing.zoomChanged.handle(self.onZoomChange)
            self.drawing.levelChanged.handle(self.onLevelChange)
            self.drawing.showContext.handle(self.showContextMenu)
            self.setMapFont()
            self.onZoomChange(self.drawing.scale)
            if (!self.mapper.getDB() || !self.mapper.getDB().version || self.mapper.useLocal != self.mapper.getOptions().preferLocalMap) {
                if ((<any>window).ipcRenderer) {
                    self.loadSite.bind(self)(false);
                } else {
                    self.load.bind(self)(self.mapper.getOptions().preferLocalMap);
                }
            } else {
                if (self.mapper.getDB() && self.mapper.getDB().version && self.mapper.useLocal == self.mapper.getOptions().preferLocalMap) {
                    self.selectPreviousZoneOrFallbackToFirst();
                    const old = self.mapper.current
                    self.mapper.setRoomById(-1)
                    if (old) self.mapper.setRoomById(old.id || 0)
                    let version = self.mapper.getDB().version
                    self.refreshFavorites();
                    (<any>self.$win).jqxWindow("setTitle", self.windowTitle + (self.mapper.getOptions().preferLocalMap ? " (da locale v." + (version?.version||0) + ")" : " (pubblico v." + (version?.version||0) + ")"));
                    return;
                }
            }
            self.handleDraggingToolbox(self.$win)
        });

        this.canvas[0].addEventListener('keydown', (e:KeyboardEvent) => {
            if (!self.drawing) return;
            self.drawing.lastKey  = {
                key: e.key,
                alt: e.altKey,
                ctrl: e.ctrlKey,
                meta: e.metaKey,
                shift: e.shiftKey,
              };
            if (!self.drawing.$focused) return;
            switch (e.key) {
                case "Escape":
                    e.preventDefault();
                    e.stopPropagation();
                    self.drawing.cancelAllActions();
                    self.allowMove = self.drawing.allowMove
                    self.editMode = self.drawing.editMode
                    self.setToolboxButtonStates();
                    break;
                case "ArrowUp": //up
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("y", true, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.scrollBy(0, -1);
                    break;
                case "ArrowDown": //down
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("y", false, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.scrollBy(0, 1);
                    break;
                case "ArrowLeft": //left
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("x", true, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.scrollBy(-1, 0);
                    break;
                case "ArrowRight": //right
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("x", false, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.scrollBy(1, 0);
                    break;
                case "Delete":
                case "Backspace": //delete
                    e.preventDefault();
                    this.deleteSelection();
                    break;
                case "Numpad1": //num1
                    e.preventDefault();
                    self.drawing.scrollBy(-1, 1);
                    break;
                case "Numpad2": //num2
                    e.preventDefault();
                    self.drawing.scrollBy(0, 1);
                    break;
                case "Numpad3": //num3
                    e.preventDefault();
                    self.drawing.scrollBy(1, 1);
                    break;
                case "Numpad4": //num4
                    e.preventDefault();
                    self.drawing.scrollBy(-1, 0);
                    break;
                case "Numpad5": //num5
                    e.preventDefault();
                    self.drawing.focusCurrentRoom();
                    break;
                case "Numpad6": //num6
                    e.preventDefault();
                    self.drawing.scrollBy(1, 0);
                    break;
                case "Numpad7": //num7
                    e.preventDefault();
                    self.drawing.scrollBy(-1, -1);
                    break;
                case "Numpad8": //num8
                    e.preventDefault();
                    self.drawing.scrollBy(0, -1);
                    break;
                case "Numpad9": //num9
                    e.preventDefault();
                    self.drawing.scrollBy(1, -1);
                    break;
                case "+": //+
                case "PageUp": //-
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("z", true, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.setLevel((self.drawing.level||0) + 1);
                    break;
                case "-": //-
                case "PageDown": //-
                    e.preventDefault();
                    if (this.drawing.allowMove) {
                        this.moveRoomsOnAxis("z", false, this.mapper.getOptions().useGrid);
                    } else
                        self.drawing.setLevel((self.drawing.level||0) - 1);
                    break;
                case "Slash": // /
                    e.preventDefault();
                    //this.setZone(this.active.zone - 1);
                    break;
                case "Multiply": // *
                    e.preventDefault();
                    //this.setZone(this.active.zone + 1);
                    break;
            }
        });

        w.on('close', function (evt:any) {
            self.detachHandlers(self.mapper, self.windowManager)
            self.detachMenu()
            if (self.drawing) {
                self.drawing.zoomChanged.release(self.onZoomChange)
                self.drawing.showContext.release(self.showContextMenu)
                self.drawing.levelChanged.release(self.onLevelChange)
                self.drawing.destroy()
                delete self.drawing;  
                self.drawing = null;
            }
        });

        w.on('docked', (evt:boolean) => {
            if (this.mapper.mapmode)
                this.showMapToolbar()
            else
                this.hideMapToolbar()
            if(evt) this.handleDraggingToolbox(w)
        });

        var setSize = function () {
            if (self.drawing) self.drawing.setSize()
        }

        this.resizeSensor = new ResizeObserver(function(){ 
            setSize()
        });
        this.resizeSensor.observe(jQuery('.mapperworkarea .midrow', w)[0]);

        (<any>this.$win).jqxWindow("close");
        (<any>$(w))[0].sizeChanged = setSize;
        
        this.attachMenu();
        this.setMapFont()
    }
    private openContextMenu(data: { x: number; y: number; }, scrollLeft: number, scrollTop: number) {
        (this.$contextMenu as any).jqxMenu('open', (data.x) + 5 + scrollLeft, (data.y) + 5 + scrollTop);
        this.drawing && (this.drawing.contextMenuOpen = true);
    }

    public moveRoomsOnAxis(axis:string, positive:boolean, useGrid: boolean) {
        let offs:Point = {
            x: 0,
            y: 0,
            z: 0
        };
        let delta = useGrid ? Math.floor(this.drawing.gridSize / 7.5) : 1
        if (axis == "z") delta = 1

        if (!positive)
            delta *= -1

        offs[axis as keyof(Point)] = delta;
        this.drawing.moveRooms([...this.drawing.selectedRooms.values()], offs, useGrid);
    }

    isContextMenuOpen() {
        return (<any>this.$menu).jqxMenu("isOpen")
    }
    write(text: string, buffer: string): void {
        this.setBottomMessage(text);
    }
    writeLine(text: string, buffer: string): void {
        this.setBottomMessage(text);
    }
    getLines(): string[] {
        return [this.$bottomMessage.text()];
    }
    cls() {
        this.setBottomMessage("")
    }
    private handleDraggingToolbox(w:JQuery) {
        this.detachToolbox();
        var $dragging:JQuery = null;
        let self = this;
        var mouseData = {
            offsetTop: 0,
            offsetLeft: 0,
            moved: false
        };

        $(w).on("mousemove", function(e) {
            if ($dragging) {
                mouseData.moved = true;
                $dragging.offset({
                    top: e.pageY -  mouseData.offsetTop,
                    left: e.pageX - mouseData.offsetLeft
                });
            }
        });

        $(w).on("mousedown", function (e) {
            if (e.button != 0) return;
            if ($(e.target).is(".draghandle") && $(e.target).parents(".draggable").length) {
                $dragging = $(e.target).parents(".draggable").first();

                mouseData.offsetLeft = e.offsetX + $(e.target).offset().left - $dragging.offset().left;
                mouseData.offsetTop =  e.offsetY + $(e.target).offset().top - $dragging.offset().top;
                
            } else if ($(e.target).is(".draggable")) {
                $dragging = $(e.target);
                mouseData.offsetLeft = e.offsetX;
                mouseData.offsetTop =  e.offsetY;
            }
        });

        $(w).on("mouseup", function (e) {
            if ($dragging && !mouseData.moved && $(".draggable-content", $dragging).length) {
                if ($(".draggable-content", $dragging).is(":visible")) {
                    $(".draggable-content", $dragging).hide()
                    $(".draggable-expand", $dragging).css('display', 'inline-block')
                    $(".draggable-collapse", $dragging).hide()
                } else {
                    $(".draggable-content", $dragging).show()
                    $(".draggable-expand", $dragging).hide()
                    $(".draggable-collapse", $dragging).css('display', 'inline-block')
                }
            }
            if (mouseData.moved) {
                const left = parseInt($(".mappertoolbox", self.$win).css("left")||"0");
                const top = parseInt($(".mappertoolbox", self.$win).css("top")||"0")
                self.mapper.getOptions().toolboxX = left
                self.mapper.getOptions().toolboxY = top
                self.mapper.saveOptions()
            }
            mouseData.moved = false;
            $dragging = null;
            mouseData.offsetLeft = 0
            mouseData.offsetTop = 0
        });
    }
    private destroyMenu(mnu:any) {
        try {
            mnu.jqxMenu('destroy')
        } catch {
            console.log("Cannto destroy mapper menu")
        }
        try {
            (<any>$("#mapperContextMenu")).jqxMenu('destroy')
        } catch {
            console.log("Cannto destroy mapper context menu")
        }
        $("[data-option-type=mapper]").parents(".jqx-menu-popup").remove()
        if ($("#favorites").length > 0) {
            console.log("jqxMenu.destroy() failed")
        }
    }

    private closeMenues(mnu: any) {
        mnu.jqxMenu('closeItem', "dati");
        mnu.jqxMenu('closeItem', "azioni");
        mnu.jqxMenu('closeItem', "mapperaltro");
    }

    getFontSize():number {
        const w = this.windowManager.windows.get("Mapper")
        if (!w) return NaN;
        return w.data.fontSize
    }

    onLevelChange = (lv: number) => {
        this.$level.text("Lv. "+lv)
    }


    private attachHandlers(mapper: Mapper, windowManager:WindowManager) {
        mapper.emitMessage.handle(this.onEmitMapperMessage);
        mapper.emitSearch.handle(this.onEmitMapperSearch);
        mapper.zoneChanged.handle(this.onEmitMapperZoneChanged);
        mapper.roomChanged.handle(this.onEmitMapperRoomChanged);
        mapper.favoritesChanged.handle(this.favoritesChanged);
        windowManager.EvtEmitWindowsChanged.handle(this.onEmitWindowsChanged);
        this.handleDraggingToolbox(this.$win)
        this.destroyFader()
        if (this.mapper.getOptions().zoneMusic ?? true)
            this.setFader()
    }

    setFader() {
        this.destroyFader();
        this.fader = new AudioFader(this.mapper.getOptions().zoneVolume ?? 30, this.$audio, this.$audio2, this.$audio3, this.$audio4)
    }
    private favoritesChanged = (favoritesChanged: any) => {
        this.refreshFavorites();
    }

    private destroyFader() {
        if (this.fader) {
            this.fader.destroy();
            this.fader = null
        }
    }

    private detachHandlers(mapper: Mapper, windowManager:WindowManager) {
        mapper.emitMessage.release(this.onEmitMapperMessage);
        mapper.emitSearch.release(this.onEmitMapperSearch);
        mapper.zoneChanged.release(this.onEmitMapperZoneChanged);
        mapper.roomChanged.release(this.onEmitMapperRoomChanged);
        mapper.favoritesChanged.release(this.favoritesChanged);
        
        windowManager.EvtEmitWindowsChanged.release(this.onEmitWindowsChanged);
        this.detachToolbox();
        this.destroyFader()
    }

    onEmitWindowsChanged = (windows: string[]) => {
        if (this.drawing && windows.indexOf("Mapper")>-1) {
            this.setMapFont()
        }
    }

    private detachToolbox() {
        $(this.$win).off("mousemove");
        $(this.$win).off("mousedown");
        $(this.$win).off("mouseup");
    }

    private detachMenuOption(name:string, element:Element, checkbox:Element) {
        if (element) $(element).off("click");
        if (checkbox) $(checkbox).off("change");
    }

    private detachMenu() {
        $("[data-option-type=mapper]").filter("[data-option-name]").each((i, e) => {
            const name = $(e)[0].getAttribute("data-option-name");
            const chk = $(e).find("input[type='checkbox']")[0];
            this.detachMenuOption(name, e, chk);
        });
    }

    private attachMenu() {
        $("[data-option-type=mapper]").filter("[data-option-name]").each((i, e) => {
            const name = $(e)[0].getAttribute("data-option-name");
            const chk = $(e).find("input[type='checkbox']")[0];
            this.attachMenuOption(name, e, chk);
        });
    }

    private attachMenuOption(name:string, element:Element, checkbox:Element) {
        $(element).click(async (event: JQueryEventObject) => {
            if (!event.target || (event.target.tagName != "LI" && event.target.tagName != "BUTTON")) return false;
            if ($((<any>event).target).closest(".jqx-menu-popup").length!=0) this.closeMenues($("#mapperMenubar",this.$win));
            try {
                switch (name) {
                    case "music":
                        this.musicOn = !this.musicOn
                        this.fader?.setVolume(this.musicOn?(this.mapper.getOptions().zoneVolume??30):0)
                        this.musicOn ? $(element).addClass("toggled") : $(element).removeClass("toggled"); 
                        break;
                    case "mapmode":
                        this.toggleMapMode();
                        break;
                    case "mapversion":
                        this.showMapVersions();
                        break;
                    case "reload":
                        this.load(false);
                        break;
                    case "info":
                        this.showInfo();
                        break;
                    case "reloadweb":
                        this.loadSite(true);
                        break;
                    case "reloadLocal":
                        this.load(true);
                        break;
                    case "pathfind":
                        this.findpath();
                        break;
                    case "exportzone":
                        this.exportZone();
                        break;
                    case "importzone":
                        this.importZone();
                        break;
                    case "exportall":
                        this.exportAll();
                        break;
                    case "search":
                        this.search();
                        break;
                    case "zoomout":
                        this.drawing.setScale(this.drawing.scale - this.drawing.scale/10);
                        break;
                    case "zoomin":
                        this.drawing.setScale(this.drawing.scale + this.drawing.scale/10);
                        break;
                    case "leveldown":
                        this.drawing.setLevel(this.drawing.level-1)
                        break;
                    case "levelup":
                        this.drawing.setLevel(this.drawing.level+1)
                        break;
                    case "export":
                        this.exportImage()
                        break;
                    case "sync":
                        this.roomSeen = false
                        this.requestRemap = false
                        this.mapper.scripting.delVariable({name: this.mapper.roomNameVariable, class: "", value: null})
                        this.mapper.scripting.delVariable({name: this.mapper.roomDescVariable, class: "", value: null})
                        this.mapper.scripting.delVariable({name: this.mapper.vnumVariable, class: "", value: null})
                        EvtScriptEmitCmd.fire({owner:"Mapper", message:"look", silent: true})    
                        setTimeout((() => {
                            this.mapper.roomDesc;
                            this.mapper.roomName;
                            this.mapper.roomVnum;
                            if (this.mapper.roomVnum && this.mapper.containsVnum(this.mapper.roomVnum)) {
                                this.mapper.setRoomByVNum(this.mapper.roomVnum)
                            } else {
                                const r = this.mapper.syncToRoom();
                                if (r) this.mapper.setRoomById(r.id)
                            }        
                        }).bind(this), 450);
                        break;
                    case "vai":
                        if (this.drawing.contextRoom) this.mapper.walkToId(this.drawing.contextRoom.id)
                        break;
                    case "set":
                        if (this.drawing.contextRoom) {
                            this.mapper.setRoomById(this.drawing.contextRoom.id)
                            this.mapper.previous = null;
                        }
                        break;
                    case "mapperroom":
                    case "edit":
                        {
                            if (this.mapper.mapmode) {

                                if (this.drawing.hover) {
                                    const hover = this.drawing.hover
                                    if (this.drawing.selectedRooms.size > 1 &&
                                        this.drawing.selectedRooms.get(hover.id)) {
                                        const r = await Messagebox.Question("Vuoi fare modifiche multiple a " + this.drawing.selectedRooms.size + " stanze?\nSe vuoi modificare solo quella premuta rispondi negativamente.")
                                        if (r.button == Button.Ok) {
                                            this.editRoom([...this.drawing.selectedRooms.values()])
                                        } else {
                                            this.editRoom([hover])
                                        }
                                    } else {
                                        this.editRoom([hover])
                                    }
                                }
                                else if (this.drawing.selectedRooms.size > 1)
                                    this.editRoom([...this.drawing.selectedRooms.values()])
                                else if (this.drawing.contextRoom)
                                    this.editRoom([this.drawing.contextRoom]);
                                else if (this.drawing.selected)
                                    this.editRoom([this.drawing.selected])
                            } else {
                                Notification.Show("Il mapper deve trovarsi in modalita' mapping.")
                            }
                        }
                        break;
                    case "addfavorite":
                        if (this.drawing.contextRoom && !$(element).hasClass("disabled")) this.addFavorite((this.drawing.contextRoom))
                        break;
                    case "removefavorite":
                        if (this.drawing.contextRoom && !$(element).hasClass("disabled")) this.removeFavorite((this.drawing.contextRoom))
                        break;
                    case "legend":
                        this.drawing.showLegend=!!!this.drawing.showLegend;
                        break;
                    case "impostazioni":
                        this.optionsWindow.show()
                        break;
                    case "toolbox-pan":
                    case "toolbox-select":
                    case "toolbox-move":
                    case "toolbox-createlink":
                    case "toolbox-add":
                    case "toolbox-remap":
                    case "toolbox-delete":
                    case "toolbox-movewindow":
                    case "toolbox-movetozone":
                    case "toolbox-editrooms":
                    case "toolbox-newzone":
                    case "toolbox-deletezone":
                    case "toolbox-editzone":
                        event.preventDefault();
                        this.handleToolboxItem(name);
                        return false;
                    default:
                        break;
                }
            } finally {
                this.closeContextMenu();
            }
            return true;
        });
    }
    private async closeContextMenu() {
        (this.$contextMenu as any).jqxMenu('close');
        this.drawing && (this.drawing.contextMenuOpen = false)
    }

    async showMapVersions() {
        const lv = await this.mapper.getLocalDbVersion()
        const ov = await this.mapper.getOnlineVersion()
        const r = Messagebox.Question(`Il Database Mappe online:\n\r
\n\r
Versione: ${ov.version||0}\n\r
Messaggio: ${ov.message||"??"}\n\r
Data: ${ov.date||"??"}\n\r
\n\r
Vuoi vedere o modificare il DB locale?`)
        if ((await r).button == Button.Ok) {
            let r2 = await Messagebox.ShowMultiInput(
                "Versione DB Mappe locali",
                ["Versione", "Messaggio", "Data"],
                [lv.version, lv.message, lv.date]
            )
            if (r2.button == Button.Ok) {
                let vr = r2.results[0]
                let vmes = r2.results[1]
                let vdt = r2.results[2]
                if (!(parseInt(vr)>=0 && parseInt(vr)<Infinity)) {
                    Notification.Show("Numero versione errato (non numero positivo)")
                    return
                }
                if (!vmes) {
                    Notification.Show("Il messaggio vuoto non e' supportato")
                    return
                }
                if (!vdt) {
                    Notification.Show("La data vuota non e' supportata")
                    return
                }
                lv.version = parseInt(vr)
                lv.message = vmes
                lv.date = vdt
                this.mapper.saveLocalDbVersion(lv) 
                Notification.Show("Versione Db mappe locale aggiornata")
            }
        }
    }
    private showInfo() {
        Messagebox.Show("Informazioni",
            `L'Autore delle mappe "Traxter" ed i suoi contributori, cedono in esclusiva ed in
via definitiva a TemporaSanguinis.it, che accetta, tutti i diritti (inclusivi ed
esclusivi) di pubblicazione e utilizzazione economica, a mezzo stampa o con ogni
altro tipo di supporto e comunque in ogni forma e modo, originale e/o derivato,
vantati dallo stesso sull' Opera. In particolare, la cessione comprende in via
esemplificativa e non esclusiva:

  a) il diritto del Cessionario di pubblicare l'Opera in qualsiasi forma e modo,
     compreso Internet;
  b) il diritto di tradurre l'Opera in qualsiasi lingua diversa dall'Italiano;
  c) il diritto di adattare ed elaborare l'Opera, o parte della stessa, per la
     pubblicazione a titolo esemplificativo e non esclusivo a mezzo, stampa, via
     filo e/o satellite, per l'utilizzazione su supporti sonori e/o strumenti
     audiovisivi di ogni tipo, su supporti elettronici, magnetici, o su strumenti
     analoghi o similari a quelli sopra indicati, nonché all'interno di banche dati,
     o per mezzo di Internet, ed ancora per finalità meramente pubblicitarie o di
     promozione sia dell'Opera che di sue singole parti;
 d) diritti di diffondere l'Opera, distribuirla e commercializzarla con i mezzi di
    cui alle lettere precedenti, o con ogni altro mezzo disponibile;
 e) la facoltà di trasferire a terzi i diritti di cui alle lettere precedenti.

Nota: Per eventuali errori o richieste rivolgetevi
nel canale #mappe del Discord di Tempora Sanguinis.`, "display: block;unicode-bidi: embed;");
    }

    private handleToolboxItem(name: string) {
        
        if (name == "toolbox-editrooms") {
            if (this.drawing.selectedRooms.size > 1)
                this.editRoom([...this.drawing.selectedRooms.values()])
            else if (this.drawing.selected)
                this.editRoom([this.drawing.selected])
            else
                this.setBottomMessage("Nessuna stanza selezionata")
        } else if (name == "toolbox-move") {
            this.allowMove = !this.allowMove
            this.drawing.allowMove = this.allowMove
            if (this.editMode != EditMode.Drag) {
                this.editMode = EditMode.Drag
            }
            this.drawing.editMode = this.editMode
            this.setBottomMessage("Spostamento stanze " + (this.drawing.allowMove ? "PERMESSO" : "BLOCCATO"))
        } else if (name == "toolbox-pan") {
            this.drawing.editMode = this.editMode = EditMode.Drag
            this.setBottomMessage("Trascinare con il mouse ora spostera' l'origine per la visuale della mappa")
        } else if (name == "toolbox-select") {
            this.drawing.editMode = this.editMode = EditMode.Select
            this.drawing.allowMove = this.allowMove = false
            this.setBottomMessage("Trascinare con il mouse ora selezionera' le stanze (shortcut Shift)")
        } else if (name == "toolbox-createlink") {
            this.drawing.editMode = this.editMode = EditMode.CreateLink
            this.drawing.allowMove = this.allowMove = false 
            this.setBottomMessage("Crea l'uscita trascinando con il mouse da stanza a stanza")
        } else if (name == "toolbox-add") {
            this.drawing.editMode = this.editMode = EditMode.CreateRoom
            this.drawing.allowMove = this.allowMove = false 
            this.setBottomMessage("Seleziona la posizione per creare la stanza")
        } else if (name == "toolbox-delete") {
            this.deleteSelection();
        } else if (name == "toolbox-movewindow") {
            this.showMoveRoomsWindow();
        } else if (name == "toolbox-movetozone") {
            this.showMoveToZoneWindow()
        } else if (name == "toolbox-newzone") {
            this.showZoneWindow(true)
        } else if (name == "toolbox-deletezone") {
            this.deleteZone()
        } else if (name == "toolbox-editzone") {
            this.showZoneWindow(false)
        } else if (name == "toolbox-remap") {
            this.remapRoomStart(false)
        }


        this.setToolboxButtonStates();
    }
    remapRoomStart(createnew: boolean) {
        let room = this.drawing?.active
        if (!room) {
            Notification.Show("Una stanza deve essere attiva con il pallino")
            return
        }
        this.mapper.scripting.delVariable({name: this.mapper.roomNameVariable, class: "", value: null})
        this.mapper.scripting.delVariable({name: this.mapper.roomDescVariable, class: "", value: null})
        this.mapper.scripting.delVariable({name: this.mapper.vnumVariable, class: "", value: null})
        this.mapper.scripting.delVariable({name: this.mapper.exitsVariable, class: "", value: null})
        setTimeout(() => {
            this.mapper.clearManualSteps()
            this.mapper.current = room
            this.roomSeen = false
            this.requestRemap = true
            EvtScriptEmitCmd.fire({owner:"Mapper", message:"look", silent: true})                    
        }, 30);
    }
    remapRoomEnd() {
        if (this.requestRemap && this.drawing.active && this.drawing.active == this.mapper.current && this.roomSeen) {
            if (!this.mapper.updateRoomOnMovement(this.mapper.current, true)) {
                Notification.Show("La stanza sembra identica.")
            }
        } else {
            Notification.Show("Remap fallito. Non trovo la stanza.")
        }
        this.requestRemap = false
    }

    async deleteZone() {
        if (this.zoneId >-1) {
            let cnt = (this.mapper.getZoneRooms(this.zoneId)||[]).length || 0
            let r = await Messagebox.Question("Sei sicuro di voler cancellare la zona?\nPerderai le " + cnt + " room che contiene.")
            if (r.button == Button.Ok) this.mapper.deleteZone(this.zoneId)
        }
    }
    showZoneWindow(create:boolean) {
        if (create) {
            let cur = this.mapper.current
                    
            const zw = new EditZoneWin(null, (z) => {
                if (z && z.name && z.name.length > 2) {
                    z.id = null
                    this.mapper.saveZone(z)
                    this.mapper.zoneId = z.id
                    this.mapper.OnZonesListChanged()
                    if (cur) {
                        this.mapper.setRoomById(-1)
                        this.mapper.setRoomById(cur.id)
                    }
                } else if (z) {
                    Notification.Show("Dati zona non validi. Il nome deve avere almeno tre caratteri.")
                }
            })
        } else {
            const zone = this.mapper.idToZone.get(this.zoneId)
            if (zone) {
                let cur = this.mapper.current
                    
                const zw = new EditZoneWin(zone, (z) => {
                    if (z && z.name && z.name.length > 2) {
                        
                        zone.id = parseInt(z.id?.toString())
                        zone.name = z.name
                        zone.description = z.description
                        zone.label = z.label
                        zone.backColor = z.backColor
                        zone.imageOffset = z.imageOffset
                        zone.image = z.image
                        zone.musicUrl = z.musicUrl
                        this.mapper.saveZone(zone) 
                        this.mapper.zoneId = zone.id
                        this.mapper.OnZonesListChanged()
                        this.drawing.refresh()
                        if (cur) {
                            this.mapper.setRoomById(-1)
                            this.mapper.setRoomById(cur.id)
                        }
                    } else if (z) {
                        Notification.Show("Dati zona non validi. Il nome deve avere almeno tre caratteri.")
                    }
                })
            }
        }
    }
    showMoveToZoneWindow() {
        let rooms:Room[] = [...this.drawing.selectedRooms.values()];
        if (!rooms || !rooms.length) {
            Notification.Show("Devi selezionare delle stanze prima.")
            return
        }
        let mzw = new MapperMoveToZoneWin(this.mapper, (z) => {
            if (z) {
                this.mapper.moveRoomsToZone(rooms, z)
                this.drawing.selectedRooms = new Map<number, Room>(rooms.map(obj => [obj.id, obj]))
                this.mapper.current = null
                Notification.Show(`${rooms.length} stanze spostate`)
            } else {
                Notification.Show(`Zona non selezionata. Abort, Retry, Fail? :D`)
            }
        });
        mzw.show()
    }
    showMoveRoomsWindow() {
        let rooms = [...this.drawing.selectedRooms.values()]
        if (rooms.length < 1) {
            Notification.Show("Nessuna room selezionata")
            return
        }
        let mw = new MoveRoomsWin(this, rooms, () => {
            // nothing to do already done
        })
    }
    private async deleteSelection() {
        if (!this.mapper.mapmode) {
            Notification.Show("Per cancellare stanze devi trovarti nella modalita' mapping")
            return
        }
        if (this.drawing.selectedRooms.size >= 1 || this.drawing.selected || this.drawing.selectedExit) {
            let cosa = this.drawing.selectedExit ? "l'uscita" : this.drawing.selectedRooms.size + " stanze"
            let r = await Messagebox.Question("Sicuro di voler eliminare " + cosa + "?")
            if (r.button != Button.Ok) return;
            if (this.drawing.selectedExit) {
                let exits: RoomExit[] = [];
                exits.push(this.drawing.selectedExit);
                if (this.drawing.selectedReverseExit) {
                    exits.push(this.drawing.selectedReverseExit);
                }
                this.deleteExits(exits);
            } else if (this.drawing.selectedRooms.size) {
                this.deleteRooms([...this.drawing.selectedRooms.values()]);
            }
        } else {
            Messagebox.Show("Attenzione", "Nessuna stanza o uscita selezionata");
        }
    }

    deleteRooms(rooms: Room[]) {
        this.drawing.selectedRooms.clear()
        this.drawing.selected = null
        if (this.drawing.active && rooms.find(r => r.id == this.drawing.active.id)) {
            this.drawing.active = null
        }
        this.mapper.deleteRooms(rooms)
    }
    deleteExits(exits: RoomExit[]) {
        function hasExit(r: Room, ex: RoomExit): ExitDir {
            for (const key in r.exits) {
                if (r.exits[key as ExitDir] == ex) {
                    return key as ExitDir
                }
            }
            return null
        }
        this.drawing.selectedExit
        for (const ex of exits) {
            let room = this.drawing.rooms.find(r => hasExit(r, ex))
            if (!room) continue
            let dir = hasExit(room, ex)
            if (!dir) continue
            this.mapper.deleteRoomExit(room, dir)
        }
    }

    private setToolboxButtonStates() {
        $(".mapperworkarea-toolboxbuttons button", this.$win).removeClass("selected");
        $(".mapperworkarea-toolboxbuttons button", this.$win).removeClass("enabled");
        
        if (this.allowMove) {
            $(".mapperworkarea-toolboxbuttons button[data-option-name='toolbox-move']", this.$win).addClass("enabled");
        } else if (this.editMode == EditMode.CreateLink) {
            $(".mapperworkarea-toolboxbuttons button[data-option-name='toolbox-createlink']", this.$win).addClass("enabled");
        }
        if (this.editMode == EditMode.Drag) {
            $(".mapperworkarea-toolboxbuttons button[data-option-name='toolbox-pan']", this.$win).addClass("selected");
        } else if (this.editMode == EditMode.Select) {
            $(".mapperworkarea-toolboxbuttons button[data-option-name='toolbox-select']", this.$win).addClass("selected");
        }
        this.drawing.setFocus(true);
    }

    refreshFavorites() {
        const fv = this.mapper.getFavorites()
        console.log("refresh favorites " + (fv||[]).length)
        this.addFavoritesToMenu(fv)
    }
    async toggleMapMode() {
        const localVer = await this.mapper.getLocalDbVersion()
        const onlineVer = await this.mapper.getOnlineVersion()
            
        if (!this.mapper.mapmode && !this.mapper.useLocal) {
            if (onlineVer && localVer && localVer.version > onlineVer.version) {
                const r = await Messagebox.Question(
`ATTENZIONE!!!\n
Stai tentando di modificare il DB mappe pubblico.\n
Il tuo DB locale ha versione piu' alta di quello pubblico\n
Uscendo dalla modalita' mapping potresti sovrascrivere le tue modifiche locali!\n
\n
Versione pubblica: ${onlineVer.version}\n
Versione locale: ${localVer.version}\n
\n
Sei SICURO di voler continuare?`
                )
                if (r.button != Button.Ok) {
                    return
                }
            }
        }
        if (this.mapper.mapmode && !this.mapper.useLocal) {
            const lv = await this.mapper.getLocalDbVersion()
            const ov = await this.mapper.getOnlineVersion()
            if (ov && lv && lv.version > ov.version) {
                const r = await Messagebox.Question(
`ATTENZIONE!!!\n\r
Stai chiudendo modifiche del DB pubblico.\n\r
Il tuo DB locale ha versione piu' alta di quello pubblico\n\r
Continuando sovrascriverai le tue modifiche locali!\n\r
\n\r
Versione pubblica: ${ov.version}\n\r
Versione locale: ${lv.version}\n\r
\n\r
Sei SICURO di voler salvare?\n\r
Rispondendo negativamente uscirai dalla modalita' mapping senza salvare.`
                )
                if (r.button != Button.Ok) {
                    this.mapper.mapmode = false
                    this.setBottomMessage("Modalita Mapping DISABILITATA")
                    this.hideMapToolbar();
                    (<any>this.$win).jqxWindow("setTitle", this.windowTitle + (this.mapper.useLocal ? " (da locale v." + (this.mapper.getDB()?.version?.version||0) + ")" : " (pubblico v." + (this.mapper.getDB()?.version?.version||0) + ")"));        
                    return
                }
            }
        }

        if (this.mapper.mapmode) {
            if (onlineVer?.version && onlineVer?.version >= localVer?.version) {
                this.mapper.requestIncrementVersion = onlineVer?.version+1
                Notification.Show("Incremento versione locale in quanto era piu bassa di quella online.")
            }
        }

        this.mapper.mapmode = !this.mapper.mapmode;
        this.drawing.mapmode = this.mapper.mapmode
        if (this.mapper.mapmode) {
            this.setBottomMessage("Modalita Mapping ABILITATA");
            (<any>$(this.$win)).jqxWindow('setTitle', 'Mapper (modalita\' mapping)');
            this.handleDraggingToolbox(this.$win);
            this.showMapToolbar();

        }
        else {
            this.setBottomMessage("Modalita Mapping DISABILITATA")
            this.hideMapToolbar();
            (<any>this.$win).jqxWindow("setTitle", this.windowTitle + (this.mapper.useLocal ? " (da locale v." + (this.mapper.getDB()?.version?.version||0) + ")" : " (pubblico v." + (this.mapper.getDB()?.version?.version||0) + ")"));
        }
    }
    private hideMapToolbar() {
        $(".mappertoolbox", this.$win).hide();
    }

    private showMapToolbar() {
        $(".mappertoolbox", this.$win).css("left", this.mapper.getOptions().toolboxX || 0);
        $(".mappertoolbox", this.$win).css("top", this.mapper.getOptions().toolboxY || 0);
        $(".mappertoolbox", this.$win).show();
    }

    addFavoritesToMenu(favs: Favorite[]) {
        const favUl = $("#mapFavorites");
        favUl.empty();
        if (favs.length == 0) {
            favUl.append("<li class='custom jqx-item jqx-menu-item jqx-rc-all' role='menuitem'>&lt;nessuno&gt;</li>");
            return;
        }
        for (const fv of favs) {
            let li = $("<li class='custom jqx-item jqx-menu-item jqx-rc-all' role='menuitem'>" + fv.key + "</li>");
            li.on("click", () => {
                this.closeMenues($("#mapperMenubar",this.$win))
                this.mapper.walkToId(fv.roomId)
            });
            favUl.append(li);
        }
    }

    removeFavorite(r: Room) {
        this.mapper.removeFavorite(r.id);
        this.refreshFavorites()
    }
    async addFavorite(r: Room) {
        if (!r) return;
        if (r.shortName && r.shortName.startsWith("[") && r.shortName.endsWith("]")) {
            r.shortName = r.shortName.slice(1, r.shortName.length -1);
        }
        const fvi = await Messagebox.ShowMultiInput("Crea favorito", ["Nome (per vai, opzionale)", "Colore (opzionale)"], [r.shortName, r.color])
        if (fvi.button != Button.Ok) return;

        this.mapper.addFavorite({
            roomId: r.id,
            key: fvi.results[0]||r.name,
            color: fvi.results[1]
        });
        this.refreshFavorites()
    }
    exportImage() {
        const zone = this.mapper.getRoomZone(this.mapper.roomId)
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        if (!this.drawing.rooms || !this.drawing.rooms.length) {
            Messagebox.Show("Errore","Non ci sono room nel mapper.")
            return
        }
        for (let i = 0; i < this.drawing.rooms.length; i++) {
            let room = this.drawing.rooms[i]
            if (room.z == this.drawing.level-1) {
                if (room.x > maxX) maxX = room.x;
                if (room.x < minX) minX = room.x;
                if (room.y > maxY) maxY = room.y;
                if (room.y < minY) minY = room.y;
            }
            else if (room.z == this.drawing.level+1) {
                if (room.x > maxX) maxX = room.x;
                if (room.x < minX) minX = room.x;
                if (room.y > maxY) maxY = room.y;
                if (room.y < minY) minY = room.y;                
            }
            else if (room.z == this.drawing.level) {
                if (room.x > maxX) maxX = room.x;
                if (room.x < minX) minX = room.x;
                if (room.y > maxY) maxY = room.y;
                if (room.y < minY) minY = room.y;
            }
        }
        var c = document.createElement("canvas")
        const roomSize = 32*this.drawing.scale

        const borderRooms = 2;
        const w = (1+2*borderRooms)*roomSize+(((maxX-minX)/7.5)*this.drawing.scale)|0
        const h = (1+2*borderRooms)*roomSize+(((maxY-minY)/7.5)*this.drawing.scale)|0
        

        const roomsWide = w / roomSize
        const roomsTall = h / roomSize
        

        const mx = (minX/7.5) - borderRooms*32 + w/2/this.drawing.scale
        const my = (minY/7.5) - borderRooms*32 + h/2/this.drawing.scale

        if (h < 10 || h > 10000 || w < 10 || h > 10000) {
            Messagebox.Show("Errore", "Grandezza immagine non valida per export")
            return;
        }

        const vscroll = mx //(mx/16*this.drawing.scale)|0
        const hscroll = my //(my/16*this.drawing.scale)|0

        c.width = w
        c.height = h
        this.drawing.y_scroll = hscroll
        this.drawing.x_scroll = vscroll

        const ctx = c.getContext("2d")
        this.drawing.draw(c, ctx, true, () => {
            var imageURI = c.toDataURL("image/png");
            let link = document.createElement("a");
            link.setAttribute("href", imageURI);

            link.setAttribute("download", `${zone?zone.name:"[Zona sconosciuta]"}_Mappa_liv${this.drawing.level}.png`);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(imageURI);
            c.toBlob((blob) => {
                if ((<any>navigator.clipboard).write) (<any>navigator.clipboard).write([
                    new ClipboardItem({ "image/png": blob })
                ]);
              }, "image/png");
        })
    }

    private openRoomEditors = new Map<number, EditRoomWin>()
    async editRoom(rooms: Room[]) {
        if (!rooms.length) return

        let existingW: EditRoomWin;
        let alreadyEditingW: EditRoomWin;
        let alreadyEditing = false
        for (const k of this.openRoomEditors.keys()) {
            let tmp = this.openRoomEditors.get(k)
            if (tmp && tmp.rooms[0].id == rooms[0].id && 
                sameRooms(tmp?.rooms, rooms)) {
                    existingW = tmp
            } else {
                let anyId = false
                rooms.map(r => tmp?.rooms.includes(r) ? (anyId = true) : false)
                alreadyEditing ||= anyId
                if (alreadyEditing) {
                    alreadyEditingW = tmp
                }
            }
        }

        if (!existingW && alreadyEditingW) {
            const r = await Messagebox.Question("Alcune stanze che vuoi editare sono gia' aperte in altri editor.\nVuoi continuare comunque?")
            if (r.button != Button.Ok) {
                return
            }
        }

        if (existingW) {
            existingW.refresh()
            return
        }

        existingW = new EditRoomWin()
        this.openRoomEditors.set(rooms[0].id, existingW)
        existingW.editRooms(rooms, () => {
            this.openRoomEditors.delete(rooms[0].id)
        })
    }

    search() {
        Messagebox.ShowMultiInput("Campi di ricerca locazione", ["Nome", "Descrizione"], ["",""]).then(r => {
            if (r.button == Button.Ok) this.mapper.search(r.results[0], r.results[1])
        })
    }

    findpath() {
        Messagebox.ShowMultiInput("Vai a #num", ["Inserisci il numero della locazione", "Posizionami senza eseguire la path"], [this.drawing.selected ? this.drawing.selected.id.toString() : "?", true]).then(r => {
            if (r.button == 1) {
                const destId = parseInt(r.results[0]);
                
                if (r.results[1]) {
                    let r = this.mapper.getRoomById(destId)
                    if (r) {
                        this.mapper.setRoomById(r.id)
                    } else {
                        Notification.Show("La stanza non esiste")
                    }
                    return
                }

                if (!this.drawing.active) {
                    Messagebox.Show("Errore", "Non c'e' locazione iniziale per iniziare il percorso")
                    return;
                }
                
                const id1 = this.drawing.active.id;
                
                const walk = this.mapper.calculateWalk(id1, destId, -1);
                if (!walk.end) {
                    Messagebox.Show("Ouch", "Non trovo il percorso")
                } else if (!walk.steps || walk.steps.length < 1) {
                    Messagebox.Show("Uhm", "Sembra che non c'e' ragione di muoversi...")
                } else {
                    this.mapper.safeWalk(walk);
                }
            }
        })
    }

    setWindowManager(windowManager: WindowManager) {
        this.windowManager = windowManager;
    }

    public Instance() : any {
        return this.$win;
    }

    private exportZone() {
        if (!this.mapper || !this.mapper.current) {
            Messagebox.Show("Errore", "Mapper non inizializzato o non si trova in nessuna zona")
            return;
        }
        const data = this.mapper.exportZone(this.mapper.current.zone_id)
        downloadJsonToFile(data, "mapperZoneExport.json")
    }

    private exportAll() {
        if (!this.mapper || !this.mapper.current) {
            Messagebox.Show("Errore", "Mapper non inizializzato o non si trova in nessuna zona")
            return;
        }
        const data = this.mapper.exportAll()
        downloadJsonToFile(data, "mapperExport.json")
    }

    private importZone() {
        if (!this.mapper) {
            Messagebox.Show("Errore", "Mapper non inizializzato")
            return;
        }
        importFromFile(d => {
            if (d) {
                var db = JSON.parse(d) as MapDatabase
                this.mapper.importMapDb(db)
            }
        })
    }

    public async load(useLocal:boolean) {

        if (this.mapper.mapmode) {
            let r = await Messagebox.Question("Sei in modalita' mappaggio.\nProseguendo perderai eventuali modifiche.\nVuoi continuare?")
            if (r.button != Button.Ok) {
                return
            }
        }
        this.hideMapToolbar();
        let version: MapVersion = null;
        (<any>this.$win).jqxWindow("setTitle", this.windowTitle + (useLocal ? " (da locale)" : " (pubblico)"));

        this.mapper.useLocal = useLocal
                    
        this.mapper.loadVersion(false).then(v => {
            version = v;
            let vn = Math.random()
            if (v.version != 0) {
                vn = v.version
            }
            if (this.mapper.useLocal)
                return this.mapper.loadLocalDb()
            else
                return this.mapper.load('mapperData.json?v='+vn, v)
        }).then(mDb => {
            if (!version) {
                version = mDb.version;
            }
            if (!version) {
                this.setBottomMessage(`Caricato mappe - versione sconosciuta`)
            } else 
                this.setBottomMessage(`Caricato mappe v${version.version} ${version.date?"("+version.date+")":''} ${version.message?"["+version.message+"]":''}`)
            
            this.selectPreviousZoneOrFallbackToFirst();
            this.refreshFavorites();
            (<any>this.$win).jqxWindow("setTitle", this.windowTitle + (useLocal ? " (da locale v." + (version?.version||0) + ")" : " (pubblico v." + (version?.version||0) + ")"));
        
        });

    }

    public async loadSite(force:boolean) {
        
        if (this.mapper.mapmode) {
            let r = await Messagebox.Question("Sei in modalita' mappaggio.\nProseguendo perderai eventuali modifiche.\nVuoi continuare?")
            if (r.button != Button.Ok) {
                return
            }
        }
        this.hideMapToolbar();
        (<any>this.$win).jqxWindow("setTitle", this.windowTitle + " (pubblico)");
        
        let version: MapVersion = null;
        this.mapper.useLocal = false
        this.mapper.loadVersion(true).then(v => {
            version = v;
            let vn = Math.random()
            if (v.version != 0) {
                vn = v.version
            }
            const localVer = this.mapper.getVersion()
            const remoteVer = v.version
            console.log(`mapperWindow loadSite remote ${remoteVer} local ${localVer}`)
            if (!force && remoteVer <= localVer) {
                version = null;
                console.log("Keep using builtin map since newer")
                return this.mapper.getDB()
            }
            console.log("Load map from site")
            return this.mapper.load('https://temporasanguinis.it/client/mapperData.json?v='+vn, v)
        }).then(mDb => {
            if (!version) {
                version = mDb.version;
            }
            if (!version) {
                this.setBottomMessage(`Caricato mappe - versione sconosciuta`)
            } else 
                this.setBottomMessage(`Caricato mappe v${version.version} ${version.date?"("+version.date+")":''} ${version.message?"["+version.message+"]":''}`)
            
            this.selectPreviousZoneOrFallbackToFirst();
            this.refreshFavorites();
            (<any>this.$win).jqxWindow("setTitle", this.windowTitle + (" (pubblico v." + (version?.version||0) + ")"));
        
        });
    }

    private selectPreviousZoneOrFallbackToFirst() {
        if (this.mapper.current) {
            const zn = this.mapper.idToZone.get(this.mapper.current.zone_id);
            const msg = { id: zn?.id, zone: zn };
            this.onEmitMapperZoneChanged(msg);
        } else if (this.zoneId) {
            const zn = this.mapper.idToZone.get(this.zoneId);
            const msg = { id: zn?.id, zone: zn };
            this.onEmitMapperZoneChanged(msg);
        }
        else {
            const zn = this.mapper.getZones()[0];
            const msg = { id: zn?.id, zone: zn };
            this.onEmitMapperZoneChanged(msg);
        }
    }

    public fillZonesDropDown(zones:Zone[]) {
        const useLabels = this.mapper.getOptions().preferZoneAbbreviations;
        
        if (!this.$win || !this.$win.length ||
            !this.$zoneList || !this.$zoneList.length ||
            !$("#zonelist", this.$win).length
        ) return;

        const prevVal = (<any>this.$zoneList).jqxDropDownList('getSelectedItem');
        let prevIndex = (<any>this.$zoneList).jqxDropDownList('selectedIndex');
        (<any>$("#zonelist", this.$win)).jqxDropDownList('clearFilter');
        
        let newList:any[] = [];
        if (zones && zones.length) {
            newList = zones.map(z => {
                return { 
                    "value": z.id.toString(),
                    "label": createZoneLabel(useLabels, true, z)    
                }
            });
        }

        try {
            this.selecting = true;
            (<any>this.$zoneList).jqxDropDownList({"source": newList});
        } finally {
            this.selecting = false
        }
        if (prevVal && prevVal.value && zones) {
            prevIndex = zones.findIndex(z => z.id == parseInt(prevVal.value));
            if (prevIndex>-1) (<any>this.$zoneList).jqxDropDownList('selectIndex', prevIndex);
        } else if (prevIndex > -1) {
            (<any>this.$zoneList).jqxDropDownList('unselectIndex', prevIndex);
        }
        return;
        (<any>this.$zoneList).jqxDropDownList('clear');

        if (zones && zones.length) {
            $.each(zones, (i, item) => {
                (<any>this.$zoneList).jqxDropDownList("addItem", { 
                    value: item.id.toString(),
                    label: createZoneLabel(useLabels, true, item)
                });
            });
            if (prevIndex>-1) (<any>this.$zoneList).jqxDropDownList('selectIndex', prevIndex);
        };
    }

    public setBottomMessage(mess:string) {
        this.$bottomMessage.text(mess||"");
        this.$bottomMessage.attr("title", mess||"");
    }
    public loadZonesIfNeeded(force: boolean) {
        let items: any;
        
        if (!this.$win || !this.$win.length ||
            !this.$zoneList || !this.$zoneList.length
        ) return;

        // reread zones when mapper sends empty zone message or we don't have items in dropdown
        if (force || !(items = (<any>this.$zoneList).jqxDropDownList('getItems')) || !items.length) {
            if (!this.selecting) this.fillZonesDropDown(this.zones)
        }
    }

    // zoneSortByNameWithCleanup(z1:Zone, z2:Zone):number {
    //     let a = z1.name
    //     let b = z2.name
    //     a = a.replace(/^il |lo |la |le |l\' |i /i, "").trim()
    //     b = b.replace(/^il |lo |la |le |l\' |i /i, "").trim()
    //     return a.localeCompare(b);
    // }

    public show() {
        (<any>this.$win).jqxWindow("open");
        (<any>this.$win).jqxWindow('bringToFront');
    }

    public destroy() {
        this.detachHandlers(this.mapper, this.windowManager)
        this.detachMenu();
        this.destroyMenu(this.$menu);
        if (this.drawing) {
            this.drawing.destroy()
            delete this.drawing;  
            this.drawing = null;
        }
        <JQuery>((<any>this.$zoneList)).jqxDropDownList("destroy");
        delete this.ctx;
        delete this.canvas;
        this.resizeSensor.disconnect();
        this.optionsWindow.destroy(); 
        (<any>this.$win).jqxWindow("destroy");
    }

    public hide() {
        (<any>this.$win).jqxWindow("close");
    }
}


function sameRooms(rooms: Room[], rooms1: Room[]) {
    if (!rooms || !rooms1 || rooms.length != rooms1.length) return false
    for (let i = 0; i < rooms.length; i++) {
        if (rooms1[i].id != rooms[i].id)
            return false
    }
    return true
}

