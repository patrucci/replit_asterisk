import JsSIP from 'jssip';
import { EventEmitter } from 'events';

// Configurações para o codec G.729
const G729_PAYLOAD_TYPE = 18;
const G729_CLOCK_RATE = 8000;

// Interface para as configurações SIP
export interface SipConfig {
  domain: string;         // Domínio do servidor SIP
  wsUri: string;          // URI do WebSocket
  authorizationUser: string; // Usuário de autorização
  password: string;       // Senha
  displayName?: string;   // Nome de exibição
  registerExpires?: number; // Tempo de expiração do registro (padrão: 600 segundos)
  debug?: boolean;        // Modo de depuração
}

// Estados de uma chamada
export enum CallState {
  NONE = 'none',
  CONNECTING = 'connecting',
  PROGRESS = 'progress',
  ESTABLISHED = 'established',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
  HOLD = 'hold'
}

// Estados do registro
export enum RegisterState {
  UNREGISTERED = 'unregistered',
  REGISTERED = 'registered',
  REGISTERING = 'registering',
  FAILED = 'failed'
}

// Interface do cliente SIP
export interface ISipClient {
  call(number: string): void;
  hangup(): void;
  answer(): void;
  reject(): void;
  hold(flag: boolean): void;
  mute(flag: boolean): void;
  sendDTMF(tone: string): void;
  register(): Promise<void>;
  unregister(): void;
  getCallState(): CallState;
  getRegisterState(): RegisterState;
  setConfig(config: SipConfig): void;
  isRegistered(): boolean;
  addEventHandler(event: string, callback: (...args: any[]) => void): void;
}

// Implementação do cliente SIP
export class SipClient extends EventEmitter implements ISipClient {
  private ua: JsSIP.UA | null = null;
  private session: JsSIP.RTCSession | null = null;
  private config: SipConfig | null = null;
  private callState: CallState = CallState.NONE;
  private registerState: RegisterState = RegisterState.UNREGISTERED;
  private remoteStream: MediaStream | null = null;
  private localStream: MediaStream | null = null;
  private isHold: boolean = false;
  private isMuted: boolean = false;
  private peerConnection: RTCPeerConnection | null = null;
  
  // Método para configurar o cliente SIP
  setConfig(config: SipConfig): void {
    this.config = config;
    if (this.ua) {
      // Se já existir um UA (User Agent), desregistre primeiro
      this.unregister();
    }
  }
  
  // Método para fazer o registro no servidor SIP
  async register(): Promise<void> {
    if (!this.config) {
      throw new Error("SIP config is not set. Call setConfig first.");
    }
    
    // Configuração do JsSIP
    const socket = new JsSIP.WebSocketInterface(this.config.wsUri);
    
    // Obter acesso ao microfone/câmera
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      throw new Error(`Failed to get media access: ${error}`);
    }
    
    const uaConfig = {
      uri: `sip:${this.config.authorizationUser}@${this.config.domain}`,
      password: this.config.password,
      display_name: this.config.displayName,
      sockets: [socket],
      registrar_server: `sip:${this.config.domain}`,
      contact_uri: `sip:${this.config.authorizationUser}@${this.config.domain}`,
      authorization_user: this.config.authorizationUser,
      register_expires: this.config.registerExpires || 600,
      session_timers: false,
      use_preloaded_route: false
    };
    
    this.ua = new JsSIP.UA(uaConfig);
    
    // Configurar eventos do UA
    this.setupUaEvents();
    
    // Configurar debugging
    if (this.config.debug) {
      JsSIP.debug.enable('JsSIP:*');
    } else {
      JsSIP.debug.disable();
    }
    
    // Iniciar o UA
    this.ua.start();
    
