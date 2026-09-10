import { AppInfo } from '../appInfo';
import { EventHook } from '../Core/event';
import * as ioc from "socket.io-client";

let ICE_SERVERS = [
    {urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
        "stun:stun.ekiga.net"
    ]}
];

const channels = ["Lobby","Locanda", "Quest", "RPG", "Offtopic", "Chat"];
    
export interface PeerData {
    id:string;
    name:string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    muted: boolean;
    volume: number;
    iceCandidateQueue: any[],
    isRemoteDescriptionSet: boolean,
    connection:RTCPeerConnection,
    streamsByType: Map<"audio/video"|"screenshare", WebRTCStream>,
}

export interface UserData{
    name: string;
    muted: boolean;
}

export interface ChannelData {
    name: string;
    users: UserData[]
}

export interface WebRTCTrack {
    type: "audio" | "video";
    track: MediaStreamTrack;
    mediaPlayer: HTMLMediaElement;
}

export interface WebRTCStream {
    type: "audio/video" | "screenshare";
    stream: MediaStream;
    audioContext: AudioContext;
    audioAnalizer: AnalyserNode;
    tracksByType: Map<"audio" | "video", WebRTCTrack[]>;
    audioSourceNode: MediaStreamAudioSourceNode;
}

export interface LocalMedia {
    streamsByType: Map<"audio/video"|"screenshare", WebRTCStream>,
    mediaAllowed: boolean
}

export type Channels = {
    [key: string]: ChannelData;
};

export class WebRTC {
    private defaultChannel = channels[0];
    private globalMutePeers = false;
    private voiceActivityThreshold = 40
    private serverConnection:ioc.Socket = null;
    private localMedia: LocalMedia = {
        streamsByType: new Map<"audio/video"|"screenshare", WebRTCStream>,
        mediaAllowed: false
    }
    private peers = new Map<string, PeerData>(); // key: socketid
    private active_channels:Channels = { }; // key:channel name
    private all_channels:Channels = { };  // key:channel name
    public userName:string = null;
    private autojoin: boolean = false;
    private microphoneEnabled = false
    private webcamEnabled = false
    private connectionError: boolean = false

    private _lastChannel: string = null;
    public get lastChannel(): string {
        return this._lastChannel;
    }
    public set lastChannel(value: string) {
        this._lastChannel = value;
        this.EvtRequestingChannel.fire(value)
    }
    
    public EvtRequestingChannel = new EventHook<string>();
    public EvtVoiceActivity = new EventHook<string>();
    public EvtAuthenticated = new EventHook<string>();
    public EvtPeersChanged = new EventHook<string[]>();
    public EvtMicChanged = new EventHook<boolean>();
    public EvtAudioChanged = new EventHook<boolean>();
    public EvtPeersLeft = new EventHook<string>();
    public EvtPeersCame = new EventHook<string>();
    public EvtChannelChange = new EventHook<string>();
    public EvtNewChannelData = new EventHook<ChannelData>();
    public EvtEnteredChannel = new EventHook<string>();
    public EvtExitedChannel = new EventHook<string>();
    public EvtConnected = new EventHook<string>();
    public EvtDisconnected = new EventHook<boolean>();

    constructor(private host:string,
                private port:number,
                private peerContainer:HTMLElement,
                private localContainer:HTMLElement) {
    }

    GetChannelDatas() {
        return this.all_channels
    }

    GetPeers() {
        return this.peers
    }

    Join(channel?:string) {
        channel = channel || this.lastChannel || this.defaultChannel
        if ((channels.indexOf(channel)<0) || !this.userName || !this.serverConnection) return
        this.lastChannel = channel
        this.requestJoinChannel(channel, {})
    }

    IsMicEnabled() {
        const ls = this.localMedia.streamsByType.get("audio/video")
        if (!ls || !this.microphoneEnabled) return false
        
        return true
    }

    ToggleMicrophone(val:boolean) {
        const stream:MediaStream = this.localMedia.streamsByType.get("audio/video")?.stream
        if (!stream) return
        const audioTracks = stream.getAudioTracks();
        this.microphoneEnabled = val
        audioTracks.forEach(track => {
            track.enabled = val;
        });
        this.EvtMicChanged.fire(val)
    }

