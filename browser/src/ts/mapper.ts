import { EventHook } from './event';
import { EvtScriptEmitPrint, JsScript } from './jsScript'
import { EvtScriptEvent, ScripEventTypes, EvtScriptEmitCmd } from './jsScript'
import { aStar, PathFinder } from 'ngraph.path';
import { compress, decompress } from 'lz-string';
import * as ngraph from 'ngraph.graph';

export interface Zone {
    id: number;
    name: string;
    description?: string;
    label?: string;
}

export enum ExitType {
    Normal = 0,
    Door = 1,
    Locked = 2
}

export const ExitDir2LabelPos = new Map<ExitDir, LabelPos>()

export enum ExitDir {
    North = "n",
    NorthEast = "ne",
    East = "e",
    SouthEast = "se",
    South = "s",
    SouthWest = "sw",
    West = "w",
    NorthWest = "nw",
    Up = "u",
    Down = "d",
    Other = "other",
    Special = "special",
}

export const ReverseExitDir = new Map<ExitDir, ExitDir>()
ReverseExitDir.set(ExitDir.North, ExitDir.South)
ReverseExitDir.set(ExitDir.NorthEast, ExitDir.SouthWest)
ReverseExitDir.set(ExitDir.East, ExitDir.West)
ReverseExitDir.set(ExitDir.SouthEast, ExitDir.NorthWest)
ReverseExitDir.set(ExitDir.South, ExitDir.North)
ReverseExitDir.set(ExitDir.SouthWest, ExitDir.NorthEast)
ReverseExitDir.set(ExitDir.West, ExitDir.East)
ReverseExitDir.set(ExitDir.NorthWest, ExitDir.SouthEast)
ReverseExitDir.set(ExitDir.Up, ExitDir.Down)
ReverseExitDir.set(ExitDir.Down, ExitDir.Up)

export interface MapVersion {
    version:number;
    message?:string;
    date?:string;
}

export enum LabelPos {
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
    Up,
    Down,
    Center,
    Hidden,
}

ExitDir2LabelPos.set(ExitDir.North, LabelPos.North)
ExitDir2LabelPos.set(ExitDir.NorthEast, LabelPos.NorthEast)
ExitDir2LabelPos.set(ExitDir.East, LabelPos.East)
ExitDir2LabelPos.set(ExitDir.SouthEast, LabelPos.SouthEast)
ExitDir2LabelPos.set(ExitDir.South, LabelPos.South)
ExitDir2LabelPos.set(ExitDir.SouthWest, LabelPos.SouthWest)
ExitDir2LabelPos.set(ExitDir.West, LabelPos.West)
ExitDir2LabelPos.set(ExitDir.NorthWest, LabelPos.NorthWest)
ExitDir2LabelPos.set(ExitDir.Up, LabelPos.Up)
ExitDir2LabelPos.set(ExitDir.Down, LabelPos.Down)
ExitDir2LabelPos.set(ExitDir.Other, LabelPos.NorthEast)
ExitDir2LabelPos.set(ExitDir.Special, LabelPos.NorthEast)

export interface RoomExit {
    type: ExitType;
    label?: string;
    to_room?: number;
    to_dir?: ExitDir;
    name?: string;
    param?: string;
    nodraw?: boolean;
}

export type RoomExits = {
    [key in ExitDir]?: RoomExit
}

export enum RoomType {
    Inside,
    Forest,
    Outside
}

export interface Room {
    id: number;
    name: string;
    color: string;
    description?: string;
    zone_id: number;
    vnum?: number;
    cost?:number;
    x: number;
    y: number;
    z: number;
    type?:RoomType;
    teleport?:boolean;
    shortName?: string;
    exits: RoomExits;
    labelDir?: LabelPos
}

export interface MapDatabase {
    version?:MapVersion;
    zones: Zone[];
    rooms: Room[];
}

export interface Step {
    room: Room;
    dir: ExitDir;
    exit: RoomExit
}

export interface Path {
    start: Room;
    end: Room;
    steps: Step[];
}

export interface SafeWalk {
    start: Room;
    end: Room;
    steps: WalkData[],
    index?:number;
}

export enum WalkCommandType {
    Directional,
    DoorUnlock,
    DoorOpen,
    Other
}

export interface WalkCommand {
    type: WalkCommandType,
    command: string
}

export interface WalkData {
    room: Room;
    direction: ExitDir;
    commands: WalkCommand[]
}

export enum WalkMode {
    SpeedWalk,
    SafeWalk
}

export const openingCommands = [
    'open',
    'push',
    'pull',
    'turn',
    'lift',
    'twist',
    'dig',
    'cut',
    'doorb',
];

export const unlockCommands = [
    'unlock',
    'pick'
];

