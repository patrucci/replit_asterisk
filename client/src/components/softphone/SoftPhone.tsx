import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  X,
  User,
  Settings,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  Pause,
  RotateCw,
  Volume,
  AlertTriangle,
  Check,
} from 'lucide-react';

import { SipConfig, sipClient, CallState, RegisterState } from '@/lib/sipClient';

// Interface para as props do componente SoftPhone
interface SoftPhoneProps {
  extension?: string;
  displayName?: string;
  domain?: string;
  wsUri?: string;
  password?: string;
  autoRegister?: boolean;
  className?: string;
  onCallStateChange?: (state: CallState) => void;
  onRegisterStateChange?: (state: RegisterState) => void;
}

// Componente principal do SoftPhone
export function SoftPhone({
  extension,
  displayName,
  domain = '',
  wsUri = '',
  password = '',
  autoRegister = false,
  className = '',
  onCallStateChange,
  onRegisterStateChange,
}: SoftPhoneProps) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callState, setCallState] = useState<CallState>(CallState.NONE);
  const [registerState, setRegisterState] = useState<RegisterState>(RegisterState.UNREGISTERED);
  const [isMuted, setIsMuted] = useState(false);
  const [isHold, setIsHold] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [config, setConfig] = useState<SipConfig>({
    domain: domain,
    wsUri: wsUri,
    authorizationUser: extension || '',
    password: password,
    displayName: displayName || '',
    registerExpires: 600,
    debug: false,
  });
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [callHistory, setCallHistory] = useState<Array<{
    number: string;
    displayName?: string;
    direction: 'outgoing' | 'incoming';
    duration: number;
    timestamp: number;
    status: 'answered' | 'missed' | 'busy';
  }>>([]);
  const [incomingCall, setIncomingCall] = useState<{
    number: string;
    displayName?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('dial');
  const [micVolume, setMicVolume] = useState(100);
  const [speakerVolume, setSpeakerVolume] = useState(100);
  const [simulationMode, setSimulationMode] = useState(() => {
    // Carregar preferência de modo de simulação do localStorage
    const savedMode = localStorage.getItem('softphone_simulation_mode');
    return savedMode !== null ? savedMode === 'true' : true; // Ativado por padrão
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Efeito para carregar configurações salvas e registrar no servidor SIP
  useEffect(() => {
    // Tentar carregar configurações salvas do localStorage
    try {
      const savedConfig = localStorage.getItem('softphone_config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        
        // Criar configuração combinando props e valores salvos
        const mergedConfig = {
          domain: parsedConfig.domain || domain,
          wsUri: parsedConfig.wsUri || wsUri,
          authorizationUser: parsedConfig.authorizationUser || extension || '',
          password: parsedConfig.password || password,
          displayName: parsedConfig.displayName || displayName || '',
          registerExpires: parsedConfig.registerExpires || 600,
          debug: parsedConfig.debug || false
        };
        
        setConfig(mergedConfig);
        console.log('Configurações do SoftPhone carregadas:', mergedConfig);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do softphone:', error);
    }

    // Configurar os manipuladores de eventos
    setupEventHandlers();
    
    // Registrar automaticamente se configurado
    if (autoRegister && config.authorizationUser && config.password) {
      registerSip();
    }
    
    // Limpar ao desmontar
    return () => {
      sipClient.removeAllListeners();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      // Desregistrar do servidor SIP
      if (registerState === RegisterState.REGISTERED) {
        sipClient.unregister();
      }
    };
  }, []);

  // Efeito para manipular a conexão de áudio remota
  useEffect(() => {
    if (callState === CallState.ESTABLISHED) {
      const remoteStream = sipClient.getRemoteStream();
      if (remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(error => {
          console.error('Error playing remote audio:', error);
        });
        
        // Iniciar o timer de duração da chamada
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    } else if (callState === CallState.TERMINATED) {
      // Parar o timer de duração da chamada
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      
      // Resetar a duração da chamada
      setCallDuration(0);
      
      // Limpar o áudio remoto
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      
      // Resetar estados da chamada
      setIsMuted(false);
      setIsHold(false);
    }
  }, [callState]);

  // Configurar manipuladores de eventos SIP
  const setupEventHandlers = () => {
    // Evento de alteração de estado de registro
    sipClient.addEventHandler('registerStateChanged', (state: RegisterState) => {
      setRegisterState(state);
      
      if (state === RegisterState.REGISTERED) {
        setIsRegistering(false);
        toast({
          title: "Registrado",
          description: "Softphone conectado com sucesso",
        });
      } else if (state === RegisterState.FAILED) {
        setIsRegistering(false);
        toast({
          title: "Falha no registro",
          description: "Não foi possível conectar ao servidor SIP",
          variant: "destructive",
        });
      }
      
      if (onRegisterStateChange) {
        onRegisterStateChange(state);
      }
    });
    
    // Evento de alteração de estado da chamada
    sipClient.addEventHandler('callStateChanged', (state: CallState) => {
      setCallState(state);
      
      if (onCallStateChange) {
        onCallStateChange(state);
      }
    });
    
    // Evento de chamada recebida
    sipClient.addEventHandler('incomingCall', (data: { displayName?: string, number: string }) => {
      setIncomingCall(data);
      setCallState(CallState.PROGRESS);
      
      // Reproduzir som de chamada
      playRingtone();
    });
    
    // Evento de chamada encerrada
    sipClient.addEventHandler('ended', () => {
      stopRingtone();
      
      // Adicionar ao histórico de chamadas
      if (incomingCall) {
        addToCallHistory({
          number: incomingCall.number,
          displayName: incomingCall.displayName,
          direction: 'incoming',
          duration: callDuration,
          timestamp: Date.now(),
          status: callDuration > 0 ? 'answered' : 'missed',
        });
        
        setIncomingCall(null);
      } else if (phoneNumber) {
        addToCallHistory({
          number: phoneNumber,
          direction: 'outgoing',
          duration: callDuration,
          timestamp: Date.now(),
          status: callDuration > 0 ? 'answered' : 'busy',
        });
      }
    });
    
    // Evento de falha na chamada
    sipClient.addEventHandler('failed', () => {
      stopRingtone();
      
      if (incomingCall) {
        addToCallHistory({
          number: incomingCall.number,
          displayName: incomingCall.displayName,
          direction: 'incoming',
          duration: 0,
          timestamp: Date.now(),
          status: 'missed',
        });
        
        setIncomingCall(null);
      } else if (phoneNumber) {
        addToCallHistory({
          number: phoneNumber,
          direction: 'outgoing',
          duration: 0,
          timestamp: Date.now(),
          status: 'busy',
        });
        
        toast({
          title: "Chamada falhou",
          description: "Não foi possível completar a chamada",
          variant: "destructive",
        });
      }
    });
    
    // Evento de hold/unhold
    sipClient.addEventHandler('hold', () => {
      setIsHold(true);
    });
    
    sipClient.addEventHandler('unhold', () => {
      setIsHold(false);
    });
    
    // Evento de mute
    sipClient.addEventHandler('mute', (muted: boolean) => {
      setIsMuted(muted);
    });
  };

  // Método para registrar no servidor SIP
  const registerSip = () => {
    try {
      // Validar campos obrigatórios
      if (!config.domain || !config.wsUri || !config.authorizationUser) {
        toast({
          title: "Configuração incompleta",
          description: "Preencha todos os campos obrigatórios (Domínio SIP, URI WebSocket e Ramal)",
          variant: "destructive",
        });
        return;
      }
      
      // Verificar se o wsUri tem o protocolo correto
      if (!config.wsUri.startsWith('ws://') && !config.wsUri.startsWith('wss://')) {
        toast({
          title: "URI WebSocket inválido",
          description: "O URI WebSocket deve iniciar com ws:// ou wss://",
          variant: "destructive",
        });
        return;
      }
      
      // Se não tiver senha, perguntar se deseja continuar
      if (!config.password) {
        if (!confirm("Você não inseriu uma senha. Deseja continuar com a tentativa de registro sem senha?")) {
          return;
        }
      }
      
      setIsRegistering(true);
      
      // Tentar primeira conexão com a versão não segura (ws://) 
      // já que muitos servidores Asterisk não têm SSL configurado corretamente
      let connectionUri = config.wsUri;
      if (connectionUri.startsWith('wss://')) {
        connectionUri = connectionUri.replace('wss://', 'ws://');
        toast({
          title: "Usando conexão não segura",
          description: "Tentando conexão não segura (ws://) primeiro para compatibilidade com Asterisk",
        });
      }
      
      // Preparar configuração ajustada
      const adjustedConfig = {
        domain: config.domain,
        wsUri: connectionUri,
        authorizationUser: config.authorizationUser,
        password: config.password,
        displayName: config.displayName,
        registerExpires: config.registerExpires,
        debug: true, // Forçar modo debug para melhor diagnóstico
      };
      
      // Salvar configurações antes de registrar para garantir persistência
      localStorage.setItem('softphone_config', JSON.stringify(adjustedConfig));
      
      console.log("Definindo configurações para o cliente SIP...", adjustedConfig);
      
      // Definir explicitamente se deve usar modo de simulação
      // Garantir que o modo de simulação seja definido antes de qualquer configuração
      sipClient.setMockMode(simulationMode);
      console.log(`SoftPhone: Definindo modo de simulação: ${simulationMode ? 'ATIVADO' : 'DESATIVADO'}`);
      
      if (simulationMode) {
        toast({
          title: "Modo de Simulação Ativo",
          description: "Usando modo de simulação para demonstração sem servidor real.",
        });
      } else {
        toast({
          title: "Conectando ao Servidor Real",
          description: `Tentando conectar a ${connectionUri} como ${config.authorizationUser}`,
        });
      }
      
      // Configurar o cliente SIP com debug ativado para facilitar diagnóstico
      sipClient.setConfig(adjustedConfig);
      
      // Verificar novamente se o modo de simulação foi mantido
      console.log(`SoftPhone: Modo de simulação após setConfig: ${(sipClient as any).mockMode ? 'ATIVADO' : 'DESATIVADO'}`);
      
      // Colocar timeout de 20 segundos para não ficar tentando para sempre
      const timeout = setTimeout(() => {
        if (registerState !== RegisterState.REGISTERED) {
          setIsRegistering(false);
          toast({
            title: "Tempo esgotado",
            description: "Não foi possível conectar ao servidor SIP após 20 segundos. Verifique os dados e a conectividade.",
            variant: "destructive",
          });
        }
      }, 20000);
      
      console.log("Iniciando registro SIP...");
      
      console.log("Verificando modo de simulação antes do registro:", (sipClient as any).mockMode ? "ATIVADO" : "DESATIVADO");
      
      // Registrar
      sipClient.register()
        .then(() => {
          console.log("Registro iniciado com sucesso");
          console.log("Modo de simulação após registro:", (sipClient as any).mockMode ? "ATIVADO" : "DESATIVADO");
          // O estado será atualizado pelos eventos
        })
        .catch(error => {
          console.error('Erro de registro:', error);
          setIsRegistering(false);
          clearTimeout(timeout);
          
          // Mensagens de erro mais específicas
          let errorMsg = error.message;
          if (typeof errorMsg === 'string') {
            if (errorMsg.includes('WebSocket')) {
              errorMsg = "Erro de conexão WebSocket. Verifique se o URI do WebSocket está correto e acessível.";
              
              // Se foi erro de websocket, tente a alternativa
              if (connectionUri.startsWith('ws://')) {
                const secureUri = connectionUri.replace('ws://', 'wss://');
                toast({
                  title: "Tentando conexão alternativa",
                  description: `Não foi possível conectar via ${connectionUri}. Tentando ${secureUri}...`,
                });
                
                // Atualizar configuração e tentar novamente
                adjustedConfig.wsUri = secureUri;
                sipClient.setConfig(adjustedConfig);
                sipClient.register()
                  .then(() => console.log("Segundo método de conexão iniciado"))
                  .catch(altError => {
                    console.error("Segunda tentativa também falhou:", altError);
                    toast({
                      title: "Falha na conexão",
                      description: "Tentamos ws:// e wss:// e ambos falharam. Verifique se o servidor está online.",
                      variant: "destructive",
                    });
                  });
                return;
              }
            } else if (errorMsg.includes('authentication')) {
              errorMsg = "Falha de autenticação. Verifique seu ramal e senha.";
            } else if (errorMsg.includes('media')) {
              errorMsg = "Falha ao acessar o microfone. Verifique as permissões do navegador.";
            }
          } else {
            errorMsg = "Erro desconhecido durante o registro SIP";
          }
          
          toast({
            title: "Erro de registro",
            description: errorMsg,
            variant: "destructive",
          });
        });
    } catch (error: any) {
      console.error('Erro no processo de registro:', error);
      setIsRegistering(false);
      
      toast({
        title: "Erro de registro",
        description: error.message || "Não foi possível conectar ao servidor SIP",
        variant: "destructive",
      });
    }
  };

  // Método para desregistrar do servidor SIP
  const unregisterSip = () => {
    try {
      sipClient.unregister();
    } catch (error) {
      console.error('Unregister error:', error);
    }
  };

  // Método para fazer uma chamada
  const makeCall = () => {
    if (!phoneNumber) {
      toast({
        title: "Número inválido",
        description: "Digite um número para discar",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se está registrado
    if (registerState !== RegisterState.REGISTERED) {
      toast({
        title: "Não registrado",
        description: "É necessário estar conectado ao servidor SIP para fazer chamadas",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log(`Iniciando chamada para: ${phoneNumber}`);
      
      // Formatar o número se necessário (limpeza de caracteres especiais)
      const cleanNumber = phoneNumber.replace(/[^\d*#+]/g, '');
      
      // Se o número limpo está vazio, avisar o usuário
      if (cleanNumber === '') {
        toast({
          title: "Número inválido",
          description: "Digite um número válido para discar",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Número formatado: ${cleanNumber}`);
      
      // Fazer a chamada
      sipClient.call(cleanNumber);
      
      // Reproduzir som de chamada
      playRingtone();
      
      toast({
        title: "Chamando...",
        description: `Ligando para ${cleanNumber}`,
      });
    } catch (error: any) {
      console.error('Erro na chamada:', error);
      
      // Determinar mensagem de erro específica
      let errorMessage = "Não foi possível iniciar a chamada";
      
      if (error.message && error.message.includes("not registered")) {
        errorMessage = "O ramal não está registrado. Verifique as configurações e reconecte.";
      } else if (error.message && error.message.includes("media")) {
        errorMessage = "Erro ao acessar o microfone. Verifique as permissões do navegador.";
      }
      
      toast({
        title: "Erro na chamada",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Método para encerrar uma chamada
  const hangupCall = () => {
    try {
      sipClient.hangup();
      stopRingtone();
      setIncomingCall(null);
    } catch (error) {
      console.error('Hangup error:', error);
    }
  };

  // Método para atender uma chamada
  const answerCall = () => {
    try {
      sipClient.answer();
      stopRingtone();
    } catch (error) {
      console.error('Answer error:', error);
      
      toast({
        title: "Erro ao atender",
        description: "Não foi possível atender a chamada",
        variant: "destructive",
      });
    }
  };

  // Método para rejeitar uma chamada
  const rejectCall = () => {
    try {
      sipClient.reject();
      stopRingtone();
      setIncomingCall(null);
      
      // Adicionar ao histórico como chamada perdida
      if (incomingCall) {
        addToCallHistory({
          number: incomingCall.number,
          displayName: incomingCall.displayName,
          direction: 'incoming',
          duration: 0,
          timestamp: Date.now(),
          status: 'missed',
        });
      }
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  // Método para colocar/tirar chamada de espera
  const toggleHold = () => {
    try {
      sipClient.hold(!isHold);
    } catch (error) {
      console.error('Hold/unhold error:', error);
      
      toast({
        title: "Erro na operação",
        description: "Não foi possível alterar o estado de espera",
        variant: "destructive",
      });
    }
  };

  // Método para mutar/desmutar o microfone
  const toggleMute = () => {
    try {
      sipClient.mute(!isMuted);
    } catch (error) {
      console.error('Mute/unmute error:', error);
      
      toast({
        title: "Erro na operação",
        description: "Não foi possível alterar o estado do microfone",
        variant: "destructive",
      });
    }
  };

  // Método para enviar dígito DTMF
  const sendDTMF = (digit: string) => {
    try {
      sipClient.sendDTMF(digit);
      
      // Adicionar o dígito ao número discado se estiver na fase de discagem
      if (callState === CallState.NONE) {
        setPhoneNumber(prev => prev + digit);
      }
      
      // Reproduzir som de tom
      playDTMFTone(digit);
    } catch (error) {
      console.error('DTMF error:', error);
    }
  };

  // Método para reproduzir som de tom DTMF
  const playDTMFTone = (digit: string) => {
    // Em uma implementação real, reproduziria o som do tom DTMF
    // Por simplicidade, vamos apenas usar a API de áudio
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // Configurar a frequência com base no dígito (simplificado)
      const frequency = digit === '*' ? 941 : digit === '#' ? 1209 : 1000 + parseInt(digit) * 100;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      
      // Tocar o som por 100ms
      setTimeout(() => {
        oscillator.stop();
        context.close();
      }, 100);
    } catch (error) {
      console.error('Error playing DTMF tone:', error);
    }
  };

  // Método para reproduzir ringtone
  const playRingtone = () => {
    // Em uma implementação real, reproduziria um ringtone
    // Aqui apenas simulamos isso
  };

  // Método para parar o ringtone
  const stopRingtone = () => {
    // Em uma implementação real, pararia o ringtone
  };

  // Adicionar chamada ao histórico
  const addToCallHistory = (call: {
    number: string;
    displayName?: string;
    direction: 'outgoing' | 'incoming';
    duration: number;
    timestamp: number;
    status: 'answered' | 'missed' | 'busy';
  }) => {
    setCallHistory(prev => [call, ...prev.slice(0, 19)]); // Manter apenas as últimas 20 chamadas
  };

  // Formatar duração da chamada
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Formatar data/hora
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };

  // Renderização do teclado numérico
  const renderDialpad = () => {
    const dialpadButtons = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#']
    ];
    
    return (
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {dialpadButtons.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map(button => (
              <Button
                key={button}
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 md:h-10 text-sm sm:text-base p-0 min-w-[32px]"
                onClick={() => sendDTMF(button)}
                disabled={callState !== CallState.NONE && callState !== CallState.ESTABLISHED}
              >
                {button}
              </Button>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Renderização do histórico de chamadas
  const renderCallHistory = () => {
    if (callHistory.length === 0) {
      return (
        <div className="text-center py-10 text-neutral-500">
          <PhoneCall className="mx-auto h-10 w-10 mb-3 opacity-25" />
          <p>Nenhuma chamada no histórico</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {callHistory.map((call, index) => (
          <div 
            key={index} 
            className="flex justify-between items-center p-2 rounded-md hover:bg-neutral-100 cursor-pointer"
            onClick={() => {
              setPhoneNumber(call.number);
              setActiveTab('dial');
            }}
          >
            <div className="flex items-center">
              {call.direction === 'outgoing' ? (
                <PhoneForwarded className="h-4 w-4 mr-2" />
              ) : call.status === 'missed' ? (
                <PhoneMissed className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <PhoneIncoming className="h-4 w-4 mr-2" />
              )}
              <div>
                <p className="font-medium">{call.displayName || call.number}</p>
                <p className="text-xs text-neutral-500">{formatTimestamp(call.timestamp)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm">{formatDuration(call.duration)}</p>
              <p className="text-xs text-neutral-500">
                {call.status === 'answered' ? 'Atendida' : 
                 call.status === 'missed' ? 'Perdida' : 'Ocupado'}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderização da interface minimizada
  const renderMinimized = () => {
    return (
      <Card className={`fixed bottom-4 right-4 w-auto shadow-lg ${className}`}>
        <CardContent className="p-2">
          <div className="flex items-center space-x-2">
            <Button
              variant={registerState === RegisterState.REGISTERED ? "default" : "destructive"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsMinimized(false)}
            >
              <Phone className="h-4 w-4" />
            </Button>
            
            {callState !== CallState.NONE && (
              <Badge variant={callState === CallState.ESTABLISHED ? "default" : "outline"}>
                {callState === CallState.ESTABLISHED ? formatDuration(callDuration) : 'Chamando...'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Renderização principal
  if (isMinimized) {
    return renderMinimized();
  }

  return (
    <Card className={`shadow-lg ${className}`}>
      <CardHeader className="py-2 px-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-base">Softphone</CardTitle>
            <CardDescription className="text-xs">
              {config.displayName ? `${config.displayName} (${config.authorizationUser})` : config.authorizationUser}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsMinimized(true)}
              title="Minimizar"
            >
              <Pause className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setConfigDialogOpen(true)}
              title="Configurações"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Aviso de modo de simulação */}
      {registerState === RegisterState.REGISTERED && simulationMode && (
        <div className="mx-3 my-1 p-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-sm">
          <p className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <strong>Simulação Ativa</strong>: Modo de demonstração sem servidor real.
          </p>
        </div>
      )}
      
      <CardContent className="p-3 pt-0">
        {/* Mostrar chamada em andamento */}
        {callState !== CallState.NONE && (
          <div className="mb-2 p-2 bg-secondary rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {incomingCall 
                    ? (incomingCall.displayName || incomingCall.number)
                    : phoneNumber}
                </p>
                <p className="text-sm text-neutral-500">
                  {callState === CallState.CONNECTING ? "Conectando..." :
                   callState === CallState.PROGRESS ? (incomingCall ? "Chamada recebida" : "Chamando...") :
                   callState === CallState.ESTABLISHED ? formatDuration(callDuration) :
                   callState === CallState.HOLD ? "Em espera" :
                   "Finalizando..."}
                </p>
              </div>
              
              {/* Botões de controle da chamada */}
              <div className="flex space-x-2">
                {callState === CallState.ESTABLISHED && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${isMuted ? 'bg-amber-100' : ''}`}
                      onClick={toggleMute}
                      title={isMuted ? 'Ativar microfone' : 'Mudo'}
                    >
                      {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${isHold ? 'bg-amber-100' : ''}`}
                      onClick={toggleHold}
                      title={isHold ? 'Retomar' : 'Espera'}
                    >
                      {isHold ? <PhoneForwarded className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowKeypad(!showKeypad)}
                      title={showKeypad ? 'Fechar teclado' : 'Teclado numérico'}
                    >
                      {showKeypad ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </>
                )}
                
                {/* Botão de encerrar chamada */}
                {(callState === CallState.ESTABLISHED || 
                  callState === CallState.CONNECTING || 
                  callState === CallState.PROGRESS) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 p-0 px-2 text-xs"
                    onClick={hangupCall}
                  >
                    <PhoneOff className="h-3 w-3 mr-1" />
                    Desl
                  </Button>
                )}
                
                {/* Botões para chamada recebida */}
                {incomingCall && callState === CallState.PROGRESS && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 p-0 px-2 text-xs"
                      onClick={rejectCall}
                    >
                      <PhoneOff className="h-3 w-3 mr-1" />
                      Rej
                    </Button>
                    
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 p-0 px-2 text-xs"
                      onClick={answerCall}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Atd
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Teclado numérico durante a chamada */}
            {showKeypad && callState === CallState.ESTABLISHED && (
              <div className="mt-4">
                {renderDialpad()}
              </div>
            )}
          </div>
        )}
        
        {/* Abas de discagem/histórico */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dial">Discador</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dial" className="pt-4">
            {/* Campo de número */}
            <div className="mb-2">
              <Input
                type="text"
                placeholder="Digite um número..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-center text-sm sm:text-base h-9"
                disabled={callState !== CallState.NONE}
              />
            </div>
            
            {/* Teclado de discagem */}
            {renderDialpad()}
            
            {/* Botão de chamada */}
            <div className="mt-3 flex justify-center">
              <Button
                size="default"
                className="rounded-full h-10 w-10 sm:h-12 sm:w-12 p-0"
                disabled={callState !== CallState.NONE || !phoneNumber || registerState !== RegisterState.REGISTERED}
                onClick={makeCall}
              >
                <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="pt-4">
            {renderCallHistory()}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-0 pb-2 flex justify-between items-center">
        {/* Botão de registro */}
        {registerState === RegisterState.REGISTERED ? (
          <Button variant="outline" size="sm" className="h-7 text-xs px-2 py-0" onClick={unregisterSip}>
            Desconectar
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm"
            className="h-7 text-xs px-2 py-0"
            onClick={registerSip}
            disabled={isRegistering || !config.authorizationUser || !config.password}
          >
            {isRegistering ? (
              <>
                <RotateCw className="h-3 w-3 mr-1 animate-spin" />
                Conectando
              </>
            ) : (
              'Conectar'
            )}
          </Button>
        )}
        
        {/* Indicador de status */}
        <div>
          <Badge 
            variant="outline"
            className={`text-xs py-0 px-1 ${
              registerState === RegisterState.REGISTERED ? 'bg-green-100 text-green-800' :
              registerState === RegisterState.REGISTERING ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}
          >
            {registerState === RegisterState.REGISTERED && <Check className="h-2 w-2 mr-0.5" />}
            {registerState === RegisterState.REGISTERING && <RotateCw className="h-2 w-2 mr-0.5 animate-spin" />}
            {registerState === RegisterState.FAILED && <AlertTriangle className="h-2 w-2 mr-0.5" />}
            {registerState === RegisterState.UNREGISTERED && "Offline"}
            {registerState === RegisterState.REGISTERED && "Online"}
            {registerState === RegisterState.REGISTERING && "Conectando"}
            {registerState === RegisterState.FAILED && "Falha"}
          </Badge>
        </div>
      </CardFooter>
      
      {/* Diálogo de configuração */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg">Configurações do Softphone</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Configure os parâmetros de conexão SIP. As configurações serão salvas no navegador.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-2">
            <div className="rounded-md bg-yellow-50 p-2 mb-2">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="ml-2">
                  <h3 className="text-xs font-medium text-yellow-800">Atenção</h3>
                  <div className="mt-1 text-xs text-yellow-700">
                    <p>Ramal, Domínio SIP e URI do WebSocket são obrigatórios.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-1 mb-1">
              <Label htmlFor="extension" className="text-xs">Ramal</Label>
              <Input
                id="extension"
                value={config.authorizationUser}
                onChange={(e) => setConfig({...config, authorizationUser: e.target.value})}
                placeholder="Ex: 1001, 2001, ext123"
                className="h-8"
              />
            </div>
            
            <div className="grid gap-1 mb-1">
              <Label htmlFor="display-name" className="text-xs">Nome de exibição</Label>
              <Input
                id="display-name"
                value={config.displayName}
                onChange={(e) => setConfig({...config, displayName: e.target.value})}
                placeholder="Ex: João Silva"
                className="h-8"
              />
            </div>
            
            <div className="grid gap-1 mb-1">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => setConfig({...config, password: e.target.value})}
                placeholder="Senha do ramal"
                className="h-8"
              />
            </div>
            
            <div className="grid gap-1 mb-1">
              <Label htmlFor="domain" className="text-xs">Domínio SIP</Label>
              <Input
                id="domain"
                value={config.domain}
                onChange={(e) => setConfig({...config, domain: e.target.value})}
                placeholder="Ex: pbx.suaempresa.com, asterisk.local"
                className="h-8"
              />
              <div className="text-[10px] text-muted-foreground">
                <p>Se você está enfrentando problemas de conexão, experimente usar o endereço IP do servidor.</p>
              </div>
            </div>
            
            <div className="grid gap-1 mb-1">
              <Label htmlFor="ws-uri" className="text-xs">URI do WebSocket</Label>
              <Input
                id="ws-uri"
                value={config.wsUri}
                onChange={(e) => setConfig({...config, wsUri: e.target.value})}
                placeholder="Ex: wss://pbx.suaempresa.com:8089/ws"
                className="h-8"
              />
              <div className="text-[10px] text-neutral-500">
                <p>Formato: wss://dominio.com:porta/ws | Portas: 8088 ou 8089</p>
              </div>
            </div>
            
            <div className="grid gap-1 mb-1">
              <Label htmlFor="expires" className="text-xs">Tempo de registro (segundos)</Label>
              <Input
                id="expires"
                type="number"
                value={config.registerExpires}
                onChange={(e) => setConfig({...config, registerExpires: parseInt(e.target.value)})}
                placeholder="Ex: 600"
                className="h-8"
              />
            </div>
            
            <div className="mb-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="debug-mode" className="text-xs">Modo de depuração</Label>
                <Switch
                  id="debug-mode"
                  checked={config.debug}
                  onCheckedChange={(checked) => setConfig({...config, debug: checked})}
                  className="scale-75"
                />
              </div>
              <p className="text-[10px] text-neutral-500">
                Ativa logs detalhados no console do navegador
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-1">
              <Label className="text-xs">Controles de volume</Label>
              
              <div className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                <div className="w-full">
                  <Label htmlFor="mic-volume" className="sr-only">Volume do microfone</Label>
                  <input
                    id="mic-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={micVolume}
                    onChange={(e) => setMicVolume(parseInt(e.target.value))}
                    className="w-full h-3"
                  />
                </div>
                <span className="text-[10px] w-8 text-right">{micVolume}%</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Volume className="h-3 w-3" />
                <div className="w-full">
                  <Label htmlFor="speaker-volume" className="sr-only">Volume do alto-falante</Label>
                  <input
                    id="speaker-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={speakerVolume}
                    onChange={(e) => setSpeakerVolume(parseInt(e.target.value))}
                    className="w-full h-3"
                  />
                </div>
                <span className="text-[10px] w-8 text-right">{speakerVolume}%</span>
              </div>
            </div>
          </div>
          
          {/* Opção para alternar entre modo real e simulação */}
          <div className="mt-2 mb-2 p-2 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="simulationMode" className="text-xs font-medium text-blue-800">Modo de Simulação</Label>
                <p className="text-[10px] text-blue-700">
                  Simula conexão sem servidor real para testes.
                </p>
              </div>
              <Switch
                id="simulationMode"
                checked={simulationMode}
                onCheckedChange={(checked) => {
                  setSimulationMode(checked);
                  localStorage.setItem('softphone_simulation_mode', checked.toString());
                }}
                className="scale-75"
              />
            </div>
          </div>
          
          <div className="my-2 rounded-md border border-yellow-200 bg-yellow-50 p-2">
            <h4 className="text-xs font-medium text-yellow-800">Dicas rápidas</h4>
            <ul className="text-[10px] text-yellow-700 list-disc pl-3 mt-1">
              <li>Verifique se o servidor está ativo</li>
              <li>Use WSS para conexões seguras</li>
              <li>Verifique se porta 8088/8089 está aberta</li>
            </ul>
          </div>
          
          <DialogFooter className="flex sm:flex-row gap-1 border-t pt-2 mt-1">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => {
                // Validação básica
                if (!config.wsUri) {
                  toast({
                    title: "URI WebSocket necessário",
                    description: "Informe o URI do WebSocket para testar a conexão",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Testar apenas o WebSocket
                try {
                  const ws = new WebSocket(config.wsUri);
                  
                  toast({
                    title: "Testando conexão...",
                    description: "Tentando conectar ao WebSocket",
                  });
                  
                  ws.onopen = () => {
                    toast({
                      title: "Conexão bem-sucedida",
                      description: "WebSocket conectado!",
                    });
                    ws.close();
                  };
                  
                  ws.onerror = (error) => {
                    console.error("Erro na conexão WebSocket:", error);
                    toast({
                      title: "Falha na conexão",
                      description: "Não foi possível conectar ao servidor",
                      variant: "destructive",
                    });
                  };
                } catch (error) {
                  console.error("Erro ao iniciar websocket:", error);
                  toast({
                    title: "Erro na conexão",
                    description: "Formato de URI inválido",
                    variant: "destructive",
                  });
                }
              }}>
              Testar
            </Button>
            <Button 
              size="sm"
              className="text-xs h-7 px-2" 
              onClick={() => {
                setConfigDialogOpen(false);
                
                // Salvar configurações no localStorage para persistência
                try {
                  localStorage.setItem('softphone_config', JSON.stringify(config));
                  
                  toast({
                    title: "Configurações salvas",
                    description: "As configurações foram salvas com sucesso"
                  });
                  
                  // Se já estiver registrado, desregistre primeiro para aplicar as novas configurações
                  if (registerState === RegisterState.REGISTERED) {
                    unregisterSip();
                    
                    // Registre novamente com as novas configurações após um breve atraso
                    setTimeout(() => {
                      registerSip();
                    }, 1000);
                  }
                } catch (error) {
                  console.error('Error saving softphone config:', error);
                  toast({
                    title: "Erro ao salvar",
                    description: "Não foi possível salvar as configurações",
                    variant: "destructive"
                  });
                }
              }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Elemento de áudio para reproduzir o stream da chamada */}
      <audio ref={remoteAudioRef} autoPlay />
    </Card>
  );
}