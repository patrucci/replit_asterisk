import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Circle, AlertTriangle, Network } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AsteriskDiagnostic() {
  const { toast } = useToast();
  const [host, setHost] = useState<string>("");
  const [port, setPort] = useState<string>("5038");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isTestingTcp, setIsTestingTcp] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    details?: string;
    type?: "tcp" | "ami";
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

      if (!res.ok) {
        const errorData = await res.json();
        setTestResult({
          success: false,
          message: errorData.message || "Falha no teste TCP",
          details: errorData.details,
          type: "tcp",
        });
        return;
      }

      const data = await res.json();
      setTestResult({
        success: true,
        message: data.message || "Teste TCP bem-sucedido",
        details: "A porta TCP está acessível e respondendo",
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

      if (!res.ok) {
        const errorData = await res.json();
        setTestResult({
          success: false,
          message: errorData.message || "Falha no teste AMI",
          details: errorData.details,
          type: "ami",
        });
        return;
      }

      const data = await res.json();
      setTestResult({
        success: true,
        message: data.message || "Teste AMI bem-sucedido",
        details: "A conexão AMI foi estabelecida com sucesso",
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
            
            {!testResult.success && (
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