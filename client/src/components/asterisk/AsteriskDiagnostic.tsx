import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, AlertTriangle, Network, Activity, PlusCircle, Server, Database, Wifi, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AsteriskDiagnostic() {
  const { toast } = useToast();
  const [host, setHost] = useState<string>("");
  const [port, setPort] = useState<string>("5038");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [customPort, setCustomPort] = useState<string>("");
  const [customPorts, setCustomPorts] = useState<string[]>([]);
  const [isTestingTcp, setIsTestingTcp] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isTestingCustom, setIsTestingCustom] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    details?: string;
    diagnosticInfo?: string;
    type?: "tcp" | "ami";
    openPorts?: number[];
  } | null>(null);

  // Status da conexão AMI
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ["/api/asterisk/status"],
    queryFn: async () => {
      const res = await fetch("/api/asterisk/status");
      if (!res.ok) throw new Error("Falha ao buscar status");
      return res.json();
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Função para adicionar porta personalizada para teste
  const handleAddCustomPort = () => {
    if (!customPort || customPorts.includes(customPort)) return;
    
    // Validar se é um número de porta válido (1-65535)
    const portNumber = parseInt(customPort);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      toast({
        title: "Erro",
        description: "Digite um número de porta válido (1-65535)",
        variant: "destructive",
      });
      return;
    }
    
    setCustomPorts([...customPorts, customPort]);
    setCustomPort("");
  };
  
  // Função para remover porta personalizada
  const handleRemoveCustomPort = (port: string) => {
    setCustomPorts(customPorts.filter(p => p !== port));
  };
  
  // Função para testar portas personalizadas
  const handleTestCustomPorts = async () => {
    if (!host || customPorts.length === 0) {
      toast({
        title: "Erro",
        description: "Preencha o host e adicione pelo menos uma porta para testar",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsTestingCustom(true);
      
      // Para cada porta, fazemos um teste TCP básico
      const openPorts: number[] = [];
      
      for (const portStr of customPorts) {
        const portNum = parseInt(portStr);
        
        try {
          const res = await apiRequest("POST", "/api/asterisk/test-connection", {
            host,
            port: portNum,
            testTcpOnly: true,
          });
          
          if (res.ok) {
            openPorts.push(portNum);
          }
        } catch (error) {
          console.error(`Erro ao testar porta ${portNum}:`, error);
        }
      }
      
      // Atualizar o resultado com as portas abertas encontradas
      setTestResult(prev => ({
        ...prev,
        openPorts,
        details: `${openPorts.length} porta(s) aberta(s) encontrada(s)`,
        message: openPorts.length > 0 
          ? `Portas abertas encontradas: ${openPorts.join(', ')}` 
          : "Nenhuma porta aberta encontrada",
        type: "tcp",
      }));
      
      toast({
        title: "Teste de portas concluído",
        description: `${openPorts.length} porta(s) aberta(s) encontrada(s)`,
        variant: openPorts.length > 0 ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Erro ao testar portas:", error);
      toast({
        title: "Erro",
        description: "Erro ao executar teste de portas personalizadas",
        variant: "destructive",
      });
    } finally {
      setIsTestingCustom(false);
    }
  };

  // Função para testar conexão TCP
  const handleTestTcp = async () => {
    if (!host || !port) {
      toast({
        title: "Campos obrigatórios",
        description: "Host e porta são obrigatórios para o teste",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTestingTcp(true);
      setTestResult(null);

      const res = await apiRequest("POST", "/api/asterisk/test-connection", {
        host,
        port: parseInt(port),
        testTcpOnly: true,
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        setTestResult({
          success: false,
          message: responseData.message || "Falha no teste TCP",
          details: responseData.details || "Não foi possível estabelecer conexão com o servidor",
          diagnosticInfo: responseData.diagnosticInfo || "",
          type: "tcp",
        });
        return;
      }

      setTestResult({
        success: true,
        message: responseData.message || "Teste TCP bem-sucedido",
        details: "A porta TCP está acessível e respondendo",
        diagnosticInfo: responseData.diagnosticInfo || "",
        type: "tcp",
      });
    } catch (error) {
      console.error("Erro ao testar TCP:", error);
      setTestResult({
        success: false,
        message: "Erro ao executar teste TCP",
        details: error instanceof Error ? error.message : String(error),
        type: "tcp",
      });
    } finally {
      setIsTestingTcp(false);
    }
  };

  // Função para testar conexão AMI
  const handleTestAmi = async () => {
    if (!host || !port || !username || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Todos os campos são obrigatórios para o teste AMI",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      const res = await apiRequest("POST", "/api/asterisk/test-connection", {
        host,
        port: parseInt(port),
        username,
        password,
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        setTestResult({
          success: false,
          message: responseData.message || "Falha na autenticação AMI",
          details: responseData.details || "Não foi possível autenticar com o servidor AMI",
          diagnosticInfo: responseData.diagnosticInfo || "",
          type: "ami",
        });
        return;
      }

      setTestResult({
        success: true,
        message: responseData.message || "Conexão AMI bem-sucedida",
        details: "As credenciais foram autenticadas com sucesso",
        diagnosticInfo: responseData.diagnosticInfo || "",
        type: "ami",
      });

    } catch (error) {
      console.error("Erro ao testar AMI:", error);
      setTestResult({
        success: false,
        message: "Erro ao executar teste AMI",
        details: error instanceof Error ? error.message : String(error),
        type: "ami",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Diagnóstico Avançado Asterisk
        </CardTitle>
        <CardDescription>
          Ferramentas avançadas para diagnóstico da conexão com o servidor Asterisk
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic" className="flex items-center gap-1">
              <Server className="h-4 w-4" /> Teste Básico
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1">
              <Activity className="h-4 w-4" /> Portscan Avançado
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="pt-4">
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Servidor</Label>
                  <Input
                    id="host"
                    placeholder="exemplo: asterisk.seudominio.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    placeholder="5038"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    placeholder="usuário AMI"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="senha AMI"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-between mt-2">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto flex items-center gap-1"
                  onClick={handleTestTcp}
                  disabled={isTestingTcp || !host || !port}
                >
                  {isTestingTcp ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Testando...
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4" /> Testar Conectividade TCP
                    </>
                  )}
                </Button>
                <Button
                  className="w-full sm:w-auto flex items-center gap-1"
                  onClick={handleTestAmi}
                  disabled={isTesting || !host || !port || !username || !password}
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Autenticando...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" /> Testar Conexão AMI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host-adv">Servidor</Label>
                  <Input
                    id="host-adv"
                    placeholder="exemplo: asterisk.seudominio.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-900">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Wifi className="h-4 w-4" /> Teste de portas personalizadas
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Adicione portas específicas para verificar se estão abertas no servidor.
                </p>
                
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Digite um número de porta"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    className="w-full sm:w-48"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPort()}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddCustomPort}
                    disabled={!customPort}
                    className="flex items-center gap-1 whitespace-nowrap"
                  >
                    <PlusCircle className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
                
                {customPorts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {customPorts.map(port => (
                      <Badge key={port} variant="secondary" className="py-1 px-2">
                        {port}
                        <button 
                          className="ml-1 text-xs opacity-70 hover:opacity-100"
                          onClick={() => handleRemoveCustomPort(port)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTestCustomPorts}
                  disabled={isTestingCustom || !host || customPorts.length === 0}
                  className="w-full"
                >
                  {isTestingCustom ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" /> Testando portas...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 mr-1" /> Verificar Portas ({customPorts.length})
                    </>
                  )}
                </Button>
              </div>
              
              {testResult?.openPorts && testResult.openPorts.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <h3 className="font-medium flex items-center gap-1 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" /> 
                    Portas Abertas Encontradas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {testResult.openPorts.map(port => (
                      <Badge key={port} className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
                        {port}
                      </Badge>
                    ))}
                  </div>
                  {testResult.openPorts.includes(5038) && (
                    <p className="text-sm mt-2 text-green-700">
                      A porta padrão do Asterisk AMI (5038) está aberta! Tente conectar usando esta porta.
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {testResult && activeTab === "basic" && (
          <div
            className={`p-3 rounded-md mt-4 ${
              testResult.success ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
            }`}
          >
            <div className="flex items-center gap-2 font-medium mb-1">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.details && <div className="text-sm opacity-80">{testResult.details}</div>}
            <div className="text-xs mt-2 opacity-70">
              Tipo de teste: {testResult.type === "tcp" ? "Conectividade TCP" : "Autenticação AMI"}
            </div>
            
            {!testResult.success && testResult.message?.includes("ECONNREFUSED") && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="font-medium text-amber-800 mb-1">Conexão Recusada - Diagnóstico:</p>
                <ul className="list-disc pl-5 space-y-1 text-amber-700">
                  <li>O servidor <strong>{host}</strong> está <strong>ativo</strong>, mas a <strong>porta {port} está fechada</strong></li>
                  <li>O serviço Asterisk pode não estar rodando ou está em uma porta diferente</li>
                  <li>O firewall pode estar bloqueando conexões na porta {port}</li>
                </ul>
                <p className="mt-2 text-xs">Confirme com o administrador do servidor se o Asterisk AMI está configurado para a porta {port} e se está habilitado para conexões externas.</p>
              </div>
            )}
            
            {!testResult.success && testResult.message?.includes("ENOTFOUND") && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="font-medium text-amber-800 mb-1">Servidor Não Encontrado - Diagnóstico:</p>
                <ul className="list-disc pl-5 space-y-1 text-amber-700">
                  <li>O nome do servidor <strong>{host}</strong> não pode ser resolvido pelo DNS</li>
                  <li>O servidor pode não existir ou o nome pode estar incorreto</li>
                </ul>
                <p className="mt-2 text-xs">Tente usar o endereço IP do servidor ao invés do nome.</p>
              </div>
            )}
            
            {!testResult.success && testResult.message?.includes("ETIMEDOUT") && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="font-medium text-amber-800 mb-1">Timeout de Conexão - Diagnóstico:</p>
                <ul className="list-disc pl-5 space-y-1 text-amber-700">
                  <li>O servidor <strong>{host}</strong> não está respondendo</li>
                  <li>Um firewall pode estar filtrando as tentativas de conexão</li>
                  <li>O servidor pode estar offline ou inacessível da sua rede</li>
                </ul>
                <p className="mt-2 text-xs">Verifique se o servidor está online e se sua rede permite acessá-lo.</p>
              </div>
            )}
            
            {testResult && testResult.message?.includes("Authentication") && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="font-medium text-amber-800 mb-1">Erro de Autenticação - Diagnóstico:</p>
                <ul className="list-disc pl-5 space-y-1 text-amber-700">
                  <li>A conexão TCP com o servidor <strong>{host}:{port}</strong> foi estabelecida com sucesso</li>
                  <li>O servidor Asterisk recusou as credenciais fornecidas</li>
                  <li>As credenciais do usuário "<strong>{username}</strong>" estão incorretas ou este usuário não tem permissão AMI</li>
                </ul>
                <p className="mt-2 text-xs">Verifique o arquivo manager.conf no servidor Asterisk para confirmar as credenciais corretas. O arquivo está normalmente em /etc/asterisk/manager.conf.</p>
              </div>
            )}
            
            {!testResult.success && !testResult.message?.includes("ECONNREFUSED") &&
              !testResult.message?.includes("ENOTFOUND") &&
              !testResult.message?.includes("ETIMEDOUT") && 
              !testResult.diagnosticInfo && !testResult.message?.includes("Authentication") && (
              <div className="mt-3 text-sm">
                <strong>Recomendações:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  {testResult.type === "tcp" && (
                    <>
                      <li>Verifique se o endereço do servidor está correto</li>
                      <li>Confirme se a porta AMI (geralmente 5038) está aberta no firewall</li>
                      <li>Verifique se o serviço Asterisk está rodando no servidor</li>
                      <li>Tente usar o endereço IP em vez do nome de domínio</li>
                    </>
                  )}
                  {testResult.type === "ami" && (
                    <>
                      <li>Confirme se as credenciais de usuário e senha AMI estão corretas</li>
                      <li>Verifique se o usuário AMI tem permissão para se conectar do seu endereço IP</li>
                      <li>Confirme se o arquivo manager.conf do Asterisk está configurado corretamente</li>
                    </>
                  )}
                </ul>
              </div>
            )}
            
            {!testResult.success && testResult.diagnosticInfo && (
              <div className="mt-3">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="diagnostics">
                    <AccordionTrigger className="text-sm font-medium">
                      Exibir diagnóstico técnico detalhado
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono whitespace-pre-wrap overflow-auto max-h-80">
                        {testResult.diagnosticInfo}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}