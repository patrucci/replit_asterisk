import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Network, ServerOff, Server } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AsteriskDiagnostic() {
  const { toast } = useToast();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5038');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message?: string;
    details?: string;
  } | null>(null);
  
  const runTcpTest = async () => {
    if (!host || !port) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha o host e a porta para o teste",
        variant: "destructive",
      });
      return;
    }
    
    setTesting(true);
    setConnectionResult(null);
    
    try {
      const response = await apiRequest("POST", "/api/asterisk/test", {
        host,
        port: parseInt(port),
        username: username || 'admin', // valor padrão para testar apenas a conexão TCP
        password: password || 'password', // valor padrão para testar apenas a conexão TCP
        testTcpOnly: true // Adicionar flag para testar apenas TCP
      });
      
      const result = await response.json();
      
      setConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Teste TCP bem-sucedido",
          description: "A conexão TCP com o servidor foi estabelecida com sucesso",
        });
      } else {
        toast({
          title: "Falha no teste TCP",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao testar conexão TCP:", error);
      setConnectionResult({
        success: false,
        message: "Erro ao executar teste TCP",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
      
      toast({
        title: "Erro no teste",
        description: "Não foi possível executar o teste TCP",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };
  
  const testFullConnection = async () => {
    if (!host || !port || !username || !password) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha todos os campos para o teste completo",
        variant: "destructive",
      });
      return;
    }
    
    setTesting(true);
    setConnectionResult(null);
    
    try {
      const response = await apiRequest("POST", "/api/asterisk/test", {
        host,
        port: parseInt(port),
        username,
        password
      });
      
      const result = await response.json();
      
      setConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Teste bem-sucedido",
          description: "A conexão com o Asterisk AMI foi estabelecida com sucesso",
        });
      } else {
        toast({
          title: "Falha no teste",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao testar conexão:", error);
      setConnectionResult({
        success: false,
        message: "Erro ao executar teste",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
      
      toast({
        title: "Erro no teste",
        description: "Não foi possível executar o teste",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Network className="h-5 w-5 mr-2" />
          Diagnóstico de Conexão Asterisk
        </CardTitle>
        <CardDescription>
          Ferramentas para diagnosticar problemas de conexão com o servidor Asterisk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <Label htmlFor="host-diagnostic">Endereço do servidor</Label>
            <Input
              id="host-diagnostic"
              placeholder="Ex: asterisk.exemplo.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="port-diagnostic">Porta AMI</Label>
            <Input
              id="port-diagnostic"
              placeholder="Padrão: 5038"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <Label htmlFor="username-diagnostic">Usuário AMI</Label>
            <Input
              id="username-diagnostic"
              placeholder="Usuário do AMI"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password-diagnostic">Senha</Label>
            <Input
              id="password-diagnostic"
              type="password"
              placeholder="Senha do AMI"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={runTcpTest}
            disabled={testing || !host || !port}
          >
            <Server className="h-4 w-4 mr-2" />
            {testing ? "Testando..." : "Testar Conexão TCP"}
          </Button>
          
          <Button
            onClick={testFullConnection}
            disabled={testing || !host || !port || !username || !password}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {testing ? "Testando..." : "Testar Conexão AMI Completa"}
          </Button>
        </div>
        
        {connectionResult && (
          <>
            <Separator className="my-4" />
            
            <Alert variant={connectionResult.success ? "default" : "destructive"}>
              {connectionResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle className="ml-2">
                {connectionResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
              </AlertTitle>
              <AlertDescription className="ml-2">
                {connectionResult.message}
                
                {connectionResult.details && (
                  <div className="mt-2 p-2 text-xs bg-muted rounded border">
                    <p className="font-semibold">Detalhes técnicos:</p>
                    <p className="whitespace-pre-wrap">{connectionResult.details}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
            
            {!connectionResult.success && (
              <div className="text-sm space-y-2">
                <h4 className="font-medium">Dicas de resolução:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Verifique se o servidor Asterisk está em execução.</li>
                  <li>Confirme que a porta AMI (geralmente 5038) está aberta no firewall.</li>
                  <li>Verifique as configurações no arquivo <code>manager.conf</code> do Asterisk.</li>
                  <li>Confirme que o usuário AMI tem permissões adequadas.</li>
                  <li>Teste a conexão diretamente do servidor com <code>telnet localhost 5038</code>.</li>
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}