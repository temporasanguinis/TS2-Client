import * as http from "http";
import * as https from "https";
import * as socketio from "socket.io";
import express from "express";

interface SocketData {
    id: string;
    channels: Map<string, ChannelData>;
    socket: socketio.Socket;
    name: string;
}

interface ChannelData {
    name: string;
    sockets: Map<string, SocketData>
}

export type logger = (...arg: any[]) => void;

let channelMap = new Map<string, ChannelData>([
    ["Lobby", {name: "Lobby", sockets: new Map<string, SocketData>()}],
    ["Locanda", {name: "Locanda", sockets: new Map<string, SocketData>()}],
    ["Quest", {name: "Quest", sockets: new Map<string, SocketData>()}],
    ["RPG", {name: "RPG", sockets: new Map<string, SocketData>()}],
    ["Offtopic", {name: "Offtopic", sockets: new Map<string, SocketData>()}],
    ["Chat", {name: "Chat", sockets: new Map<string, SocketData>()}]
])

export class SignalingServer {

    private socketData: Map<string, SocketData> = new Map()
    private allowedChannels = channelMap
    
    constructor(host:string, port:number, credentials:https.ServerOptions, private log:logger = console.log, private token: string = "") {
        let socketIoConfig = <any>{
            serveClient: false,
            pingTimeout: 60000,
            allowEIO3: false,
            exclusive: true,
            cors: {
                origin: (_req:any, callback:Function) => {
                    callback(null, true);
                },
                methods: ["GET", "POST"],
                allowedHeaders: [],
                credentials: true
              }
        }
        const webapi = express()
        const server = credentials ? https.createServer(credentials, webapi) : http.createServer();
        const io = new socketio.Server(server, socketIoConfig);

        this.initServer(server, port, host, io);
    }

    removeSocketFromChannel = (sckId:string, channel:string) => {
        let sd = this.socketData.get(sckId)
        if (sd && this.allowedChannels.has(channel)) {
            let ch = sd.channels.get(channel)
            if (ch) {
                ch.sockets.delete(sckId)
                sd.channels.delete(channel)
            }
            for (const otherSocket of this.allowedChannels.get(channel).sockets.values()) {
                if (otherSocket.socket && otherSocket.socket.connected) {
                    otherSocket.socket.emit('removePeer', {'peer_id': sd.socket.id});
                }
                sd.socket.emit('removePeer', {'peer_id': otherSocket.id});
            }
            this.allowedChannels.get(channel).sockets.delete(sckId)
            
            for (const sk of this.socketData.values()) {
                sk.socket.emit("channelchange", channel)
            }
        }
    }

    addSocketToChannel = (sckId:string, channel:string) => {
        let sd = this.socketData.get(sckId)
        if (sd && this.allowedChannels.get(channel) && !sd.channels.get(channel)) {
            let ch = this.allowedChannels.get(channel)
            sd.channels.set(channel, ch)
            ch.sockets.set(sckId, sd)
        }
    }

    deleteSocket = (sckId: string) => {
        let sd = this.socketData.get(sckId)
        if (sd) {
            for (const chk of sd.channels.keys()) {
                this.removeSocketFromChannel(sckId, chk)
            }
            if (sd.socket && sd.socket.connected) {
                sd.socket.disconnect()
                sd.socket = null
            }
            this.socketData.delete(sckId)
        }
    }

    addSocket = (sckId:string, socket: socketio.Socket) => {
        this.socketData.set(sckId, {
            id: sckId,
            name: null,
            socket: socket,
            channels: new Map<string, ChannelData>()
        })
    }

    leaveChannel = (socket:socketio.Socket, channel:string) => {
        this.log("["+ socket.id + "] leaveChannel ");

        if (!this.socketData.has(socket.id)) {
            this.log("["+ socket.id + "] ERROR: no socket to leave channel ", socket.id);
            return;
        }

        if (!(this.socketData.get(socket.id).channels.has(channel))) {
            this.log("["+ socket.id + "] ERROR: not in ", channel);
            return;
        }

        this.removeSocketFromChannel(socket.id, channel)
        this.locateSocket(socket);
    }

    joinToChannel = (socket:socketio.Socket, channel:string) => {
        
        const thisData = this.socketData.get(socket.id)

        if (!thisData) {
            this.log("["+ socket.id + "] ERROR: does not exist so cannot join");
            return
        }

        this.addSocketToChannel(socket.id, channel)

        for (const sckData of this.allowedChannels.get(channel).sockets.values()) {
            if (sckData.id != thisData.id && sckData.socket && sckData.socket.connected) {
                sckData.socket.emit('addPeer', {
                    'peer_id': socket.id,
                    'should_create_offer': false,
                    name: thisData.name
                });
                socket.emit('addPeer', {
                    'peer_id': sckData.id, 
                    'should_create_offer': true, 
                    name: sckData.name
                });
            }
        }


        this.locateSocket(socket)

        for (const sk of this.socketData.values()) {
            if (sk.socket && sk.socket.connected)
                sk.socket.emit("channelchange", channel)
        }
    }

    removeStaleSockets = () => {
        for (const sd of this.socketData.values()) {
            if (sd.socket && !sd.socket.connected) {
                for (const ch of sd.channels.keys()) {
                    this.removeSocketFromChannel(sd.id, ch)
                }
                this.deleteSocket(sd.id)
            }
        }
    }

