import * as JsSIP from 'jssip';
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
  setMockMode(enabled: boolean): void;
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
  public mockMode: boolean = false; // Modo de simulação para testes - SEMPRE FALSO PARA CONEXÃO REAL
  private mockRegisterTimer: any = null;
  private mockCallTimer: any = null;
  
  // Método para definir o modo de simulação
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    console.log(`[SipClient] Modo de simulação ${enabled ? 'ATIVADO' : 'DESATIVADO'}`);
  }
  
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
      console.error("SIP config is not set.");
      throw new Error("SIP config is not set. Call setConfig first.");
    }
    
    console.log("Iniciando registro SIP...");
    console.log(`Domínio: ${this.config.domain}`);
    console.log(`WebSocket URI: ${this.config.wsUri}`);
    console.log(`Usuário: ${this.config.authorizationUser}`);
    console.log(`Tempo de registro: ${this.config.registerExpires || 600} segundos`);
    
    // Verificar e logar o modo de simulação atual
    const currentMockMode = this.mockMode;
    console.log(`SipClient.register(): Modo de simulação está ${currentMockMode ? 'ATIVADO' : 'DESATIVADO'}`);
    
    // Se estamos em modo de simulação, simular um registro bem-sucedido
    if (this.mockMode) {
      console.log("MODO DE SIMULAÇÃO: Simulando registro SIP...");
      this.updateRegisterState(RegisterState.REGISTERING);
      
      // Simular pequeno atraso como se estivesse registrando
      if (this.mockRegisterTimer) {
        clearTimeout(this.mockRegisterTimer);
      }
      
      this.mockRegisterTimer = setTimeout(() => {
        console.log("MODO DE SIMULAÇÃO: Registro simulado concluído com sucesso");
        this.updateRegisterState(RegisterState.REGISTERED);
        this.emit('registered', { cause: "mock_simulation" });
      }, 2000);
      
      return;
    }
    
    try {
      // Configuração do JsSIP
      console.log("Criando WebSocket interface...");
      
      // Verificar e ajustar o URI do WebSocket para compatibilidade com páginas HTTPS
      let wsUri = this.config.wsUri;
      const originalUri = wsUri;
      
      // CORREÇÃO: Verificar todos os casos possíveis de protocolo
      // Em páginas HTTPS, precisamos usar WebSocket seguro (wss://)
      if (window.location.protocol === 'https:') {
        if (wsUri.startsWith('ws://')) {
          console.warn('Página HTTPS detectada mas URI WebSocket está usando protocolo inseguro ws://');
          console.warn('Convertendo automaticamente de ws:// para wss:// para evitar bloqueio de mixed-content');
          wsUri = wsUri.replace('ws://', 'wss://');
        } else if (!wsUri.startsWith('wss://')) {
          // Se o usuário forneceu apenas o domínio sem protocolo, adicionar wss://
          console.warn('Nenhum protocolo encontrado na URI WebSocket. Adicionando protocolo seguro wss://');
          wsUri = 'wss://' + wsUri;
        }
      } else {
        // Em páginas HTTP, podemos usar ws:// ou wss://
        if (!wsUri.startsWith('ws://') && !wsUri.startsWith('wss://')) {
          console.warn('Nenhum protocolo encontrado na URI WebSocket. Adicionando protocolo ws://');
          wsUri = 'ws://' + wsUri;
        }
      }
      
      // Garantir que a porta esteja especificada (8088 é a padrão do Asterisk)
      if (!wsUri.includes(':8088') && !wsUri.includes(':8089') && 
          !wsUri.match(/:\d+\//) && !wsUri.endsWith(':8088') && !wsUri.endsWith(':8089')) {
        console.warn('Nenhuma porta especificada na URI WebSocket. Adicionando porta padrão 8088');
        if (wsUri.includes('/ws')) {
          wsUri = wsUri.replace('/ws', ':8088/ws');
        } else {
          wsUri = wsUri + ':8088/ws';
        }
      }
      
      // Garantir que o caminho /ws esteja presente
      if (!wsUri.includes('/ws')) {
        console.warn('Caminho /ws não encontrado na URI WebSocket. Adicionando caminho /ws');
        wsUri = wsUri + '/ws';
      }
      
      if (originalUri !== wsUri) {
        console.log(`URI WebSocket corrigida: ${originalUri} -> ${wsUri}`);
        // Atualizar a configuração para referências futuras
        this.config.wsUri = wsUri;
      }
      
      let socket;
      
      try {
        console.log("Iniciando conexão WebSocket com: " + wsUri);
        
        // @ts-ignore - JsSIP tem problema de tipagem, mas a propriedade existe
        socket = new JsSIP.WebSocketInterface(wsUri);
        
        // Adicionar logs detalhados para o socket
        const wsSocket = (socket as any).socket;
        if (wsSocket) {
          wsSocket.addEventListener('open', () => {
            console.log(`[SIP WebSocket] Conexão aberta com ${wsUri}`);
            this.emit('connection_status', { 
              status: 'connected', 
              uri: wsUri,
              message: 'Conexão WebSocket estabelecida com sucesso'
            });
          });
          
          wsSocket.addEventListener('error', (err: any) => {
            console.error(`[SIP WebSocket] Erro na conexão com ${wsUri}:`, err);
            const errorMsg = err && err.message ? err.message : 'Erro desconhecido na conexão WebSocket';
            
            this.emit('connection_status', { 
              status: 'error', 
              uri: wsUri,
              message: errorMsg,
              details: `Não foi possível conectar ao servidor Asterisk via WebSocket. Verifique se o servidor está online e se as portas 8088/8089 estão abertas no firewall.`
            });
          });
          
          wsSocket.addEventListener('close', (evt: any) => {
            console.warn(`[SIP WebSocket] Conexão fechada com ${wsUri}. Código: ${evt.code}, Razão: ${evt.reason}`);
            
            let closeReason = 'Conexão fechada';
            if (evt && evt.code) {
              if (evt.code === 1000) closeReason = 'Fechamento normal';
              else if (evt.code === 1001) closeReason = 'Endpoint foi embora';
              else if (evt.code === 1002) closeReason = 'Erro no protocolo';
              else if (evt.code === 1003) closeReason = 'Dados não aceitos';
              else if (evt.code === 1005) closeReason = 'Sem código de status';
              else if (evt.code === 1006) closeReason = 'Conexão fechada anormalmente';
              else if (evt.code === 1007) closeReason = 'Dados inválidos';
              else if (evt.code === 1008) closeReason = 'Violação de política';
              else if (evt.code === 1009) closeReason = 'Mensagem muito grande';
              else if (evt.code === 1010) closeReason = 'Extensões não negociadas';
              else if (evt.code === 1011) closeReason = 'Erro inesperado';
              else if (evt.code === 1015) closeReason = 'Falha TLS';
              else closeReason = `Conexão fechada (código ${evt.code})`;
            }
            
            if (evt && evt.reason) closeReason += ': ' + evt.reason;
            
            this.emit('connection_status', { 
              status: 'disconnected', 
              uri: wsUri,
              message: closeReason,
              code: evt ? evt.code : null
            });
          });
        }
        
        console.log("WebSocket interface criado com sucesso usando: " + wsUri);
      } catch (wsError) {
        console.warn(`Erro ao conectar usando ${wsUri}`, wsError);
        
        // Se falhou usando wss://, tentar com ws://
        if (wsUri.startsWith('wss://')) {
          const alternativeUri = wsUri.replace('wss://', 'ws://');
          console.log(`Tentando conexão alternativa com: ${alternativeUri}`);
          try {
            // @ts-ignore
            socket = new JsSIP.WebSocketInterface(alternativeUri);
            
            // Adicionar logs para a conexão alternativa também
            const wsSocket = (socket as any).socket;
            if (wsSocket) {
              wsSocket.addEventListener('open', () => {
                console.log(`[SIP WebSocket Alt] Conexão aberta com ${alternativeUri}`);
              });
              
              wsSocket.addEventListener('error', (err: any) => {
                console.error(`[SIP WebSocket Alt] Erro na conexão com ${alternativeUri}:`, err);
              });
              
              wsSocket.addEventListener('close', (evt: any) => {
                console.warn(`[SIP WebSocket Alt] Conexão fechada com ${alternativeUri}. Código: ${evt.code}, Razão: ${evt.reason}`);
              });
            }
            
            console.log("WebSocket interface criado com sucesso usando versão não segura: " + alternativeUri);
          } catch (altError) {
            console.error(`Também falhou a conexão alternativa:`, altError);
            throw new Error(`Falha ao conectar com WebSocket: Original=${wsUri}, Alternativo=${alternativeUri}`);
          }
        } else {
          throw wsError;
        }
      }
      
      // Obter acesso ao microfone/câmera
      console.log("Solicitando permissão para acesso ao microfone...");
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Permissão do microfone concedida.");
      } catch (error) {
        console.error(`Falha ao acessar o microfone: ${error}`);
        throw new Error(`Failed to get media access: ${error}`);
      }
      
      // Configurações adicionais para compatibilidade
      JsSIP.debug.enable('JsSIP:*');
      
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
        use_preloaded_route: false,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
        hack_via_tcp: true, // Compatibilidade com alguns servidores SIP
        hack_ip_in_contact: true, // Compatibilidade com NATs
        no_answer_timeout: 60 // Tempo maior para esperar resposta
      };
      
      console.log("Criando UA (User Agent)...");
      this.ua = new JsSIP.UA(uaConfig);
      
      // Configurar eventos do UA
      console.log("Configurando eventos do UA...");
      this.setupUaEvents();
      
      // Configurar debugging
      if (this.config.debug) {
        console.log("Ativando modo de debug JsSIP...");
        JsSIP.debug.enable('JsSIP:*');
      } else {
        JsSIP.debug.disable();
      }
      
      // Iniciar o UA
      console.log("Iniciando UA...");
      this.ua.start();
      
      this.updateRegisterState(RegisterState.REGISTERING);
    } catch (error: any) {
      console.error(`Erro ao registrar: ${error?.message || error}`);
      this.updateRegisterState(RegisterState.FAILED);
      throw error;
    }
  }
  
  // Configurar eventos do User Agent
  private setupUaEvents(): void {
    if (!this.ua) {
      console.error("UA não inicializado ao configurar eventos");
      return;
    }
    
    this.ua.on('connecting', (e: any) => {
      console.log("UA: Conectando ao servidor WebSocket...");
    });
    
    this.ua.on('connected', (e: any) => {
      console.log("UA: Conexão WebSocket estabelecida com sucesso.");
    });
    
    this.ua.on('disconnected', (e: any) => {
      console.log("UA: Conexão WebSocket perdida.", e?.cause || "");
    });
    
    this.ua.on('registered', (e: any) => {
      console.log("UA: Registrado com sucesso no servidor SIP.");
      this.updateRegisterState(RegisterState.REGISTERED);
      this.emit('registered', e);
    });
    
    this.ua.on('unregistered', (e: any) => {
      console.log("UA: Desregistrado do servidor SIP.", e?.cause || "");
      this.updateRegisterState(RegisterState.UNREGISTERED);
      this.emit('unregistered', e);
    });
    
    this.ua.on('registrationFailed', (e: any) => {
      const cause = e?.cause || "Causa desconhecida";
      const statusCode = e?.response?.status_code || "Sem código de status";
      const responseText = e?.response?.reason_phrase || "Sem detalhes adicionais";
      
      console.error(`UA: Falha no registro SIP. Causa: ${cause}, Código: ${statusCode}, Resposta: ${responseText}`);
      
      // Diagnóstico adicional baseado na causa da falha
      if (cause === "Request Timeout") {
        console.error("DIAGNÓSTICO: O servidor SIP não está respondendo. Verifique se o servidor está acessível e se a porta está correta.");
      } else if (cause.includes("Rejected") || statusCode === 401 || statusCode === 403) {
        console.error("DIAGNÓSTICO: Credenciais rejeitadas. Verifique se o usuário e senha estão corretos.");
      } else if (cause.includes("Transport Error")) {
        console.error("DIAGNÓSTICO: Erro de transporte. O servidor pode estar bloqueando conexões WebSocket.");
      } else if (statusCode === 404) {
        console.error("DIAGNÓSTICO: Extensão não encontrada. Verifique se o ramal existe no servidor Asterisk.");
      }
      
      // Tentar exibir detalhes completos do erro
      try {
        console.error("Detalhes completos do erro:", JSON.stringify({
          cause,
          statusCode,
          responseText,
          response: e?.response,
        }, null, 2));
      } catch (err) {
        console.error("Não foi possível exibir detalhes completos do erro.");
      }
      
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
    // Se estamos em modo de simulação, simular uma chamada
    if (this.mockMode) {
      // Verificar se estamos "registrados" no modo simulado
      if (this.registerState !== RegisterState.REGISTERED) {
        throw new Error("Modo de simulação: É necessário registrar-se primeiro");
      }
      
      // Se já tem uma sessão ativa, encerre-a primeiro
      if (this.callState !== CallState.NONE && this.callState !== CallState.TERMINATED) {
        this.hangup();
      }
      
      console.log(`MODO DE SIMULAÇÃO: Discando para ${number}...`);
      this.updateCallState(CallState.CONNECTING);
      
      // Simular progresso da chamada
      setTimeout(() => {
        this.updateCallState(CallState.PROGRESS);
        console.log('MODO DE SIMULAÇÃO: Chamada em progresso (tocando)...');
        
        // Simular conexão após alguns segundos
        setTimeout(() => {
          this.updateCallState(CallState.ESTABLISHED);
          console.log('MODO DE SIMULAÇÃO: Chamada estabelecida!');
          this.emit('confirmed');
        }, 3000);
      }, 1500);
      
      return;
    }
    
    // Modo normal (não simulado)
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
          
          // Formatação do número
          let target = number;
          
          // Adiciona o prefixo sip: e sufixo @domínio apenas se o número não já tiver formato SIP
          if (!target.startsWith("sip:")) {
            // Se é apenas um número/ramal, adicione o formato SIP completo
            target = `sip:${number}@${this.config?.domain}`;
          }
          
          console.log(`Discando para: ${target}`);
          
          // Iniciar a chamada
          this.session = this.ua!.call(target, options);
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
    // Se estamos em modo de simulação
    if (this.mockMode) {
      console.log("MODO DE SIMULAÇÃO: Encerrando chamada...");
      this.updateCallState(CallState.TERMINATING);
      
      setTimeout(() => {
        this.updateCallState(CallState.TERMINATED);
        setTimeout(() => {
          this.updateCallState(CallState.NONE);
        }, 500);
        console.log("MODO DE SIMULAÇÃO: Chamada encerrada");
      }, 500);
      
      return;
    }
    
    // Modo normal
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
    // Se estamos em modo de simulação
    if (this.mockMode) {
      console.log("MODO DE SIMULAÇÃO: Desregistrando...");
      
      // Se houver chamada ativa, encerre-a
      if (this.callState !== CallState.NONE && this.callState !== CallState.TERMINATED) {
        this.hangup();
      }
      
      // Limpar timers de simulação
      if (this.mockRegisterTimer) {
        clearTimeout(this.mockRegisterTimer);
        this.mockRegisterTimer = null;
      }
      
      // Desregistrar com pequeno atraso para simular
      setTimeout(() => {
        this.updateRegisterState(RegisterState.UNREGISTERED);
        console.log("MODO DE SIMULAÇÃO: Desregistrado com sucesso");
      }, 500);
      
      return;
    }
    
    // Modo normal
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
    let stateName = "UNKNOWN";
    switch(state) {
      case RegisterState.UNREGISTERED: stateName = "UNREGISTERED"; break;
      case RegisterState.REGISTERED: stateName = "REGISTERED"; break;
      case RegisterState.REGISTERING: stateName = "REGISTERING"; break;
      case RegisterState.FAILED: stateName = "FAILED"; break;
    }
    console.log(`SIP Register State Changed: ${state} (${stateName})`);
    this.emit('registerStateChanged', state);
    
    // Se o registro falhou e temos um modo de conexão automática, ativar modo de simulação
    if (state === RegisterState.FAILED && !this.mockMode) {
      console.warn('Registro SIP falhou. Considere ativar o modo de simulação para testes.');
    }
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