    ToggleAudio(val:boolean) {
        this.globalMutePeers = !val
        let ks = [...this.peers.keys()]
        for (const k of ks) {
            this.TogglePeerAudio(k, val)
        }
        this.EvtAudioChanged.fire(val)
    }

    IsAudioEnabled() {
        return !this.globalMutePeers
    }

    IsVideoEnabled() {
        return this.webcamEnabled
    }

    ToggleVideo(val:boolean) {
        this.webcamEnabled = val
        let ks = [...this.peers.keys()]
        for (const k of ks) {
            this.TogglePeerVideo(k, val)
        }
    }

    Leave() {
        if (!this.userName || !this.serverConnection) return
        Object.keys(this.active_channels).forEach(k => {
            this.requestLeaveChannel(k)
            delete this.active_channels[k]
        })
        this.Disconnect()
    }

    Connect() {
        this.initServerConnection()
    }

    GetAllowedChannels():string[] {
        return channels
    }

    async IsMicAllowed(noprompt:boolean) {
        let ok = false

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getSupportedConstraints ||
            !navigator.mediaDevices.getSupportedConstraints() /*||
            !navigator.permissions*/) {
            return false;
        }

        let pm = {state: "granted"}/*await navigator.permissions.query({
            name: "microphone" as any
        })*/
        ok = pm.state == "granted"
        if (ok && !noprompt) try {
            await this.TryGetMicrophone()
        } catch {
            ok = false
        }