export const Long2ShortExit = new Map<string,string>([
    ['north','n'],
    ['northeast','ne'],
    ['east','e'],
    ['southeast','se'],
    ['south','s'],
    ['southwest','sw'],
    ['west','w'],
    ['northwest','nw'],
    ['up','u'],
    ['down','d'],
]);
export const Short2LongExit = new Map<string,string>([
    ['n','north'],
    ['ne','northeast'],
    ['e','east'],
    ['se','southeast'],
    ['s','south'],
    ['sw','southwest'],
    ['w','west'],
    ['nw','northwest'],
    ['u','up'],
    ['d','down'],
]);

export const Long2ShortExitIta = new Map<string,string>([
    ['nord','n'],
    ['nordest','ne'],
    ['est','e'],
    ['sudest','se'],
    ['sud','s'],
    ['sudovest','so'],
    ['ovest','o'],
    ['nordovest','no'],
    ['alto','a'],
    ['basso','b'],
]);
export const Short2LongExitIta = new Map<string,string>([
    ['n','nord'],
    ['ne','nordest'],
    ['e','est'],
    ['se','sudest'],
    ['s','sud'],
    ['so','sudovest'],
    ['o','ovest'],
    ['ne','nordovest'],
    ['a','alto'],
    ['b','basso'],
]);

export function IsDirectionalCommand(cmd:string, ita:boolean):boolean {
    const sh = ita ? Short2LongExitIta : Short2LongExit;
    const long = ita ? Long2ShortExitIta : Long2ShortExit;
    let ret = false

    ret = !!(sh.get(cmd.toLowerCase()) || long.get(cmd.toLowerCase()))

    if (!ret) {
        const sh = Short2LongExit;
        const long = Long2ShortExit;
    
        ret = !!(sh.get(cmd.toLowerCase()) || long.get(cmd.toLowerCase()))
        
    }
    return ret;
}

export class Mapper {

    private _useItalian: boolean = true;
    public get useItalian(): boolean {
        return this._useItalian;
    }
    public set useItalian(value: boolean) {
        this._useItalian = value;
    }

    private manualSteps:Step[]=[]
    public clearManualSteps() {
        this.manualSteps.splice(0, this.manualSteps.length)
    }

    parseCommandsForDirection(command: string): string[] {
        if (!this.current) return [command];
        const lastStepRoom = this.manualSteps.length ? this.idToRoom.get(this.manualSteps[this.manualSteps.length-1].exit.to_room) : this.current
        if (!lastStepRoom) return [command];
        const ret:string[] = <string[]>[command];
        if (IsDirectionalCommand(command, this.useItalian)) {
            const dir = this.parseDirectionalCommand(command);
            const st = {
                dir: dir,
                room: lastStepRoom,
                exit: lastStepRoom.exits[dir]
            }
            if (!st.exit) return [command];
            this.manualSteps.push(st)
            const queue:WalkCommand[] = []
            this.handlePossibleDoor(st, false, queue)
            ret.splice(0, ret.length)
            if (queue.length) {
                queue.map(q => ret.push(q.command))
            }
        }
        return ret;
    }

    parseDirectionalCommand(cmd: string): ExitDir {
        let ret:ExitDir=null;
        const sh = this.useItalian ? Short2LongExitIta : Short2LongExit;
        const long = this.useItalian ? Long2ShortExitIta : Long2ShortExit;
        
        for (let index = 0; index < sh.size; index++) {
            const key = Array.from(sh.keys())[index]
            const key2 = Array.from(long.keys())[index]
            if (key === cmd.toLowerCase()) {
                ret = <ExitDir>Array.from(Short2LongExit.keys())[index];
                break;
            } else if (key2 === cmd.toLowerCase()) {
                ret = <ExitDir>Array.from(Short2LongExit.keys())[index];
                break;
            }
        }

        if (ret == null) {
            // fallback english
            const sh2 = Short2LongExit;
            const long2 = Long2ShortExit;
            
            for (let index = 0; index < sh2.size; index++) {
                const key = Array.from(sh2.keys())[index]
                const key2 = Array.from(long2.keys())[index]
                if (key === cmd.toLowerCase()) {
                    ret = <ExitDir>Array.from(Short2LongExit.keys())[index];
                    break;
                } else if (key2 === cmd.toLowerCase()) {
                    ret = <ExitDir>Array.from(Short2LongExit.keys())[index];
                    break;
                }
            }
        }
        return ret;
    }

    setZoneById(zid: number) {
        const zr = this.getZoneRooms(zid)
        if (zr && zr.length) {
            this.setRoomById(zr[0].id)
        }
    }
    
    setSelected(selected: Room) {
        this.selected = selected
    }
    getSelected():Room {
        return this.selected
    }
    private _selected: Room = null;
    public get selected(): Room {
        return this._selected;
    }
    public set selected(value: Room) {
        this._selected = value;
    }
    private _current: Room = null;
    private _previous: Room = null;
    public get current(): Room {
        return this._current;
    }

    private _prevZoneId:number = null;
    private _zoneId:number = null;

