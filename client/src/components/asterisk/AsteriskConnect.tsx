import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface AsteriskConnectionStatus {
  connected: boolean;
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
  message?: string;
}

interface AsteriskConnectionSettings {
  host: string;
  port: string;
  username: string;
  password: string;
}

export default function AsteriskConnect() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<AsteriskConnectionSettings>({
    host: "",
    port: "5038",
    username: "",
    password: ""
  });
  
  // Carregar status da conexão
  const { data: status, isLoading: isStatusLoading } = useQuery<AsteriskConnectionStatus>({
    queryKey: ["/api/asterisk/status"],
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });
  
  // Buscar configurações existentes do servidor
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/asterisk/config');
        const data = await response.json();
        
        // Se houver configurações, preencher o formulário
        if (data?.configured && data.host) {
          setSettings({
            host: data.host || "",
            port: String(data.port || "5038"),
            username: data.username || "",
            password: "" // Nunca preencher a senha
          });
        }
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
      }
    };

    // Buscar configurações apenas se o status indicar que está configurado
    if (status?.configured) {
      fetchConfig();
    }
  }, [status]);
  
  // Mutação para conectar ao Asterisk
  const connectMutation = useMutation({
    mutationFn: async (data: AsteriskConnectionSettings) => {
      const response = await apiRequest("POST", "/api/asterisk/connect", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Conectado com sucesso",
        description: "A conexão com o Asterisk AMI foi estabelecida.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/asterisk/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro de conexão",
        description: `Não foi possível conectar ao Asterisk: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Teste de conexão
  const testMutation = useMutation({
    mutationFn: async (data: AsteriskConnectionSettings) => {
      const response = await apiRequest("POST", "/api/asterisk/test-connection", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Teste de conexão",
        description: data.message || "Teste concluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no teste",
        description: `Não foi possível testar a conexão: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };
  
  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate(settings);
  };
  
  const handleTest = (e: React.MouseEvent) => {
    e.preventDefault();
    testMutation.mutate(settings);
  };
  
  const isFormValid = settings.host && settings.port && settings.username && settings.password;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configuração do Asterisk AMI</CardTitle>
        <CardDescription>
          Configure a conexão com o Asterisk Manager Interface para monitorar filas
        </CardDescription>
        {!isStatusLoading && status && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span>Status:</span>
            {status.connected ? (
              <span className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" /> Conectado
              </span>
            ) : (
              <span className="flex items-center text-red-600">
                <XCircle className="h-4 w-4 mr-1" /> Desconectado
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Servidor</Label>
              <Input
                id="host"
                name="host"
                placeholder="Endereço do servidor Asterisk"
                value={settings.host}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                name="port"
                placeholder="Porta do AMI"
                value={settings.port}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                placeholder="Usuário do AMI"
                value={settings.username}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Senha do AMI"
                value={settings.password}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <p>Nota: Estas configurações serão utilizadas para monitorar filas e agentes no Asterisk.</p>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTest}
          disabled={!isFormValid || testMutation.isPending}
        >
          {testMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            "Testar Conexão"
          )}
        </Button>
        <Button 
          type="submit"
          onClick={handleConnect}
          disabled={!isFormValid || connectMutation.isPending}
        >
          {connectMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Conectando...
            </>
          ) : (
            "Conectar"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}