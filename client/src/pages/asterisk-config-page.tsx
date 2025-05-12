import { useState, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  PhoneForwarded, 
  PhoneIncoming, 
  Phone, 
  Settings, 
  Save, 
  Plus, 
  Trash2,
  ArrowRight,
  Clock,
  MessageSquare,
  Voicemail
} from "lucide-react";

// Schema para validação do formulário de configuração do Asterisk
const asteriskConfigSchema = z.object({
  serverAddress: z.string().min(1, "Endereço do servidor é obrigatório"),
  port: z.string().regex(/^\d+$/, "Porta deve ser um número").optional(),
  username: z.string().min(1, "Nome de usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  context: z.string().optional(),
  enabled: z.boolean().default(false),
});

type AsteriskConfigFormValues = z.infer<typeof asteriskConfigSchema>;

// Schema para o plano de discagem
const dialPlanNextStepSchema = z.object({
  stepId: z.string(),
  condition: z.string().optional(),
  label: z.string().optional()
});

const dialPlanStepSchema = z.object({
  id: z.string(),
  type: z.enum(["answer", "playback", "dial", "voicemail", "hangup", "wait", "gotoif", "set"]),
  parameters: z.record(z.string(), z.string()).optional(),
  nextSteps: z.array(dialPlanNextStepSchema).optional(),
  label: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

type DialPlanStep = z.infer<typeof dialPlanStepSchema>;

export default function AsteriskConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("server");
  const [dialPlanSteps, setDialPlanSteps] = useState<DialPlanStep[]>([
    {
      id: "start",
      type: "answer",
      label: "Atender Chamada",
      x: 100,
      y: 50,
      nextSteps: [{ stepId: "greeting", label: "Continuar" }]
    },
    {
      id: "greeting",
      type: "playback",
      parameters: { file: "bem-vindo" },
      label: "Reproduzir Saudação",
      x: 100,
      y: 150,
      nextSteps: [{ stepId: "menu", label: "Continuar" }]
    },
    {
      id: "menu",
      type: "playback",
      parameters: { file: "menu-options" },
      label: "Menu de Opções",
      x: 100,
      y: 250,
      nextSteps: [
        { stepId: "dial", condition: "${OPCAO}=1", label: "Opção 1" },
        { stepId: "voicemail", condition: "${OPCAO}=2", label: "Opção 2" }
      ]
    },
    {
      id: "dial",
      type: "dial",
      parameters: { extension: "100", timeout: "20" },
      label: "Discar para Ramal",
      x: 300,
      y: 350
    },
    {
      id: "voicemail",
      type: "voicemail",
      parameters: { mailbox: "100" },
      label: "Caixa Postal",
      x: 100,
      y: 350
    }
  ]);
  
  const [selectedStep, setSelectedStep] = useState<DialPlanStep | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected" | "testing">("disconnected");
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  // Carregar configuração existente
  const { data: configData, isLoading } = useQuery({
    queryKey: ["/api/asterisk/config"],
    enabled: false, // Desativado por enquanto, habilitar quando a API estiver disponível
  });

  // Formulário de configuração
  const form = useForm<AsteriskConfigFormValues>({
    resolver: zodResolver(asteriskConfigSchema),
    defaultValues: {
      serverAddress: "",
      port: "5060",
      username: "",
      password: "",
      context: "default",
      enabled: false,
    },
  });

  // Mutação para salvar configuração
  const configMutation = useMutation({
    mutationFn: async (data: AsteriskConfigFormValues) => {
      // Será implementado quando a API estiver disponível
      const response = await apiRequest("POST", "/api/asterisk/config", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações do Asterisk foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/asterisk/config"] });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar configuração",
        description: "Não foi possível salvar as configurações. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para salvar plano de discagem
  const dialPlanMutation = useMutation({
    mutationFn: async (steps: DialPlanStep[]) => {
      // Será implementado quando a API estiver disponível
      const response = await apiRequest("POST", "/api/asterisk/dialplan", { steps });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plano de discagem salvo",
        description: "O plano de discagem foi salvo com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar plano de discagem",
        description: "Não foi possível salvar o plano de discagem. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Testar conexão com o Asterisk
  const testConnection = async () => {
    setConnectionStatus("testing");
    try {
      // Será implementado quando a API estiver disponível
      await apiRequest("POST", "/api/asterisk/test", form.getValues());
      setConnectionStatus("connected");
      toast({
        title: "Conexão estabelecida",
        description: "A conexão com o servidor Asterisk foi estabelecida com sucesso.",
      });
    } catch (error) {
      setConnectionStatus("disconnected");
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar ao servidor Asterisk. Verifique as configurações.",
        variant: "destructive",
      });
    }
  };

  // Adicionar novo passo ao plano de discagem
  const addDialPlanStep = (type: DialPlanStep["type"]) => {
    // Calcular posição para o novo passo
    const lastStep = dialPlanSteps[dialPlanSteps.length - 1];
    const x = lastStep?.x || 100;
    const y = (lastStep?.y || 0) + 100;
    
    const newStep: DialPlanStep = {
      id: `step-${Date.now()}`,
      type,
      label: getDefaultLabel(type),
      parameters: getDefaultParameters(type),
      x,
      y,
      nextSteps: [],
    };
    
    setDialPlanSteps([...dialPlanSteps, newStep]);
    setSelectedStep(newStep);
  };

  // Remover passo do plano de discagem
  const removeDialPlanStep = (id: string) => {
    // Remover o passo
    const updatedSteps = dialPlanSteps.filter(step => step.id !== id);
    
    // Remover referências a esse passo em nextSteps de outros passos
    const cleanedSteps = updatedSteps.map(step => {
      if (step.nextSteps && step.nextSteps.length > 0) {
        return {
          ...step,
          nextSteps: step.nextSteps.filter(next => next.stepId !== id)
        };
      }
      return step;
    });
    
    setDialPlanSteps(cleanedSteps);
    
    // Desselecionar se o passo removido estava selecionado
    if (selectedStep?.id === id) {
      setSelectedStep(null);
    }
  };

  // Atualizar um passo existente
  const updateDialPlanStep = (updatedStep: DialPlanStep) => {
    setDialPlanSteps(dialPlanSteps.map(step => 
      step.id === updatedStep.id ? updatedStep : step
    ));
  };

  // Adicionar uma conexão entre dois passos
  const addConnection = (fromStepId: string, toStepId: string, condition?: string, label?: string) => {
    const fromStep = dialPlanSteps.find(step => step.id === fromStepId);
    
    if (!fromStep) return;
    
    const newConnection = {
      stepId: toStepId,
      condition,
      label: label || (condition ? `Se ${condition}` : 'Continuar')
    };
    
    const updatedFromStep = {
      ...fromStep,
      nextSteps: [...(fromStep.nextSteps || []), newConnection]
    };
    
    updateDialPlanStep(updatedFromStep);
  };
  
  // Remover uma conexão entre dois passos
  const removeConnection = (fromStepId: string, toStepId: string) => {
    const fromStep = dialPlanSteps.find(step => step.id === fromStepId);
    
    if (!fromStep || !fromStep.nextSteps) return;
    
    const updatedFromStep = {
      ...fromStep,
      nextSteps: fromStep.nextSteps.filter(next => next.stepId !== toStepId)
    };
    
    updateDialPlanStep(updatedFromStep);
  };

  // Salvar plano de discagem
  const saveDialPlan = () => {
    dialPlanMutation.mutate(dialPlanSteps);
  };

  // Obter rótulo padrão para um tipo de passo
  const getDefaultLabel = (type: DialPlanStep["type"]): string => {
    const labels: Record<DialPlanStep["type"], string> = {
      answer: "Atender Chamada",
      playback: "Reproduzir Áudio",
      dial: "Discar",
      voicemail: "Caixa Postal",
      hangup: "Encerrar Chamada",
      wait: "Aguardar",
      gotoif: "Condição",
      set: "Definir Variável"
    };
    return labels[type];
  };

  // Obter parâmetros padrão para um tipo de passo
  const getDefaultParameters = (type: DialPlanStep["type"]): Record<string, string> | undefined => {
    switch (type) {
      case "playback":
        return { file: "bem-vindo" };
      case "dial":
        return { extension: "100", timeout: "20" };
      case "wait":
        return { seconds: "5" };
      case "voicemail":
        return { mailbox: "100" };
      case "set":
        return { variable: "DESTINO", value: "100" };
      case "gotoif":
        return { expression: "${COND}=1", destination: "true" };
      default:
        return undefined;
    }
  };

  // Renderizar os parâmetros específicos para cada tipo de passo
  const renderStepParameters = () => {
    if (!selectedStep) return null;

    switch (selectedStep.type) {
      case "playback":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Arquivo de Áudio</label>
              <Input 
                placeholder="Nome do arquivo" 
                value={selectedStep.parameters?.file || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      file: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
              <p className="text-sm text-neutral-500 mt-1">
                Nome do arquivo de áudio a ser reproduzido
              </p>
            </div>
          </div>
        );
      
      case "dial":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ramal</label>
              <Input 
                placeholder="Número do ramal" 
                value={selectedStep.parameters?.extension || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      extension: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tempo limite (segundos)</label>
              <Input 
                placeholder="20" 
                value={selectedStep.parameters?.timeout || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      timeout: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
            </div>
          </div>
        );
      
      case "wait":
        return (
          <div>
            <label className="text-sm font-medium">Segundos</label>
            <Input 
              placeholder="5" 
              value={selectedStep.parameters?.seconds || ""} 
              onChange={(e) => {
                const updated = { 
                  ...selectedStep, 
                  parameters: { 
                    ...selectedStep.parameters, 
                    seconds: e.target.value 
                  } 
                };
                updateDialPlanStep(updated);
              }}
              className="mt-1"
            />
          </div>
        );
        
      case "voicemail":
        return (
          <div>
            <label className="text-sm font-medium">Caixa Postal</label>
            <Input 
              placeholder="Número da caixa postal" 
              value={selectedStep.parameters?.mailbox || ""} 
              onChange={(e) => {
                const updated = { 
                  ...selectedStep, 
                  parameters: { 
                    ...selectedStep.parameters, 
                    mailbox: e.target.value 
                  } 
                };
                updateDialPlanStep(updated);
              }}
              className="mt-1"
            />
          </div>
        );
      
      case "set":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Variável</label>
              <Input 
                placeholder="Nome da variável" 
                value={selectedStep.parameters?.variable || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      variable: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Valor</label>
              <Input 
                placeholder="Valor" 
                value={selectedStep.parameters?.value || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      value: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
            </div>
          </div>
        );
      
      case "gotoif":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Expressão</label>
              <Input 
                placeholder="${COND}=1" 
                value={selectedStep.parameters?.expression || ""} 
                onChange={(e) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      expression: e.target.value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
                className="mt-1"
              />
              <p className="text-sm text-neutral-500 mt-1">
                Condição para avaliação (ex: ${"{COND}=1"})
              </p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-sm text-neutral-500">
            Este passo não requer parâmetros adicionais.
          </div>
        );
    }
  };

  // Obter ícone para um tipo de passo
  const getStepIcon = (type: DialPlanStep["type"]) => {
    switch (type) {
      case "answer":
        return <PhoneIncoming className="h-5 w-5" />;
      case "playback":
        return <MessageSquare className="h-5 w-5" />;
      case "dial":
        return <Phone className="h-5 w-5" />;
      case "voicemail":
        return <Voicemail className="h-5 w-5" />;
      case "hangup":
        return <PhoneForwarded className="h-5 w-5" />;
      case "wait":
        return <Clock className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  // Renderização do componente
  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Configuração do Asterisk</h2>
        <p className="text-sm text-neutral-500">Configure a integração com o Asterisk e os planos de discagem.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-6">
          <TabsTrigger value="server">Configuração do Servidor</TabsTrigger>
          <TabsTrigger value="dialplan">Plano de Discagem (WYSIWYG)</TabsTrigger>
        </TabsList>

        <TabsContent value="server" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Servidor Asterisk</CardTitle>
              <CardDescription>
                Configure os parâmetros de conexão com o servidor Asterisk.
              </CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => configMutation.mutate(data))}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="serverAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço do Servidor</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Porta</FormLabel>
                          <FormControl>
                            <Input placeholder="5060" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="admin" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="context"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contexto</FormLabel>
                        <FormControl>
                          <Input placeholder="default" {...field} />
                        </FormControl>
                        <FormDescription>
                          Contexto padrão para planos de discagem
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Ativar integração</FormLabel>
                          <FormDescription>
                            Ative ou desative a integração com o Asterisk.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    type="button"
                    onClick={testConnection}
                    variant="outline"
                    disabled={configMutation.isPending || connectionStatus === "testing"}
                  >
                    {connectionStatus === "testing" ? "Testando..." : "Testar Conexão"}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={configMutation.isPending}
                  >
                    {configMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>

        <TabsContent value="dialplan" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Passos Disponíveis</CardTitle>
                  <CardDescription>
                    Arraste e solte os componentes para criar seu plano de discagem.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => addDialPlanStep("answer")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <PhoneIncoming className="h-4 w-4 mr-2" />
                      Atender Chamada
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("playback")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Reproduzir Áudio
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("dial")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Discar
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("voicemail")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Voicemail className="h-4 w-4 mr-2" />
                      Caixa Postal
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("wait")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Aguardar
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("hangup")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <PhoneForwarded className="h-4 w-4 mr-2" />
                      Encerrar Chamada
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("gotoif")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Condição
                    </Button>
                    <Button 
                      onClick={() => addDialPlanStep("set")} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Definir Variável
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Propriedades do passo selecionado */}
              {selectedStep && (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Propriedades</CardTitle>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => removeDialPlanStep(selectedStep.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Rótulo</label>
                      <Input 
                        placeholder="Rótulo do passo" 
                        value={selectedStep.label || ""} 
                        onChange={(e) => {
                          const updated = { ...selectedStep, label: e.target.value };
                          updateDialPlanStep(updated);
                        }} 
                        className="mt-1"
                      />
                    </div>
                    
                    <Separator />
                    
                    {renderStepParameters()}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Área de desenho do plano de discagem */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Plano de Discagem</CardTitle>
                    <Button onClick={saveDialPlan}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Plano
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    ref={diagramRef} 
                    className="min-h-[500px] border rounded-md p-4 relative bg-neutral-50"
                  >
                    <div className="flex flex-col gap-4">
                      {dialPlanSteps.map((step, index) => (
                        <div 
                          key={step.id}
                          className={`
                            flex items-center gap-2 p-3 bg-white border rounded-md shadow-sm
                            ${selectedStep?.id === step.id ? 'ring-2 ring-primary' : ''}
                            cursor-pointer transition-all hover:shadow-md
                          `}
                          onClick={() => setSelectedStep(step)}
                        >
                          <div className="flex-shrink-0 h-8 w-8 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                            {getStepIcon(step.type)}
                          </div>
                          <div className="flex-grow">
                            <div className="font-medium">{step.label || getDefaultLabel(step.type)}</div>
                            <div className="text-xs text-neutral-500">
                              {step.type === "dial" && step.parameters?.extension && (
                                <>Ramal: {step.parameters.extension}</>
                              )}
                              {step.type === "playback" && step.parameters?.file && (
                                <>Arquivo: {step.parameters.file}</>
                              )}
                              {step.type === "wait" && step.parameters?.seconds && (
                                <>{step.parameters.seconds} segundos</>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-6">
                            {index < dialPlanSteps.length - 1 && (
                              <div className="absolute left-1/2 transform -translate-x-1/2 mt-3 w-px h-4 bg-gray-300"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}