    public set current(value: Room) {
        this._zoneId = value ? value.zone_id : null
        this._previous = this.current;
        this._current = value;
        this._selected = value;
        this.resyncato = false;
        if (this._prevZoneId != this._zoneId) {
            this.zoneChanged.fire({
                id: this._zoneId,
                zone: this.idToZone.get(this._zoneId)
            })
        }
        this._prevZoneId = this._zoneId
    }
    public roomVnum: number = -1;
    public roomId: number = -1;
    public roomName: string;
    public roomDesc: string;

    private db: MapDatabase = null;
    public roomChanged = new EventHook<{id: number, vnum:number, room:Room}>();
    public zoneChanged = new EventHook<{id: number, zone:Zone}>();
    public emitMessage = new EventHook<string>();
    public emitSearch = new EventHook<string>();

    public vnumToRoom: Map<number, Room> = new Map<number, Room>(); 
    public idToRoom: Map<number, Room> = new Map<number, Room>(); 
    public shortNameToRoom: Map<string, Room> = new Map<string, Room>(); 
    public idToZone: Map<number, Zone> = new Map<number, Zone>(); 
    public roomIdToZoneId: Map<number, number> = new Map<number, number>(); 
    private _zoneRooms: Map<number, Room[]> = new Map<number, Room[]>(); 
    public get zoneRooms(): Map<number, Room[]> {
        return this._zoneRooms;
    }
    public set zoneRooms(value: Map<number, Room[]>) {
        this._zoneRooms = value;
    }
    public pathFinder: PathFinder<Step>;
    private _vnumVariable: string = "TSRoom";
    private exitsVariable: string = "Exits";
    private _autoSync: boolean = true;
    public get autoSync(): boolean {
        return this._autoSync;
    }
    public set autoSync(value: boolean) {
        this._autoSync = value;
    }
    currentWalk: SafeWalk;
    walkQueue: WalkData[] = [];
    private _addDirectionToDoors: boolean = true;
    public get addDirectionToDoors(): boolean {
        return this._addDirectionToDoors;
    }
    public set addDirectionToDoors(value: boolean) {
        this._addDirectionToDoors = value;
    }
    private _roomNameVariable: string ="RoomName";
    public get roomNameVariable(): string {
        return this._roomNameVariable;
    }
    public set roomNameVariable(value: string) {
        this._roomNameVariable = value;
    }
    private _roomDescVariable: string = "RoomDesc";
    public get roomDescVariable(): string {
        return this._roomDescVariable;
    }
    public set roomDescVariable(value: string) {
        this._roomDescVariable = value;
    }
    public get vnumVariable(): string {
        return this._vnumVariable;
    }
    public set vnumVariable(value: string) {
        this._vnumVariable = value;
    }
    private _unlockCommand: string = "unlock";
    public get unlockCommand(): string {
        return this._unlockCommand;
    }
    public set unlockCommand(value: string) {
        this._unlockCommand = value;
    }
    private _openCommand: string = "open";
    public get openCommand(): string {
        return this._openCommand;
    }
    public set openCommand(value: string) {
        this._openCommand = value;
    }

    private _activeExits: string[];
    public get activeExits(): string[] {
        return this._activeExits;
    }
    public set activeExits(value: string[]) {
        this._activeExits = value;
    }
    private _walkMode: WalkMode = WalkMode.SafeWalk;
    public get walkMode(): WalkMode {
        return this._walkMode;
    }
    public set walkMode(value: WalkMode) {
        this._walkMode = value;
    }
    private resyncato = false;

    setScript(script:JsScript) {
        this.roomVnum = script.getVariableValue(this.vnumVariable)
        if (this.roomVnum) this.setRoomByVNum(this.roomVnum);
    }

    public async loadVersion():Promise<MapVersion> {
        let data:MapVersion = null;
        try {
            const response = await fetch("mapperVersion.json?rnd="+Math.random());
            data = await response.json();
        } catch {
            data = {
                version: 0,
                message: "Unknown"
            }
        }
        return data;
    }

    constructor() {
        EvtScriptEvent.handle(d => {
            if (d.event == ScripEventTypes.VariableChanged && d.condition == this.vnumVariable) {
                if (d.value) {
                    //this.roomName = null;
                    this.roomDesc = null;
                    const newVnum = (<any>d.value).newValue;
                    setTimeout(() => {
                        this.setRoomByVNum(parseInt(newVnum));
                        this.acknowledgeStep(newVnum);                            
                    }, 1);
                } 
                else
                    this.setRoomByVNum(-1);
            }
            if (d.event == ScripEventTypes.VariableChanged && d.condition == this.exitsVariable) {
                if (d.value) 
                    this.activeExits = ((<any>d.value).newValue as string||'').split('|').map(v => v);
                else
                    this.activeExits = []
            } else if (d.event == ScripEventTypes.VariableChanged && d.condition == this.roomNameVariable) {
                if (this.manualSteps.length) this.manualSteps.splice(0,1)
                this.roomDesc = null
                if (d.value) {
                    this.roomName = (<any>d.value).newValue as string;
                }
                else
                    this.roomName = null
            } else if (d.event == ScripEventTypes.VariableChanged && d.condition == this.roomDescVariable) {
                if (d.value) 
                    this.roomDesc = (<any>d.value).newValue as string;
                else
                    this.roomDesc = null
            }
        })
    }

