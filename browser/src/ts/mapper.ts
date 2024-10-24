import { EventHook } from './event';
import { EvtScriptEmitPrint, JsScript } from './jsScript'
import { EvtScriptEvent, ScripEventTypes, EvtScriptEmitCmd } from './jsScript'
import { aStar, PathFinder } from 'ngraph.path';
import * as ngraph from 'ngraph.graph';
import {MapperStorage} from './mapperStorage'

export interface MapperOptions {
    mapperScale: number;
    useGrid: boolean;
    gridSize: number;
    preferLocalMap: boolean;
    toolboxX: number;
    toolboxY: number;
    backgroundColor: string;
    foregroundColor: string;
    drawWalls: boolean,
    drawRoomType: boolean,
    preferZoneAbbreviations: boolean;
    drawAdjacentLevel: boolean
};

export interface Zone {
    id: number;
    name: string;
    description?: string;
    label?: string;
    backColor?: string
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
ReverseExitDir.set(ExitDir.Other, ExitDir.Other)

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
    Field,
    Water,
    Mountain,
    Underground,
    Street,
    Crossroad,
    DeathTrap,
    Air,
    Path,
    Hills,
    City,
    Mercant,
    Underwater,
    Desert
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
    ['no','nordovest'],
    ['a','alto'],
    ['b','basso'],
]);