    locateSocket = (socket:socketio.Socket) => {
        const sd = this.socketData.get(socket.id)
        if (sd) {
            const socket_channels = [...sd.channels.keys()].join(",");
            this.log("["+ socket.id + "] located ", socket_channels);

            const cdatas: { [k:string]:{name:string}} = {}
            for (const k of sd.channels.keys()) {
                cdatas[k] = this.getChannelData(k)
            }
            socket.emit('located', { channels: socket_channels, chanelDatas: cdatas });
        }
    }

    private initServer(server: http.Server | https.Server, port: number, host: string, io: socketio.Server) {
        server.listen(port, host, () => {
            this.log("WebRTC Listening on port " + port);
            if (this.token)
                this.log("Your WebRTC connection token is: " + this.token)
        });

        /**
         * Users will connect to the signaling server, after which they'll issue a "join"
         * to join a particular channel. The signaling server keeps track of all sockets
         * who are in a channel, and on join will send out 'addPeer' events to each pair
         * of users in a channel. When clients receive the 'addPeer' even they'll begin
         * setting up an RTCPeerConnection with one another. During this process they'll
         * need to relay ICECandidate information to one another, as well as SessionDescription
         * information. After all of that happens, they'll finally be able to complete
         * the peer connection and will be streaming audio/video between eachother.
         */
        io.sockets.on('connection', (socket: socketio.Socket) => {
            
            this.log("[" + socket.id + "] connecting");

            if (this.token) {
                let ctoken = socket.handshake.auth?.token
                if (ctoken != this.token) {
                    this.log("[" + socket.id + "] not authorized (wrong token)");
                    socket.emit('exception', {errorMessage: 'Not authorized'});
                    socket.disconnect()
                    socket.removeAllListeners()
                }
            }

            this.log("[" + socket.id + "] connection accepted");

            this.removeStaleSockets();
            this.addSocket(socket.id, socket);

            socket.on('disconnect', () => {

                if (!this.socketData.has(socket.id)) {
                    this.log("[" + socket.id + "] ERROR: no socket to disconnect ", socket.id);
                    return;
                }

                for (let channel of this.socketData.get(socket.id).channels.keys()) {
                    this.leaveChannel(socket, channel);
                }

                this.log("[" + socket.id + "] disconnected");
                this.deleteSocket(socket.id);
            });


            socket.on('join', (config) => {
                this.log("[" + socket.id + "] join ", config);
                let channel: string = config.channel;

                if (!this.socketData.has(socket.id)) {
                    this.log("[" + socket.id + "] ERROR: no socket ", socket.id);
                    return;
                }

                if (!this.allowedChannels.has(channel)) {
                    this.log("[" + socket.id + "] ERROR: no channel ", channel);
                    return;
                }

                if (this.socketData.get(socket.id).channels.has(channel)) {
                    this.log("[" + socket.id + "] ERROR: already joined ", channel);
                    return;
                }

                for (let channel of this.socketData.get(socket.id).channels.keys()) {
                    // remove from existing channels
                    this.leaveChannel(socket, channel);
                }

                this.joinToChannel(socket, channel);
            });

            socket.on('identify', (config) => {
                this.log("[" + socket.id + "] identify ", config);
                if (this.socketData.get(socket.id) && config.name) {
                    this.socketData.get(socket.id).name = config.name;
                    socket.emit('identified');
                }
            });

            socket.on('getchanneldata', (channel: string) => {
                this.log("[" + socket.id + "] getchanneldata ", channel);
                if (this.allowedChannels.has(channel)) {
                    let ret = this.getChannelData(channel);
                    socket.emit("channeldata", ret);
                } else {
                    socket.emit("channeldata", {
                        name: channel,
                        users: []
                    });
                }
            });

            socket.on('locate', (config) => {
                this.log("[" + socket.id + "] locate ");
                this.locateSocket(socket);
            });

            socket.on('part', (channel: string) => {
                this.log("[" + socket.id + "] part ", channel);
                this.leaveChannel(socket, channel);
            });

            socket.on('relayICECandidate', (config) => {
                let peer_id = config.peer_id;
                let ice_candidate = config.ice_candidate;
                this.log("[" + socket.id + "] relaying ICE candidate to [" + peer_id + "] ", ice_candidate);

                if (this.socketData.has(peer_id)) {
                    const peer = this.socketData.get(peer_id);
                    if (peer.socket && peer.socket.connected) {
                        peer.socket.emit('iceCandidate', { 'peer_id': socket.id, 'ice_candidate': ice_candidate });
                    }
                }
            });

            socket.on('relaySessionDescription', (config) => {
                let peer_id = config.peer_id;
                let session_description = config.session_description;
                this.log("[" + socket.id + "] relaying session description to [" + peer_id + "] ", session_description);

                if (this.socketData.has(peer_id)) {
                    const peer = this.socketData.get(peer_id);
                    if (peer.socket && peer.socket.connected) {
                        peer.socket.emit('sessionDescription', { 'peer_id': socket.id, 'session_description': session_description });
                    }
                }
            });
        });
    }

    private getChannelData(channel: string) {
        let ret = {
            name: channel,
            users: [] as {name:string}[]
        };
        const cd = this.allowedChannels.get(channel);
        for (const sd of cd.sockets.values()) {
            ret.users.push({
                name: sd.name
            });
        }
        return ret;
    }
}
