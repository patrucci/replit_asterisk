import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wifi, CheckCircle, AlertTriangle, XCircle, Settings } from 'lucide-react';
import { sipClient } from '@/lib/sipClient';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

export function SoftphoneConnectionTest() {
  const [wsUri, setWsUri] = useState('wss://voip.lansolver.com:8089/ws');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [savedConfig, setSavedConfig] = useState<any>(null);
  
  // Carregar configurações salvas do softphone
  useEffect(() => {
    try {
      const config = localStorage.getItem('softphone_config');
      if (config) {
        const parsedConfig = JSON.parse(config);
        setSavedConfig(parsedConfig);
        
        // Definir o URI WebSocket da configuração se estiver disponível
        if (parsedConfig.wsUri) {
          setWsUri(parsedConfig.wsUri);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações salvas:', error);
    }
  }, []);
  
  // Função para testar a conexão WebSocket diretamente no navegador
  const testWebSocketConnection = async () => {
    if (!wsUri) {
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      console.log(`Testando conexão WebSocket com ${wsUri}...`);
      
      const ws = new WebSocket(wsUri);
      
      // Definir timeout para fechar após 10 segundos se não conectar
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setTestResult({
            success: false,
            message: `Timeout: Não foi possível estabelecer conexão após 10 segundos.`,
            details: 'O servidor não respondeu dentro do tempo esperado. Verifique se o endereço está correto e se o servidor está online.'
          });
          setIsTesting(false);
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('WebSocket conectado com sucesso!');
        setTestResult({
          success: true,
          message: 'Conexão WebSocket estabelecida com sucesso!',
          details: `Conectado a ${wsUri}`
        });
        ws.close();
        setIsTesting(false);
      };
      
      ws.onerror = (event) => {
        clearTimeout(timeout);
        console.error('Erro na conexão WebSocket:', event);
        setTestResult({
          success: false,
          message: 'Erro ao tentar conectar via WebSocket',
          details: 'Verifique no console do navegador (F12) para detalhes específicos do erro.'
        });
        setIsTesting(false);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log('Conexão WebSocket fechada:', event.code, event.reason);
        
        // Se fechou não por timeout ou erro reportado pelo manipulador onerror
        if (!testResult) {
          const wasClean = event.wasClean;
          setTestResult({
            success: wasClean,
            message: wasClean 
              ? 'Conexão WebSocket fechada normalmente' 
              : `Conexão WebSocket fechada com erro (código ${event.code})`,
            details: wasClean
              ? 'A conexão foi estabelecida e fechada corretamente.'
              : `Código: ${event.code}. Razão: ${event.reason || 'Nenhuma razão específica fornecida'}`
          });
        }
        setIsTesting(false);
      };
    } catch (error: any) {
      console.error('Erro ao criar objeto WebSocket:', error);
      setTestResult({
        success: false,
        message: `Erro ao iniciar teste: ${error.message || 'Erro desconhecido'}`,
        details: 'Ocorreu um erro ao tentar criar o objeto WebSocket. Verifique se o URI é válido.'
      });
      setIsTesting(false);
    }
  };
  
  // Função para tentar tanto wss:// quanto ws://
  const testBothProtocols = async () => {
    if (!wsUri) return;
    
    // Obter o URI base sem o protocolo
    let baseUri = wsUri;
    if (baseUri.startsWith('wss://')) {
      baseUri = baseUri.replace('wss://', '');
    } else if (baseUri.startsWith('ws://')) {
      baseUri = baseUri.replace('ws://', '');
    }
    
    // Definir os URIs para testar
    const secureUri = `wss://${baseUri}`;
    const insecureUri = `ws://${baseUri}`;
    
    // Atualizar o URI atual para o seguro e iniciar o teste
    setWsUri(secureUri);
    setTimeout(() => {
      testWebSocketConnection();
    }, 100);
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="bg-secondary/50">
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Teste de Conexão SIP WebSocket
        </CardTitle>
        <CardDescription>
          Verifique a conectividade WebSocket com o servidor Asterisk para conectar o Softphone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ws-uri">URI do WebSocket SIP</Label>
            <div className="flex gap-2">
              <Input
                id="ws-uri"
                value={wsUri}
                onChange={(e) => setWsUri(e.target.value)}
                placeholder="wss://voip.example.com:8089/ws"
                className="flex-1"
              />
              <Button 
                variant="default" 
                onClick={testWebSocketConnection}
                disabled={isTesting || !wsUri}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar
              </Button>
              <Button 
                variant="outline" 
                onClick={testBothProtocols}
                disabled={isTesting || !wsUri}
                title="Testa wss:// e ws:// automaticamente"
              >
                Teste Automático
              </Button>
            </div>
          </div>
          
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"} className="mt-4">
              <div className="flex items-center gap-2">
                {testResult.success 
                  ? <CheckCircle className="h-4 w-4" /> 
                  : <XCircle className="h-4 w-4" />
                }
                <AlertTitle>
                  {testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
                </AlertTitle>
              </div>
              <AlertDescription className="mt-2">
                <p>{testResult.message}</p>
                {testResult.details && (
                  <p className="mt-2 text-xs opacity-80">{testResult.details}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="mt-6 bg-muted p-4 rounded-md">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Dicas para solução de problemas
          </h3>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>O WebSocket URI deve usar o formato: <code>wss://dominio.com:porta/ws</code></li>
            <li>Portas comuns para WebSocket SIP: 8088 ou 8089</li>
            <li>Se <code>wss://</code> falhar, tente <code>ws://</code> para conexões não-seguras</li>
            <li>Verifique se o módulo WebSocket está habilitado no Asterisk</li>
            <li>Certifique-se que o firewall não está bloqueando a porta WebSocket</li>
            <li>Para conexões <code>wss://</code>, o certificado SSL deve ser válido</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
        Esta ferramenta testa apenas a conexão WebSocket. Um teste bem-sucedido não garante que o 
        registro SIP funcionará, mas confirma que o servidor Asterisk está acessível.
      </CardFooter>
    </Card>
  );
}