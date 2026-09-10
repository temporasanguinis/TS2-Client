import { EventHook } from '../Core/event';
import { EvtScriptEmitPrint, JsScript } from '../Scripting/jsScript'
import { EvtScriptEvent, ScripEventTypes, EvtScriptEmitCmd } from '../Scripting/jsScript'
import { aStar, PathFinder } from 'ngraph.path';
import * as ngraph from 'ngraph.graph';
import {MapperStorage} from '../Storage/mapperStorage'
import { Notification } from '../App/messagebox';
import { ProfileManager } from '../App/profileManager';

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
    drawAdjacentLevel: boolean;
    zoneImages: boolean;
    zoneMusic: boolean;
    zoneVolume: number;
};

export interface Zone {
    id: number;
    name: string;
    description?: string;
    label?: string;
    backColor?: string
    image?:string,
    imageOffset?: {x: number, y:number},
    musicUrl?:string
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
    requestIncrementVersion: number = 0;
    OnZonesListChanged() {
        this.zoneChanged.fire({ id: null, zone: null})
        if (this.zoneId > -1) this.zoneChanged.fire({ id: this.zoneId, zone: this.idToZone.get(this.zoneId)})
    }
    nonotify: boolean;
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
        this.zoneChanged.fire({ id: null, zone: null})
    }
    saveZone(zone: Zone) {
        let curr = this.current
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
        this.current = curr;
        if (curr?.id == zone.id) {
            this.zoneChanged.fire({ id: zone.id, zone: zone})
        }
    }
    moveRoomsToZone(rooms: Room[], newZone: Zone) {
        let lastRoom: Room;
        let newRoom = this.current && rooms.find(r => r == this.current) ? this.current : null 
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

        if (!newRoom) {
            newRoom = lastRoom
        }

        this.createGraph();
        this.current = newRoom
        this.zoneChanged.fire({ id: newZone.id, zone: newZone})
        if (newRoom) this.roomChanged.fire({ id: newRoom.id, vnum: newRoom.vnum, room: newRoom})
    
    }
    deleteRooms(rooms: Room[], noPrepare = false) {
        let old = (this.current?.zone_id || rooms[0].zone_id)
        for (const rm of rooms) {
            let index = this.db.rooms.findIndex((r,i) => r == rm)
            if (index>-1) {
                this.deleteExitsReferencing(rm)
                this.db.rooms.splice(index, 1)
            } else if ((index = this.db.rooms.findIndex((r,i) => r.id == rm.id)) > -1) {
                this.deleteExitsReferencing(rm)
                this.db.rooms.splice(index, 1)
            }
        }
        if (!noPrepare) {
            this.prepare()
            if (old) {
                this.zoneChanged.fire({ id: old, zone: this.idToZone.get(old)})
            } else {
                this.zoneChanged.fire({ id: null, zone: null})
            }
        }
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
                drawAdjacentLevel: true,
                zoneImages: true,
                zoneMusic: true,
                zoneVolume: 30
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
        this.zoneChanged.fire({
            id: null,
            zone: null
        })
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

    private manualSteps:Step[]=[]
    //private _lastStep: Step = null;
    public get nextStep(): Step {
        return this.manualSteps.length ? this.manualSteps[0] : null;
    }

    public get stepAfterNext(): Step {
        return this.manualSteps.length ? this.manualSteps[1] : null;
    }

    public get lastStep() : Step {
        return this.manualSteps.length ? this.manualSteps[this.manualSteps.length-1] : null;
    }
    // public set lastStep(value: Step) {
    //     this._lastStep = value;
    // }
    public clearManualSteps() {
        this.manualSteps = []
        this.mapDebug("Clearing all manual queued steps")
        return
        //this.manualSteps.splice(0, this.manualSteps.length)
    }

    public countManualSteps() {
        return this.manualSteps.length
    }

    public addManualStep(s:Step) {
        this.manualSteps.push(s)
        this.scripting.delVariable({name: "TSSettore", class: "", value: null})
        let msg = ("Stepping from " + s.room.id + " towards " + s.dir + (s.exit ? "(existing exit)":"(no exit)") + " ("+ this.manualSteps.length +" steps left)")
        this.mapDebug(msg);
    }

    public mapDebug(msg: string) {
        let cfg = this.profileManager.getCurrentConfig();
        if (cfg && cfg.getDef("debugScripts", false)) {
            EvtScriptEmitPrint.fire({
                message: msg,
                owner: "Mapper",
            });
        }
    }

    parseCommandsForDirection(command: string): string[] {
        if (!this.current) return [command];
        
        
        const ret:string[] = [];
        let doLog = false;
        let dir = null
        if (IsDirectionalCommand(command, this.useItalian) &&
            (dir = this.parseDirectionalCommand(command))) {

            // we have a direction given, mapper could do work
            let stepStartRoom:Room = null;
            const longCommand = Short2LongExit.get(command)
                
            if (this.lastStep) {
                if (this.lastStep.exit) {
                    // either we follow the last step and start from there
                    stepStartRoom = this.idToRoom.get(this.lastStep.exit.to_room)
                } else if (this.mapmode) {
                    // we fake a room
                    stepStartRoom = {
                        id: -1,
                        name: "",
                        color: "",
                        x: 0,
                        y: 0,
                        z: this.lastStep.room.z,
                        zone_id: this.lastStep.room.zone_id,
                        exits: {}
                    }
                }
            } else if (!this.lastStep) {
                // or we go from the current when it has this exit
                if (this.current && this.current.exits[dir]?.to_room) { 
                    stepStartRoom = this.current
                } else if (this.current && this.mapmode) {
                    // mapping new room
                    stepStartRoom = this.current
                }
            }

            // nowhere to go on the map, just give the command
            if (!stepStartRoom) return [longCommand || command];
            
            if (this.acknowledgingWalkStep) 
            {
                // this means mapper is walking with a path
                // we have sent the next dir and are waiting 
                // for the mud output to give the vnum
                return [longCommand || command];
            }
            this.checkValidManualSteps(dir, stepStartRoom);
            // our next step will will exit the dest room
            const st = {
                dir: dir,
                room: stepStartRoom,
                exit: stepStartRoom.exits[dir]
            }
            // but if there is no exit and we are mapping
            // just go there without handling doors
            if (!st.exit) {
                if (this.mapmode) {
                    this.addManualStep(st)
                } else {
                    this.mapDebug("No exit " + (longCommand||command) + " and not in mapmode. Skipping manual step.")
                }
                return [longCommand || command];
            }
            this.addManualStep(st)

            const queue:WalkCommand[] = []
            this.handlePossibleDoor(st, this.countManualSteps() == 1 && this.doorAlreadyOpen(st.room, st.dir), queue)
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
        } else {
            // no directions given, just a command
            ret.push(command)
        }
        
        return ret;
    }
    checkValidManualSteps( dir: ExitDir, steppingTo:Room) {
        if (!this.countManualSteps()) return;

        if (!this.lastStep.exit && this.lastStep.room.id == -1 ||
            steppingTo.id == -1) {
            // mapping in advance
            return
        }
        const dirs = [ExitDir.Down,ExitDir.Up,ExitDir.North,ExitDir.NorthEast,ExitDir.East,ExitDir.SouthEast,ExitDir.South,ExitDir.SouthWest,ExitDir.West,ExitDir.NorthWest]
        let ok = false;
        if (this.lastStep.exit.to_room == steppingTo.id) {
            ok = true
        } else {
        //for (const dir of dirs) {
            const ex = this.lastStep.room.exits[dir]
            // our last step leads to destination
            if (ex && (ex.to_room == steppingTo.id)) {
                ok = true
            }
            //exit from last step leads to current
            // illogic, leads to itself
            if (ex && this.current && ex.to_room == this.current.id) {
                ok = true
            }
        //}
        }
        if (!ok) {
            this.clearManualSteps()
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
            if (!this.nonotify) this.zoneChanged.fire({
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
            var now = new Date()
            let dateStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`
            if (this.db.version) {
                if (this.requestIncrementVersion) {
                    this.db.version.version = Math.min(this.requestIncrementVersion, ++this.db.version.version)
                }
                if (!this.db.version.message)
                    this.db.version.message = "Modifiche locali"
                var now = new Date()
                this.db.version.date = dateStr
            } else {
                this.db.version = {
                    message: "Modifiche locali",
                    date: dateStr,
                    version: 1
                }
            }
            this.requestIncrementVersion = 0
            this.saveLocal()
        }
    }
    private _prevZoneId:number = null;
    private _zoneId: number = null;
    public get zoneId(): number {
        return this._zoneId;
    }
    public set zoneId(value: number) {
        this._zoneId = value;
    }

    public set current(value: Room) {
        this.zoneId = value ? value.zone_id : null
        if (value == this._current) {
            return
        }
        
        this._previous = this.current;
        this._current = value;
        this._selected = value;
        this.resyncato = false;
        this.roomId = value?.id
        this.roomVnum = value?.vnum
        if (this.zoneId && this._prevZoneId != this.zoneId) {
            this._prevZoneId = this.zoneId
            if (!this.nonotify) this.zoneChanged.fire({
                id: this.zoneId,
                zone: this.idToZone.get(this.zoneId)
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
    public exitsVariable: string = "Exits";
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

    constructor(private storage:MapperStorage, private profileManager:ProfileManager) {
        this.loadFavorites();
        this.loadOptions();
        EvtScriptEvent.handle(d => {
            if (d.event == ScripEventTypes.VariableChanged && d.condition == this.vnumVariable) {
                if (d.value) {
                    // questo non va bene, nelle illogichge non cambia vnum al movimento
                    //
                    let newVnum = (<any>d.value).newValue;

                    if (newVnum) setTimeout(() => {
                        newVnum = parseInt(newVnum)
                        //console.log("got vnum " + newVnum)
                        if (this.acknowledgingWalkStep && this.discardWalkStep>=0 && this.discardWalkStep == newVnum) {
                            this.mapDebug("Discarding step for vnum " + this.discardWalkStep)
                            this.discardWalkStep = -1;
                            this.acknowledgingWalkStep = false
                            this.recalculating = false
                            this.virtualCurrent = null;
                        
                            return;
                        }
    
                        this.mapDebug("Got VNUM: "+(newVnum))
                            
                        this.acknowledgingWalkStep = false
                        if (this.mapmode && ((this.current && !this.current.vnum) || this.nextStep)) {
                            let existingRoom = this.getRoomByVnum(parseInt(newVnum))
                            if (!existingRoom && !this.nextStep) {
                                existingRoom = (this.current && !this.current.vnum) ? this.current : null
                            }
                            if (!existingRoom && this.nextStep) {
                                this.createRoomOnMovement(newVnum);
                            } else {
                                this.updateRoomOnMovement(existingRoom, false, newVnum)
                            }
                        }

                        this.setRoomByVNum(parseInt(newVnum));
                        this.acknowledgeStep(newVnum);                            

                        if (!this.currentWalk) {
                            this.virtualCurrent = null;
                        }
                        this.oneManualStepDone();
                    }, 0);
                } 
                else {
                    this.setRoomByVNum(-1);
                    this.oneManualStepDone();
                }
            }
            if (d.event == ScripEventTypes.VariableChanged && d.condition == this.exitsVariable) {
                if (d.value) 
                    this.activeExits = ((<any>d.value).newValue as string||'').split('|').filter(Boolean).map(v => v);
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

    private oneManualStepDone() {
        if (this.manualSteps.length) {
            this.manualSteps.shift();
        }
    }

    public updateRoomOnMovement(mudSeenRoom: Room, full?:boolean, vnumOverride?: number) : boolean {
        const oldExits = mudSeenRoom.exits
        mudSeenRoom.exits = {}
        this.mapDebug("updateRoomOnMovement " + mudSeenRoom.id + " vnum:" + (vnumOverride||mudSeenRoom.vnum))
        let changed = false
        if (this.nextStep) {
            const dir = this.nextStep;
            const fromRoom = dir.room;
            if (dir?.dir && fromRoom && fromRoom.id > 0) {
                let createdNewExit = false
                if (!fromRoom.exits[dir?.dir] || !fromRoom.exits[dir?.dir].to_room) {
                    fromRoom.exits[dir?.dir] = {
                        type: ExitType.Normal,
                        to_room: mudSeenRoom.id,
                        to_dir: ReverseExitDir.get(dir?.dir)
                    }
                    createdNewExit = true
                }
                if (createdNewExit) {
                    if (!mudSeenRoom.exits[ReverseExitDir.get(dir?.dir)] &&
                        !((oldExits||{})[ReverseExitDir.get(dir?.dir)]?.to_room) &&
                        !this.hasExitsTo(oldExits, fromRoom.id))
                    mudSeenRoom.exits[ReverseExitDir.get(dir?.dir)] = {
                        type: ExitType.Normal,
                        to_room: fromRoom.id,
                        to_dir: (dir?.dir)
                    }
                }
                this.prepareRoom(fromRoom)
            } else if (fromRoom && fromRoom.id < 0) {
                this.deleteRooms([fromRoom], true)
            }
        }
        const sett = this.scripting.getVariableValue("TSSettore")
        let newName = this.scripting.getVariableValue("RoomName") ?? this.roomName
        const newDesc = (this.scripting.getVariableValue("RoomDesc")??this.roomDesc).toString().replace(/\r/g,"")
        let newVnum = parseInt(this.scripting.getVariableValue("TSRoom")??this.roomVnum)||0
        if (vnumOverride) {
            newVnum = vnumOverride
        }
        changed ||= (newName !== mudSeenRoom.name)
        changed ||= (this.compareDescriptions(newDesc, mudSeenRoom.description))
        changed ||= (newVnum != mudSeenRoom.vnum)

        if (!(mudSeenRoom.type >= 0) && sett) {
            changed = true
        }

        if (this.activeExits) this.activeExits.forEach((e)=>{
            if (!e) return
            if (!mudSeenRoom.exits[<ExitDir>Long2ShortExit.get(e)] && oldExits[<ExitDir>Long2ShortExit.get(e)]) {
                if (full || !mudSeenRoom.exits[<ExitDir>Long2ShortExit.get(e)]?.to_room) { 
                    mudSeenRoom.exits[<ExitDir>Long2ShortExit.get(e)] = oldExits[<ExitDir>Long2ShortExit.get(e)]
                }
            } else if (!mudSeenRoom.exits[<ExitDir>Long2ShortExit.get(e)] && !oldExits[<ExitDir>Long2ShortExit.get(e)]) {
                mudSeenRoom.exits[<ExitDir>Long2ShortExit.get(e)] = {
                    type: ExitType.Normal,
                }
            }
        })
        if (oldExits && !full) {
            Object.keys(oldExits).forEach(ex => {
                if (!mudSeenRoom.exits[ex as ExitDir]) {
                    mudSeenRoom.exits[ex as ExitDir] = oldExits[ex as ExitDir]
                }
            })
        }
        changed ||= !this.sameExists(mudSeenRoom.exits, oldExits)
        if (changed) {
            mudSeenRoom.name = newName
            mudSeenRoom.description = newDesc
            mudSeenRoom.vnum = newVnum
            if (!mudSeenRoom.type) {
                mudSeenRoom.type = sett == "Foresta" ? RoomType.Forest : sett == "Aperto" ? RoomType.Field : RoomType.Inside
            }
            this.prepareRoom(mudSeenRoom)
            this.createGraph()
            this.roomChanged.fire({ id: mudSeenRoom.id, vnum: mudSeenRoom.vnum, room: mudSeenRoom})
            Notification.Show("Stanza con ID " + mudSeenRoom.id + " si differenzia dal MUD. Rimappata.", true)
        }
        if (this.countManualSteps()) {
            //this.manualSteps.shift()
            //this.lastStep = this.manualSteps[this.manualSteps.length - 1]
            this.mapDebug("  Seen " + mudSeenRoom.id + (changed ? " and UPDATED" : ""))
            this.mapDebug("    by going from " + this.nextStep?.room?.id + " to -> " + this.nextStep?.dir)
        }
        return changed
    }
    hasExitsTo(exits: RoomExits, id: number) {
        for (const dir of Object.keys(exits)) {
            let ex = exits[dir as ExitDir]
            if (ex && ex.to_room == id)
                return true
        }
        return false
    }

    private compareDescriptions(newDesc: any, oldDesc: string): boolean {
        const oldDs = (oldDesc??"").replace(/\r/g,"").trimEnd()
        const newDs = (newDesc??"").replace(/\r/g,"").trimEnd()
        return newDs != oldDs;
    }

    sameExists(ex1: RoomExits, ex2: RoomExits) {
        const exL1 = [...Short2LongExit.keys()].filter(e => ex1[e as ExitDir])
        const exL2 = [...Short2LongExit.keys()].filter(e => ex2[e as ExitDir])
        if (exL1.length != exL2.length) return false
        let same = true
        for (const ex of exL1) {
            same ||= (ex1[ex as ExitDir].to_room == ex2[ex as ExitDir].to_room)
            same ||= (ex1[ex as ExitDir].to_dir == ex2[ex as ExitDir].to_dir)
        }
        return same
    }

    private createRoomOnMovement(newVnum: any) {
        if (!this.nextStep) return;
        this.mapDebug("createRoomOnMovement vnum: " + newVnum)
        const steppingFrom = this.nextStep;
        const fromRoom = steppingFrom.room;
        if (fromRoom.id == -1) {
            this.mapDebug("createRoomOnMovement bug not updated previous room of " + newVnum)
            return
        }
        const oneRoomWidth = 240
        const sett = this.scripting.getVariableValue("TSSettore")
        const toRoom:Room = {
            id: 0,
            name: this.scripting.getVariableValue("RoomName"),
            description: (this.scripting.getVariableValue("RoomDesc")??"").toString().replace(/\r/g,""),
            exits: {},
            zone_id: fromRoom.zone_id,
            color: null,
            x: fromRoom.x,
            y: fromRoom.y,
            z: fromRoom.z,
            type: sett == "Foresta" ? RoomType.Forest : sett == "Aperto" ? RoomType.Field : RoomType.Inside
        };
        switch (steppingFrom.dir) {
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
        if (steppingFrom?.dir) {
            this.mapDebug("Creating exit from : " + fromRoom.id + " to " + toRoom.id);
            fromRoom.exits[steppingFrom?.dir] = {
                type: ExitType.Normal,
                to_room: toRoom.id,
                to_dir: ReverseExitDir.get(steppingFrom?.dir)
            }
            // todo if oneway dont do this check if (this.activeExits)
            toRoom.exits[ReverseExitDir.get(steppingFrom?.dir)] = {
                type: ExitType.Normal,
                to_room: fromRoom.id,
                to_dir: (steppingFrom?.dir)
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
        this.mapDebug("Created room " + toRoom.id)
        this.mapDebug("  by going from " + this.nextStep?.room?.id + " to -> " + this.nextStep?.dir)
        this.db.rooms.push(toRoom)
        this.prepareRoom(fromRoom)
        this.prepareRoom(toRoom)
        this.createGraph()
        if (this.stepAfterNext && this.stepAfterNext.room.id == -1) {
            // update next step with this created room
            this.stepAfterNext.room = toRoom
            if (toRoom.id == -1) {
                return
            }
        }
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
        try {
            this.nonotify = true
            this.vnumToRoom.clear();
            this.idToRoom.clear();
            this.idToZone.clear();
            this.roomIdToZoneId.clear();
            this.zoneRooms.clear();
            this._zoneRoomsByLevel.clear();
            this.currentWalk = null;
            this.current = null;
            this.clearManualSteps();
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
            if (!this.nonotify) this.roomChanged.fire({id:-1, vnum:-1,room:null})
            if (!this.nonotify) this.zoneChanged.fire({id:-1,zone:null})
        } finally {
            this.nonotify = false
        }
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
            zones: this.db.zones,
            rooms: this.db.rooms,
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
            this.mapDebug("Roomchanged " + old?.id + " -> " + this.current?.id)
            this.roomChanged.fire({ id: this.roomId, vnum: this.roomVnum, room: this.current })
        }
    }

    public setRoomByVNum(vnum:number) {
        if (typeof(vnum) != "number" || isNaN(vnum)) {
            this.mapDebug("Vnum not numeric");
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
        }
        if (!this.mapmode && ((!this.current && this.autoSync) || (this.current && this.autoSync && this.roomName && this.current.name != this.roomName))) {
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
                            this.mapDebug("resync by name and exits" + vnum)
                        }
                    }
                }
            }
            if (!this.mapmode && !this.current) {
                this.current = found || this.syncToRoom()
                if (this.current) {
                    this.mapDebug("full resync for vnum " + vnum + " to id " + this.current.id)
                    this.setRoomById(this.current.id)
                    this.resyncato = true;
                }
            }
        }
        if (!this.mapmode && old != this.current) {
            const lastStep = this.walkQueue.shift()
            if (!this.current && lastStep && old) {
                const exitFromPrevious = old.exits[lastStep.direction];
                if (exitFromPrevious && exitFromPrevious.to_room) {
                    const backupRoom = this.idToRoom.get(exitFromPrevious.to_room);
                    if (backupRoom) {
                        this.roomId = backupRoom.id
                        this.roomVnum = backupRoom.vnum
                        this.current = backupRoom
                        this.mapDebug("resync for walkqueue to id " + this.roomId)
                    }
                }
            }
            const lastStepManual = this.nextStep
            if (!this.current && lastStepManual && old) {
                const exitFromPrevious = old.exits[lastStepManual.dir];
                if (exitFromPrevious && exitFromPrevious.to_room) {
                    const backupRoom = this.idToRoom.get(exitFromPrevious.to_room);
                    if (backupRoom) {
                        this.roomId = backupRoom.id
                        this.roomVnum = backupRoom.vnum
                        this.current = backupRoom
                        this.mapDebug("resync for manualQueue to id " + this.roomId)
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
        else {
            this.roomChanged.fire({ id: this.current?.id, vnum: this.current?.vnum, room: this.current })
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
            if (name.toLowerCase() == this._previous.name?.toLowerCase()) {
                rooms = [this._previous]
            } else {
                const checkDir = (ex:ExitDir)=> (this._previous.exits[ex] && this._previous.exits[ex].to_room && this.getRoomById(this._previous.exits[ex].to_room)?.name?.toLowerCase() == name.toLowerCase())
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
        this.mapDebug(reason ? "Fail walk " + reason : "End walk")
        if (this.virtualCurrent && this.canConnectToCurrent(this.virtualCurrent)) {
            this.current = this.virtualCurrent;
            if (this.acknowledgingWalkStep) {
                this.discardWalkStep = this.virtualCurrent.vnum;
                this.mapDebug("About to discard step with vnum: " + this.discardWalkStep)
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
        this.clearManualSteps();
        this.currentWalk = null;
        return ret;
    }
    canConnectToCurrent(virtualCurrent: Room) {
        if (!this.current) return false
        let ok = false
        Object.keys(this.current.exits).forEach(k => {
            if (this.current.exits[k as ExitDir].to_room == virtualCurrent.id) {
                ok = true
            }
        })
        return ok
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

            this.mapDebug("AcknowledgeStep " + vnum)

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
                this.failWalk("Percorso fallito");
                return;
            }
            const lastStepDir = this.currentWalk.steps[this.currentWalk.steps.length-1].direction;
            const endRoom = this.currentWalk.end;
            const nextId = endRoom.exits[lastStepDir].to_room
            this.mapDebug("Ricalcolo " + stepVnum + " - " + nextId)
            this.recalculating = true;
            //this.failWalk("");
            //EvtScriptEmitPrint.fire({owner:"Mapper", message: `Ricalcolo percorso a ${nextId}`})
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
            this.mapDebug("Walk: sending next dir for vnum " + nr.vnum + " from " + (this.virtualCurrent?.vnum||this.current?.vnum) + ": dir: " + step.direction )
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
                    walkQueue.push({ type: WalkCommandType.Other, command: (st.exit.param || st.exit.name || "").replace(/\;/g,",").split(",").join("\n")})
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