    public setRoomData(id:number, roomData:Room) {
        const pos = this.db.rooms.findIndex(r => r.id == id)
        if (!pos) {
            this.db.rooms.push(roomData)
        } else {
            this.db.rooms[pos] = roomData
        }
        this.loadDb(this.db)
        this.setSelected(this.idToRoom.get(roomData.id))
    }

    public getRoomName(room: Room): string {
        const vnum = "";//" (Vnum: " + room.vnum + ")"
        if (!room) 
            return ("Stanza sconosciuta.");
        else
            return "[" + room.id + "] " + room.name + vnum + (this.resyncato ? " <resync>":"");
    }

    public getRoomIdFromVnum(roomVnum:number): number {
        if (typeof roomVnum == 'string') roomVnum = parseInt(roomVnum);
        return this.vnumToRoom.get(roomVnum).id;
    }

    public getRoomByVnum(vnum:number) {
        if (typeof vnum == 'string') vnum = parseInt(vnum);
        return this.vnumToRoom.get(vnum)
    }

    public async load(url:string):Promise<MapDatabase> {
        this.emitMessage.fire("Inizializzo mapper... attendere.");
        const response = await fetch(url);
        console.log("Mappe:" + response.statusText  + "(" + response.status + ")")
        const data = await response.json();
        /*
        const r2 = await fetch(url);
        const total = Number(r2.headers.get('content-length'));
        const tot = total;
        const buffer = new Uint8Array(total);
        const self = this;
        function consume(reader:ReadableStreamDefaultReader<Uint8Array>) {
            var total = 0
            return new Promise<Uint8Array>((resolve, reject) => {
              function pump() {
                reader.read().then(({done, value}) => {
                  if (done) {
                    resolve(buffer)
                    return
                  }
                  buffer.set(value, total);
                  total += value.byteLength
                  self.emitMessage.fire(`Scaricato ${total} byte (${tot} in totale)`);
                  setTimeout(pump, 25);
                }).catch(reject)
              }
              pump()
            })
          }
          

          const reData = await consume(r2.body.getReader());
          var string = new TextDecoder().decode(reData);
          var compressed = compress(string);
          localStorage.setItem("mapperDatabase", compressed);
*/
        this.emitMessage.fire("Carico database mappe... attendere.");
        return this.loadDb(data);
    }

    private prepare() {
        this.vnumToRoom.clear();
        this.idToRoom.clear();
        this.idToZone.clear();
        this.roomIdToZoneId.clear();
        this.zoneRooms.clear();
        this.currentWalk = null;
        this.current = null;
        this.walkQueue = [];
        if (!this.db) return;

        for (const zn of this.db.zones) {
            if (zn.id) {
                this.idToZone.set(zn.id, zn);
                this.zoneRooms.set(zn.id, []);
            }
        }

        for (const rm of this.db.rooms) {
            if (rm.id) {
                this.idToRoom.set(rm.id, rm);
                this.roomIdToZoneId.set(rm.id, rm.zone_id);
                if (rm.shortName && rm.shortName.length) this.shortNameToRoom.set(rm.shortName.toLowerCase(), rm);
                const z = this.zoneRooms.get(rm.zone_id);
                if (z) {
                    z.push(rm);
                }
            }
            if (rm.vnum) this.vnumToRoom.set(rm.vnum, rm);
        }

        let graph = ngraph.default();

        for (const rm of this.db.rooms) {
            graph.addNode(rm.id, {
                room: rm
            })
            for (const rex in rm.exits) {
                let exDir:ExitDir = <ExitDir>rex;
                if (!rm.exits[exDir] || !rm.exits[exDir].to_room) continue;
                const rm2 = this.idToRoom.get(rm.exits[exDir].to_room);
                if (!rm2) continue;

                graph.addLink(rm.id, rm.exits[exDir].to_room, {
                    dir: exDir,
                    exit: rm.exits[exDir],
                    room: rm,
                    roomTo: rm2,
                    weight: rm2.cost || 1
                });

                
            }
        }

        // not needed since i use oriented in astar
        /*graph.forEachNode(n => {
            for (const l of [...n.links]) {
                if (l.fromId != n.id) {
                    n.links.delete(l);
                }
            }
        })*/

        this.pathFinder = aStar<Step, any>(graph, {
            distance(fromNode, toNode, link) {
                return (link.data.weight || 1)
            },
            oriented: true
          });
    }

    public getRoomZone(roomId: number): Zone {
        const zid = this.roomIdToZoneId.get(roomId);
        if (zid) {
            return this.idToZone.get(zid);
        }
        return null;
    }

