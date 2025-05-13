import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ConnectionCheck {
  type: string;
  success: boolean;
  message: string;
  diagnosticInfo?: string;
  details?: any;
}

export function AsteriskConnectionStatus({ 
  host = "voip.lansolver.com", 
  onSuccess 
}: {
  host?: string,
  onSuccess?: () => void
}) {
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<ConnectionCheck[]>([]);
  const [overallStatus, setOverallStatus] = useState<'success'|'error'|'warning'|'unknown'>('unknown');
  const [fullDiagnostic, setFullDiagnostic] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setChecks([]);
    setOverallStatus('unknown');
    setFullDiagnostic(null);

    try {
      // 1. Verificar resolução de DNS
      try {
        const dnsCheck = await checkDns(host);
        setChecks(prev => [...prev, dnsCheck]);

        // 2. Verificar portas WebSocket
        if (dnsCheck.success) {
          const wsCheck = await checkWebSocket(host);
          setChecks(prev => [...prev, wsCheck]);

          // 3. Verificar porta AMI
          const amiCheck = await checkAmi(host);
          setChecks(prev => [...prev, amiCheck]);

          // Determinar status geral
          updateOverallStatus([dnsCheck, wsCheck, amiCheck]);
        } else {
          setOverallStatus('error');
        }
      } catch (error) {
        console.error("Erro ao executar diagnósticos:", error);
        setChecks(prev => [...prev, {
          type: "geral",
          success: false,
          message: "Erro ao executar diagnósticos",
          diagnosticInfo: error instanceof Error ? error.message : String(error)
        }]);
        setOverallStatus('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkDns = async (host: string): Promise<ConnectionCheck> => {
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-dns", { host });
      const data = await res.json();
      
      return {
        type: "dns",
        success: data.success,
        message: data.message,
        diagnosticInfo: data.error || data.diagnosticInfo,
        details: data
      };
    } catch (error) {
      return {
        type: "dns",
        success: false,
        message: "Falha ao verificar DNS",
        diagnosticInfo: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const checkWebSocket = async (host: string): Promise<ConnectionCheck> => {
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-websocket", { 
        host,
        ports: [8088, 8089],
        timeout: 5000
      });
      const data = await res.json();
      
      return {
        type: "websocket",
        success: data.success,
        message: data.message,
        diagnosticInfo: data.diagnosticInfo,
        details: data
      };
    } catch (error) {
      return {
        type: "websocket",
        success: false,
        message: "Falha ao verificar WebSocket",
        diagnosticInfo: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const checkAmi = async (host: string): Promise<ConnectionCheck> => {
    try {
      const res = await apiRequest("POST", "/api/asterisk/test-tcp-connection", { 
        host,
        port: 5038,
        timeout: 5000
      });
      const data = await res.json();
      
      return {
        type: "ami",
        success: data.success,
        message: data.message,
        diagnosticInfo: data.diagnosticInfo,
        details: data
      };
    } catch (error) {
      return {
        type: "ami",
        success: false,
        message: "Falha ao verificar AMI",
        diagnosticInfo: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const updateOverallStatus = (checks: ConnectionCheck[]) => {
    const allSuccess = checks.every(check => check.success);
    const allFailed = checks.every(check => !check.success);
    
    if (allSuccess) {
      setOverallStatus('success');
      if (onSuccess) onSuccess();
    } else if (allFailed) {
      setOverallStatus('error');
    } else {
      setOverallStatus('warning');
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [host]);
  
  const getStatusMessages = () => {
    const dnsCheck = checks.find(c => c.type === 'dns');
    const wsCheck = checks.find(c => c.type === 'websocket');
    const amiCheck = checks.find(c => c.type === 'ami');
    
    let title = "Verificando conectividade...";
    let description = "Aguarde enquanto verificamos a conexão com o servidor Asterisk.";
    let icon = <RefreshCw className="h-5 w-5 animate-spin" />;
    let recommendations: string[] = [];
    
    if (!loading && checks.length > 0) {
      if (overallStatus === 'success') {
        title = "Servidor Asterisk acessível";
        description = "Todas as verificações foram bem-sucedidas. Seu servidor Asterisk está online e configurado corretamente.";
        icon = <CheckCircle className="h-5 w-5 text-green-500" />;
      } else if (overallStatus === 'error') {
        title = "Servidor Asterisk inacessível";
        description = "Não foi possível conectar ao servidor Asterisk. Verifique se o servidor está rodando e acessível.";
        icon = <AlertCircle className="h-5 w-5 text-red-500" />;
        
        // Adicionar recomendações
        if (dnsCheck && !dnsCheck.success) {
          recommendations.push("O nome do servidor não pôde ser resolvido. Verifique se o nome de domínio está correto ou use um endereço IP.");
        }
        
        if (amiCheck && !amiCheck.success) {
          recommendations.push("A porta AMI (5038) está fechada ou bloqueada. Verifique se o serviço Asterisk está rodando e se a porta 5038 está liberada no firewall.");
        }
        
        if (wsCheck && !wsCheck.success) {
          recommendations.push("As portas WebSocket (8088/8089) não estão acessíveis. Verifique se o módulo HTTP do Asterisk está habilitado e configurado para WebSocket.");
        }
      } else if (overallStatus === 'warning') {
        title = "Conectividade parcial com Asterisk";
        description = "Algumas verificações falharam. O servidor pode estar parcialmente acessível.";
        icon = <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        
        if (amiCheck && !amiCheck.success) {
          recommendations.push("A porta AMI (5038) está fechada. Verifique se o serviço Asterisk está rodando e se a porta 5038 está aberta no firewall.");
        }
        
        if (wsCheck && !wsCheck.success) {
          recommendations.push("As portas WebSocket (8088/8089) não estão acessíveis. Verifique se o módulo HTTP do Asterisk está habilitado com suporte a WebSocket.");
        }
      }
    }
    
    return { title, description, icon, recommendations };
  };
  
  const { title, description, icon, recommendations } = getStatusMessages();
  
  return (
    <Card className="w-full border-2 border-muted">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={runDiagnostics} 
            disabled={loading}
            className="h-8 px-2 flex gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        {recommendations.length > 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Recomendações</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-3">
          {!loading ? (
            checks.map((check, index) => (
              <div key={index} className="flex items-start gap-2">
                {check.success ? 
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" /> : 
                  <AlertCircle className="h-4 w-4 mt-0.5 text-red-500" />
                }
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {check.type === 'dns' && 'Verificação de DNS'}
                    {check.type === 'websocket' && 'Verificação de WebSocket (8088/8089)'}
                    {check.type === 'ami' && 'Verificação de AMI (5038)'}
                    {check.type === 'geral' && 'Verificação geral'}
                  </p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                  
                  {check.diagnosticInfo && (
                    <Accordion type="single" collapsible className="mt-1">
                      <AccordionItem value="diag">
                        <AccordionTrigger className="py-1 text-xs">Ver detalhes</AccordionTrigger>
                        <AccordionContent>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {check.diagnosticInfo}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-60" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
      
      {!loading && (
        <CardFooter className="pt-0 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Servidor: <span className="font-mono">{host}</span>
          </div>
          <Button 
            variant="link" 
            size="sm" 
            asChild
            className="px-0 h-auto"
          >
            <a href="/diagnostico" target="_blank" rel="noopener noreferrer">
              <span className="flex items-center gap-1">
                Diagnóstico avançado
                <ExternalLink className="ml-1 h-3 w-3" />
              </span>
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}