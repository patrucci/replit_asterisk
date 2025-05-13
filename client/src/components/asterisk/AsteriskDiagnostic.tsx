import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Circle, AlertTriangle, Network, Activity, PlusCircle, Server, Database, Wifi } from "lucide-react";
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
        testTcpOnly: false,
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        setTestResult({
          success: false,
          message: responseData.message || "Falha no teste AMI",
          details: responseData.details || "Não foi possível autenticar no servidor Asterisk",
          diagnosticInfo: responseData.diagnosticInfo || "",
          type: "ami",
        });
        return;
      }

      setTestResult({
        success: true,
        message: responseData.message || "Teste AMI bem-sucedido",
        details: "A conexão AMI foi estabelecida com sucesso",
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
          Diagnóstico de Conexão Asterisk
        </CardTitle>
        <CardDescription>
          Ferramentas para diagnóstico da conexão com o servidor Asterisk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="host">Host do Servidor</Label>
          <Input
            id="host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="Endereço IP ou domínio"
          />
        </div>
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="port">Porta AMI</Label>
          <Input
            id="port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="5038"
          />
        </div>
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="username">Usuário AMI</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuário do Asterisk Manager Interface"
          />
        </div>
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="password">Senha AMI</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do AMI"
          />
        </div>

        {/* Status do Servidor */}
        <div className="bg-muted p-3 rounded-md">
          <div className="font-medium mb-2">Status Atual da Conexão</div>
          <div className="flex items-center gap-2">
            {isStatusLoading ? (
              <Circle className="h-4 w-4 animate-pulse text-muted-foreground" />
            ) : statusData?.connected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <span>
              {isStatusLoading
                ? "Verificando status..."
                : statusData?.connected
                ? "Conectado ao servidor Asterisk"
                : "Desconectado do servidor Asterisk"}
            </span>
          </div>
        </div>

        {/* Resultado do Teste */}
        {testResult && (
          <div
            className={`p-3 rounded-md ${
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
            
            {!testResult.success && testResult.diagnosticInfo && (
              <div className="mt-3">
                <details className="cursor-pointer">
                  <summary className="font-medium text-sm">
                    Exibir diagnóstico técnico detalhado
                  </summary>
                  <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60">
                    {testResult.diagnosticInfo}
                  </div>
                </details>
              </div>
            )}
            
            {!testResult.success && !testResult.message?.includes("ECONNREFUSED") &&
              !testResult.message?.includes("ENOTFOUND") &&
              !testResult.message?.includes("ETIMEDOUT") && 
              !testResult.diagnosticInfo && (
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
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-between">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleTestTcp}
          disabled={isTestingTcp || !host || !port}
        >
          {isTestingTcp ? "Testando..." : "Testar Conectividade TCP"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={handleTestAmi}
          disabled={isTesting || !host || !port || !username || !password}
        >
          {isTesting ? "Testando..." : "Testar Conexão AMI"}
        </Button>
      </CardFooter>
    </Card>
  );
}