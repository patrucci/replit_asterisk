import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2, Settings, Server, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SipConfig } from "@/lib/sipClient";

interface DiagnosticResults {
  dns?: {
    success: boolean;
    ip?: string;
  };
  websocket?: {
    success: boolean;
    ports?: number[];
  };
  ami?: {
    success: boolean;
  };
}

interface SoftphoneAutoConfigProps {
  host: string;
  onConfigGenerated?: (config: SipConfig) => void;
}

export function SoftphoneAutoConfig({ 
  host = "voip.lansolver.com",
  onConfigGenerated 
}: SoftphoneAutoConfigProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults>({});
  const [suggestedConfig, setSuggestedConfig] = useState<SipConfig | null>(null);
  const [testingPhase, setTestingPhase] = useState<'idle' | 'dns' | 'websocket' | 'ami' | 'complete' | 'error'>('idle');

  // Função para realizar diagnóstico completo
  const runDiagnostics = async () => {
    setLoading(true);
    setTestingPhase('dns');
    setSuggestedConfig(null);
    setDiagnosticResults({});

    try {
      // 1. Testar DNS
      let hostIp = host;
      const dnsResult = await testDns(host);
      setDiagnosticResults(prev => ({ ...prev, dns: dnsResult }));
      
      if (dnsResult.success && dnsResult.ip) {
        hostIp = dnsResult.ip; // Usar IP se DNS resolver com sucesso
      }
      
      // 2. Testar WebSocket
      setTestingPhase('websocket');
      const wsResult = await testWebSocket(host);
      setDiagnosticResults(prev => ({ ...prev, websocket: wsResult }));
      
      // 3. Testar AMI 
      setTestingPhase('ami');
      const amiResult = await testAmi(host);
      setDiagnosticResults(prev => ({ ...prev, ami: amiResult }));
      
      // 4. Gerar configuração sugerida
      setTestingPhase('complete');
      generateSuggestedConfig(host, hostIp, wsResult);
      
    } catch (error) {
      console.error("Erro ao executar diagnóstico:", error);
      setTestingPhase('error');
      toast({
        title: "Erro no diagnóstico",
        description: "Não foi possível completar o diagnóstico. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testDns = async (hostname: string): Promise<{success: boolean, ip?: string}> => {
    try {
      // Verificar se já é um IP
      if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return { success: true, ip: hostname };
      }
      
      const res = await apiRequest("POST", "/api/asterisk/test-dns", { host: hostname });
      const data = await res.json();
      
      return { 
        success: data.success, 
        ip: data.success ? data.ip : undefined
      };
    } catch (error) {
      console.error("Erro no teste DNS:", error);
      return { success: false };
    }
  };

  const testWebSocket = async (hostname: string): Promise<{success: boolean, ports?: number[]}> => {
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-websocket", { 
        host: hostname,
        ports: [8088, 8089],
        timeout: 5000
      });
      const data = await res.json();
      
      // Extrair portas bem-sucedidas
      const openPorts: number[] = [];
      if (data.results) {
        data.results.forEach((result: any) => {
          if (result.success) {
            openPorts.push(result.port);
          }
        });
      }
      
      return { 
        success: data.success, 
        ports: openPorts.length > 0 ? openPorts : undefined
      };
    } catch (error) {
      console.error("Erro no teste WebSocket:", error);
      return { success: false };
    }
  };

  const testAmi = async (hostname: string): Promise<{success: boolean}> => {
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-tcp-connection", { 
        host: hostname,
        port: 5038,
        timeout: 5000
      });
      const data = await res.json();
      
      return { success: data.success };
    } catch (error) {
      console.error("Erro no teste AMI:", error);
      return { success: false };
    }
  };

  const generateSuggestedConfig = (hostname: string, ip: string, wsResult: {success: boolean, ports?: number[]}) => {
    // Determinar a melhor configuração baseada nos resultados
    
    // Escolher entre hostname ou IP baseado no resultado do DNS
    const serverAddress = hostname;
    
    // Escolher a porta WebSocket (preferindo 8089, depois 8088)
    let wsPort = '8088'; // Porta padrão
    let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    
    if (wsResult.ports && wsResult.ports.length > 0) {
      if (wsResult.ports.includes(8089)) {
        wsPort = '8089';
      } else if (wsResult.ports.includes(8088)) {
        wsPort = '8088';
      }
    }
    
    // Montar a configuração
    const config: SipConfig = {
      domain: serverAddress,
      wsUri: `${protocol}://${serverAddress}:${wsPort}/ws`,
      authorizationUser: '',
      password: '',
      displayName: '',
      registerExpires: 600,
      debug: true,
    };
    
    setSuggestedConfig(config);
    
    // Chamar callback se fornecido
    if (onConfigGenerated) {
      onConfigGenerated(config);
    }
  };

  const applyConfig = () => {
    if (!suggestedConfig) return;
    
    // Salvar no localStorage para ser usado pelo SoftPhone
    localStorage.setItem('softphone_config', JSON.stringify(suggestedConfig));
    
    toast({
      title: "Configuração aplicada",
      description: "Configure o ramal e senha para conectar ao softphone.",
    });
    
    // Chamar callback
    if (onConfigGenerated) {
      onConfigGenerated(suggestedConfig);
    }
  };

  return (
    <Card className="border-2 border-muted">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração Automática
          </CardTitle>
          {!loading && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runDiagnostics}
              className="h-8"
            >
              {testingPhase === 'idle' ? 'Iniciar' : 'Refazer'}
            </Button>
          )}
        </div>
        <CardDescription>
          Detecte automaticamente a configuração ideal para o softphone
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-4 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {testingPhase === 'dns' && 'Verificando resolução DNS...'}
              {testingPhase === 'websocket' && 'Testando portas WebSocket...'}
              {testingPhase === 'ami' && 'Verificando conexão AMI...'}
            </p>
          </div>
        )}
        
        {!loading && testingPhase === 'idle' && (
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-center text-muted-foreground">
              Clique em "Iniciar" para detectar a melhor configuração para seu servidor Asterisk.
            </p>
          </div>
        )}
        
        {!loading && testingPhase === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro no Diagnóstico</AlertTitle>
            <AlertDescription>
              Não foi possível completar o diagnóstico de configuração. Tente novamente ou configure manualmente.
            </AlertDescription>
          </Alert>
        )}
        
        {!loading && testingPhase === 'complete' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                {diagnosticResults.dns?.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">DNS</span>
              </div>
              
              <div className="flex items-center gap-2">
                {diagnosticResults.websocket?.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">WebSocket</span>
              </div>
              
              <div className="flex items-center gap-2">
                {diagnosticResults.ami?.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">AMI</span>
              </div>
              
              <div className="flex items-center gap-2">
                {suggestedConfig ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">Configuração</span>
              </div>
            </div>
            
            {suggestedConfig && (
              <div>
                <h4 className="text-sm font-medium mb-2">Configuração Sugerida</h4>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Domínio SIP</span>
                    <span className="font-mono">{suggestedConfig.domain}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WebSocket URI</span>
                    <span className="font-mono">{suggestedConfig.wsUri}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo de registro</span>
                    <span className="font-mono">{suggestedConfig.registerExpires}s</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {!loading && suggestedConfig && (
        <CardFooter>
          <Button className="w-full" onClick={applyConfig}>
            <Settings className="h-4 w-4 mr-2" />
            Aplicar Configuração
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}