    public getZoneRooms(zoneId: number): Room[] {
        const zid = this.zoneRooms.get(zoneId);
        if (zid) {
            return zid;
        }
        return null;
    }

    public importMapDb(db:MapDatabase) {
        if (!this.db) {
            this.emitMessage.fire("Mapper non inizializzato: impossibile importare da file.")
            return
        }

        for (const z of db.zones) {
            let existing = this.db.zones.findIndex(dbz => dbz.id == z.id)
            if (existing>-1) {
                this.db.zones[existing] = z
            } else {
                this.db.zones.push(z)
            }

            const zrooms = db.rooms.filter(ir => ir.zone_id == z.id)
            for (const ir of zrooms) {
                let existingR = this.db.rooms.findIndex(dbr => dbr.id == ir.id)
                if (existing>-1) {
                    this.db.rooms[existingR] = ir
                } else {
                    this.db.rooms.push(ir)
                }
            }
        }

        this.loadDb(this.db);
        this.emitMessage.fire("File mapper importato.")
    }

    public exportZone(zoneid:number):MapDatabase {
        
        if (!zoneid) {
            this.emitMessage.fire("Numero zona invalido: export impossibile.")
            return null
        }

        if (!this.db) {
            this.emitMessage.fire("Mapper non inizializzato: impossibile esportare zona in file.")
            return null
        }

        const zoneData = this.idToZone.get(zoneid)
        if (!zoneData) return null;
        const zoneRooms = this.getZoneRooms(zoneid)

        const ret:MapDatabase = {
            rooms: zoneRooms,
            zones: [zoneData],
            version: {
                version: this.db.version ? this.db.version.version : 0
            }
        }
        this.emitMessage.fire("Zona esportata, scaricamento in corso.")
        return ret;
    }

    public loadDb(mapDb: MapDatabase):MapDatabase {
        this.db = mapDb;

        this.prepare();

        if (!this.current && this.roomId>=0) {
            this.setRoomById(this.roomId);
        } else if (!this.current && this.roomVnum>=0) {
            this.setRoomByVNum(this.roomVnum);
        }
        
        this.roomChanged.fire({id: -1, vnum: -1, room: null});
        this.roomChanged.fire({id: this.roomId, vnum: this.roomVnum, room: this.current});
        
        return mapDb;
    }

    public getRoomById(id:number) {
        if (typeof id != 'number')
            id = parseInt(id);
        return this.idToRoom.get(id);
    }

    public setRoomById(id:number) {
        this.roomId = id;
        const old = this.current;
        if (id == -1) {
            this.current = null;
        } else {
            this.current = this.idToRoom.get(id);
            if (this.current) this.roomVnum = this.current.vnum;
        }
        if (old != this.current) {
            this.roomChanged.fire({ id: this.roomId, vnum: this.roomVnum, room: this.current })
        }
    }

    public setRoomByVNum(vnum:number) {
        this.roomVnum = vnum;
        const old = this.current;
        const prev = this._previous;
        if (vnum == -1) {
            this.roomId = -1;
            this.current = null;
        } else {
            this.current = this.vnumToRoom.get(vnum);
            if (this.current) this.roomId = this.current.id;
        }
        if ((!this.current && this.autoSync) || (this.current && this.autoSync && this.roomName && this.current.name != this.roomName)) {
            let found:Room = null
            if (prev) {
                for (const k of Object.keys(prev.exits)) {
                    const ex = prev.exits[k as ExitDir]
                    let candidate:Room;
                    if (ex.to_room && this.roomName && this.activeExits && (candidate = this.idToRoom.get(ex.to_room))) {
                        if (candidate.name == this.roomName && this.activeExits.every(e => {
                            const shortExit = Long2ShortExit.get(e)
                            return candidate.exits[<ExitDir>shortExit];
                        })) {
                            found = candidate
                        }
                    }
                }
            }
            this.current = found || this.syncToRoom()
            if (this.current) {
                this.setRoomById(this.current.id)
                this.resyncato = true;
            }
        }
        if (old != this.current) {
            const lastStep = this.walkQueue.shift()
            if (!this.current && lastStep && prev) {
                const exitFromPrevious = prev.exits[lastStep.direction];
                if (exitFromPrevious && exitFromPrevious.to_room) {
                    const backupRoom = this.idToRoom.get(exitFromPrevious.to_room);
                    if (backupRoom) {
                        this.roomId = backupRoom.id
                        this.roomVnum = backupRoom.vnum
                        this.current = backupRoom
                    }
                }
            }
            if (!this.current && this.autoSync) {
                this.current = this.syncToRoom()
                if (this.current) {
                    this.setRoomById(this.current.id)
                    this.resyncato = true;
                }
            }
            this.roomChanged.fire({ id: this.roomId, vnum: this.roomVnum, room: this.current })
        }
    }

