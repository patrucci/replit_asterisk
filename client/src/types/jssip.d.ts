declare module 'jssip' {
  export interface WebSocketInterface {
    via_transport: string;
    url: string;
    sip_uri: string;
    weight: number;
    status: number;
    protocol: string;
    ws: WebSocket;
  }

  export interface RTCSessionDescription {
    type: string;
    sdp: string;
  }
  
  export interface RTCIceCandidate {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
  }

  export interface RTCSession {
    connection: RTCPeerConnection;
    direction: string;
    remote_identity: {
      display_name: string;
      uri: {
        user: string;
      };
    };
    local_identity: {
      display_name: string;
      uri: {
        user: string;
      };
    };
    isInProgress(): boolean;
    isEstablished(): boolean;
    isEnded(): boolean;
    isOnHold(): boolean;
    
    terminate(): void;
    answer(options?: any): void;
    hold(): void;
    unhold(): void;
    sendDTMF(tone: string): void;
    
    on(event: string, callback: Function): void;
    once(event: string, callback: Function): void;
    removeListener(event: string, callback: Function): void;
  }
  
  export interface UAConfiguration {
    uri: string;
    password?: string;
    display_name?: string;
    sockets: WebSocketInterface[];
    registrar_server?: string;
    contact_uri?: string;
    authorization_user?: string;
    register_expires?: number;
    session_timers?: boolean;
    use_preloaded_route?: boolean;
  }
  
  export class UA {
    constructor(configuration: UAConfiguration);
    
    start(): void;
    stop(): void;
    register(): void;
    unregister(): void;
    isRegistered(): boolean;
    call(target: string, options?: any): RTCSession;
    
    on(event: string, callback: Function): void;
    once(event: string, callback: Function): void;
    removeListener(event: string, callback: Function): void;
  }
  
  export const debug: {
    enable: (level: string) => void;
    disable: () => void;
  };
}