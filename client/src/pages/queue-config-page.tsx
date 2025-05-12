import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCheck, FileQuestion, MoveRight, Phone, PhoneCall, PhoneForwarded } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MainLayout } from "@/components/layout/main-layout";
import AsteriskConnect from "@/components/asterisk/AsteriskConnect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AsteriskConnectionStatus {
  connected: boolean;
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
  message?: string;
}

export default function QueueConfigPage() {
  const { data: status, isLoading } = useQuery<AsteriskConnectionStatus>({
    queryKey: ["/api/asterisk/status"],
    refetchInterval: 10000,
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Filas de Atendimento</h1>
            <p className="text-muted-foreground">
              Gerencie suas filas de atendimento e configure o Asterisk
            </p>
          </div>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="mb-4 grid grid-cols-3 w-[400px]">
            <TabsTrigger value="connection">Conexão</TabsTrigger>
            <TabsTrigger value="queues" disabled={!status?.connected}>Filas</TabsTrigger>
            <TabsTrigger value="agents" disabled={!status?.connected}>Agentes</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <AsteriskConnect />
            
            {status?.connected && (
              <Alert>
                <CheckCheck className="h-4 w-4" />
                <AlertTitle>Conexão estabelecida!</AlertTitle>
                <AlertDescription>
                  O sistema está conectado ao servidor Asterisk. Agora você pode gerenciar filas e agentes.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="p-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Phone className="h-5 w-5 mr-2 text-primary" />
                    Conexão com Asterisk
                  </CardTitle>
                </CardHeader>
                <p className="text-sm text-muted-foreground">
                  Configure a conexão com o servidor Asterisk para monitorar e gerenciar filas de atendimento.
                </p>
              </Card>
              
              <Card className="p-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <PhoneCall className="h-5 w-5 mr-2 text-primary" />
                    Filas de Atendimento
                  </CardTitle>
                </CardHeader>
                <p className="text-sm text-muted-foreground">
                  Configure estratégias de distribuição, timeouts, anúncios e outras configurações para suas filas.
                </p>
              </Card>
              
              <Card className="p-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <PhoneForwarded className="h-5 w-5 mr-2 text-primary" />
                    Gestão de Agentes
                  </CardTitle>
                </CardHeader>
                <p className="text-sm text-muted-foreground">
                  Adicione, remova e configure agentes para suas filas de atendimento.
                </p>
              </Card>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">Perguntas Frequentes</h3>
              <Separator className="mb-4" />
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-medium flex items-center">
                    <FileQuestion className="h-4 w-4 mr-2 text-muted-foreground" />
                    O que é o Asterisk AMI?
                  </h4>
                  <p className="text-sm text-muted-foreground ml-6 mt-1">
                    Asterisk Manager Interface (AMI) é uma interface de controle que permite gerenciar remotamente um servidor Asterisk,
                    monitorar eventos e executar ações como pausar agentes ou monitorar filas.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-base font-medium flex items-center">
                    <FileQuestion className="h-4 w-4 mr-2 text-muted-foreground" />
                    Preciso ter um servidor Asterisk?
                  </h4>
                  <p className="text-sm text-muted-foreground ml-6 mt-1">
                    Sim, você precisa ter acesso a um servidor Asterisk com o AMI habilitado. Configure as permissões
                    no arquivo manager.conf do Asterisk para permitir acesso ao ProConnect CRM.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-base font-medium flex items-center">
                    <FileQuestion className="h-4 w-4 mr-2 text-muted-foreground" />
                    Como configurar o AMI no Asterisk?
                  </h4>
                  <p className="text-sm text-muted-foreground ml-6 mt-1">
                    Edite o arquivo <code>manager.conf</code> no seu servidor Asterisk e adicione um usuário com permissões
                    adequadas. Exemplo:
                  </p>
                  <pre className="bg-secondary p-2 rounded-md text-xs mt-2 ml-6">
{`[proconnect]
secret=senhaamicomplexaseconfirme
read=system,call,agent
write=system,call,agent,command`}
                  </pre>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="queues" className="space-y-4">
            {!status?.connected ? (
              <div className="flex flex-col items-center justify-center p-8">
                <p className="text-center text-muted-foreground mb-4">
                  Conecte-se ao servidor Asterisk primeiro para gerenciar filas.
                </p>
                <Button variant="outline" onClick={() => {
                  const element = document.querySelector('[data-value="connection"]') as HTMLElement;
                  if (element) element.click();
                }}>
                  Ir para configuração de conexão <MoveRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <div className="p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Configuração de filas em implementação...</h3>
                  <p className="mb-4">Esta página de configuração técnica ainda está em desenvolvimento.</p>
                  <Alert className="bg-blue-50">
                    <AlertTitle>Dica: Use a página de Filas!</AlertTitle>
                    <AlertDescription>
                      Para gerenciar suas filas de atendimento (criar, editar, excluir), acesse a página 
                      <Button variant="link" className="px-1 text-primary" onClick={() => window.location.href="/queues"}>
                        Filas
                      </Button> 
                      no menu lateral.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            {!status?.connected ? (
              <div className="flex flex-col items-center justify-center p-8">
                <p className="text-center text-muted-foreground mb-4">
                  Conecte-se ao servidor Asterisk primeiro para gerenciar agentes.
                </p>
                <Button variant="outline" onClick={() => {
                  const element = document.querySelector('[data-value="connection"]') as HTMLElement;
                  if (element) element.click();
                }}>
                  Ir para configuração de conexão <MoveRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <div className="p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Configuração de agentes em implementação...</h3>
                  <p className="mb-4">Esta página de configuração técnica ainda está em desenvolvimento.</p>
                  <Alert className="bg-blue-50">
                    <AlertTitle>Dica: Use a página de Filas!</AlertTitle>
                    <AlertDescription>
                      Para gerenciar seus agentes, acesse a página 
                      <Button variant="link" className="px-1 text-primary" onClick={() => window.location.href="/queues"}>
                        Filas
                      </Button> 
                      no menu lateral e utilize a aba "Agentes".
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}