    search(name:string, desc?:string) {
        let totLen = name.length + (desc||"").length
        if (totLen < 3) {
            EvtScriptEmitPrint.fire({owner:"Mapper", message: "Errore: Minima lunghezza di ricerca: 3 caratteri."})
            return
        }
        let rooms = this.searchRoomsByNameAndDesc(name, desc)
        const len = rooms ? rooms.length : 0
        if (len > 20) {
            rooms = rooms.slice(0, 19)
        } else if (len == 0) {
            EvtScriptEmitPrint.fire({owner:"Mapper", message: "Nessuna room trovata"})
            return
        }

        let line = $(`<span><span style="color:white">Risultati ricerca:</span><br/> Nome:<span style="color:green">[${name||"-"}]</span> Descrizione:<span style="color:green">[${desc||"-"}]</span><br /><br /></span>`)
        EvtScriptEmitPrint.fire({owner:"Mapper", message: null, raw:line})

        for (const r of rooms) {
            const wid = r.id;
            let zname = this.getRoomZone(wid).name
            let line = $(`<span><a class="underline clickable" title="Vai a room ${r.id}"><span style="color:yellow">${r.id}</span></a> <span style="color:white">${r.name}</span> <span style="color:gray">(${zname})</span><br /></span>`)
            $("a", line).click(()=>{
                this.walkToId(wid)
            })
            EvtScriptEmitPrint.fire({owner:"Mapper", message: null, raw:line})
        }
        if (len>20) {
            let msg = "Troppi risultati ("+len.toString()+"). Ne mostro i primi 20."
            line = $(`<span><br /><span style="color:red">${msg}</span><br /></span>`)
            EvtScriptEmitPrint.fire({owner:"Mapper", message: null, raw:line})
        }
        this.emitSearch.fire(name)
    }

    searchRoomsByNameAndDesc(name:string, desc:string):Room[] {
        if (!this.db || !this.db.rooms) return null
        let rooms = this.db.rooms
        rooms = rooms.filter(r => (r.name||'').toLowerCase().match((name||'').toLowerCase()));
        if (desc && desc.length) {
            rooms = rooms.filter(r => {
                const d1 = (r.description||'').replace("\r","")
                return d1.toLowerCase().match(desc.toLowerCase());
            })
        }
        return rooms
    }

    findRoomByNameDescAndExits(rooms:Room[], name:string, desc:string, exits:string[]):Room {
        if (!name || !name.length || !rooms) return null;

        rooms = rooms.filter(r => r.name == name);
        if (desc && desc.length) {
            const descLine1 = (desc||'').split("\n")[0].replace("\r","")
            rooms = rooms.filter(r => {
                const d1 = (r.description||'').split("\n")[0].replace("\r","")
                return d1 == descLine1;
            })
        }
        if (exits && exits.length) {
            rooms = rooms.filter(r => {
                const all = exits.every(e => {
                    const shortExit = Long2ShortExit.get(e)
                    return r.exits[<ExitDir>shortExit];
                })
                return all;
            })
        }

        return rooms.length ? rooms[0] : null
    }

    public syncToRoom():Room {
        if (!this.db || !this.db.rooms) return null;
        if (this._previous && this._previous.zone_id) {
            const srcRooms = this.zoneRooms.get(this._previous.zone_id);
            return this.findRoomByNameDescAndExits(srcRooms, this.roomName, this.roomDesc, this.activeExits)
                || this.findRoomByNameDescAndExits(this.db.rooms, this.roomName, this.roomDesc, this.activeExits);
        } else {
            return this.findRoomByNameDescAndExits(this.db.rooms, this.roomName, this.roomDesc, this.activeExits);
        }
    }

    public path(from:number, to:number):Path {
        
        let path = this.pathFinder.find(from, to);

        if (!path.length) return null;

        path.reverse();

        var ret:Path = {
            start: path[0].data.room,
            end: path[path.length-1].data.room,
            steps: []
        };

        for (let i = 0; i < path.length - 1; i++) {
            let fromRoom = path[i].id
            let toRoom = path[i+1].id
            let dir = null;
            let exit = null;
            path[i].links.forEach((v1,v2,s) => {
                if (v2.toId == toRoom) {
                    dir = v2.data.dir
                    exit = v2.data.exit
                }
            })

            if (fromRoom && dir && exit) {
                ret.steps.push({
                    dir: dir,
                    exit: exit,
                    room: this.idToRoom.get(<number>fromRoom)
                })
            }
        }


        return ret;
    }

    public failWalk(reason:string):boolean {
        const ret = !!this.currentWalk
        if (reason && reason.length && ret) EvtScriptEmitPrint.fire( { owner: "Mapper", message: reason})
        /*if (this.currentWalk) {
            EvtScriptEmitPrint.fire( { owner: "Mapper", message: JSON.stringify(this.currentWalk, null, 2)})
        }
        if (this.walkQueue) {
            EvtScriptEmitPrint.fire( { owner: "Mapper", message: this.walkQueue.join(",")})
        }*/
        this.walkQueue = []
        this.currentWalk = null;
        return ret;
    }