        return ok
    }

    async IsCameraAllowed(noprompt:boolean) {
        let ok = false

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getSupportedConstraints ||
            !navigator.mediaDevices.getSupportedConstraints() /*||
            !navigator.permissions*/) {
            return false;
        }

        let pm = {state: "granted"}/*await navigator.permissions.query({
            name: "camera" as any
        })*/
        ok = pm.state == "granted"
        if (ok && !noprompt) try {
            await this.TryGetWebcam()    
        } catch {
            ok = false
        }

        return ok
    }

    IsConnected() {
        return !!(this.serverConnection &&
               this.serverConnection.connected &&
               this.localMedia.mediaAllowed &&
               this.localMedia.streamsByType.size)
    }

    GetChannelData(channel:string) {
        if (!this.serverConnection) {
            return
        }
        this.serverConnection.emit("getchanneldata", channel)
    }

    Disconnect() {
        this.clearLocalStreams()
        this.active_channels = {};
        this.removePeers()
        if (!this.serverConnection) return
        const socket = this.serverConnection
        this.serverConnection = null;
        socket.offAny()
        socket.disconnect()
        this.EvtDisconnected.fire(true)
    }

    DidConnectionFail() {
        return this.connectionError
    }

    DidAllowMedia() {
        return this.localMedia.mediaAllowed
    }

    CheckAuthentication() {
        this.EvtAuthenticated.fire(this.userName)
        return !!this.userName
    }

    GetUsername() {
        return this.userName
    }

    SetUsername(name:string) {
        if (name) {
            this.userName = name
            this.EvtAuthenticated.fire(name)
        } else {
            this.Leave()
            this.userName = null
            this.EvtAuthenticated.fire(null)
        }
    }

    async TryGetMicrophone() {
        let ret:MediaStream;
        try {
            ret = await navigator.mediaDevices.getUserMedia({"audio":true, "video":false});
        } catch {
            return false
        }
        if (ret) {
            // so the browser doesn't show the icon indefinitely after we try
            ret.getAudioTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
            ret.getVideoTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
            ret.getTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
        }
        return ret
    }

    async TryGetWebcam() {
        let ret:MediaStream;
        try {
            ret = await navigator.mediaDevices.getUserMedia({"audio":false, "video":true});
        } catch {
            return false
        }
        if (ret) {
            // so the browser doesn't show the icon indefinitely after we try
            ret.getAudioTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
            ret.getVideoTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
            ret.getTracks().forEach(t => {
                t.stop()
                ret.removeTrack(t) 
            })
        }
        return ret
    }

    public IsPeerMuted(peer:string) {
        let p = this.peers.get(peer)
        return p.muted || false
    }

    public HasPeer(peer:string) {
        return this.peers.has(peer)
    }

    public GetPeerVolume(peer:string) {
        let p = this.peers.get(peer)
        return p.volume || 0
    }

    public SetPeerMuted(peer:string, muted?:boolean) {
        let p = this.peers.get(peer)
        p.muted = muted ?? !p.muted

        const ps = p.streamsByType.get("audio/video")
        if (!ps) return

        const as = ps.tracksByType.get("audio")
        if (!as) return
        as.forEach(at => {
            at.mediaPlayer.muted = p.muted
            at.mediaPlayer.volume = p.muted ? 0 : p.volume
        })
    }

    public SetPeerVolume(peer:string, vol:number) {
        let p = this.peers.get(peer)

        let nv = vol
        if (nv < 0) {
            nv = 0
        } else if (nv > 1) {
            nv = 1
        }
        p.volume = nv
        p.muted = nv > 0 ? false : true
        
        const ps = p.streamsByType.get("audio/video")
        if (!ps) return

        const as = ps.tracksByType.get("audio")
        if (!as) return
        as.forEach(at => {
            at.mediaPlayer.volume = nv
            at.mediaPlayer.muted = p.muted
        })
    }
    
    TogglePeerVideo(peer_id:string, val:boolean) {
        const peer = this.peers.get(peer_id)
        if (!peer) return

        const avStream = peer.streamsByType.get("audio/video")

        if (!avStream) return
        peer.videoEnabled = val
        const videoTracks = avStream.tracksByType.get("video") || []
        for (const track of videoTracks) {
            track.track.enabled = val
        }
    }
    
    IsPeerAudioEnabled(peer_id:string) {
        const peer = this.peers.get(peer_id);
        if (!peer) return false
        return peer.audioEnabled
    }

    TogglePeerAudio(peer_id:string, val:boolean) {
        const peer = this.peers.get(peer_id);
        if (!peer) return
        const str = peer.streamsByType.get("audio/video")
        if (!str) return
        const tracks = str.tracksByType.get("audio")
        if (!tracks || !tracks.length) return
        peer.audioEnabled = val
        tracks.forEach(t => {
            t.track.enabled = val
        })
    }
    
    private createAudioContext = (stream:WebRTCStream) => {
        stream.audioContext = new window.AudioContext()
        stream.audioAnalizer = stream.audioContext.createAnalyser()
        stream.audioAnalizer.fftSize = 32
    }

    private removePeerTrack(peer:PeerData, stream: WebRTCStream, track: WebRTCTrack) {
        const tracks = stream.tracksByType.get(track.type)
        if (!tracks) return
        const ti = tracks.indexOf(track)
        if (ti < 0) return
        tracks.splice(ti)
        track.mediaPlayer.remove()
        stream.stream.removeTrack(track.track)
        if (!tracks.length) {
            stream.audioSourceNode = null
            peer.streamsByType.delete(stream.type)
        }
        if (!stream.tracksByType.has("audio")) {
            stream.audioSourceNode = null
        }
    }

    private removePeer(peer_id:string) {
        const peer = this.peers.get(peer_id)
        if (!peer) return

        for (const st of [...peer.streamsByType.values()]) {
            st.audioSourceNode = null
            for (const tracks of [...st.tracksByType.values()]) {
                for (const track of tracks) {
                    this.removePeerTrack(peer, st, track)
                }
            }
        }
        
        this.peers.get(peer_id)?.connection?.close();
        this.peers.delete(peer_id)
    }

    private removePeers() {
        for (const peerId of [...this.peers.keys()]) {
            this.removePeer(peerId)
        }
        this.peers.clear();  
        this.peerContainer.replaceChildren()           
    }

    private clearLocalStreams() {
        for (const ls of this.localMedia.streamsByType.values()) {
            for (const lt of ls.tracksByType.values()) {
                lt.forEach(l => {
                    l.track.stop()
                    l.mediaPlayer.remove()
                })
            }
            ls.audioSourceNode = null
        }
        this.localMedia.streamsByType.clear(); 
    }

    private initServerConnection() {

        if (this.serverConnection && this.serverConnection.connected) {
            return
        }

        this.connectionError = false
        this.removePeers()

        let cfg = <ioc.SocketOptions>{
            serveClient: false,
            pingTimeout: 120000,
            allowEIO3: true,
            exclusive: true,
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                allowedHeaders: [],
                credentials: true
              },
            auth: {token: AppInfo.Token}
        }
        this.serverConnection = ioc.io(this.host + ":" + this.port, cfg);

        this.serverConnection.on('connect_error', (err) => {
            this.connectionError = true
            this.Disconnect()
             console.error('RTC Initial connection failed:', err.message);
        });

        this.serverConnection.on("channelchange", (channel:string) => {
            // a channel changed, app can refresh ui
            this.EvtChannelChange.fire(channel)
        })

        this.serverConnection.on("channeldata", (cd:ChannelData) => {
            // remember for this channel the last state of users
            this.all_channels[cd.name] = {
                name: cd.name,
                users: cd.users
            }
            this.EvtNewChannelData.fire(cd)
        })

        this.serverConnection.on("identified", async (data) => {
            /* when logged we could autojoin */
            if (this.localMedia.mediaAllowed && this.autojoin)
                this.Join();
            this.EvtConnected.fire(this.userName)
        })
        this.serverConnection.on('connect', async () => {
            console.log("RTC Connected to signaling server");
            await this.setupLocalMedia(this.userName);
            if (this.userName) this.requestIdentify(this.userName);
        });
        this.serverConnection.on('located', (data) => {
            if (data.channels) {
                const newChannels = Object.fromEntries((data.channels as string).split(",").map((value:string, index:number) => [value, {name: value, users: [] as UserData[]}]))
                if (data.cdatas) {
                    Object.keys(newChannels).forEach(k => {
                        newChannels[k].users = data.cdatas[k].users as UserData[] || []
                    })
                }
                Object.keys(newChannels).forEach(k => {
                    if (newChannels[k] && !this.active_channels[k]) {
                        console.log("RTC now located in ", k);
                        this.EvtEnteredChannel.fire(k)
                    }
                })
                this.active_channels = newChannels         
            } else {
                this.active_channels = {}
                console.log("RTC now located nowhere ");
                this.EvtExitedChannel.fire("")
            }
        })
        this.serverConnection.on('disconnect', () => {
            console.log("RTC Disconnected from signaling server");
            /* Tear down all of our peer connections and remove all the
            * media divs when we disconnect */
            this.Disconnect()
        });
        /** 
        * When we join a group, our signaling server will send out 'addPeer' events to each pair
        * of users in the group (creating a fully-connected graph of users, ie if there are 6 people
        * in the channel you will connect directly to the other 5, so there will be a total of 15 
        * connections in the network). 
        */
        this.serverConnection.on('addPeer', (config) => {
            console.log('RTC Signaling server said to add peer:', config);
            let peer_id = config.peer_id;
            if (!peer_id) {
                console.error("RTC Got null peerid ");
                return;
            }
            if (peer_id in [...this.peers.keys()]) {
                /* This could happen if the user joins multiple channels where the other peer is also in. */
                console.log("RTC Already connected to peer ", peer_id);
                return;
            }

            let rtcPc = RTCPeerConnection as any;
            let peer_connection:RTCPeerConnection = new rtcPc(
                {"iceServers": ICE_SERVERS},
                {"optional": [
                    {"DtlsSrtpKeyAgreement": true}
                ]} /* this will no longer be needed by chrome
                    * eventually, but is necessary 
                    * for now to get firefox to talk to chrome */
            );

            this.peers.set(peer_id, {
                id: peer_id,
                name: config.name,
                connection: peer_connection,
                volume: 1,
                audioEnabled: true,
                videoEnabled: false,
                isRemoteDescriptionSet: false,
                iceCandidateQueue: [],
                muted: this.globalMutePeers,
                streamsByType: new Map<"audio/video"|"screenshare", WebRTCStream>()
            });
            
            peer_connection.onicecandidate = (event) => {
                console.log("RTC On ice candidate ", event.candidate)
                if (event.candidate) {
                    this.serverConnection.emit('relayICECandidate', {
                        'peer_id': peer_id, 
                        'ice_candidate': {
                            'sdpMLineIndex': event.candidate.sdpMLineIndex,
                            'candidate': event.candidate.candidate
                        }
                    });
                }
            }

            peer_connection.ontrack = (event) => {
                console.log("RTC ontrack", event);
                this.addPeerTrack(peer_id, event.streams[0], event.track)
            }

            /* Add our local stream */            
            for (const ls of this.localMedia.streamsByType.values()) {
                for (const lt of ls.tracksByType.values()) {
                    lt.forEach(l => peer_connection.addTrack(l.track, ls.stream));
                }
            }

            /* Only one side of the peer connection should create the
            * offer, the signaling server picks one to be the offerer. 
            * The other user will get a 'sessionDescription' event and will
            * create an offer, then send back an answer 'sessionDescription' to us
            */
            if (config.should_create_offer) {
                console.log("RTC Creating RTC offer to ", peer_id);
                peer_connection.createOffer().then(
                    (local_description) => { 
                        console.log("RTC Local offer description is: ", local_description);
                        peer_connection.setLocalDescription(local_description).then(
                            () => { 
                                this.serverConnection.emit('relaySessionDescription', 
                                    {'peer_id': peer_id, 'session_description': local_description});
                                console.log("RTC Offer setLocalDescription succeeded"); 
                            }).catch(
                            () => { console.error("RTC Offer setLocalDescription failed!"); }
                        );
                    }).catch(
                    (error) => {
                        console.error("RTC Error sending offer: ", error);
                    });
            }

            this.EvtPeersCame.fire(config.name)
        });

        /** 
         * Peers exchange session descriptions which contains information
         * about their audio / video settings and that sort of stuff. First
         * the 'offerer' sends a description to the 'answerer' (with type
         * "offer"), then the answerer sends one back (with type "answer").  
         */
        this.serverConnection.on('sessionDescription', (config) => {
            console.log('RTC Remote description received: ', config);
            let peer_id = config.peer_id;
            let peerData = this.peers.get(peer_id)
            if (!peerData) return
            let peer = this.peers.get(peer_id).connection;
            let remote_description = config.session_description;
            
            let desc = new RTCSessionDescription(remote_description);
            peer.setRemoteDescription(desc) 
                .then(() => {
                    console.log("RTC setRemoteDescription succeeded");
                    if (remote_description.type == "offer") {
                        console.log("RTC Creating answer");
                        peer.createAnswer().then(
                            (local_description) => {
                                console.log("RTC Answer description is: ", local_description);
                                peer.setLocalDescription(local_description).then(
                                    () => {
                                        if (!peerData.isRemoteDescriptionSet && peerData.iceCandidateQueue.length) {
                                            peerData.isRemoteDescriptionSet = true
                                            const queue = peerData.iceCandidateQueue
                                            while (queue.length) {
                                                const candidate = queue.shift();
                                                console.log("RTC Adding queued ice candidate ", candidate)
                                                peer.addIceCandidate(new RTCIceCandidate(candidate))
                                                    .catch(e => { console.error('RTC Error adding queued ICE candidate:', e); });
                                            }
                                        }
                                        this.serverConnection.emit('relaySessionDescription', 
                                            {'peer_id': peer_id, 'session_description': local_description});
                                        console.log("RTC Answer setLocalDescription succeeded");
                                    }).catch(
                                    () => { console.error("RTC Answer setLocalDescription failed!"); }
                                )
                            }).catch(
                            (error) => {
                                console.error("RTC Error creating answer: ", error);
                                console.log(peer);
                            })
                    }
                }).catch(
                (error) => {
                    console.error("RTC setRemoteDescription error: ", error);
                })
            console.log("RTC Description Object: ", desc);
        });
        /**
         * The offerer will send a number of ICE Candidate to the answerer so they 
         * can begin trying to find the best path to one another on the net.
         */
        this.serverConnection.on('iceCandidate', (config) => {
            let peerData = this.peers.get(config.peer_id)
            if (!peerData) return
            let peer = this.peers.get(config.peer_id).connection;
            let ice_candidate = config.ice_candidate;
            //if (!ice_candidate) {
                // this is normal at the end but chrome doesnt handle null as per spec
                // maybe it would be better to try and catch ?
            //    console.log("RTC Run out of ice candidates")
            //} else {
                if (peer.remoteDescription && peer.remoteDescription.type) {
                    // If the remote description is set, add the candidate immediately
                    // Queue the candidate until the remote description is set 
                    console.log("RTC Adding ice candidate immediately ", ice_candidate)
                    try {
                        peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
                    } catch {
                        console.log("RTC Adding ice candidate immediately failed, cadidate was: ", ice_candidate)
                    }
                } else {
                    console.log("RTC Queueing ice candidate ", ice_candidate)
                    peerData.iceCandidateQueue.push(ice_candidate);
                }
            //}
        });


        /**
         * When a user leaves a channel (or is disconnected from the
         * signaling server) everyone will recieve a 'removePeer' message
         * telling them to trash the media channels they have open for
         * that peer. If it was this client that left a channel, they'll also
         * receive the removePeers. If this client was disconnected, they
         * wont receive removePeers, but rather the
         * signaling_socket.on('disconnect') code will kick in and tear down
         * all the peer sessions.
         */
        this.serverConnection.on('removePeer', (config) => {
            console.log('RTC Signaling server said to remove peer:', config);
            let peer_id = config.peer_id;
            let name = this.peers.get(peer_id)?.name
            this.removePeer(peer_id)
            this.EvtPeersLeft.fire(name)
            this.notifyPeersChanged();
        });
    }

    private addLocalTrack(streamType: "audio/video"|"screenshare",
                         trackType: "audio" | "video",
                         track: MediaStreamTrack,
                         element: HTMLMediaElement) {
        
        let localStream = this.localMedia.streamsByType.get(streamType)
        if (!localStream) return

        let localTracks = localStream.tracksByType.get(trackType);
        if (!localTracks) {
            localTracks = []
            localStream.tracksByType.set(trackType, localTracks)
        }
        
        localTracks.push({
            mediaPlayer: element,
            type: trackType,
            track: track
        })

        localStream.stream.addTrack(track);

        for (const pc of this.peers.values()) {
            if (!pc.connection) continue;
            if (pc.connection.addTrack) {
                pc.connection.addTrack(track, localStream.stream);
              } else {
                // old browsers need to re-negotiate
                setTimeout(() => pc.connection.dispatchEvent(new Event("negotiationneeded")));
              }
        }
    }

    private removeLocalTrack(streamType:"audio/video"|"screenshare",
                     trackType: "audio" | "video",
                     track:MediaStreamTrack) {
        
        let localStream = this.localMedia.streamsByType.get(streamType)
        if (!localStream) return

        let localTracks = localStream.tracksByType.get(trackType);
        if (!localTracks || localTracks.length == 0) {
            return
        }

        const ti = localTracks.findIndex(t => t.track == track)
        if (ti < 0) return

        localTracks.splice(ti, 1)
        localTracks.forEach(l => {
            l.mediaPlayer.remove()
        })
        
        if (!localTracks.length) {
            localStream.tracksByType.delete(trackType)
        }

        if (!localStream.tracksByType.has("audio")) {
            localStream.audioSourceNode = null
        }

        localStream.stream.removeTrack(track);
        if (localStream.tracksByType.size == 0) {
            localStream.audioSourceNode = null
            this.localMedia.streamsByType.delete(streamType)
        }

        for (const pc of this.peers.values()) {
            if (!pc.connection) continue;
            if (pc.connection.removeTrack) {
                pc.connection.removeTrack(
                    pc.connection.getSenders().find((sender) => sender.track === track)
                );
            } else {
                // old browsers need to re-negotiate
                setTimeout(() => pc.connection.dispatchEvent(new Event("negotiationneeded")));
            }
        }
    }

    private createPeerMediaPlayer(str:WebRTCStream, tr:WebRTCTrack) {
        let mediaEl:HTMLMediaElement = tr.track.kind == "video" ?
             document.createElement("video") :
             document.createElement("audio");

        if (this.globalMutePeers) {
            mediaEl.muted = true;
        }
        mediaEl.controls = false;
        mediaEl.autoplay = true;
        (mediaEl as HTMLVideoElement).playsInline = true
        tr.mediaPlayer = mediaEl
        tr.mediaPlayer.srcObject = str.stream;
        this.peerContainer.append(tr.mediaPlayer)
    }

    private deduceTrackStreamType(track: MediaStreamTrack):"audio/video"|"screenshare" {
        if (track.kind == "audio") return "audio/video"
        if (track.label?.match(/screen/))
            return "screenshare"
        return "audio/video"
    }

    private addPeerTrack(peerId: string, stream: MediaStream, track: MediaStreamTrack) {
        const streamType = this.deduceTrackStreamType(track)
        const peer = this.peers.get(peerId)
        if (!peer) return
        let str = peer.streamsByType.get(streamType)
        let peerTracks:WebRTCTrack[] = []
        if (!str) {
            str = {
                tracksByType: new Map<"audio"|"video", WebRTCTrack[]>(),
                type: streamType,
                stream: stream,
                audioSourceNode: null,
                audioContext: null,
                audioAnalizer: null
            }
            peer.streamsByType.set(streamType, str)
        }
        let trackType:"audio"|"video" = track.kind == "audio" ? "audio" : "video"
        
        let rtcTrack:WebRTCTrack = {
            type: trackType,
            track: track,
            mediaPlayer: null
        }

        this.createPeerMediaPlayer(str, rtcTrack);
        peerTracks.push(rtcTrack)

        if (trackType == "audio") {
            this.setupAudioAnalyzer(str, peerId);
            peer.muted = !this.IsAudioEnabled()
            peer.volume = 1
            rtcTrack.mediaPlayer.muted = peer.muted
            rtcTrack.mediaPlayer.volume = peer.volume
        } else {
            peer.videoEnabled = this.IsVideoEnabled()
            rtcTrack.track.enabled = peer.videoEnabled
        }

        str.tracksByType.set(trackType, peerTracks)

        stream.onremovetrack = ({track}) => {
            this.removePeerTrack(peer, str, rtcTrack)
        };

        this.notifyPeersChanged();
    }

    private notifyPeersChanged() {
        this.EvtPeersChanged.fire(
            [...this.peers.keys()].map(p => this.peers.get(p).name)
        );
    }

    private requestIdentify(name:string) {
        if (!this.serverConnection) return;
        this.serverConnection.emit('identify', {"name": name});
        this.serverConnection.emit('locate', null);
    }

    private requestJoinChannel(channel:string, userdata:{ [k:string]:string}) {
        if (!this.serverConnection) {
            return;
        }
        console.log("RTC Request join channel " + channel)
        this.serverConnection.emit('join', {"channel": channel, "userdata": userdata});
    }

    private requestLeaveChannel(channel:string) {
        this.serverConnection.emit('part', channel);
    }

    private async setupLocalMedia(name:string) {
        if (this.localMedia.streamsByType.size) {  /* ie, if we've already been initialized */
            return; 
        }
        console.log("RTC Requesting access to local audio / video inputs");
    
        let userStream:MediaStream
        
        /* Ask user for permission to use the computers microphone and/or camera, 
         * attach it to an <audio> or <video> tag if they give us access. */
        userStream = await this.getLocalMicrophoneStream();
        
        if (userStream) {
            console.log("RTC Access granted to audio/video");
            this.addLocalStream("audio/video", userStream);
        }
    }

    private async getLocalMicrophoneStream() {
        let userStream: MediaStream;
        try {
            let audioConstraint:MediaTrackConstraints|boolean = (this.microphoneEnabled = true)
            const sc = navigator.mediaDevices.getSupportedConstraints()
            if (sc && audioConstraint) {
                audioConstraint = {}
                if (sc.echoCancellation) {
                    audioConstraint.echoCancellation = true
                }
                if (sc.noiseSuppression) {
                    audioConstraint.noiseSuppression = true
                }
                if (sc.autoGainControl) {
                    audioConstraint.autoGainControl = true
                }
            }
            userStream = await navigator.mediaDevices.getUserMedia(
                { "audio": audioConstraint, "video": this.webcamEnabled }
            );
            this.localMedia.mediaAllowed = true;
        } catch (err) {
            console.log("RTC Access denied for audio/video");
            this.microphoneEnabled = false;
            this.localMedia.mediaAllowed = false;
            this.Disconnect();
        }
        return userStream;
    }

    private signalVoiceActivity(peerId:string) {
        // null peerId means ourselves
        if ((peerId && !this.peers.get(peerId)?.muted)) {
            this.EvtVoiceActivity.fire(peerId);
        } else if (peerId == null && this.IsMicEnabled()) {
            this.EvtVoiceActivity.fire(null);
        }
    }

    private addLocalStream(type:"audio/video"|"screenshare", stream:MediaStream) {
        
        let videoTracks = stream.getVideoTracks()
        let audioTracks = stream.getVideoTracks()

        const localStream: WebRTCStream = {
            stream: stream,
            type: type,
            tracksByType: new Map<"audio"|"video", WebRTCTrack[]>(),
            audioSourceNode: null,
            audioContext: null,
            audioAnalizer: null
        }

        this.setupAudioAnalyzer(localStream, null);

        if (this.localMedia.streamsByType.get(type)) {
            this.localMedia.streamsByType.get(type).audioSourceNode = null
            for (const st of this.localMedia.streamsByType.get(type).tracksByType.get("audio")) {
                this.removeLocalTrack(type, st.type, st.track)
            }
        }
        this.localMedia.streamsByType.set(type, localStream)

        let tracks = [...videoTracks, ...audioTracks]
        if (!tracks.length) {
            tracks = stream.getTracks()
        }

        for (const tr of tracks) {
            const trackType = tr.kind == "audio" ? "audio" : "video";
            let localTracks = localStream.tracksByType.get(trackType)
            if (!localTracks || !localTracks.length) {
                localTracks = []
                localStream.tracksByType.set(trackType, localTracks)
            }
            let mediaElement = tr.kind == "video" ? document.createElement("video") : document.createElement("audio")
            mediaElement.autoplay = true;
            mediaElement.muted = true; /* always mute ourselves by default */
            mediaElement.controls = false;
            mediaElement.srcObject = stream
            localTracks.push({
                mediaPlayer: mediaElement,
                track: tr,
                type: trackType
            })
            this.localContainer.append(mediaElement)
        }
    }
    

    private setupAudioAnalyzer(rtcStream: WebRTCStream, peerId: string) {
        
        if (rtcStream.audioSourceNode) return;

        this.createAudioContext(rtcStream)
        const source = rtcStream.audioContext.createMediaStreamSource(rtcStream.stream);
        source.connect(rtcStream.audioAnalizer);
        rtcStream.audioSourceNode = source;

        const bufferLength = 3;
        const dataArray = new Uint8Array(rtcStream.audioAnalizer.frequencyBinCount);
        const circularBuffer = new Array(bufferLength).fill(new Uint8Array(rtcStream.audioAnalizer.frequencyBinCount));
        let bufferIndex = 0;

        const detectVoiceActivity = () => {
            if (!rtcStream.audioSourceNode) {
                // to not leak, audioSourceNode is removed when removing the stream
                source.disconnect()
                return;
            }
            rtcStream.audioAnalizer.getByteFrequencyData(dataArray);
            circularBuffer[bufferIndex] = new Uint8Array(dataArray);
            
            let sum = 0; let sumcurrent = 0
            for (let i = 0; i < bufferLength; i++) {
                for (let j = 0; j < dataArray.length; j++) {
                    sum += circularBuffer[i][j];
                    if (i == bufferIndex) {
                        sumcurrent += circularBuffer[i][j]
                    }
                }
            }

            bufferIndex = (bufferIndex + 1) % bufferLength;

            const average = sum / (bufferLength * dataArray.length);
            const averageCurrent = sumcurrent / (dataArray.length);

            // we have three buffers (3*150ms), if the average of all
            // is lower than the average in the last 150ms we have voice activity
            if (averageCurrent > average && average > this.voiceActivityThreshold) { // Adjust the threshold as needed
                this.signalVoiceActivity(peerId)
            }

            setTimeout(detectVoiceActivity, 150);
        };

        detectVoiceActivity();
    }
}
