import { useState, useRef, useEffect } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AsteriskConnect from "@/components/asterisk/AsteriskConnect";
import AsteriskDiagnostic from "@/components/asterisk/AsteriskDiagnostic";
import { 
  PhoneForwarded, 
  PhoneIncoming, 
  Phone, 
  Settings, 
  Save, 
  Plus, 
  Trash2,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  MessageSquare,
  Voicemail,
  CheckCheck,
  FileQuestion,
  Server,
  Upload,
  File,
  Music,
  ListMusic,
  Folder,
  Volume2
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

interface AsteriskConnectionStatus {
  connected: boolean;
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
  message?: string;
}

interface AudioFile {
  id: string;
  name: string;
  filename: string;
  duration?: number;
  size?: number;
  uploaded?: string;
  language?: string;
}

export default function AsteriskConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connection");
  
  // Carregar status da conexão
  const { data: status, isLoading: isStatusLoading } = useQuery<AsteriskConnectionStatus>({
    queryKey: ["/api/asterisk/status"],
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });
  
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
  
  // Estados para gerenciamento de arquivos de áudio
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<AudioFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  // Função para carregar os arquivos de áudio disponíveis
  useEffect(() => {
    loadAudioFiles();
  }, []);
  
  // Funções para gerenciamento de arquivos de áudio
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione apenas arquivos de áudio (wav, mp3, gsm, etc).",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('audioFile', file);
    formData.append('name', file.name.split('.')[0]); // Nome sem extensão
    
    setUploadingFile(true);
    
    try {
      // Esta API precisará ser implementada no backend
      const response = await fetch('/api/asterisk/audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Falha ao enviar o arquivo');
      }
      
      const result = await response.json();
      
      toast({
        title: "Arquivo enviado com sucesso",
        description: `O arquivo ${file.name} foi enviado e está disponível para uso no IVR.`,
      });
      
      // Atualizar a lista de arquivos
      setAudioFiles(prev => [...prev, result]);
      
    } catch (error) {
      toast({
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
      
      // Limpar o input de arquivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDeleteAudioFile = async (fileId: string) => {
    try {
      // Esta API precisará ser implementada no backend
      const response = await fetch(`/api/asterisk/audio/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Falha ao excluir o arquivo');
      }
      
      toast({
        title: "Arquivo removido",
        description: "O arquivo de áudio foi removido com sucesso.",
      });
      
      // Atualizar a lista de arquivos
      setAudioFiles(prev => prev.filter(file => file.id !== fileId));
      
      // Limpar a seleção se o arquivo selecionado foi o removido
      if (selectedAudioFile?.id === fileId) {
        setSelectedAudioFile(null);
      }
      
    } catch (error) {
      toast({
        title: "Erro ao remover arquivo",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
    }
  };
  
  const loadAudioFiles = async () => {
    try {
      // Esta API precisará ser implementada no backend
      const response = await fetch('/api/asterisk/audio');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar os arquivos de áudio');
      }
      
      const files = await response.json();
      setAudioFiles(files);
      
    } catch (error) {
      console.error("Erro ao carregar arquivos de áudio:", error);
      // Podemos optar por não mostrar um toast de erro aqui para não incomodar o usuário
    }
  };

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
              <label className="text-sm font-medium">Ramal/Número</label>
              <Input 
                placeholder="Ramal ou número" 
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
              <label className="text-sm font-medium">Timeout (segundos)</label>
              <Input 
                placeholder="Tempo de espera" 
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
        
      case "voicemail":
        return (
          <div className="space-y-4">
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
          </div>
        );
        
      case "wait":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tempo de Espera (segundos)</label>
              <Input 
                placeholder="Segundos" 
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
          </div>
        );
        
      case "set":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Variável</label>
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
                placeholder="Valor da variável" 
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
                placeholder="Condição" 
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
                Ex: ${'{DIGITO}'}=1
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Destino se Verdadeiro</label>
              <Select 
                value={selectedStep.parameters?.destination || ""}
                onValueChange={(value) => {
                  const updated = { 
                    ...selectedStep, 
                    parameters: { 
                      ...selectedStep.parameters, 
                      destination: value 
                    } 
                  };
                  updateDialPlanStep(updated);
                }}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  {dialPlanSteps.filter(step => step.id !== selectedStep.id).map(step => (
                    <SelectItem key={step.id} value={step.id}>
                      {step.label || step.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Iniciar arrastamento de um passo
  const handleDragStart = (stepId: string) => {
    setDraggedStep(stepId);
  };

  // Mover um passo durante arrastamento
  const handleDrag = (e: React.MouseEvent, step: DialPlanStep) => {
    if (draggedStep !== step.id || !diagramRef.current) return;
    
    const rect = diagramRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;
    
    const updatedStep = { ...step, x: newX, y: newY };
    updateDialPlanStep(updatedStep);
  };

  // Renderização do componente
  return (
    <MainLayout>
      <div className="content-container overflow-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-800">Configuração do Asterisk</h2>
          <p className="text-sm text-neutral-500">Configure a integração com o Asterisk e os planos de discagem.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full mb-6 sticky top-0 z-10 bg-background" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <TabsTrigger value="connection">Conexão AMI</TabsTrigger>
            <TabsTrigger value="diagnóstico">Diagnóstico</TabsTrigger>
            <TabsTrigger value="dialplan">Plano de Discagem</TabsTrigger>
            <TabsTrigger value="queues" disabled={!status?.connected}>Filas</TabsTrigger>
          </TabsList>

        <TabsContent value="diagnóstico" className="space-y-6">
          <AsteriskDiagnostic />
        </TabsContent>

        <TabsContent value="connection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conexão com Asterisk AMI</CardTitle>
              <CardDescription>
                Configure as credenciais de conexão com a interface AMI do Asterisk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AsteriskConnect />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Filas</CardTitle>
              <CardDescription>
                Gerencie as filas de atendimento do Asterisk. Esta seção só está disponível quando o Asterisk está conectado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!status?.connected ? (
                <Alert className="mb-4">
                  <FileQuestion className="h-4 w-4" />
                  <AlertTitle>Asterisk não conectado</AlertTitle>
                  <AlertDescription>
                    Conecte-se ao Asterisk primeiro para configurar as filas.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="queue-stats-container">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Suporte</CardTitle>
                        <CardDescription>Fila principal de suporte</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-neutral-500">
                          <div className="flex justify-between mb-2">
                            <span>Estratégia:</span>
                            <span className="font-medium">ringall</span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span>Tempo médio:</span>
                            <span className="font-medium">30s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Agentes:</span>
                            <span className="font-medium">3/5</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button variant="outline" size="sm" className="w-full">Editar</Button>
                      </CardFooter>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Vendas</CardTitle>
                        <CardDescription>Fila de vendas e prospecção</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-neutral-500">
                          <div className="flex justify-between mb-2">
                            <span>Estratégia:</span>
                            <span className="font-medium">leastrecent</span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span>Tempo médio:</span>
                            <span className="font-medium">45s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Agentes:</span>
                            <span className="font-medium">2/4</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button variant="outline" size="sm" className="w-full">Editar</Button>
                      </CardFooter>
                    </Card>

                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center text-neutral-500">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Nova Fila
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center py-8">
                        <Button variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Nova Fila
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dialplan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Editor de Plano de Discagem</CardTitle>
              <CardDescription>
                Crie e edite os planos de discagem de forma visual. Arraste e conecte os blocos para criar fluxos personalizados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
                <div className="lg:col-span-3 p-4">
                  <div 
                    ref={diagramRef}
                    className="dialplan-editor w-full h-full relative" 
                  >
                    {/* Aqui será renderizado o diagrama do plano de discagem */}
                    {dialPlanSteps.map(step => (
                      <div
                        key={step.id}
                        className={`dialplan-step ${selectedStep?.id === step.id ? 'selected' : ''}`}
                        style={{ 
                          left: `${step.x}px`, 
                          top: `${step.y}px`,
                          zIndex: draggedStep === step.id ? 10 : 1
                        }}
                        onClick={() => setSelectedStep(step)}
                        onMouseDown={() => handleDragStart(step.id)}
                        onMouseMove={(e) => handleDrag(e, step)}
                        onMouseUp={() => setDraggedStep(null)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            {step.type === "answer" && <PhoneIncoming className="h-4 w-4 mr-2 text-green-500" />}
                            {step.type === "playback" && <Volume2 className="h-4 w-4 mr-2 text-blue-500" />}
                            {step.type === "dial" && <Phone className="h-4 w-4 mr-2 text-indigo-500" />}
                            {step.type === "voicemail" && <Voicemail className="h-4 w-4 mr-2 text-purple-500" />}
                            {step.type === "hangup" && <PhoneForwarded className="h-4 w-4 mr-2 text-red-500" />}
                            {step.type === "wait" && <Clock className="h-4 w-4 mr-2 text-yellow-500" />}
                            {step.type === "gotoif" && <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />}
                            {step.type === "set" && <Settings className="h-4 w-4 mr-2 text-gray-500" />}
                            <span className="text-sm font-medium truncate">
                              {step.label || step.id}
                            </span>
                          </div>
                          
                          {step.id !== "start" && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDialPlanStep(step.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-xs text-neutral-500">
                          {step.type === "playback" && `Arquivo: ${step.parameters?.file || "não definido"}`}
                          {step.type === "dial" && `Ramal: ${step.parameters?.extension || "não definido"}`}
                          {step.type === "voicemail" && `Caixa: ${step.parameters?.mailbox || "não definida"}`}
                          {step.type === "wait" && `Segundos: ${step.parameters?.seconds || "não definido"}`}
                          {step.type === "set" && `${step.parameters?.variable || "VAR"}=${step.parameters?.value || "valor"}`}
                          {step.type === "gotoif" && `Se ${step.parameters?.expression || "condição"}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Adicionar Passo</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("playback")}
                        >
                          <Volume2 className="h-4 w-4 mr-2 text-blue-500" />
                          <span className="text-xs">Áudio</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("dial")}
                        >
                          <Phone className="h-4 w-4 mr-2 text-indigo-500" />
                          <span className="text-xs">Discar</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("voicemail")}
                        >
                          <Voicemail className="h-4 w-4 mr-2 text-purple-500" />
                          <span className="text-xs">Caixa Postal</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("hangup")}
                        >
                          <PhoneForwarded className="h-4 w-4 mr-2 text-red-500" />
                          <span className="text-xs">Encerrar</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("wait")}
                        >
                          <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                          <span className="text-xs">Aguardar</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start" 
                          size="sm"
                          onClick={() => addDialPlanStep("gotoif")}
                        >
                          <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />
                          <span className="text-xs">Condição</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start col-span-2" 
                          size="sm"
                          onClick={() => addDialPlanStep("set")}
                        >
                          <Settings className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-xs">Definir Variável</span>
                        </Button>
                      </div>
                    </div>
                    
                    {selectedStep && (
                      <div className="space-y-3 border rounded-md p-3">
                        <h3 className="text-sm font-medium">Propriedades</h3>
                        <div>
                          <label className="text-xs text-neutral-500">Rótulo</label>
                          <Input 
                            value={selectedStep.label || ""}
                            onChange={(e) => {
                              const updated = { ...selectedStep, label: e.target.value };
                              updateDialPlanStep(updated);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        <div className="pt-2">
                          <h4 className="text-xs font-medium mb-2">Parâmetros</h4>
                          {renderStepParameters()}
                        </div>
                        
                        <div className="pt-2">
                          <h4 className="text-xs font-medium mb-2">Próximos Passos</h4>
                          {selectedStep.nextSteps && selectedStep.nextSteps.length > 0 ? (
                            <div className="space-y-2">
                              {selectedStep.nextSteps.map((next, index) => (
                                <div key={index} className="flex items-center justify-between text-xs border rounded p-2">
                                  <div>
                                    <span className="font-medium">
                                      {next.label || "Continuar para "}
                                    </span>
                                    <span className="text-neutral-500 ml-1">
                                      {dialPlanSteps.find(s => s.id === next.stepId)?.label || next.stepId}
                                    </span>
                                    {next.condition && (
                                      <span className="block text-neutral-400 mt-1">
                                        Se {next.condition}
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => removeConnection(selectedStep.id, next.stepId)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-500 py-2">
                              Nenhum próximo passo definido
                            </div>
                          )}
                          
                          <div className="mt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full text-xs"
                              onClick={() => {
                                // Implemente a lógica para adicionar uma nova conexão
                                // Isso pode ser um modal ou um dropdown para selecionar o destino
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar Conexão
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <Button className="w-full" onClick={saveDialPlan} disabled={dialPlanMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Plano de Discagem
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}