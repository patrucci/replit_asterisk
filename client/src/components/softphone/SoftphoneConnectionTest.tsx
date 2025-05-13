import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircleIcon, CheckCircleIcon, Loader2Icon, ServerIcon, PhoneIcon, WifiIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface DiagnosticResult {
  success: boolean;
  message: string;
  diagnosticInfo?: string;
}

export function SoftphoneConnectionTest() {
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState("voip.lansolver.com");
  const [port, setPort] = useState("5038");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [testResult, setTestResult] = useState<DiagnosticResult | null>(null);
  const [tcpResult, setTcpResult] = useState<DiagnosticResult | null>(null);
  const [websocketResult, setWebsocketResult] = useState<DiagnosticResult | null>(null);
  const [dnsResult, setDnsResult] = useState<DiagnosticResult | null>(null);
  const [activeTab, setActiveTab] = useState("tcp");
  
  // Executar testes automaticamente ao montar o componente
  React.useEffect(() => {
    // Pequeno atraso para não sobrecarregar a página durante o carregamento
    const timer = setTimeout(() => {
      runDnsTest();
      
      // Pequeno intervalo entre os testes para não sobrecarregar o servidor
      setTimeout(() => runTcpTest(), 1500);
      setTimeout(() => runWebsocketTest(), 3000);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const runTcpTest = async () => {
    setLoading(true);
    setTcpResult(null);
    
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-tcp-connection", {
        host,
        port: parseInt(port),
        timeout: 5000
      });
      const data = await res.json();
      setTcpResult(data);
    } catch (error) {
      setTcpResult({
        success: false,
        message: "Erro ao executar teste: " + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setLoading(false);
    }
  };

  const runWebsocketTest = async () => {
    setLoading(true);
    setWebsocketResult(null);
    
    try {
      // Testa a conexão WebSocket nas portas 8088 e 8089
      const res = await apiRequest("POST", "/api/asterisk/test-websocket", {
        host,
        ports: [8088, 8089],
        timeout: 5000
      });
      const data = await res.json();
      setWebsocketResult(data);
    } catch (error) {
      setWebsocketResult({
        success: false,
        message: "Erro ao testar WebSocket: " + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setLoading(false);
    }
  };

  const runDnsTest = async () => {
    setLoading(true);
    setDnsResult(null);
    
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-dns", {
        host
      });
      const data = await res.json();
      setDnsResult(data);
    } catch (error) {
      setDnsResult({
        success: false,
        message: "Erro ao verificar DNS: " + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setLoading(false);
    }
  };

  const runFullTest = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-connection", {
        host,
        port: parseInt(port),
        username,
        password
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        message: "Erro ao testar conexão: " + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 border-2 border-muted">
      <div className="space-y-6">
        <div className="flex flex-col space-y-1">
          <h3 className="text-xl font-medium flex items-center">
            <ServerIcon className="mr-2 h-5 w-5 text-primary" />
            Diagnóstico de Conectividade Asterisk
          </h3>
          <p className="text-sm text-muted-foreground">
            Use esta ferramenta para testar a conexão com seu servidor Asterisk e diagnosticar problemas de conexão.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="host">Servidor Asterisk (Hostname/IP)</Label>
            <Input
              id="host"
              placeholder="Ex: voip.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="port">Porta AMI</Label>
            <Input
              id="port"
              placeholder="Ex: 5038"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="username">Usuário AMI</Label>
            <Input
              id="username"
              placeholder="Ex: admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha AMI</Label>
            <Input
              id="password"
              type="password"
              placeholder="Senha do AMI"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="tcp">TCP</TabsTrigger>
            <TabsTrigger value="websocket">WebSocket</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
            <TabsTrigger value="full">AMI</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tcp" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Teste de Conexão TCP</h4>
                <p className="text-xs text-muted-foreground">Verifica se é possível estabelecer uma conexão TCP com o servidor.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={runTcpTest}
                disabled={loading}
              >
                {loading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <WifiIcon className="mr-2 h-4 w-4" />}
                Testar TCP
              </Button>
            </div>
            
            {tcpResult && (
              <Alert variant={tcpResult.success ? "default" : "destructive"}>
                <div className="flex items-start">
                  {tcpResult.success ? 
                    <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5" /> : 
                    <AlertCircleIcon className="h-4 w-4 mr-2 mt-0.5" />
                  }
                  <div>
                    <AlertTitle>{tcpResult.success ? "Conexão TCP Bem-Sucedida" : "Falha na Conexão TCP"}</AlertTitle>
                    <AlertDescription>
                      {tcpResult.message}
                      
                      {tcpResult.diagnosticInfo && (
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem value="details">
                            <AccordionTrigger className="text-xs">Ver detalhes técnicos</AccordionTrigger>
                            <AccordionContent>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {tcpResult.diagnosticInfo}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="websocket" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Teste de WebSocket</h4>
                <p className="text-xs text-muted-foreground">Verifica se é possível estabelecer uma conexão WebSocket com o servidor (portas 8088/8089).</p>
              </div>
              <Button 
                variant="outline" 
                onClick={runWebsocketTest}
                disabled={loading}
              >
                {loading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <PhoneIcon className="mr-2 h-4 w-4" />}
                Testar WebSocket
              </Button>
            </div>
            
            {websocketResult && (
              <Alert variant={websocketResult.success ? "default" : "destructive"}>
                <div className="flex items-start">
                  {websocketResult.success ? 
                    <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5" /> : 
                    <AlertCircleIcon className="h-4 w-4 mr-2 mt-0.5" />
                  }
                  <div>
                    <AlertTitle>{websocketResult.success ? "Conexão WebSocket Bem-Sucedida" : "Falha na Conexão WebSocket"}</AlertTitle>
                    <AlertDescription>
                      {websocketResult.message}
                      
                      {websocketResult.diagnosticInfo && (
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem value="details">
                            <AccordionTrigger className="text-xs">Ver detalhes técnicos</AccordionTrigger>
                            <AccordionContent>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {websocketResult.diagnosticInfo}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="dns" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Teste de DNS</h4>
                <p className="text-xs text-muted-foreground">Verifica se o nome do servidor pode ser resolvido para um endereço IP.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={runDnsTest}
                disabled={loading}
              >
                {loading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <ServerIcon className="mr-2 h-4 w-4" />}
                Testar DNS
              </Button>
            </div>
            
            {dnsResult && (
              <Alert variant={dnsResult.success ? "default" : "destructive"}>
                <div className="flex items-start">
                  {dnsResult.success ? 
                    <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5" /> : 
                    <AlertCircleIcon className="h-4 w-4 mr-2 mt-0.5" />
                  }
                  <div>
                    <AlertTitle>{dnsResult.success ? "Resolução DNS Bem-Sucedida" : "Falha na Resolução DNS"}</AlertTitle>
                    <AlertDescription>
                      {dnsResult.message}
                      
                      {dnsResult.diagnosticInfo && (
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem value="details">
                            <AccordionTrigger className="text-xs">Ver detalhes técnicos</AccordionTrigger>
                            <AccordionContent>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {dnsResult.diagnosticInfo}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="full" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Teste Completo de Autenticação AMI</h4>
                <p className="text-xs text-muted-foreground">Testa a conexão TCP e autenticação no Asterisk Manager Interface.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={runFullTest}
                disabled={loading}
              >
                {loading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <ServerIcon className="mr-2 h-4 w-4" />}
                Testar AMI
              </Button>
            </div>
            
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                <div className="flex items-start">
                  {testResult.success ? 
                    <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5" /> : 
                    <AlertCircleIcon className="h-4 w-4 mr-2 mt-0.5" />
                  }
                  <div>
                    <AlertTitle>{testResult.success ? "Conexão AMI Bem-Sucedida" : "Falha na Conexão AMI"}</AlertTitle>
                    <AlertDescription>
                      {testResult.message}
                      
                      {testResult.diagnosticInfo && (
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem value="details">
                            <AccordionTrigger className="text-xs">Ver detalhes técnicos</AccordionTrigger>
                            <AccordionContent>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {testResult.diagnosticInfo}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <div className="rounded-md bg-muted p-4">
          <div className="flex flex-col space-y-1">
            <h4 className="text-sm font-medium">Dicas para Solução de Problemas</h4>
            <ul className="text-xs text-muted-foreground space-y-1 mt-2">
              <li className="flex items-start">
                <Badge variant="outline" className="mr-2 mt-0.5">TCP</Badge>
                <span>Se a conexão TCP falhar, verifique se o servidor está online e se a porta AMI (geralmente 5038) está aberta no firewall.</span>
              </li>
              <li className="flex items-start">
                <Badge variant="outline" className="mr-2 mt-0.5">WebSocket</Badge>
                <span>O softphone requer que as portas 8088 ou 8089 estejam acessíveis. Verifique as configurações do módulo WebSocket no Asterisk.</span>
              </li>
              <li className="flex items-start">
                <Badge variant="outline" className="mr-2 mt-0.5">DNS</Badge>
                <span>Se a resolução DNS falhar, verifique se o hostname está correto ou tente usar o endereço IP diretamente.</span>
              </li>
              <li className="flex items-start">
                <Badge variant="outline" className="mr-2 mt-0.5">AMI</Badge>
                <span>Se a autenticação AMI falhar, verifique se as credenciais estão corretas e configuradas no arquivo manager.conf do Asterisk.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}