    public walkToId(id:number) {
        if (typeof id != 'number')
            id = parseInt(id);

        this.cancelWalk();
        if (!this.current) {
            this.failWalk("Il mapper non ha una room iniziale.")
            return;
        }

        this.walkFromTo(this.current.id, id, this.current.id);
    }

    public walkToVnum(vnum:number) {
        if (typeof vnum != 'number')
            vnum = parseInt(vnum);

        this.cancelWalk();
        if (!this.current) {
            this.failWalk("Il mapper non ha una room iniziale.")
            return;
        }

        const destId = this.getRoomIdFromVnum(vnum);

        if (!destId) {
            this.failWalk("Non c'e' stanza con quel Vnum.")
            return;
        }

        this.walkFromTo(this.current.id, destId, this.current.id);
    }

    public walkToRoomShortName(shname:string) {
        shname = shname.toLowerCase();
        this.cancelWalk();
        if (!this.current) return;
        const destRM = this.shortNameToRoom.get(shname);
        if (!destRM) {
            this.failWalk("Non c'e' stanza con quella parola chiave.")
            return;
        }
        this.walkFromTo(this.current.id, destRM.id);
    }

    acknowledgeStep(vnum:number) {
        if (!this.currentWalk || !this.current)
            return;

        if (!this.currentWalk.steps || this.currentWalk.index >= this.currentWalk.steps.length) {
            if (this.currentWalk.index >= this.currentWalk.steps.length) this.failWalk( `Arrivato a destinazione.`)
            this.failWalk("");
            return;
        }
        let stepVnum = this.currentWalk.steps[this.currentWalk.index].room.vnum
        if (stepVnum &&
            stepVnum != vnum) {
            const lastStepDir = this.currentWalk.steps[this.currentWalk.steps.length-1].direction;
            this.walkToId(this.currentWalk.end.exits[lastStepDir].to_room);
            EvtScriptEmitPrint.fire({owner:"Mapper", message: `Ricalcolo percorso a ${this.currentWalk.end.name}`})
            //this.failWalk( `Percorso fallito. Sei in ${vnum} ma il percorso aspettava ${stepVnum}`)
            return;
        }
        for (let index = this.currentWalk.index; index < this.currentWalk.steps.length; index++) {
            const step = this.currentWalk.steps[index];
            stepVnum = this.currentWalk.steps[index].room.vnum
            if (stepVnum>0 && stepVnum == vnum) {
                this.currentWalk.index = index;
                break;
            }
        }
        const step = this.currentWalk.steps[this.currentWalk.index++];
        if (step) for (const walkCommand of step.commands) {
            const doorOpen = this.doorAlreadyOpen(this.current, step.direction)
            if ((walkCommand.type == WalkCommandType.DoorOpen ||
                walkCommand.type == WalkCommandType.DoorUnlock) && doorOpen) {
                continue;
            }
            if (walkCommand.type == WalkCommandType.Directional) {
                this.walkQueue.push(step);
            }
            else if (walkCommand.type == WalkCommandType.Other) {
                this.walkQueue.push(step);
            }
            EvtScriptEmitCmd.fire( { owner: "Mapper", message: walkCommand.command})
        }
    }

    safeWalk(safeWalk:SafeWalk) {
        if (this.currentWalk != safeWalk) {
            this.failWalk("");
            this.currentWalk = safeWalk
        }
        if (!this.currentWalk) return;
        if (this.currentWalk.index == 0) {
            this.walkQueue = []
        }
        const room = this.currentWalk.steps[this.currentWalk.index||0].room;
        if (room.id == this.roomId || room.vnum == this.roomVnum) this.acknowledgeStep(room.vnum); 
    }

    speedWalk(safeWalk:SafeWalk) {
        this.walkQueue = []
        for (const walkData of this.currentWalk.steps) {
            for (const walkCommand of walkData.commands) {
                EvtScriptEmitCmd.fire( { owner: "Mapper", message: walkCommand.command})
                if (walkCommand.type == WalkCommandType.Directional) {
                    this.walkQueue.push(walkData);
                }
            }
        }
    }

    walkFromTo(id1: number, id2: number, skipDoorsId:number = -1) {
        this.currentWalk = this.calculateWalk(id1, id2, skipDoorsId);
        if (!this.currentWalk.steps.length) {
            this.failWalk("Non trovo il percorso a quella locazione.")
        } else {
            if (this.walkMode == WalkMode.SpeedWalk) {
                this.speedWalk(this.currentWalk)
            } else if (this.walkMode == WalkMode.SafeWalk) {
                this.safeWalk(this.currentWalk)
            }
        }
    }

    doorAlreadyOpen(room:Room, dir:ExitDir):boolean {
        if (this.activeExits.map(v => Long2ShortExit.get(v)).indexOf(dir)>=0) {
            return true;
        }
        return false;
    }