export function IsDirectionalCommand(cmd:string, ita:boolean):boolean {
    if (cmd.indexOf(" ")>-1) return false;

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

export interface Favorite {
    roomId:number;
    key:string;
    color:string;
};

export class Mapper {
    deleteZone(zoneId: number) {
        let rooms = this.getZoneRooms(zoneId)
        for (const r of rooms) {
            let ri = this.db.rooms.findIndex(z => z.id == r.id)
            if (ri > -1) {
                this.db.rooms.splice(ri, 1)
            }
        }
        let zi = this.db.zones.findIndex(z => z.id == zoneId)
        if (zi > -1) {
            this.db.zones.splice(zi, 1)
        }
        this.prepare()
    }
    saveZone(zone: Zone) {
        if (!zone.id) {
            let maxId = -1
            for (const z of this.db.zones) {
                if (maxId < z.id) {
                    maxId = z.id
                }
            }
            maxId++
            zone.id = maxId
        }
        if (this.db.zones.indexOf(zone) == -1) {
            this.db.zones.push(zone)
        }
        this.prepare()
        this.zoneChanged.fire({ id: zone.id, zone: zone})
    }
    moveRoomsToZone(rooms: Room[], newZone: Zone) {
        let lastRoom: Room;
        for (const room of rooms) {
            let zrooms = this.zoneRooms.get(room.zone_id)
            let ri = zrooms?.findIndex(z => z.id == room.id)
            if (ri > -1) {
                zrooms.splice(ri, 1)
            }
            room.zone_id = newZone.id
            this.prepareRoom(room);
            lastRoom = room
        }

        this.createGraph();

        this.zoneChanged.fire({ id: newZone.id, zone: newZone})
        if (lastRoom) this.roomChanged.fire({ id: lastRoom.id, vnum: lastRoom.vnum, room: lastRoom})
    
    }
    deleteRooms(rooms: Room[]) {
        for (const rm of rooms) {
            const index = this.db.rooms.findIndex((r,i) => r == rm)
            if (index>-1) {
                this.deleteExitsReferencing(rm)
                this.db.rooms.splice(index, 1)
            }
        }
        this.prepare()
    }
    deleteExitsReferencing(rm: Room) {
        for (const room of this.db.rooms) {
            if (room.id != rm.id && room.exits) for (const dir of Object.keys(ExitDir).map(k => (ExitDir as any)[k])) {
                if (room.exits[dir as ExitDir] && room.exits[dir as ExitDir].to_room == rm.id) {
                    delete room.exits[dir as ExitDir]
                }
            }
        }
    }
    deleteRoomExit(room: Room, dir: ExitDir) {
        delete room.exits[dir]
        this.prepareRoom(room)
        this.createGraph()
        if (this.current) this.zoneChanged.fire({
            id: this.current.zone_id,
            zone: null
        })
        return room
    }
    createRoomAt(zone: number, createRoomPos: {x: number, y: number, z?:number}) {
        let zn = this.getZoneRooms(zone)
        if (!zn) {
            this.emitMessage.fire("Zona inesistente "+ zone)
            return null;
        }
        let starNum = this.getZoneRooms(zone).length ? this.getZoneRooms(zone).map(r => r.id).sort((n,n2) => n - n2)[0] : 0;

        let newId = this.getFreeId(starNum)
        const room: Room = {
            name: "Room" + newId,
            description: "",
            type: RoomType.Inside,
            zone_id: zone,
            color: null,
            id: newId,
            x: createRoomPos.x,
            y: createRoomPos.y,
            z: createRoomPos.z || 0,
            exits: {}
        };
        this.db.rooms.push(room)
        this.prepareRoom(room)
        this.createGraph()
        this.roomChanged.fire({
            id: room.id,
            room: room,
            vnum: null
        })
        return room
    }
    getZones():Zone[] {
        return this.db.zones
    }
    options:MapperOptions;
    loadOptions() {
        const mop = localStorage.getItem("mapperOptions")
        if (mop) {
            this.options = JSON.parse(mop)
        } else {
            this.options = {
                gridSize: 240,
                mapperScale: 1.33,
                useGrid: true,
                preferLocalMap: false,
                backgroundColor: null,
                foregroundColor: null,
                drawWalls: true,
                toolboxX: 0,
                toolboxY: 0,
                drawRoomType: true,
                preferZoneAbbreviations: false,
                 drawAdjacentLevel: true
            }
        }

        if (this.options.drawAdjacentLevel == undefined) {
            this.options.drawAdjacentLevel = true
        }
        if (this.options.gridSize < 1)
            this.options.gridSize = 1
        if (this.options.gridSize > 480)
            this.options.gridSize = 480
        
        if (this.options.mapperScale < .5)
            this.options.mapperScale = .5
        if (this.options.mapperScale > 4)
            this.options.mapperScale = 4
        
    }
    saveOptions() {
        const mop = JSON.stringify(this.options, null, 2)
        localStorage.setItem("mapperOptions", mop.toString())
    }
    getOptions(): MapperOptions {
        if (!this.options) {
            this.loadOptions()
        }
        return this.options;
    }
    getVersion():number {
        return (this.db?.version?.version) || 0;
    }
    getDB(): MapDatabase {
        return this.db;
    }
    private favorites = new Map<number, Favorite>();

    private saveFavorites() {
        const fv = [...this.favorites.values()]
        localStorage.setItem("mapper_favorites", JSON.stringify(fv))
        if (this.db) this.loadDb(this.db, this.db?.version)
    }

    public getFavorites():Favorite[] {
        return [...this.favorites.values()]
    }

    public addFavorite(fv:Favorite) {
        for (const f of this.favorites.values()) {
            if (f.key == fv.key) {
                this.favorites.delete(f.roomId);
                // duplicates
            }
        }
        this.favorites.set(fv.roomId, fv);
        this.saveFavorites();
    }

    public removeFavorite(id:number) {
        this.favorites.delete(id);
        const rm = this.getRoomById(id)
        if (rm) {
            rm.color = null
            rm.shortName = null;
        }
        this.saveFavorites();
    }

    public loadFavorites(override?:Favorite[]) {
        this.favorites.clear()
        const fv = override ? override : JSON.parse(localStorage.getItem("mapper_favorites")) as Favorite[];
        if (fv) {
            for (const f of fv) {
                this.favorites.set(f.roomId, f);
            }
            this.favoritesChanged.fire(null);
        }
    }

    scripting: JsScript;
    loadLastPosition() {
        this.roomVnum = parseInt(this.scripting.getVariableValue(this.vnumVariable))
        this.setRoomByVNum(this.roomVnum)
        if (!this.current) {
            const name = this.scripting.getVariableValue(this.roomNameVariable)
            const desc = this.scripting.getVariableValue(this.roomDescVariable)
            if (name?.length || desc?.length) {
                const candidates = this.searchRoomsByNameAndDesc(name, desc)
                if (candidates && candidates.length) {
                    this.setRoomById(candidates[0].id)
                }
            }
        }
        return !!this.current
    }
    
    private _useItalian: boolean = true;
    defaultDoorName: string = "porta";
    private _virtualCurrent: Room;
    public get virtualCurrent(): Room {
        return this._virtualCurrent;
    }
    public set virtualCurrent(value: Room) {
        this._virtualCurrent = value;
        if (value==null) {
            this.acknowledgingWalkStep = false;
        }
    }
    public loading = false;
    public get useItalian(): boolean {
        return this._useItalian;
    }
    public set useItalian(value: boolean) {
        this._useItalian = value;
    }

    private lastStep:Step = null;
    private manualSteps:Step[]=[]
    public clearManualSteps() {
        this.manualSteps.splice(0, this.manualSteps.length)
    }

    parseCommandsForDirection(command: string): string[] {
        if (!this.current) return [command];
        
        const lastStepRoom = this.manualSteps.length && this.manualSteps[this.manualSteps.length-1].exit ? this.idToRoom.get(this.manualSteps[this.manualSteps.length-1].exit.to_room) : this.current
        if (!lastStepRoom) return [command];
        const ret:string[] = <string[]>[command];
        let doLog = false;
        if (IsDirectionalCommand(command, this.useItalian)) {
            if (this.acknowledgingWalkStep) 
            {
                //this.acknowledgingWalkStep = false;
                return [command];
            }
            const dir = this.parseDirectionalCommand(command);
            this.checkValidManualSteps(dir, lastStepRoom);
            const st = {
                dir: dir,
                room: lastStepRoom,
                exit: lastStepRoom.exits[dir]
            }
            if (!st.exit) {
                if (this.mapmode) {
                    this.manualSteps.push(st)
                    this.lastStep = st;
                }
                return [command];
            }
            this.manualSteps.push(st)
            this.lastStep = st;
            doLog = true
            const queue:WalkCommand[] = []
            this.handlePossibleDoor(st, this.manualSteps.length == 1 && this.doorAlreadyOpen(st.room, st.dir), queue)
            ret.splice(0, ret.length)
            if (queue.length) {
                queue.map(q => {
                    if (q.type == WalkCommandType.Directional) {
                        const longCommad = Short2LongExit.get(q.command)
                        ret.push(longCommad || command)
                    } else {
                        ret.push(q.command)
                    }
                })
            }
        }
        
        if (doLog && this.manualSteps.length) console.log("Steps: " + this.manualSteps.reduce((ps, cs, i, arr) => ps + ", " + cs.room.name, ""))
            
        return ret;
    }
    checkValidManualSteps( dir: ExitDir, room:Room) {
        if (!this.manualSteps.length) return;

        const wrongRooms = this.manualSteps.filter(ms => ms.room.id == room.id)
        if (wrongRooms.length) {
            this.manualSteps.splice(0, this.manualSteps.length)
            return
        }

        const dirs = [ExitDir.Down,ExitDir.Up,ExitDir.North,ExitDir.NorthEast,ExitDir.East,ExitDir.SouthEast,ExitDir.South,ExitDir.SouthWest,ExitDir.West,ExitDir.NorthWest]
        let ok = false;
        for (const dir of dirs) {
            const ex = this.manualSteps[this.manualSteps.length-1].room.exits[dir]
            if (ex && (ex.to_room == room.id || (this.current && ex.to_room == this.current.id))) {
                ok = true
            }
        }
        if (!ok) {
            this.manualSteps.splice(0, this.manualSteps.length)
            return
        }        
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
        if (this.current && this.current.zone_id == zid) return;
        const zr = this.getZoneRooms(zid)
        if (zr && zr.length) {
            if (this.current && this.current.zone_id == zid) {
                this.setRoomById(this.current.id)
            } else {
                this.setRoomById(zr[0].id)
            }
        } else {
            this.zoneChanged.fire({
                id: zid, zone: this.idToZone.get(zid)
            })
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
    public get previous(): Room {
        return this._previous;
    }
    public set previous(value: Room) {
        this._previous = value;
    }
    public get current(): Room {
        return this._current;
    }
    private _mapmode: boolean = null;
    public get mapmode(): boolean {
        return this._mapmode;
    }
    public closeMapModeWithoutSaving() {
        this._mapmode = false
    }
    public set mapmode(value: boolean) {
        const oldV = this._mapmode 
        this._mapmode = value
        if (!value && !!oldV) {
            if (this.db.version) {
                this.db.version.version++
                if (!this.db.version.message)
                    this.db.version.message = "Modifiche locali"
                var now = new Date()
                this.db.version.date = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`
            }

            this.saveLocal()
        }
    }
    private _prevZoneId:number = null;
    private _zoneId:number = null;

    public set current(value: Room) {
        this._zoneId = value ? value.zone_id : null
        this._previous = this.current;
        this._current = value;
        this._selected = value;
        this.resyncato = false;
        this.roomId = value?.id
        this.roomVnum = value?.vnum
        if (this._prevZoneId != this._zoneId) {
            this._prevZoneId = this._zoneId
            this.zoneChanged.fire({
                id: this._zoneId,
                zone: this.idToZone.get(this._zoneId)
            })
        }
    }
    public roomVnum: number = -1;
    public roomId: number = -1;
    public roomName: string;
    public roomDesc: string;

    private db: MapDatabase = null;
    public roomChanged = new EventHook<{id: number, vnum:number, room:Room}>();
    public zoneChanged = new EventHook<{id: number, zone:Zone}>();
    public favoritesChanged = new EventHook();
    public emitMessage = new EventHook<string>();
    public emitSearch = new EventHook<string>();

    public vnumToRoom: Map<number, Room> = new Map<number, Room>(); 
    public idToRoom: Map<number, Room> = new Map<number, Room>(); 
    public shortNameToRoom: Map<string, Room> = new Map<string, Room>(); 
    public idToZone: Map<number, Zone> = new Map<number, Zone>(); 
    public roomIdToZoneId: Map<number, number> = new Map<number, number>(); 
    private _zoneRooms: Map<number, Room[]> = new Map<number, Room[]>(); 
    private _zoneRoomsByLevel: Map<number, Map<number, Room[]>> = new Map<number, Map<number, Room[]>>(); 
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
        this.roomVnum = parseInt(script.getVariableValue(this.vnumVariable))
        if (this.roomVnum) this.setRoomByVNum(this.roomVnum);
        this.scripting = script;
    }

    async getLocalDbVersion() {
        const firstVersion = await this.storage.versionKeys();
        return await this.storage.getVersion(firstVersion[0]||0)
    }

    async saveLocalDbVersion(v:MapVersion) {
        await this.storage.setVersion(v.version || 1, v)
        if (this.useLocal && this.db && this.db.version) {
            this.db.version.message = v.message
            this.db.version.version = v.version
        }
    }

    async getOnlineVersion() {
        let data:MapVersion = null;
        try {
            let prefix = ""
            if ((<any>window).ipcRenderer) {
                prefix = true ? "https://temporasanguinis.it/client/" : ""
            }
            const response = await fetch(prefix + "mapperVersion.json?rnd="+Math.random());
            data = await response.json();
        } catch {
            data = {
                version: 0,
                message: "Unknown"
            }
        }
        return data;
    }

    public async loadVersion(online:boolean):Promise<MapVersion> {
        let data:MapVersion = null;
        try {
            if (this.useLocal) {
                await this.loadLocal(true)
                return this.db.version || {
                    version: 0,
                    message: "Unknown"
                };
            }
            let prefix = ""
            if ((<any>window).ipcRenderer) {
                prefix = online ? "https://temporasanguinis.it/client/" : ""
            }
            const response = await fetch(prefix + "mapperVersion.json?rnd="+Math.random());
            data = await response.json();
        } catch {
            data = {
                version: 0,
                message: "Unknown"
            }
        }
        return data;
    }

    async loadLocalDb() {
        this.emitMessage.fire("Inizializzo mapper... attendere.");
        await this.loadLocal(false)
        return this.loadDb(this.db, this.db?.version);
    }

    private _useLocal: boolean;
    public get useLocal(): boolean {
        return this._useLocal;
    }
    public set useLocal(value: boolean) {
        this._useLocal = value;
    }

    async saveLocal() {
        await this.storage.clearVersion()
        await this.storage.setVersion(this.db.version?.version || 1, this.db.version || { version: 1})
        await this.storage.clearZones()
        await this.storage.setZones(this.db.zones)
        await this.storage.clearRooms()
        await this.storage.setRooms(this.db.rooms)
    }

    async loadLocal(onlyVersion:boolean) {
        this.db = { zones: [], rooms: []}
        const firstVersion = await this.storage.versionKeys();
        this.db.version = await this.storage.getVersion(firstVersion[0]||0)
        if (!onlyVersion) {
            this.db.zones = await this.storage.allZones()
            this.db.rooms = await this.storage.allRooms()
        }
    }

    constructor(private storage:MapperStorage) {
        this.loadFavorites();
        this.loadOptions();
        EvtScriptEvent.handle(d => {
            if (d.event == ScripEventTypes.VariableChanged && d.condition == this.vnumVariable) {
                if (d.value) {
                    // questo non va bene, nelle illogichge non cambia vnum al movimento
                    //
                    const newVnum = (<any>d.value).newValue;

                    setTimeout(() => {
                        //console.log("got vnum " + newVnum)
                        if (this.acknowledgingWalkStep && this.discardWalkStep>=0 && this.discardWalkStep == newVnum) {
                            console.log("discarding " + this.discardWalkStep)
                            this.discardWalkStep = -1;
                            this.acknowledgingWalkStep = false
                            this.recalculating = false
                            this.virtualCurrent = null;
                        
                            return;
                        }
    
                        this.acknowledgingWalkStep = false
                        if (this.mapmode && this._previous && this.lastStep) {
                            console.log("MAPPING:"+parseInt(newVnum))
                            const existingRoom = this.getRoomByVnum(parseInt(newVnum))
                            if (!existingRoom) {
                                this.createRoomOnMovement(newVnum);
                            } else {
                                this.updateRoomOnMovement(existingRoom)
                            }
                        }
                        {
                            this.setRoomByVNum(parseInt(newVnum));
                            this.acknowledgeStep(newVnum);
                            if (this.manualSteps.length) this.manualSteps.splice(0,1)                            
                        }

                        if (!this.currentWalk) {
                            this.virtualCurrent = null;
                        }
                        
                    }, 0);
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
                
                //this.roomDesc = null
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

    private updateRoomOnMovement(room: Room) {
        const oldExits = room.exits
        room.exits = {}
        console.log("updateRoomOnMovement")
        
        if (this.lastStep) {
            const dir = this.lastStep;
            const fromRoom = dir.room;
            if (dir?.dir && fromRoom) {
                fromRoom.exits[dir?.dir] = {
                    type: ExitType.Normal,
                    to_room: room.id,
                    to_dir: ReverseExitDir.get(dir?.dir)
                }
                room.exits[ReverseExitDir.get(dir?.dir)] = {
                    type: ExitType.Normal,
                    to_room: fromRoom.id,
                    to_dir: (dir?.dir)
                }
                this.prepareRoom(fromRoom)
            }
        }
        const sett = this.scripting.getVariableValue("TSSettore")
        room.name = this.scripting.getVariableValue("RoomName"),
        room.description = (this.scripting.getVariableValue("RoomDesc")??"").toString().replace(/\r/g,""),
        room.vnum = this.scripting.getVariableValue("TSRoom")
        if (!room.type) room.type = sett == "Foresta" ? RoomType.Forest : sett == "Aperto" ? RoomType.Field : RoomType.Inside
        
        this.activeExits.forEach((e)=>{
            if (!room.exits[<ExitDir>Long2ShortExit.get(e)] && oldExits[<ExitDir>Long2ShortExit.get(e)]) {
                room.exits[<ExitDir>Long2ShortExit.get(e)] = oldExits[<ExitDir>Long2ShortExit.get(e)]
            } else if (!room.exits[<ExitDir>Long2ShortExit.get(e)] && !oldExits[<ExitDir>Long2ShortExit.get(e)]) {
                room.exits[<ExitDir>Long2ShortExit.get(e)] = {
                    type: ExitType.Normal,
                }
            }
        })
        this.lastStep = null;
        this.prepareRoom(room)
        this.createGraph()
        this.roomChanged.fire({ id: 0, vnum: 0, room: null})
        this.roomChanged.fire({ id: room.id, vnum: room.vnum, room: room})
    }

    private createRoomOnMovement(newVnum: any) {
        if (!this.lastStep) return;
        console.log("createRoomOnMovement")
        const dir = this.lastStep;
        const fromRoom = dir.room;
        const oneRoomWidth = 240
        const sett = this.scripting.getVariableValue("TSSettore")
        const toRoom:Room = {
            id: 0,
            name: this.scripting.getVariableValue("RoomName"),
            description: this.scripting.getVariableValue("RoomDesc"),
            exits: {},
            zone_id: fromRoom.zone_id,
            color: null,
            x: fromRoom.x,
            y: fromRoom.y,
            z: fromRoom.z,
            type: sett == "Foresta" ? RoomType.Forest : sett == "Aperto" ? RoomType.Field : RoomType.Inside
        };
        switch (dir.dir) {
            case ExitDir.Down:
                toRoom.z--;
                break;        
            case ExitDir.Up:
                toRoom.z++;
                break;        
            case ExitDir.West:
                toRoom.x-=oneRoomWidth;
                break;        
            case ExitDir.East:
                toRoom.x+=oneRoomWidth;
                break;        
            case ExitDir.South:
                toRoom.y+=oneRoomWidth;
                break;        
            case ExitDir.North:
                toRoom.y-=oneRoomWidth;
                break;        
    
                default:
                break;
        }
        // todo check overlap var zoneRooms = this.getZoneRooms(fromRoom.zone_id)

        toRoom.vnum = parseInt(newVnum);
        let newId = this.getFreeId(fromRoom.id);
        toRoom.id = newId;
        toRoom.exits = {}
        this.activeExits.forEach((e)=>{
            toRoom.exits[<ExitDir>Long2ShortExit.get(e)] = {
                type: ExitType.Normal,
            }
        })
        if (dir?.dir) {
            console.log("mapmode: ", fromRoom.id, toRoom.id, dir?.dir);
            fromRoom.exits[dir?.dir] = {
                type: ExitType.Normal,
                to_room: toRoom.id,
                to_dir: ReverseExitDir.get(dir?.dir)
            }
            toRoom.exits[ReverseExitDir.get(dir?.dir)] = {
                type: ExitType.Normal,
                to_room: fromRoom.id,
                to_dir: (dir?.dir)
            }
        }
        const fromIndex = this.db.rooms.findIndex(r => r.id == fromRoom.id)
        if (fromIndex>-1) {
            this.db.rooms.splice(fromIndex, 1)
        }
        this.db.rooms.push(fromRoom)
        const toIndex = this.db.rooms.findIndex(r => r.id == toRoom.id)
        if (toIndex>-1) {
            this.db.rooms.splice(toIndex, 1)
        }
        this.db.rooms.push(toRoom)
        this.lastStep = null;
        this.prepareRoom(fromRoom)
        this.prepareRoom(toRoom)
        this.createGraph()
    }

    private getFreeId(fromId: number) {
        const occVnums = [...this.idToRoom.keys()].sort((v1, v2) => v1 < v2 ? -1 : 1);
        let newId = 0;
        for (let index = occVnums.indexOf(fromId) + 1; index < occVnums.length - 1; index++) {
            const e1 = occVnums[index];
            const e2 = occVnums[index + 1];
            if (e1 + 1 != e2) {
                newId = e1 + 1;
                break;
            }
        }
        if (newId == 0) {
            newId = occVnums[occVnums.length - 1] + 1;
        }
        return newId;
    }

    public setRoomData(id:number, roomData:Room) {
        const pos = this.db.rooms.findIndex(r => r.id == id)
        if (!pos) {
            this.db.rooms.push(roomData)
        } else {
            this.db.rooms[pos] = roomData
        }
        this.loadDb(this.db, this.db?.version)
        this.setSelected(this.idToRoom.get(roomData.id))

        this.roomChanged.fire({ id: 0, vnum: 0, room: null})
        this.roomChanged.fire({ id: roomData.id, vnum: roomData.vnum, room: roomData})
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

    public async load(url:string, ver: MapVersion):Promise<MapDatabase> {
        console.log("Caricamento db mappe da " + url)
        this.emitMessage.fire("Inizializzo mapper... attendere.");
        let response;
        try {
            response = await fetch(url);
        } catch {
            this.emitMessage.fire("Errore nello scaricamento mappe.");
        }
        const data = await response.json();
        this.emitMessage.fire("Carico database mappe... attendere.");
        return this.loadDb(data, ver);
    }

    private prepare() {
        const oldCurrent = this.current
        this.vnumToRoom.clear();
        this.idToRoom.clear();
        this.idToZone.clear();
        this.roomIdToZoneId.clear();
        this.zoneRooms.clear();
        this._zoneRoomsByLevel.clear();
        this.currentWalk = null;
        this.current = null;
        this.manualSteps = [];
        this.walkQueue = [];
        this.loadFavorites();
        if (!this.db) return;

        for (const zn of this.db.zones) {
            if (zn.id) {
                this.idToZone.set(zn.id, zn);
                this.zoneRooms.set(zn.id, []);
                this._zoneRoomsByLevel.set(zn.id, new Map<number, Room[]>());
            }
        }

        for (const rm of this.db.rooms) {
            this.prepareRoom(rm);
        }

        this.createGraph();
        this.roomChanged.fire({id:-1, vnum:-1,room:null})
        this.zoneChanged.fire({id:-1,zone:null})
        if (oldCurrent && (this._current = this.getRoomById(oldCurrent.id))) {
            this.zoneChanged.fire({ id: oldCurrent.zone_id, zone: this.getRoomZone(oldCurrent.id)})
            this.roomChanged.fire({id: oldCurrent.id, vnum: oldCurrent.vnum, room: oldCurrent})
        }
    }

    private createGraph() {
        let graph = ngraph.default();

        for (const rm of this.db.rooms) {
            graph.addNode(rm.id, {
                room: rm
            });
            for (const rex in rm.exits) {
                let exDir: ExitDir = <ExitDir>rex;
                if (!rm.exits[exDir] || !rm.exits[exDir].to_room)
                    continue;
                const rm2 = this.idToRoom.get(rm.exits[exDir].to_room);
                if (!rm2)
                    continue;

                if (rm.exits[exDir].name && exDir != "other") {
                    console.log("Exit con commando: ", rm.id, exDir, rm.exits[exDir])
                }
                
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
                return (link.data.weight || 1);
            },
            oriented: true
        });
    }

    private prepareRoom(rm: Room) {
        if (rm.id) {
            if (this.favorites.has(rm.id)) {
                const f = this.favorites.get(rm.id);
                if (f.color) {
                    rm.color = f.color;
                }
                if (f.key) {
                    rm.shortName = '['+f.key+']';
                }
            }
            this.idToRoom.set(rm.id, rm);
            this.roomIdToZoneId.set(rm.id, rm.zone_id);
            if (rm.shortName && rm.shortName.length && rm.shortName[0]=='[' && rm.shortName[rm.shortName.length-1]==']')
                this.shortNameToRoom.set(rm.shortName.toLowerCase().substring(1,rm.shortName.length-1), rm);
            const z = this.zoneRooms.get(rm.zone_id);
            if (z) {
                const existingId = z.findIndex(r => r.id == rm.id)
                if (existingId>-1) {
                    z.splice(existingId, 1)
                }
                z.push(rm);

                const zrl = this._zoneRoomsByLevel.get(rm.zone_id);
                if (zrl) {
                    let lv = zrl.get(rm.z);
                    if (!lv) {
                        zrl.set(rm.z, []);
                    }
                    lv = zrl.get(rm.z);
                    if (lv) {
                        lv.push(rm);
                    }
                }
            }
        }
        if (rm.vnum)
            this.vnumToRoom.set(rm.vnum, rm);
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
                this.db.rooms = this.db.rooms.filter(ir => ir.zone_id != z.id)
            } else {
                this.db.zones.push(z)
            }

            const zrooms = db.rooms.filter(ir => ir.zone_id == z.id)
            for (const ir of zrooms) {
                let existingR = this.db.rooms.findIndex(dbr => dbr.id == ir.id)
                if (existingR>-1) {
                    this.db.rooms[existingR] = ir
                } else {
                    this.db.rooms.push(ir)
                }
            }
        }

        this.loadDb(this.db, this.db?.version);
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

    public exportAll():MapDatabase {

        if (!this.db) {
            this.emitMessage.fire("Mapper non inizializzato: impossibile esportare.")
            return null
        }

        const ret:MapDatabase = {
            rooms: this.db.rooms,
            zones: this.db.zones,
            version: {
                version: this.db.version ? this.db.version.version : 0,
                date: this.db.version ? this.db.version.date : "",
                message: this.db.version ? this.db.version.message : ""
            }
        }
        this.emitMessage.fire("Mappa esportata, scaricamento in corso.")
        return ret;
    }

    public loadDb(mapDb: MapDatabase, ver: MapVersion):MapDatabase {
        try {
            this.loading = true
            this.db = mapDb;
            this.mapmode = false

            if (this.db) {
                this.db.version = this.db?.version && this.db?.version?.version > 0 ? this.db?.version : ver
            }

            this.acknowledgingWalkStep = false;
            const currentRoom = this.current;
            const currentVnum = this.roomVnum;
            const currentId = this.roomId;

            this.prepare();

            let existsByVnum = !currentRoom && currentVnum >=0 ? this.containsVnum(currentVnum) : false;
            let existsById = !currentRoom && currentId >=0 ? this.containsId(currentId) : false;

            if (!currentRoom && existsById) {
                this.setRoomById(currentId);
            } else if (!currentRoom && existsByVnum) {
                this.setRoomByVNum(currentVnum);
            }
            else if (currentRoom) {
                this.roomChanged.fire({id: currentRoom.id, vnum: currentRoom.vnum, room: currentRoom});
            } else {
                if (!this.loadLastPosition()) {
                    this.zoneChanged.fire({ id: null, zone:null})
                }
            }
            console.log("Mapper Loaded data version " + this.getVersion())
            return mapDb;
        } finally {
            this.loading = false;
        }

    }

    public getRoomById(id:number) {
        if (typeof id != 'number')
            id = parseInt(id);
        return this.idToRoom.get(id);
    }

    public containsId(id:number):boolean {
        return this.idToRoom.has(id)
    }

    public containsVnum(vn:number):boolean {
        return this.vnumToRoom.has(vn)
    }

    public setRoomById(id:number) {
        this.roomId = id;
        const old = this.current;
        if (id == -1) {
            this.current = null;
        } else {
            const newCurrent = this.idToRoom.get(id)
            if (newCurrent) {
                this.current = newCurrent;
                this.current = newCurrent; // twice in case there was a zoneChanged which would set it to the first room of the zone
                this.roomVnum = newCurrent.vnum;
            }
        }
        if (old != this.current) {
            console.log("roomchanged " + old?.id + " -> " + this.current?.id)
            this.roomChanged.fire({ id: this.roomId, vnum: this.roomVnum, room: this.current })
        }
    }

    public setRoomByVNum(vnum:number) {
        if (typeof(vnum) != "number") {
            console.log("Vnum not numeric");
            return;
        }
        this.roomVnum = vnum;
        const old = this.current;
        const prev = this._previous;
        //console.log("room by vnum " + vnum)
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
                            console.log("resync by name and exits" + vnum)
                        }
                    }
                }
            }
            this.current = found || this.syncToRoom()
            if (this.current) {
                console.log("full resync for vnum " + vnum + " to id " + this.current.id)
                this.setRoomById(this.current.id)
                this.resyncato = true;
            }
        }
        if (old != this.current) {
            const lastStep = this.walkQueue.shift()
            if (!this.current && lastStep && old) {
                const exitFromPrevious = old.exits[lastStep.direction];
                if (exitFromPrevious && exitFromPrevious.to_room) {
                    const backupRoom = this.idToRoom.get(exitFromPrevious.to_room);
                    if (backupRoom) {
                        this.roomId = backupRoom.id
                        this.roomVnum = backupRoom.vnum
                        this.current = backupRoom
                        console.log("resync for walkqueue to id " + this.roomId)
                    }
                }
            }
            const lastStepManual = this.manualSteps.shift()
            if (!this.current && lastStepManual && old) {
                const exitFromPrevious = old.exits[lastStepManual.dir];
                if (exitFromPrevious && exitFromPrevious.to_room) {
                    const backupRoom = this.idToRoom.get(exitFromPrevious.to_room);
                    if (backupRoom) {
                        this.roomId = backupRoom.id
                        this.roomVnum = backupRoom.vnum
                        this.current = backupRoom
                        console.log("resync for manualQueue to id " + this.roomId)
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

    search(name:string, desc?:string):Room[] {
        let totLen = name.length + (desc||"").length
        if (totLen < 3) {
            EvtScriptEmitPrint.fire({owner:"Mapper", message: "Errore: Minima lunghezza di ricerca: 3 caratteri."})
            return []
        }
        let rooms = this.searchRoomsByNameAndDesc(name, desc)
        const len = rooms ? rooms.length : 0
        if (len > 20) {
            rooms = rooms.slice(0, 19)
        } else if (len == 0) {
            EvtScriptEmitPrint.fire({owner:"Mapper", message: "Nessuna room trovata"})
            return []
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
        return rooms;
    }

    searchRooms(name:string, desc:string):Room[] {
        return this.searchRoomsByNameAndDesc(name, desc);
    };

    searchRoomsByNameAndDesc(name:string, desc:string):Room[] {
        if (!this.db || !this.db.rooms) return null
        let rooms = this.db.rooms
        rooms = rooms.filter(r => (r.name||'').toLowerCase().match((name||'').toLowerCase()));
        if (desc && desc.length) {
            rooms = rooms.filter(r => {
                const d1 = (r.description||'').replace("\r\n"," ")
                return d1.toLowerCase().match(desc.toLowerCase());
            })
        }
        return rooms
    }

    findRoomByNameDescAndExits(rooms:Room[], name:string, desc:string, exits:string[]):Room {
        if (!name || !name.length || !rooms) return null;

        rooms = rooms.filter(r => r.name == name);
        if (!rooms.length && this._previous) {
            if (name.toLowerCase() == this._previous.name.toLowerCase()) {
                rooms = [this._previous]
            } else {
                const checkDir = (ex:ExitDir)=> (this._previous.exits[ex] && this._previous.exits[ex].to_room && this.getRoomById(this._previous.exits[ex].to_room)?.name.toLowerCase() == name.toLowerCase())
                const dirs = Object.keys(ExitDir).map(k => (<any>ExitDir)[k])
                for (let dir of dirs) {
                    if (checkDir(dir as ExitDir)) {
                        rooms = [this.getRoomById(this._previous.exits[dir as ExitDir].to_room)]
                        break;
                    }
                }
            }
        }
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
        console.log("fail walk " + ret + " '" + (reason||"") + "'")
        if (this.virtualCurrent) {
            this.current = this.virtualCurrent;
            if (this.acknowledgingWalkStep) {
                this.discardWalkStep = this.virtualCurrent.vnum;
                console.log("about to discard " + this.discardWalkStep)
            }
        }
        this.virtualCurrent = null;
        if (reason && reason.length) EvtScriptEmitPrint.fire( { owner: "Mapper", message: reason})
        /*if (this.currentWalk) {
            EvtScriptEmitPrint.fire( { owner: "Mapper", message: JSON.stringify(this.currentWalk, null, 2)})
        }
        if (this.walkQueue) {
            EvtScriptEmitPrint.fire( { owner: "Mapper", message: this.walkQueue.join(",")})
        }*/
        this.walkQueue = []
        this.manualSteps = [];
        this.currentWalk = null;
        return ret;
    }

    public walkToId(id:number) {
        if (typeof id != 'number')
            id = parseInt(id);

        const virtualCurrent = this.virtualCurrent || this.current

        if (!virtualCurrent) {
            this.failWalk("Il mapper non ha una room iniziale.")
            return;
        }
        this.cancelWalk();
        console.log("walkto id " + id + " from vnum " + virtualCurrent.vnum)
        this.walkFromTo(virtualCurrent.id, id, virtualCurrent.id);
    }

    public walkToVnum(vnum:number) {
        if (typeof vnum != 'number')
            vnum = parseInt(vnum);
        
        const virtualCurrent = this.virtualCurrent || this.current
    
        if (!virtualCurrent) {
            this.failWalk("Il mapper non ha una room iniziale.")
            return;
        }

        const destId = this.getRoomIdFromVnum(vnum);

        if (!destId) {
            this.failWalk("Non c'e' stanza con quel Vnum.")
            return;
        }
        this.cancelWalk();
        console.log("walkto vnum " + vnum + " from vnum " + virtualCurrent.vnum)
        
        this.walkFromTo(virtualCurrent.id, destId, virtualCurrent.id);
    }

    public walkToRoomShortName(shname:string) {
        shname = shname.toLowerCase();
        const virtualCurrent = this.virtualCurrent || this.current
    

        if (!virtualCurrent) return;
        const destRM = this.shortNameToRoom.get(shname);
        if (!destRM) {
            this.failWalk("Non c'e' stanza con quella parola chiave.")
            return;
        }
        this.cancelWalk();
        console.log("walkto shortname from " + virtualCurrent.vnum + " to vnum " + destRM.vnum)
        this.walkFromTo(virtualCurrent.id, destRM.id);
    }

    acknowledgingWalkStep = false
    discardWalkStep = -1
    recalculating = false;

    acknowledgeStep(vnum:number) {

        const wasRecalculating = this.recalculating;
        this.recalculating = false;

        if (typeof vnum == "string") {
            vnum = Number(vnum)
        }
        const wasAcknowledging = this.acknowledgingWalkStep;
        this.acknowledgingWalkStep = false

        if (!this.currentWalk || !this.current)
            return;

        console.log("acknowledgeStep " + vnum)

        if (!this.currentWalk.steps || this.currentWalk.index >= this.currentWalk.steps.length) {
            if (this.currentWalk.index >= this.currentWalk.steps.length) this.failWalk( `Arrivato a destinazione.`)
            this.failWalk("");
            return;
        }
        let stepVnum = this.currentWalk.steps[this.currentWalk.index].room.vnum
        if (wasAcknowledging && this.currentWalk.steps.length>0 && this.currentWalk.index>=0) {
            if (this.currentWalk.steps[this.currentWalk.index].room.vnum == vnum) {
                // extra step when changing walk to another
                return;
            }
        }

        for (let index = this.currentWalk.index; index < this.currentWalk.steps.length; index++) {
            const step = this.currentWalk.steps[index].room.vnum
            if (step>0 && step == vnum) {
                stepVnum = step
                this.currentWalk.index = index;
                break;
            }
        }

        if (stepVnum &&
            stepVnum != vnum) {
            if (wasRecalculating) {
                this.failWalk("Non posso ricalcolare percorso");
                return;
            }
            const lastStepDir = this.currentWalk.steps[this.currentWalk.steps.length-1].direction;
            const endRoom = this.currentWalk.end;
            const nextId = endRoom.exits[lastStepDir].to_room
            console.log("ricalcolo " + stepVnum + " - " + nextId)
            this.recalculating = true;
            this.failWalk("");
            EvtScriptEmitPrint.fire({owner:"Mapper", message: `Ricalcolo percorso a ${nextId}`})
            this.walkToId(nextId);
            //this.failWalk( `Percorso fallito. Sei in ${vnum} ma il percorso aspettava ${stepVnum}`)
            return;
        }
        
        for (let index = this.currentWalk.index; index < this.currentWalk.steps.length; index++) {
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
            this.acknowledgingWalkStep = true
            const nr = this.getRoomById(step.room.exits[step.direction].to_room)
            console.log("sending next dir for vnum " + nr.vnum + " -> in " + (this.virtualCurrent?.vnum||this.current?.vnum) + ":" + step.direction )
            this.virtualCurrent = nr;
            const longDir = walkCommand.type == WalkCommandType.Directional ? Short2LongExit.get(walkCommand.command) || walkCommand.command : walkCommand.command 
            EvtScriptEmitCmd.fire( { owner: "Mapper", message: longDir, silent: false})
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
        if ((this.current && (room.id == this.current.id || room.vnum == this.current.vnum)) ||
            (this.virtualCurrent && (room.id == this.virtualCurrent.id || room.vnum == this.virtualCurrent.vnum))) {
            this.acknowledgeStep(room.vnum);
        } else {
            // resync
            this.loadLastPosition()
            this.acknowledgeStep(this.roomVnum);
        } 
    }

    speedWalk(safeWalk:SafeWalk) {
        this.walkQueue = []
        for (const walkData of this.currentWalk.steps) {
            for (const walkCommand of walkData.commands) {
                const longDir = walkCommand.type == WalkCommandType.Directional ? Short2LongExit.get(walkCommand.command) || walkCommand.command : walkCommand.command
                EvtScriptEmitCmd.fire( { owner: "Mapper", message: longDir, silent: false})
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
        if (this.activeExits && this.activeExits.map(v => Long2ShortExit.get(v)).indexOf(dir)>=0) {
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
                    walkQueue.push({ type: WalkCommandType.Other, command: (st.exit.param || st.exit.name).replace(/\;/g,",").split(",").join("\n")})
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
            if (exit.name && exit.name.trim()) {
                this.openSpecialExit(exit.name, walkQueue);
            } else {
                walkQueue.push({
                    command: dir,
                    type: WalkCommandType.Directional
                })
            }
        }
    }
    
    handleLockedDoor(dir: ExitDir, exit: RoomExit, walkQueue: WalkCommand[]) {
        /*if (exit.name) {
            this.openSpecialExit(exit.name);
        }*/
        this.unlockDoor(exit.param||this.defaultDoorName, dir, walkQueue);
        
    }

    handleClosedDoor(dir: ExitDir, exit: RoomExit, walkQueue: WalkCommand[]) {
        if (exit.name) {
            this.openSpecialExit(exit.name, walkQueue);
        }
        if (exit.param) {
            this.openDoor(exit.param, dir, walkQueue, exit.type == ExitType.Door);
        } else {
            this.openDoor(this.defaultDoorName, dir, walkQueue, exit.type == ExitType.Door);
        }

        
    }
    openSpecialExit(name: string, walkQueue: WalkCommand[]) {
        walkQueue.push({
            command: name.replace(/\;/g,",").split(",").join("\n"),
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
        } else if (unlock && unlockCommands.find(oc => param.indexOf(oc+" ")>=0) /*&& !walkQueue.some(wk => wk.type == WalkCommandType.DoorUnlock)*/) {
            const openCmds = param.toLowerCase().split(",").filter(part => {
                let ret:number = unlockCommands.find(oc => part.trim().indexOf(oc+" ")>=0) ? 1 : 0;
                return ret > 0;
            })
            openTemplate = openCmds.map(v => v.trim() + (this.addDirectionToDoors && v.toLowerCase().indexOf(Short2LongExit.get(dir))==-1 ? (" " + Short2LongExit.get(dir)) : "")).join("\n")
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