    this.updateRegisterState(RegisterState.REGISTERING);
  }
  
  // Configurar eventos do User Agent
  private setupUaEvents(): void {
    if (!this.ua) return;
    
    this.ua.on('registered', (e) => {
      this.updateRegisterState(RegisterState.REGISTERED);
      this.emit('registered', e);
    });
    
    this.ua.on('unregistered', (e) => {
      this.updateRegisterState(RegisterState.UNREGISTERED);
      this.emit('unregistered', e);
    });
    
    this.ua.on('registrationFailed', (e) => {
      this.updateRegisterState(RegisterState.FAILED);
      this.emit('registrationFailed', e);
    });
    
    this.ua.on('newRTCSession', (e) => {
      const session = e.session;
      
      // Se já existe uma sessão, recuse a nova
      if (this.session) {
        session.terminate();
        return;
      }
      
      this.session = session;
      
      // Configurar eventos da sessão
      this.setupSessionEvents();
      
      // Se for uma sessão de entrada (chamada recebida)
      if (session.direction === 'incoming') {
        this.updateCallState(CallState.PROGRESS);
        this.emit('incomingCall', {
          displayName: session.remote_identity.display_name,
          number: session.remote_identity.uri.user
        });
      }
    });
    
    this.ua.on('newMessage', (e) => {
      this.emit('newMessage', e);
    });
    
    this.ua.on('sipEvent', (e) => {
      this.emit('sipEvent', e);
    });
  }
  
  // Configurar eventos da sessão RTC
  private setupSessionEvents(): void {
    if (!this.session) return;
    
    // Quando a chamada está conectando
    this.session.on('connecting', () => {
      this.updateCallState(CallState.CONNECTING);
      this.emit('connecting');
    });
    
    // Quando a chamada está em progresso (ring)
    this.session.on('progress', () => {
      this.updateCallState(CallState.PROGRESS);
      this.emit('progress');
    });
    
    // Quando a chamada é aceita
    this.session.on('accepted', () => {
      this.updateCallState(CallState.ESTABLISHED);
      this.emit('accepted');
    });
    
    // Quando a chamada é confirmada
    this.session.on('confirmed', () => {
      this.updateCallState(CallState.ESTABLISHED);
      this.emit('confirmed');
      
      // Armazenar o peer connection para manipulação direta
      this.peerConnection = this.session?.connection;
      
      // Configurar para usar o codec G.729
      this.configureG729Codec();
    });
    
    // Quando a mídia da chamada muda
    this.session.on('peerconnection', (e) => {
      const peerconnection = e.peerconnection;
      
      // Obter stream remoto quando disponível
      peerconnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.emit('remoteStream', this.remoteStream);
        }
      };
    });
    
    // Quando a chamada está terminando
    this.session.on('ended', () => {
      this.updateCallState(CallState.TERMINATED);
      this.cleanupSession();
      this.emit('ended');
    });
    
    // Quando a chamada falha
    this.session.on('failed', (e) => {
      this.updateCallState(CallState.TERMINATED);
      this.cleanupSession();
      this.emit('failed', e);
    });
    
    // Quando a sessão é colocada/retirada de espera
    this.session.on('hold', (e) => {
      this.isHold = e.originator === 'remote';
      this.updateCallState(CallState.HOLD);
      this.emit('hold', e);
    });
    
    this.session.on('unhold', (e) => {
      this.isHold = false;
      this.updateCallState(CallState.ESTABLISHED);
      this.emit('unhold', e);
    });
    
    // Quando é recebido DTMF
    this.session.on('newDTMF', (e) => {
      this.emit('newDTMF', e);
    });
  }
  
  // Método para realizar uma chamada
  call(number: string): void {
    if (!this.ua || !this.isRegistered()) {
      throw new Error("UA not registered or initialized");
    }
    
    // Se já tem uma sessão ativa, encerre-a primeiro
    if (this.session) {
      this.hangup();
    }
    
    try {
      // Obter acesso ao microfone
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          this.localStream = stream;
          
          const options = {
            mediaStream: stream,
            mediaConstraints: { audio: true, video: false },
            pcConfig: {
              iceServers: [
                { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
              ]
            }
          };
          
          // Iniciar a chamada
          this.session = this.ua!.call(`sip:${number}@${this.config?.domain}`, options);
          this.setupSessionEvents();
          this.updateCallState(CallState.CONNECTING);
        })
        .catch((error) => {
          throw new Error(`Failed to get user media: ${error}`);
        });
    } catch (error) {
      throw new Error(`Call failed: ${error}`);
    }
  }
  
  // Método para atender uma chamada recebida
  answer(): void {
    if (!this.session) {
      throw new Error("No active session to answer");
    }
    
    if (this.session.direction !== 'incoming') {
      throw new Error("No incoming call to answer");
    }
    
    try {
      // Obter acesso ao microfone
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          this.localStream = stream;
          
          const options = {
            mediaStream: stream,
            mediaConstraints: { audio: true, video: false },
            pcConfig: {
              iceServers: [
                { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
              ]
            }
          };
          
          // Atender a chamada
          this.session?.answer(options);
          this.updateCallState(CallState.CONNECTING);
        })
        .catch((error) => {
          throw new Error(`Failed to get user media: ${error}`);
        });
    } catch (error) {
      throw new Error(`Answer failed: ${error}`);
    }
  }
  
  // Método para rejeitar uma chamada
  reject(): void {
    if (!this.session) {
      throw new Error("No active session to reject");
    }
    
    if (this.session.direction !== 'incoming') {
      throw new Error("No incoming call to reject");
    }
    
    this.session.terminate();
    this.updateCallState(CallState.TERMINATED);
    this.cleanupSession();
  }
  
  // Método para encerrar uma chamada
  hangup(): void {
    if (!this.session) {
      return;
    }
    
    try {
      this.session.terminate();
      this.updateCallState(CallState.TERMINATING);
    } catch (error) {
      console.error("Error hanging up:", error);
    }
  }
  
  // Método para colocar/tirar uma chamada de espera
  hold(flag: boolean): void {
    if (!this.session || this.callState !== CallState.ESTABLISHED) {
      throw new Error("No established call to hold/unhold");
    }
    
    if (flag === this.isHold) {
      return;
    }
    
    try {
      if (flag) {
        this.session.hold();
      } else {
        this.session.unhold();
      }
    } catch (error) {
      throw new Error(`Hold operation failed: ${error}`);
    }
  }
  
  // Método para mutar/desmutar o microfone
  mute(flag: boolean): void {
    if (!this.session || this.callState !== CallState.ESTABLISHED) {
      throw new Error("No established call to mute/unmute");
    }
    
    if (flag === this.isMuted) {
      return;
    }
    
    try {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = !flag;
        });
        this.isMuted = flag;
        this.emit('mute', flag);
      }
    } catch (error) {
      throw new Error(`Mute operation failed: ${error}`);
    }
  }
  
  // Método para enviar tons DTMF
  sendDTMF(tone: string): void {
    if (!this.session || this.callState !== CallState.ESTABLISHED) {
      throw new Error("No established call to send DTMF");
    }
    
    try {
      this.session.sendDTMF(tone);
    } catch (error) {
      throw new Error(`Failed to send DTMF: ${error}`);
    }
  }
  
  // Desregistrar do servidor SIP
  unregister(): void {
    if (this.ua) {
      // Se houver chamada ativa, encerre-a
      if (this.session) {
        this.hangup();
      }
      
      // Desregistrar
      this.ua.unregister();
      this.ua.stop();
      this.ua = null;
      
      this.updateRegisterState(RegisterState.UNREGISTERED);
    }
  }
  
  // Verificar se está registrado
  isRegistered(): boolean {
    return this.registerState === RegisterState.REGISTERED;
  }
  
  // Obter o estado atual da chamada
  getCallState(): CallState {
    return this.callState;
  }
  
  // Obter o estado atual do registro
  getRegisterState(): RegisterState {
    return this.registerState;
  }
  
  // Adicionar manipulador de eventos
  addEventHandler(event: string, callback: (...args: any[]) => void): void {
    this.on(event, callback);
  }
  
  // Atualizar o estado da chamada
  private updateCallState(state: CallState): void {
    this.callState = state;
    this.emit('callStateChanged', state);
  }
  
  // Atualizar o estado do registro
  private updateRegisterState(state: RegisterState): void {
    this.registerState = state;
    console.log(`SIP Register State Changed: ${RegisterState[state]}`);
    this.emit('registerStateChanged', state);
  }
  
  // Limpar sessão após término da chamada
  private cleanupSession(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.session = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.isHold = false;
    this.isMuted = false;
  }
  
  // Configurar para usar o codec G.729
  private configureG729Codec(): void {
    if (!this.peerConnection) return;
    
    try {
      // Obter o transmissor RTP para o áudio
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          const parameters = sender.getParameters();
          if (!parameters.codecs) return;
          
          // Modificar a ordem dos codecs para priorizar G.729
          const g729Codec = parameters.codecs.find(codec => 
            codec.mimeType.toLowerCase() === 'audio/g729' ||
            codec.payloadType === G729_PAYLOAD_TYPE
          );
          
          if (g729Codec) {
            // Mover o G.729 para o topo da lista
            const otherCodecs = parameters.codecs.filter(codec => 
              codec.mimeType.toLowerCase() !== 'audio/g729' &&
              codec.payloadType !== G729_PAYLOAD_TYPE
            );
            
            parameters.codecs = [g729Codec, ...otherCodecs];
            sender.setParameters(parameters).catch(error => {
              console.error("Error setting codec preference:", error);
            });
          }
        }
      });
    } catch (error) {
      console.error("Error configuring G.729 codec:", error);
    }
  }
  
  // Obter o stream remoto (do interlocutor)
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
  
  // Obter o stream local (do microfone)
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}

// Exporta uma instância singleton do cliente SIP
export const sipClient = new SipClient();
export default sipClient;