    calculateWalk(id1: number, id2: number, skipDoorsId:number):SafeWalk {
        const path = this.path(id1, id2); 
        if (!path || !path.end) {
            return {
                start: null,
                end: null,
                steps: []
            };
        } else {
            const safeWalk:SafeWalk = {
                start: path.start,
                end: path.end,
                steps: [],
                index: 0
            }
            for (const st of path.steps) {
                const walkQueue:WalkCommand[] = []
                if (st.dir == "other") {
                    walkQueue.push({ type: WalkCommandType.Other, command: st.exit.param || st.exit.name})
                } else {
                    let alreadyOpen:boolean;
                    if (st.room.id == skipDoorsId) {
                        alreadyOpen = this.doorAlreadyOpen(st.room, st.dir)
                    }            
                    this.handlePossibleDoor(st, alreadyOpen, walkQueue);
                }
                safeWalk.steps.push({
                    room: st.room,
                    commands: walkQueue,
                    direction: st.dir
                })
            }
            if (path.steps.length) safeWalk.start = path.steps[0].room
            if (path.steps.length) safeWalk.end = path.steps[path.steps.length-1].room
            return safeWalk;
        }
    }

    private handlePossibleDoor(st: Step, alreadyOpen: boolean, walkQueue: WalkCommand[]) {
        if (st.exit.type >= ExitType.Locked && !alreadyOpen) {
            this.handleLockedDoor(st.dir, st.exit, walkQueue);
        }
        if (st.exit.type >= ExitType.Door && !alreadyOpen) {
            this.handleClosedDoor(st.dir, st.exit, walkQueue);
        }
        if (st.exit.type >= ExitType.Normal) {
            this.handleNormalDirection(st.dir, st.exit, walkQueue);
        }
    }

    cancelWalk():boolean {
        const ret = !!this.currentWalk;
        this.failWalk(null)
        return ret;
    }

    handleNormalDirection(dir: ExitDir, exit: RoomExit, walkQueue: WalkCommand[]) {
        if (exit.to_dir) {
            walkQueue.push({
                command: dir,
                type: WalkCommandType.Directional
            })
        }
    }
    
    handleLockedDoor(dir: ExitDir, exit: RoomExit, walkQueue: WalkCommand[]) {
        /*if (exit.name) {
            this.openSpecialExit(exit.name);
        }*/
        if (exit.param) {
            this.unlockDoor(exit.param, dir, walkQueue);
        }
    }

    handleClosedDoor(dir: ExitDir, exit: RoomExit, walkQueue: WalkCommand[]) {
        if (exit.name) {
            this.openSpecialExit(exit.name, walkQueue);
        }
        if (exit.param) {
            this.openDoor(exit.param, dir, walkQueue, exit.type == ExitType.Door);
        }

        
    }
    openSpecialExit(name: string, walkQueue: WalkCommand[]) {
        walkQueue.push({
            command: name,
            type: WalkCommandType.Other
        });
    }

    openDoor(param: string, dir:ExitDir, walkQueue: WalkCommand[], unlock:boolean) {
        let openTemplate;
        if (openingCommands.find(oc => param.indexOf(oc+" ")>=0)) {
            const openCmds = param.toLowerCase().split(",").filter(part => {
                let ret:number = 0
                if (unlock)
                    ret |= unlockCommands.find(oc => part.trim().indexOf(oc+" ")>=0) ? 1 : 0;
                ret |= openingCommands.find(oc => part.trim().indexOf(oc+" ")>=0) ? 1 : 0;
                return ret > 0;
            })
            openTemplate = openCmds.map(v => v.trim() + (this.addDirectionToDoors ? (" " + Short2LongExit.get(dir)) : "")).join("\n")
        } else {
            openTemplate = `${this.openCommand} ${param}` + (this.addDirectionToDoors ? (" " + Short2LongExit.get(dir)) : "")
        }
        walkQueue.push({
            command: openTemplate,
            type: WalkCommandType.DoorOpen
        });
    }

    unlockDoor(param: string, dir:ExitDir, walkQueue: WalkCommand[]) {
        let unlockTemplate;
        if (unlockCommands.find(oc => param.indexOf(oc+" ")>=0)) {
            const unlCmds = param.toLowerCase().split(",").filter(part => unlockCommands.find(oc => part.trim().indexOf(oc+" ")>=0))
            unlockTemplate = unlCmds.map(v => v.trim() + (this.addDirectionToDoors ? (" " + Short2LongExit.get(dir)) : "")).join("\n")
        } else {
            openingCommands.map(v => param = param.toLowerCase().replace(v, "").trim())
            unlockTemplate = `${this.unlockCommand} ${param}` + (this.addDirectionToDoors ? (" " + Short2LongExit.get(dir)) : "")
        }
        walkQueue.push({
            command: unlockTemplate,
            type: WalkCommandType.DoorUnlock
        });
    }
}