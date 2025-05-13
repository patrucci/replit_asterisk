import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Server, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export interface TestResult {
  success: boolean;
  message?: string;
  diagnosticInfo?: string;
}

export function AsteriskConnectionTest() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5038');
  const [isTestingTCP, setIsTestingTCP] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [tcpResult, setTcpResult] = useState<TestResult | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);
  
  const testTCPConnection = async () => {
    if (!host || !port) {
      return;
    }
    
    setIsTestingTCP(true);
    setTcpResult(null);
    
    try {
      const response = await apiRequest('POST', '/api/asterisk/test-connection', {
        host,
        port: parseInt(port)
      });
      
      const result = await response.json();
      setTcpResult(result);
      console.log('Resultado do teste TCP:', result);
    } catch (error) {
      console.error('Erro ao testar conexão TCP:', error);
      setTcpResult({
        success: false,
        message: `Erro ao testar conexão: ${error}`
      });
    } finally {
      setIsTestingTCP(false);
    }
  };
  
  const runDiagnostic = async () => {
    if (!host) {
      return;
    }
    
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    
    try {
      const response = await apiRequest('POST', '/api/asterisk/diagnose', {
        host,
        port: port ? parseInt(port) : undefined
      });
      
      const result = await response.json();
      if (result.success && result.diagnosticInfo) {
        setDiagnosticResult(result.diagnosticInfo);
      } else {
        setDiagnosticResult('Falha ao executar diagnóstico: ' + (result.message || 'Erro desconhecido'));
      }
      console.log('Resultado do diagnóstico:', result);
    } catch (error) {
      console.error('Erro ao executar diagnóstico:', error);
      setDiagnosticResult(`Erro ao executar diagnóstico: ${error}`);
    } finally {
      setIsDiagnosing(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Teste de Conectividade Asterisk
        </CardTitle>
        <CardDescription>
          Verifique a conectividade com o servidor Asterisk e diagnostique problemas de conexão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="asterisk-host">Servidor Asterisk</Label>
              <Input
                id="asterisk-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="voip.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asterisk-port">Porta</Label>
              <Input
                id="asterisk-port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5038"
              />
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={testTCPConnection}
              disabled={isTestingTCP || !host || !port}
            >
              {isTestingTCP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conectividade TCP
            </Button>
            <Button 
              variant="outline" 
              onClick={runDiagnostic}
              disabled={isDiagnosing || !host}
            >
              {isDiagnosing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Diagnóstico Detalhado
            </Button>
          </div>
        </div>
        
        {tcpResult && (
          <Alert variant={tcpResult.success ? "default" : "destructive"}>
            <div className="flex items-center gap-2">
              {tcpResult.success 
                ? <CheckCircle className="h-4 w-4" /> 
                : <XCircle className="h-4 w-4" />
              }
              <AlertTitle>
                {tcpResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
              </AlertTitle>
            </div>
            <AlertDescription className="mt-2">
              {tcpResult.message}
              {tcpResult.diagnosticInfo && (
                <pre className="mt-2 p-2 bg-secondary text-xs rounded-md overflow-auto max-h-40">
                  {tcpResult.diagnosticInfo}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {diagnosticResult && (
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Resultado do Diagnóstico
            </h3>
            <div className="bg-secondary p-3 rounded-md text-sm whitespace-pre-wrap overflow-auto max-h-80">
              {diagnosticResult}
            </div>
          </div>
        )}
        
        <div className="mt-4 bg-muted p-4 rounded-md">
          <h3 className="text-sm font-medium mb-2">Dicas de Troubleshooting</h3>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>Verifique se o servidor Asterisk está online e acessível na rede</li>
            <li>Confirme que a porta do AMI (geralmente 5038) está aberta no firewall</li>
            <li>Certifique-se que o módulo AMI está habilitado no Asterisk</li>
            <li>Para conexão WebSocket (SIP), verifique a porta 8088 ou 8089</li>
            <li>Verifique suas credenciais de AMI no arquivo /etc/asterisk/manager.conf</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
        Utilize esta ferramenta para diagnosticar problemas de conectividade com o servidor Asterisk. Os testes 
        verificam se o servidor está acessível e se as portas estão abertas.
      </CardFooter>
    </Card>
  );
}