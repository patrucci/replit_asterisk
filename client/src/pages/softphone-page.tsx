import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SoftPhone } from "@/components/softphone/SoftPhone";
import { SoftphoneConnectionTest } from "@/components/softphone/SoftphoneConnectionTest";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallState, RegisterState } from "@/lib/sipClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneCall, Settings, PhoneForwarded, Volume2, HelpCircle, Wifi } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SoftphonePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("softphone");
  const [callState, setCallState] = useState<CallState>(CallState.NONE);
  const [registerState, setRegisterState] = useState<RegisterState>(RegisterState.UNREGISTERED);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [audioTestActive, setAudioTestActive] = useState(false);
  const [g729Enabled, setG729Enabled] = useState(true);

  // Efeito para obter lista de dispositivos de áudio
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        // Solicitar permissão para acessar dispositivos de mídia
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Obter lista de dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        
        setAudioDevices([...audioInputs, ...audioOutputs]);
        
        // Definir dispositivos padrão
        if (audioInputs.length > 0) {
          setSelectedMic(audioInputs[0].deviceId);
        }
        
        if (audioOutputs.length > 0) {
          setSelectedSpeaker(audioOutputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast({
          title: "Erro de acesso",
          description: "Não foi possível acessar dispositivos de áudio",
          variant: "destructive",
        });
      }
    };
    
    getAudioDevices();
    
    // Adicionar listener para dispositivos conectados/desconectados
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
      
      // Limpar teste de áudio se estiver ativo
      if (audioTestActive) {
        stopAudioTest();
      }
    };
  }, []);

  // Manipulador de estado de chamada
  const handleCallStateChange = (state: CallState) => {
    setCallState(state);
    
    switch (state) {
      case CallState.CONNECTING:
        toast({
          title: "Conectando",
          description: "Iniciando chamada...",
        });
        break;
      case CallState.ESTABLISHED:
        toast({
          title: "Chamada estabelecida",
          description: "Chamada em andamento",
        });
        break;
      case CallState.TERMINATED:
        toast({
          title: "Chamada terminada",
          description: "A chamada foi encerrada",
        });
        break;
    }
  };

  // Manipulador de estado de registro
  const handleRegisterStateChange = (state: RegisterState) => {
    setRegisterState(state);
  };

  // Função para testar áudio
  const startAudioTest = () => {
    try {
      setAudioTestActive(true);
      
      // Criar contexto de áudio
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configurar oscilador
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // nota Lá (A4)
      
      // Configurar volume baixo
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      // Conectar componentes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Iniciar oscilador
      oscillator.start();
      
      // Parar após 3 segundos
      setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
        audioContext.close();
        setAudioTestActive(false);
      }, 3000);
      
      toast({
        title: "Teste de áudio",
        description: "Tocando tom de teste por 3 segundos",
      });
    } catch (error) {
      console.error('Error during audio test:', error);
      setAudioTestActive(false);
      
      toast({
        title: "Erro no teste",
        description: "Não foi possível reproduzir o tom de teste",
        variant: "destructive",
      });
    }
  };

  // Parar teste de áudio
  const stopAudioTest = () => {
    setAudioTestActive(false);
    // Qualquer limpeza necessária de recursos de áudio
  };

  // Removemos a função saveDefaultConfig pois não é mais necessária

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-800">Softphone</h2>
          <p className="text-sm text-neutral-500">
            Realize e receba chamadas diretamente do navegador com suporte ao codec G.729
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna do Softphone */}
          <div className="md:col-span-2">
            <SoftPhone 
              onCallStateChange={handleCallStateChange}
              onRegisterStateChange={handleRegisterStateChange}
            />
          </div>
          
          {/* Coluna de Configurações e Informações */}
          <div>
            <Tabs defaultValue="status" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="status">
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Status
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Config
                </TabsTrigger>
                <TabsTrigger value="diagnostico">
                  <Wifi className="h-4 w-4 mr-2" />
                  Diagnóstico
                </TabsTrigger>
                <TabsTrigger value="help">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Ajuda
                </TabsTrigger>
              </TabsList>
              
              {/* Aba de Status */}
              <TabsContent value="status">
                <Card>
                  <CardHeader>
                    <CardTitle>Status da Conexão</CardTitle>
                    <CardDescription>Informações sobre o estado atual do softphone</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Registro SIP</p>
                        <p className={`text-sm font-medium ${
                          registerState === RegisterState.REGISTERED ? 'text-green-600' :
                          registerState === RegisterState.REGISTERING ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {registerState === RegisterState.REGISTERED ? 'Conectado' :
                           registerState === RegisterState.REGISTERING ? 'Conectando...' :
                           registerState === RegisterState.FAILED ? 'Falha no registro' :
                           'Desconectado'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Estado da Chamada</p>
                        <p className="text-sm font-medium">
                          {callState === CallState.NONE ? 'Sem chamada' :
                           callState === CallState.CONNECTING ? 'Conectando...' :
                           callState === CallState.PROGRESS ? 'Chamando...' :
                           callState === CallState.ESTABLISHED ? 'Em chamada' :
                           callState === CallState.HOLD ? 'Em espera' :
                           'Finalizando'}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Códec G.729</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Switch 
                          checked={g729Enabled} 
                          onCheckedChange={setG729Enabled}
                          id="g729-toggle"
                        />
                        <Label htmlFor="g729-toggle" className="text-sm">
                          {g729Enabled ? 'Ativado' : 'Desativado'}
                        </Label>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        O codec G.729 fornece alta compressão, reduzindo o consumo de banda.
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-2">Dispositivos de Áudio</p>
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <Label className="text-xs">Microfone</Label>
                          <Select 
                            value={selectedMic} 
                            onValueChange={setSelectedMic}
                          >
                            <SelectTrigger className="col-span-2 h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {audioDevices
                                .filter(device => device.kind === 'audioinput')
                                .map(device => (
                                  <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                                    {device.label || `Microfone ${device.deviceId.substring(0, 5)}...`}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <Label className="text-xs">Alto-falante</Label>
                          <Select 
                            value={selectedSpeaker} 
                            onValueChange={setSelectedSpeaker}
                          >
                            <SelectTrigger className="col-span-2 h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {audioDevices
                                .filter(device => device.kind === 'audiooutput')
                                .map(device => (
                                  <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                                    {device.label || `Alto-falante ${device.deviceId.substring(0, 5)}...`}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full mt-2"
                        onClick={startAudioTest}
                        disabled={audioTestActive}
                      >
                        <Volume2 className="h-4 w-4 mr-2" />
                        Testar áudio
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Aba de Diagnóstico */}
              <TabsContent value="diagnostico">
                <SoftphoneConnectionTest />
              </TabsContent>
              
              {/* Aba de Configurações */}
              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações do Softphone</CardTitle>
                    <CardDescription>Documentação e ajuda sobre o uso do softphone</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                      <h3 className="text-sm font-medium text-blue-800 flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações do Ramal
                      </h3>
                      <p className="text-xs text-blue-700 mt-1">
                        As configurações do softphone podem ser acessadas diretamente 
                        através do botão de configuração (ícone de engrenagem) 
                        no cabeçalho do telefone.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Tipos de Codecs</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        O ProConnect CRM suporta os seguintes codecs de áudio:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>G.711 (PCMA/PCMU) - Alta qualidade, maior largura de banda</li>
                        <li>G.729 - Compressão eficiente, menor largura de banda</li>
                        <li>Opus - Codec adaptativo de alta qualidade</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium">Requisitos do Sistema</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Para o melhor funcionamento do softphone:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>Navegador Chrome, Firefox ou Edge atualizado</li>
                        <li>Conexão estável à internet</li>
                        <li>Microfone e alto-falantes funcionais</li>
                        <li>Acesso HTTPS (necessário para funcionalidades de áudio)</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Aba de Ajuda */}
              <TabsContent value="help">
                <Card>
                  <CardHeader>
                    <CardTitle>Ajuda do Softphone</CardTitle>
                    <CardDescription>Instruções de uso e dicas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">Como usar o softphone</h3>
                      <ol className="text-sm space-y-2 list-decimal list-inside">
                        <li>Configure o ramal e senha nas configurações do softphone</li>
                        <li>Clique em "Conectar" para registrar no servidor SIP</li>
                        <li>Use o teclado numérico para discar um número</li>
                        <li>Quando receber uma chamada, clique em "Atender"</li>
                        <li>Durante a chamada, você pode usar os botões de mudo e espera</li>
                      </ol>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Requisitos</h3>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>Navegador Google Chrome atualizado</li>
                        <li>Acesso ao microfone autorizado</li>
                        <li>Conexão estável com a internet</li>
                        <li>Servidor Asterisk com suporte a WebRTC e G.729</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Problemas comuns</h3>
                      <div className="text-sm space-y-2">
                        <p><strong>Falha no registro:</strong> Verifique se as credenciais do ramal estão corretas e se o servidor está acessível.</p>
                        <p><strong>Sem áudio:</strong> Verifique se o microfone está conectado e se as permissões estão concedidas.</p>
                        <p><strong>Eco na chamada:</strong> Use um headset para evitar que o áudio do alto-falante seja captado pelo microfone.</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Sobre o G.729</h3>
                      <p className="text-sm">
                        O codec G.729 é um algoritmo de compressão de áudio que reduz significativamente o consumo de banda, 
                        mantendo uma boa qualidade de voz. Ele é ideal para conexões com largura de banda limitada.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}