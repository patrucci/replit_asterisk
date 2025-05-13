import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import AsteriskConnect from "@/components/asterisk/AsteriskConnect";
import AsteriskDiagnostic from "@/components/asterisk/AsteriskDiagnostic";
import { AsteriskConnectionTest } from "@/components/asterisk/AsteriskConnectionTest";

import { 
  Plus, Save, X, PhoneOff, Phone, Mic, Volume2, ListFilter, 
  UsersRound, Radio, Activity, RefreshCw, Upload, Trash2, 
  Music, File, Loader2
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const dialPlanStepSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(['play', 'record', 'menu', 'dial', 'queue', 'hangup']),
  x: z.number(),
  y: z.number(),
  properties: z.record(z.any()).optional(),
  connections: z.array(z.string()).optional(),
});

type DialPlanStep = z.infer<typeof dialPlanStepSchema>;

interface AsteriskConfigFormValues {
  host: string;
  port: number;
  username: string;
  password: string;
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
  const [dialPlanSteps, setDialPlanSteps] = useState<DialPlanStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<DialPlanStep | null>(null);
  const [isSubmittingDialPlan, setIsSubmittingDialPlan] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected" | "testing">("disconnected");
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  
  // Estados para gerenciamento de arquivos de áudio
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [selectedAudioFile, setSelectedAudioFile] = useState<AudioFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar configuração existente
  const { data: configData, isLoading } = useQuery({
    queryKey: ["/api/asterisk/config"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/asterisk/config");
        return await res.json();
      } catch (error) {
        return null;
      }
    }
  });

  // Verificar status do Asterisk
  const { data: status } = useQuery({
    queryKey: ["/api/asterisk/status"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/asterisk/status");
        return await res.json();
      } catch (error) {
        return { connected: false, configured: false };
      }
    },
    refetchInterval: 5000
  });

  // Carregar plano de discagem
  const { data: dialPlanData } = useQuery({
    queryKey: ["/api/asterisk/dialplan"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/asterisk/dialplan");
        const data = await res.json();
        return data.steps;
      } catch (error) {
        return [];
      }
    }
  });

  // Mutation para salvar o plano de discagem
  const dialPlanMutation = useMutation({
    mutationFn: async (steps: DialPlanStep[]) => {
      try {
        const res = await apiRequest("POST", "/api/asterisk/dialplan", { steps });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Erro na resposta do servidor: ${res.status} - ${errorText}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Erro na mutação:", error);
        throw error; // Re-lançar o erro para ser capturado no saveDialPlan
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asterisk/dialplan"] });
    }
  });

  // Carregar arquivos de áudio
  const loadAudioFiles = async () => {
    setIsLoadingAudio(true);
    try {
      const res = await apiRequest("GET", "/api/asterisk/audio");
      const data = await res.json();
      setAudioFiles(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar arquivos",
        description: "Não foi possível carregar os arquivos de áudio.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Upload de arquivo de áudio
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    setUploadingFile(true);
    
    try {
      const res = await fetch("/api/asterisk/audio", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Falha ao enviar arquivo");
      }
      
      const uploadedFile = await res.json();
      setAudioFiles(prev => [...prev, uploadedFile]);
      
      toast({
        title: "Arquivo enviado",
        description: "O arquivo de áudio foi enviado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar arquivo",
        description: "Não foi possível enviar o arquivo de áudio.",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Deletar arquivo de áudio
  const handleDeleteAudioFile = async (fileId: string) => {
    try {
      await apiRequest("DELETE", `/api/asterisk/audio/${fileId}`);
      setAudioFiles(prev => prev.filter(file => file.id !== fileId));
      toast({
        title: "Arquivo deletado",
        description: "O arquivo de áudio foi removido com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao deletar arquivo",
        description: "Não foi possível remover o arquivo de áudio.",
        variant: "destructive",
      });
    }
  };

  // Carregar dados quando o componente montar
  useEffect(() => {
    if (dialPlanData) {
      setDialPlanSteps(dialPlanData);
    }
    loadAudioFiles();
  }, [dialPlanData]);

  // Salvar plano de discagem
  const saveDialPlan = async () => {
    try {
      setIsSubmittingDialPlan(true);
      await dialPlanMutation.mutateAsync(dialPlanSteps);
      toast({
        title: "Plano de discagem salvo",
        description: "O plano de discagem foi salvo com sucesso."
      });
    } catch (error) {
      console.error("Erro ao salvar plano de discagem:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar o plano de discagem.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingDialPlan(false);
    }
  };

  // Adicionar novo passo
  const handleAddStep = (type: DialPlanStep['type']) => {
    const maxY = Math.max(0, ...dialPlanSteps.map(step => step.y));
    const newStep: DialPlanStep = {
      id: uuidv4(),
      type,
      x: 100,
      y: maxY + 120,
      properties: {},
      connections: []
    };
    
    setDialPlanSteps(prev => [...prev, newStep]);
    setSelectedStep(newStep);
  };

  // Atualizar passo
  const updateDialPlanStep = (updatedStep: DialPlanStep) => {
    setDialPlanSteps(prev => 
      prev.map(step => step.id === updatedStep.id ? updatedStep : step)
    );
    
    if (selectedStep?.id === updatedStep.id) {
      setSelectedStep(updatedStep);
    }
  };

  // Deletar passo
  const handleDeleteStep = (stepId: string) => {
    setDialPlanSteps(prev => prev.filter(step => step.id !== stepId));
    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
    }
  };

  // Atualizar propriedade do passo selecionado
  const updateSelectedStepProperty = (property: string, value: any) => {
    if (!selectedStep) return;
    
    const updatedStep = {
      ...selectedStep,
      properties: {
        ...selectedStep.properties,
        [property]: value
      }
    };
    
    updateDialPlanStep(updatedStep);
  };

  // Renderizar propriedades específicas do tipo de passo
  const renderStepProperties = () => {
    if (!selectedStep) return null;
    
    switch (selectedStep.type) {
      case 'play':
        return (
          <div>
            <Label htmlFor="audioFile">Arquivo de Áudio</Label>
            <Select
              value={selectedStep.properties?.audioFile || ''}
              onValueChange={(value) => updateSelectedStepProperty('audioFile', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um arquivo" />
              </SelectTrigger>
              <SelectContent>
                {audioFiles.map(file => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
        
      case 'record':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="maxDuration">Duração Máxima (segundos)</Label>
              <Input
                id="maxDuration"
                type="number"
                value={selectedStep.properties?.maxDuration || 60}
                onChange={(e) => updateSelectedStepProperty('maxDuration', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="beep">Tocar Bipe no Início</Label>
              <Select
                value={selectedStep.properties?.beep?.toString() || 'true'}
                onValueChange={(value) => updateSelectedStepProperty('beep', value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
        
      case 'menu':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="promptFile">Arquivo de Áudio (Prompt)</Label>
              <Select
                value={selectedStep.properties?.promptFile || ''}
                onValueChange={(value) => updateSelectedStepProperty('promptFile', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um arquivo" />
                </SelectTrigger>
                <SelectContent>
                  {audioFiles.map(file => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timeout">Tempo de Espera (segundos)</Label>
              <Input
                id="timeout"
                type="number"
                value={selectedStep.properties?.timeout || 10}
                onChange={(e) => updateSelectedStepProperty('timeout', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="options">Opções</Label>
              <div className="space-y-2 mt-2">
                {/* Aqui poderia ter uma interface para definir as opções do menu */}
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Digite '1'"
                    value="1"
                    readOnly
                  />
                  <span className="text-neutral-500">→</span>
                  <Select
                    value={selectedStep.properties?.options?.['1'] || ''}
                    onValueChange={(value) => {
                      const options = selectedStep.properties?.options || {};
                      updateSelectedStepProperty('options', {
                        ...options,
                        '1': value
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {dialPlanSteps
                        .filter(step => step.id !== selectedStep.id)
                        .map(step => (
                          <SelectItem key={step.id} value={step.id}>
                            {step.name || getStepTypeName(step.type)}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const options = { ...selectedStep.properties?.options };
                      delete options['1'];
                      updateSelectedStepProperty('options', options);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    // Implementar adição de nova opção
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Opção
                </Button>
              </div>
            </div>
          </div>
        );
        
      case 'dial':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="extension">Ramal ou Número</Label>
              <Input
                id="extension"
                value={selectedStep.properties?.extension || ''}
                onChange={(e) => updateSelectedStepProperty('extension', e.target.value)}
                placeholder="Ex: 100 ou 5511999999999"
              />
            </div>
            <div>
              <Label htmlFor="timeout">Timeout (segundos)</Label>
              <Input
                id="timeout"
                type="number"
                value={selectedStep.properties?.timeout || 30}
                onChange={(e) => updateSelectedStepProperty('timeout', parseInt(e.target.value))}
              />
            </div>
          </div>
        );
        
      case 'queue':
        return (
          <div>
            <Label htmlFor="queueName">Fila</Label>
            <Select
              value={selectedStep.properties?.queueName || ''}
              onValueChange={(value) => updateSelectedStepProperty('queueName', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma fila" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suporte">Suporte</SelectItem>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
        
      case 'hangup':
        return (
          <div>
            <p className="text-sm text-neutral-500">
              Este passo encerra a chamada.
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Iniciar arrastamento de um passo
  const handleDragStart = (e: React.MouseEvent, stepId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const step = dialPlanSteps.find(s => s.id === stepId);
    if (!step) return;
    
    // Guardar o offset inicial do mouse em relação ao elemento para calcular a posição corretamente
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDraggedStep(stepId);
    
    // Adicionar atributo data-dragging para estilização CSS
    element.setAttribute('data-dragging', 'true');
    
    // Usar funções de closure para garantir acesso aos valores atuais
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!diagramRef.current) return;
      
      moveEvent.preventDefault();
      const diagramRect = diagramRef.current.getBoundingClientRect();
      
      // Calcular a nova posição considerando o offset inicial
      const newX = moveEvent.clientX - diagramRect.left - offsetX;
      const newY = moveEvent.clientY - diagramRect.top - offsetY;
      
      // Atualizar posição do passo
      updateDialPlanStep({
        ...step,
        x: Math.max(0, newX),
        y: Math.max(0, newY)
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Remover atributo data-dragging ao finalizar
      element.removeAttribute('data-dragging');
      setDraggedStep(null);
    };
    
    // Adicionar event listeners no document para capturar movimentos mesmo fora do elemento
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Como o movimento do mouse é controlado pelos listeners adicionados em handleDragStart,
  // este método não é mais necessário mas mantemos para compatibilidade com o JSX
  const handleDrag = () => {};

  // Helper para obter o nome do tipo de passo
  const getStepTypeName = (type: DialPlanStep['type']) => {
    switch (type) {
      case 'play': return 'Reproduzir Áudio';
      case 'record': return 'Gravar';
      case 'menu': return 'Menu';
      case 'dial': return 'Discar';
      case 'queue': return 'Fila';
      case 'hangup': return 'Desligar';
      default: return type;
    }
  };

  // Helper para obter a descrição do passo
  const getStepDescription = (step: DialPlanStep) => {
    switch (step.type) {
      case 'play':
        const audioFile = audioFiles.find(f => f.id === step.properties?.audioFile);
        return audioFile ? `Arquivo: ${audioFile.name}` : 'Nenhum arquivo selecionado';
      case 'record':
        return `Máx: ${step.properties?.maxDuration || 60} segundos`;
      case 'menu':
        return 'Menu de opções';
      case 'dial':
        return `Número: ${step.properties?.extension || 'Não definido'}`;
      case 'queue':
        return `Fila: ${step.properties?.queueName || 'Não definida'}`;
      case 'hangup':
        return 'Encerrar chamada';
      default:
        return '';
    }
  };

  // Helper para obter o ícone do tipo de passo
  const getStepIcon = (type: DialPlanStep['type']) => {
    switch (type) {
      case 'play': return <Volume2 className="h-4 w-4 text-green-500" />;
      case 'record': return <Mic className="h-4 w-4 text-red-500" />;
      case 'menu': return <ListFilter className="h-4 w-4 text-blue-500" />;
      case 'dial': return <Phone className="h-4 w-4 text-amber-500" />;
      case 'queue': return <UsersRound className="h-4 w-4 text-purple-500" />;
      case 'hangup': return <PhoneOff className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Helper para obter a classe de cor do tipo de passo
  const getStepColorClass = (type: DialPlanStep['type']) => {
    switch (type) {
      case 'play': return 'bg-green-50 border border-green-200';
      case 'record': return 'bg-red-50 border border-red-200';
      case 'menu': return 'bg-blue-50 border border-blue-200';
      case 'dial': return 'bg-amber-50 border border-amber-200';
      case 'queue': return 'bg-purple-50 border border-purple-200';
      case 'hangup': return 'bg-red-50 border border-red-200';
      default: return 'bg-gray-50 border border-gray-200';
    }
  };

  // Renderização do componente
  return (
    <MainLayout>
      <div className="container mx-auto pb-16">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Configuração do Asterisk</h1>
            <p className="text-sm text-neutral-500">Configure a integração com o Asterisk e os planos de discagem.</p>
          </div>
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
          <AsteriskConnect />
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
              <Tabs defaultValue="editor" className="mb-6">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="editor">Editor Visual</TabsTrigger>
                  <TabsTrigger value="audio">Arquivos de Áudio</TabsTrigger>
                </TabsList>
                
                <TabsContent value="audio">
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Arquivos de Áudio</h3>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          accept="audio/*"
                          onChange={handleFileChange}
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          className="flex items-center space-x-1"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {uploadingFile ? 'Enviando...' : 'Enviar Arquivo'}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={loadAudioFiles}
                          disabled={isLoadingAudio}
                        >
                          <RefreshCw className={`h-4 w-4 ${isLoadingAudio ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    {audioFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {audioFiles.map((file) => (
                          <Card key={file.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex justify-between items-center">
                                <div className="flex items-center">
                                  <Music className="h-4 w-4 mr-2 text-blue-500" />
                                  <span className="truncate">{file.name}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteAudioFile(file.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </CardTitle>
                              <CardDescription className="text-xs pt-1">
                                {file.duration ? `${file.duration}s` : 'Duração desconhecida'} · {file.filename}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3">
                              <audio 
                                controls 
                                className="w-full h-10"
                                src={`/api/asterisk/audio/${file.id}`} 
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 border border-dashed rounded-md">
                        <File className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                        <h3 className="text-lg font-medium text-neutral-600 mb-2">Nenhum arquivo encontrado</h3>
                        <p className="text-sm text-neutral-500 mb-6">
                          Envie arquivos de áudio para utilizar no plano de discagem.
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Arquivo
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="editor">
                  <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
                    <div className="lg:col-span-3 p-4">
                      <div 
                        ref={diagramRef}
                        className="dialplan-editor w-full h-[500px] border rounded-md p-4 relative overflow-auto"
                        style={{ background: "repeating-linear-gradient(0deg, #f5f5f5 0px, #f5f5f5 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #f5f5f5 0px, #f5f5f5 1px, transparent 1px, transparent 20px)" }}
                      >
                        {/* Aqui será renderizado o diagrama do plano de discagem */}
                        {dialPlanSteps.map(step => (
                          <div
                            key={step.id}
                            className={`dialplan-step p-3 rounded-md shadow-md absolute cursor-move ${
                              selectedStep?.id === step.id ? 'ring-2 ring-primary' : ''
                            } ${draggedStep === step.id ? 'shadow-lg opacity-90' : ''} ${getStepColorClass(step.type)}`}
                            style={{ 
                              left: `${step.x}px`, 
                              top: `${step.y}px`,
                              zIndex: draggedStep === step.id ? 10 : 1
                            }}
                            onClick={() => setSelectedStep(step)}
                            onMouseDown={(e) => handleDragStart(e, step.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                {getStepIcon(step.type)}
                                <span className="ml-2 font-medium">{step.name || `${getStepTypeName(step.type)}`}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStep(step.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-xs text-slate-500">
                              {getStepDescription(step)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-md font-medium">Adicionar Passos</h3>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={saveDialPlan}
                            disabled={isSubmittingDialPlan}
                          >
                            {isSubmittingDialPlan ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salvar
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('play')}
                          >
                            <Volume2 className="h-4 w-4 mr-2 text-green-500" />
                            <span>Play</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('record')}
                          >
                            <Mic className="h-4 w-4 mr-2 text-red-500" />
                            <span>Gravar</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('menu')}
                          >
                            <ListFilter className="h-4 w-4 mr-2 text-blue-500" />
                            <span>Menu</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('dial')}
                          >
                            <Phone className="h-4 w-4 mr-2 text-amber-500" />
                            <span>Discar</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('queue')}
                          >
                            <UsersRound className="h-4 w-4 mr-2 text-purple-500" />
                            <span>Fila</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => handleAddStep('hangup')}
                          >
                            <PhoneOff className="h-4 w-4 mr-2 text-red-500" />
                            <span>Desligar</span>
                          </Button>
                        </div>

                        {selectedStep && (
                          <>
                            <Separator />
                            <h3 className="text-md font-medium">Propriedades</h3>
                            <div className="space-y-2">
                              <div>
                                <Label htmlFor="stepName">Nome</Label>
                                <Input
                                  id="stepName"
                                  value={selectedStep.name || ''}
                                  onChange={(e) => updateSelectedStepProperty('name', e.target.value)}
                                  placeholder={getStepTypeName(selectedStep.type)}
                                />
                              </div>
                              
                              {renderStepProperties()}
                              
                              <div className="flex justify-end space-x-2 mt-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedStep(null)}
                                >
                                  Fechar
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Filas</CardTitle>
              <CardDescription>
                Configure e gerencie as filas de chamadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Conteúdo para gerenciamento de filas */}
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-neutral-600 mb-2">Funcionalidade em desenvolvimento</h3>
                <p className="text-sm text-neutral-500">
                  O gerenciamento de filas estará disponível em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}