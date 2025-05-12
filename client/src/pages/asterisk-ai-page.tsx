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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  PhoneCall, 
  CalendarPlus, 
  MessageSquare, 
  Play, 
  Plus, 
  Clock, 
  Calendar,
  CheckCircle2,
  X,
  Upload,
  Cog,
  Sparkles,
  SquarePen
} from "lucide-react";

// Schema para o formulário de chamada de IA
const aiCallSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  purpose: z.enum(["schedule", "remind", "confirm", "reschedule", "cancel"]),
  customScript: z.string().optional(),
  useCustomScript: z.boolean().default(false),
  callTime: z.string().optional(),
  scheduleCall: z.boolean().default(false),
  maxAttempts: z.number().default(3),
  voiceType: z.enum(["female1", "female2", "male1", "male2"]).default("female1"),
});

type AICallFormValues = z.infer<typeof aiCallSchema>;

// Schema para o formulário de geração de script
const scriptGenerationSchema = z.object({
  purpose: z.enum(["schedule", "remind", "confirm", "reschedule", "cancel"]),
  professionalType: z.string().min(1, "Tipo de profissional é obrigatório"),
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  businessName: z.string().min(1, "Nome da empresa é obrigatório"),
  additionalContext: z.string().optional(),
  formality: z.enum(["casual", "neutral", "formal"]).default("neutral"),
  maxLength: z.number().min(50).max(500).default(200),
});

type ScriptGenerationFormValues = z.infer<typeof scriptGenerationSchema>;

// Schema para o formulário de configuração de IA
const aiConfigSchema = z.object({
  enabled: z.boolean().default(true),
  responseTimeout: z.string().transform(val => parseInt(val, 10)).default("10"),
  confidenceThreshold: z.string().transform(val => parseFloat(val) / 100).default("70"),
  callAnalysis: z.boolean().default(true),
  transcriptionEnabled: z.boolean().default(true),
  defaultVoice: z.enum(["female1", "female2", "male1", "male2"]).default("female1"),
  speechRate: z.string().transform(val => parseFloat(val)).default("1.0"),
  maxCallDuration: z.string().transform(val => parseInt(val, 10)).default("300"),
  apiModel: z.enum(["gpt-4o", "claude-3.5-sonnet", "claude-3-opus"]).default("gpt-4o"),
});

type AIConfigFormValues = z.infer<typeof aiConfigSchema>;

// Tipo para o histórico de chamadas
type CallHistoryItem = {
  id: string;
  clientName: string;
  clientPhone: string;
  callDate: string;
  duration: string;
  purpose: string;
  status: "completed" | "failed" | "no-answer" | "scheduled";
  recording?: string;
  transcription?: string;
  analysis?: {
    sentiment: "positive" | "neutral" | "negative";
    nextSteps: string[];
    keyInsights: string[];
  };
};

// Objetos simulados para demonstração
const mockClients = [
  { id: "1", name: "João Silva", phone: "(11) 99123-4567" },
  { id: "2", name: "Maria Oliveira", phone: "(21) 98765-4321" },
  { id: "3", name: "Carlos Sousa", phone: "(31) 97654-3210" },
  { id: "4", name: "Ana Pereira", phone: "(41) 96543-2109" },
];

const mockCallHistory: CallHistoryItem[] = [
  {
    id: "call1",
    clientName: "João Silva",
    clientPhone: "(11) 99123-4567",
    callDate: "2025-05-10 14:30",
    duration: "2:45",
    purpose: "Agendamento",
    status: "completed",
    recording: "call_joao_20250510.mp3",
    transcription: "Transcrição da conversa com João...",
    analysis: {
      sentiment: "positive",
      nextSteps: ["Confirmar consulta um dia antes", "Preparar documentação"],
      keyInsights: ["Cliente prefere horários pela manhã", "Mencionou dor nas costas"]
    }
  },
  {
    id: "call2",
    clientName: "Maria Oliveira",
    clientPhone: "(21) 98765-4321",
    callDate: "2025-05-11 10:15",
    duration: "3:20",
    purpose: "Confirmação",
    status: "completed",
    recording: "call_maria_20250511.mp3",
    analysis: {
      sentiment: "neutral",
      nextSteps: ["Enviar lembretes adicionais"],
      keyInsights: ["Cliente confirmou presença com ressalvas", "Pode se atrasar"]
    }
  },
  {
    id: "call3",
    clientName: "Carlos Sousa",
    clientPhone: "(31) 97654-3210",
    callDate: "2025-05-12 08:00",
    purpose: "Agendamento",
    status: "scheduled",
    duration: "-"
  },
];

export default function AsteriskAIPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("make-call");
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [callLogs, setCallLogs] = useState<CallHistoryItem[]>(mockCallHistory);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Form para realizar chamada com IA
  const callForm = useForm<AICallFormValues>({
    resolver: zodResolver(aiCallSchema),
    defaultValues: {
      clientId: "",
      purpose: "schedule",
      customScript: "",
      useCustomScript: false,
      scheduleCall: false,
      callTime: "",
      maxAttempts: "3",
      voiceType: "female1",
    },
  });

  // Form para geração de script
  const scriptForm = useForm<ScriptGenerationFormValues>({
    resolver: zodResolver(scriptGenerationSchema),
    defaultValues: {
      purpose: "schedule",
      professionalType: "",
      clientName: "",
      businessName: "",
      additionalContext: "",
      formality: "neutral",
      maxLength: 200,
    },
  });

  // Form para configuração da IA
  const configForm = useForm<AIConfigFormValues>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      enabled: true,
      responseTimeout: "10",
      confidenceThreshold: "70",
      callAnalysis: true,
      transcriptionEnabled: true,
      defaultVoice: "female1",
      speechRate: "1.0",
      maxCallDuration: "300",
      apiModel: "gpt-4o"
    },
  });

  // Carregar clientes
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      // Em um ambiente real, carregaríamos os clientes da API
      // Por enquanto, usamos dados simulados
      return mockClients;
    },
  });

  // Mutação para realizar chamada com IA
  const makeCallMutation = useMutation({
    mutationFn: async (data: AICallFormValues) => {
      // Simulação de chamada para API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Em um ambiente real, chamaríamos a API
      return {
        success: true,
        callId: `call-${Date.now()}`,
        message: data.scheduleCall 
          ? "Chamada agendada com sucesso" 
          : "Chamada iniciada com sucesso"
      };
    },
    onSuccess: (response) => {
      toast({
        title: "Sucesso",
        description: response.message,
      });
      
      // Adicionar à lista de chamadas se for agendada
      if (callForm.getValues().scheduleCall) {
        const client = clients?.find(c => c.id === callForm.getValues().clientId);
        if (client) {
          const newCall: CallHistoryItem = {
            id: response.callId,
            clientName: client.name,
            clientPhone: client.phone,
            callDate: new Date(callForm.getValues().callTime || "").toLocaleString(),
            duration: "-",
            purpose: getPurposeText(callForm.getValues().purpose),
            status: "scheduled"
          };
          
          setCallLogs([newCall, ...callLogs]);
        }
      }
      
      callForm.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível realizar a chamada. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para geração de script
  const generateScriptMutation = useMutation({
    mutationFn: async (data: ScriptGenerationFormValues) => {
      setIsGeneratingScript(true);
      
      // Simulação de chamada para API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let scriptText = "";
      
      switch(data.purpose) {
        case "schedule":
          scriptText = `Olá, bom dia. Meu nome é Sofia, assistente virtual da ${data.businessName}.\n\nEstou ligando para verificar sua disponibilidade para agendar uma consulta com ${data.professionalType}.\n\nVocê teria disponibilidade na próxima semana? Temos horários na terça ou quinta-feira pela manhã.\n\nPodemos confirmar um desses horários para você?`;
          break;
        case "confirm":
          scriptText = `Olá, bom dia. Meu nome é Sofia, assistente virtual da ${data.businessName}.\n\nEstou ligando para confirmar sua consulta com ${data.professionalType} amanhã às 14h.\n\nVocê confirma esse compromisso?\n\nCaso precise cancelar ou reagendar, por favor me avise agora ou entre em contato com nossa recepção.`;
          break;
        case "remind":
          scriptText = `Olá, bom dia. Meu nome é Sofia, assistente virtual da ${data.businessName}.\n\nEstou ligando para lembrar sobre sua consulta com ${data.professionalType} amanhã às 14h.\n\nEsperamos você no endereço já informado. Há algo mais que você gostaria de saber sobre sua consulta?`;
          break;
        default:
          scriptText = `Olá, bom dia. Meu nome é Sofia, assistente virtual da ${data.businessName}.\n\nEstou ligando em nome de ${data.professionalType} sobre seu agendamento.\n\nComo posso ajudar você hoje?`;
      }
      
      if (data.formality === "formal") {
        scriptText = scriptText.replace("Olá, bom dia.", "Prezado(a), bom dia.");
      } else if (data.formality === "casual") {
        scriptText = scriptText.replace("Olá, bom dia.", "Oi, tudo bem?");
      }
      
      return scriptText;
    },
    onSuccess: (script) => {
      setGeneratedScript(script);
      setIsGeneratingScript(false);
      
      toast({
        title: "Script gerado",
        description: "O script para a chamada foi gerado com sucesso.",
      });
    },
    onError: () => {
      setIsGeneratingScript(false);
      
      toast({
        title: "Erro na geração",
        description: "Não foi possível gerar o script. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para salvar configurações
  const saveConfigMutation = useMutation({
    mutationFn: async (data: AIConfigFormValues) => {
      // Simulação de chamada para API
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "As configurações de IA foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Uso do script gerado
  const useGeneratedScript = () => {
    if (generatedScript) {
      callForm.setValue("customScript", generatedScript);
      callForm.setValue("useCustomScript", true);
      setActiveTab("make-call");
      
      toast({
        title: "Script aplicado",
        description: "O script gerado foi aplicado à chamada.",
      });
    }
  };

  // Iniciar/parar gravação de teste
  const toggleRecording = async () => {
    if (isRecording) {
      // Parar gravação
      if (recorderRef.current) {
        recorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Iniciar gravação
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        recorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          setAudioBlob(audioBlob);
          audioChunks.current = [];
          
          // Liberar a stream de áudio
          stream.getTracks().forEach(track => track.stop());
        };
        
        audioChunks.current = [];
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Erro ao acessar o microfone:', err);
        toast({
          title: "Erro de gravação",
          description: "Não foi possível acessar o microfone. Verifique as permissões.",
          variant: "destructive",
        });
      }
    }
  };

  // Testar voz
  const testVoice = () => {
    // Em uma implementação real, isso enviaria a gravação para a API e retornaria a resposta
    toast({
      title: "Teste de voz",
      description: "A gravação seria processada pela IA e uma resposta seria gerada.",
    });
  };

  // Obter texto para o propósito da chamada
  const getPurposeText = (purpose: string): string => {
    const purposeMap: Record<string, string> = {
      "schedule": "Agendamento",
      "remind": "Lembrete",
      "confirm": "Confirmação",
      "reschedule": "Reagendamento",
      "cancel": "Cancelamento"
    };
    
    return purposeMap[purpose] || purpose;
  };

  // Renderizar cada aba da interface
  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Assistente IA para Asterisk</h2>
        <p className="text-sm text-neutral-500">Configure e realize chamadas automatizadas com inteligência artificial.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full mb-6">
          <TabsTrigger value="make-call">
            <PhoneCall className="h-4 w-4 mr-2" />
            Realizar Chamada
          </TabsTrigger>
          <TabsTrigger value="generate-script">
            <SquarePen className="h-4 w-4 mr-2" />
            Gerar Script
          </TabsTrigger>
          <TabsTrigger value="call-history">
            <Clock className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="config">
            <Cog className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Aba de realização de chamada */}
        <TabsContent value="make-call" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Realizar Chamada com IA</CardTitle>
              <CardDescription>
                Configure os parâmetros para que a IA realize uma chamada para o cliente.
              </CardDescription>
            </CardHeader>
            <form onSubmit={callForm.handleSubmit((data) => makeCallMutation.mutate(data))}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Cliente</label>
                    <Select
                      value={callForm.watch("clientId")}
                      onValueChange={(value) => callForm.setValue("clientId", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} - {client.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {callForm.formState.errors.clientId && (
                      <p className="text-sm text-red-500 mt-1">{callForm.formState.errors.clientId.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Propósito da Chamada</label>
                    <Select
                      value={callForm.watch("purpose")}
                      onValueChange={(value: any) => callForm.setValue("purpose", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o propósito" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schedule">Agendar consulta</SelectItem>
                        <SelectItem value="remind">Lembrar de consulta</SelectItem>
                        <SelectItem value="confirm">Confirmar consulta</SelectItem>
                        <SelectItem value="reschedule">Reagendar consulta</SelectItem>
                        <SelectItem value="cancel">Cancelar consulta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={callForm.watch("useCustomScript")}
                    onCheckedChange={(checked) => callForm.setValue("useCustomScript", checked)}
                    id="use-custom-script"
                  />
                  <label className="text-sm font-medium" htmlFor="use-custom-script">
                    Usar script personalizado
                  </label>
                </div>
                
                {callForm.watch("useCustomScript") && (
                  <div>
                    <label className="text-sm font-medium">Script Personalizado</label>
                    <Textarea 
                      className="mt-1 min-h-[150px]" 
                      placeholder="Digite o script para a IA seguir durante a chamada..."
                      {...callForm.register("customScript")}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Escreva o script que a IA deverá seguir. Use variáveis como {"{nome_cliente}"}, {"{data_consulta}"} que serão substituídas automaticamente.
                    </p>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={callForm.watch("scheduleCall")}
                    onCheckedChange={(checked) => callForm.setValue("scheduleCall", checked)}
                    id="schedule-call"
                  />
                  <label className="text-sm font-medium" htmlFor="schedule-call">
                    Agendar chamada para mais tarde
                  </label>
                </div>
                
                {callForm.watch("scheduleCall") && (
                  <div>
                    <label className="text-sm font-medium">Data e Hora da Chamada</label>
                    <Input 
                      type="datetime-local" 
                      className="mt-1"
                      {...callForm.register("callTime")}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Máximo de Tentativas</label>
                    <Input 
                      type="number" 
                      className="mt-1"
                      placeholder="3" 
                      min="1" 
                      max="10" 
                      {...callForm.register("maxAttempts")}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Tipo de Voz</label>
                    <Select
                      value={callForm.watch("voiceType")}
                      onValueChange={(value: any) => callForm.setValue("voiceType", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione uma voz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female1">Feminina 1 (Sofia)</SelectItem>
                        <SelectItem value="female2">Feminina 2 (Helena)</SelectItem>
                        <SelectItem value="male1">Masculina 1 (Miguel)</SelectItem>
                        <SelectItem value="male2">Masculina 2 (Ricardo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={!audioBlob || makeCallMutation.isPending}
                  onClick={toggleRecording}
                >
                  {isRecording ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Parar Teste de Voz
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Testar com Minha Voz
                    </>
                  )}
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={makeCallMutation.isPending}
                >
                  {makeCallMutation.isPending ? (
                    "Processando..."
                  ) : callForm.watch("scheduleCall") ? (
                    <>
                      <CalendarPlus className="h-4 w-4 mr-2" />
                      Agendar Chamada
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-4 w-4 mr-2" />
                      Iniciar Chamada Agora
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Aba de geração de script */}
        <TabsContent value="generate-script" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Gerar Script com IA</CardTitle>
                  <CardDescription>
                    Crie um script personalizado para suas chamadas com IA.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={scriptForm.handleSubmit((data) => generateScriptMutation.mutate(data))}>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Propósito da Chamada</label>
                      <Select
                        value={scriptForm.watch("purpose")}
                        onValueChange={(value: any) => scriptForm.setValue("purpose", value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione o propósito" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="schedule">Agendar consulta</SelectItem>
                          <SelectItem value="remind">Lembrar de consulta</SelectItem>
                          <SelectItem value="confirm">Confirmar consulta</SelectItem>
                          <SelectItem value="reschedule">Reagendar consulta</SelectItem>
                          <SelectItem value="cancel">Cancelar consulta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Tipo de Profissional</label>
                      <Input 
                        className="mt-1"
                        placeholder="Ex: Médico, Advogado, Consultor..." 
                        {...scriptForm.register("professionalType")}
                      />
                      {scriptForm.formState.errors.professionalType && (
                        <p className="text-sm text-red-500 mt-1">{scriptForm.formState.errors.professionalType.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Nome do Cliente</label>
                      <Input 
                        className="mt-1"
                        placeholder="Ex: João Silva" 
                        {...scriptForm.register("clientName")}
                      />
                      {scriptForm.formState.errors.clientName && (
                        <p className="text-sm text-red-500 mt-1">{scriptForm.formState.errors.clientName.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Nome da Empresa</label>
                      <Input 
                        className="mt-1"
                        placeholder="Ex: Clínica Saúde Total" 
                        {...scriptForm.register("businessName")}
                      />
                      {scriptForm.formState.errors.businessName && (
                        <p className="text-sm text-red-500 mt-1">{scriptForm.formState.errors.businessName.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Contexto Adicional</label>
                      <Textarea 
                        className="mt-1"
                        placeholder="Informações adicionais relevantes para o script..." 
                        {...scriptForm.register("additionalContext")}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Nível de Formalidade</label>
                      <Select
                        value={scriptForm.watch("formality")}
                        onValueChange={(value: any) => scriptForm.setValue("formality", value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="neutral">Neutro</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Tamanho Máximo (caracteres)</label>
                      <Input 
                        type="number" 
                        className="mt-1"
                        placeholder="200" 
                        min="50" 
                        max="500" 
                        {...scriptForm.register("maxLength", { valueAsNumber: true })}
                      />
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={isGeneratingScript || generateScriptMutation.isPending}
                      className="w-full"
                    >
                      {isGeneratingScript ? (
                        "Gerando Script..."
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Gerar Script com IA
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
            
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Script Gerado</CardTitle>
                  <CardDescription>
                    Visualize e edite o script antes de usar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {generatedScript ? (
                    <Textarea 
                      className="min-h-[300px] font-mono text-sm"
                      value={generatedScript}
                      onChange={(e) => setGeneratedScript(e.target.value)}
                    />
                  ) : (
                    <div className="flex flex-col h-[300px] items-center justify-center text-center space-y-3 text-neutral-400">
                      <MessageSquare className="h-12 w-12" />
                      <div>
                        <p>Nenhum script gerado</p>
                        <p className="text-sm">Preencha o formulário ao lado e clique em "Gerar Script com IA"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button 
                    type="button" 
                    onClick={useGeneratedScript}
                    disabled={!generatedScript}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Usar Este Script
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Aba de histórico de chamadas */}
        <TabsContent value="call-history" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Chamadas</CardTitle>
                  <CardDescription>
                    Visualize o histórico de chamadas realizadas pelo sistema de IA.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-sm">Cliente</th>
                          <th className="text-left py-3 px-4 font-medium text-sm">Data/Hora</th>
                          <th className="text-left py-3 px-4 font-medium text-sm">Duração</th>
                          <th className="text-left py-3 px-4 font-medium text-sm">Propósito</th>
                          <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-sm">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callLogs.map((call) => (
                          <tr 
                            key={call.id} 
                            className="border-b hover:bg-neutral-50 cursor-pointer" 
                            onClick={() => setSelectedCall(call)}
                          >
                            <td className="py-3 px-4 text-sm">{call.clientName}</td>
                            <td className="py-3 px-4 text-sm">{call.callDate}</td>
                            <td className="py-3 px-4 text-sm">{call.duration}</td>
                            <td className="py-3 px-4 text-sm">{call.purpose}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                call.status === 'completed' ? 'bg-green-100 text-green-800' :
                                call.status === 'failed' ? 'bg-red-100 text-red-800' :
                                call.status === 'no-answer' ? 'bg-amber-100 text-amber-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {call.status === 'completed' ? 'Concluída' :
                                 call.status === 'failed' ? 'Falha' :
                                 call.status === 'no-answer' ? 'Sem Resposta' :
                                 'Agendada'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCall(call);
                                }}
                              >
                                Detalhes
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {callLogs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-neutral-500">
                              Nenhuma chamada registrada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes da Chamada</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCall ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500">Cliente</h3>
                        <p>{selectedCall.clientName}</p>
                        <p className="text-sm text-neutral-500">{selectedCall.clientPhone}</p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500">Data e Hora</h3>
                        <p>{selectedCall.callDate}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500">Duração</h3>
                        <p>{selectedCall.duration}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500">Propósito</h3>
                        <p>{selectedCall.purpose}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500">Status</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedCall.status === 'completed' ? 'bg-green-100 text-green-800' :
                          selectedCall.status === 'failed' ? 'bg-red-100 text-red-800' :
                          selectedCall.status === 'no-answer' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedCall.status === 'completed' ? 'Concluída' :
                           selectedCall.status === 'failed' ? 'Falha' :
                           selectedCall.status === 'no-answer' ? 'Sem Resposta' :
                           'Agendada'}
                        </span>
                      </div>
                      
                      {selectedCall.recording && (
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Gravação</h3>
                          <audio controls className="w-full mt-1">
                            <source src={`/api/recordings/${selectedCall.recording}`} type="audio/mpeg" />
                            Seu navegador não suporta o elemento de áudio.
                          </audio>
                        </div>
                      )}
                      
                      {selectedCall.transcription && (
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Transcrição</h3>
                          <p className="text-sm bg-neutral-50 p-3 rounded mt-1">{selectedCall.transcription}</p>
                        </div>
                      )}
                      
                      {selectedCall.analysis && (
                        <>
                          <Separator />
                          
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Análise de Sentimento</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                              selectedCall.analysis.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                              selectedCall.analysis.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {selectedCall.analysis.sentiment === 'positive' ? 'Positivo' :
                               selectedCall.analysis.sentiment === 'negative' ? 'Negativo' :
                               'Neutro'}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Próximos Passos</h3>
                            <ul className="list-disc list-inside text-sm mt-1">
                              {selectedCall.analysis.nextSteps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Insights Chave</h3>
                            <ul className="list-disc list-inside text-sm mt-1">
                              {selectedCall.analysis.keyInsights.map((insight, i) => (
                                <li key={i}>{insight}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col h-[300px] items-center justify-center text-center space-y-3 text-neutral-400">
                      <Clock className="h-12 w-12" />
                      <div>
                        <p>Nenhuma chamada selecionada</p>
                        <p className="text-sm">Selecione uma chamada da lista para ver os detalhes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Aba de configurações */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da IA</CardTitle>
              <CardDescription>
                Configure os parâmetros de funcionamento da inteligência artificial.
              </CardDescription>
            </CardHeader>
            <form onSubmit={configForm.handleSubmit((data) => saveConfigMutation.mutate(data))}>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <h3 className="font-medium">Ativar sistema de IA</h3>
                    <p className="text-sm text-neutral-500">
                      Ative ou desative todas as funcionalidades de IA do sistema.
                    </p>
                  </div>
                  <Switch
                    checked={configForm.watch("enabled")}
                    onCheckedChange={(checked) => configForm.setValue("enabled", checked)}
                    id="ai-enabled"
                  />
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium">Modelo de IA</label>
                    <Select
                      value={configForm.watch("apiModel")}
                      onValueChange={(value: any) => configForm.setValue("apiModel", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                        <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus (Máxima qualidade)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-500 mt-1">
                      Escolha o modelo que será usado para processamento de linguagem.
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Voz Padrão</label>
                    <Select
                      value={configForm.watch("defaultVoice")}
                      onValueChange={(value: any) => configForm.setValue("defaultVoice", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a voz padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female1">Feminina 1 (Sofia)</SelectItem>
                        <SelectItem value="female2">Feminina 2 (Helena)</SelectItem>
                        <SelectItem value="male1">Masculina 1 (Miguel)</SelectItem>
                        <SelectItem value="male2">Masculina 2 (Ricardo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Tempo Máximo de Espera (segundos)</label>
                    <Input 
                      type="number" 
                      className="mt-1"
                      placeholder="10"
                      min="5"
                      max="30"
                      {...configForm.register("responseTimeout")}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Tempo máximo que a IA aguardará por uma resposta do cliente.
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Limiar de Confiança (%)</label>
                    <Input 
                      type="number" 
                      className="mt-1"
                      placeholder="70"
                      min="0"
                      max="100"
                      {...configForm.register("confidenceThreshold")}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Nível mínimo de confiança para a IA aceitar uma resposta como válida.
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Velocidade da Fala</label>
                    <Input 
                      type="number" 
                      className="mt-1"
                      placeholder="1.0"
                      step="0.1"
                      min="0.5"
                      max="2.0"
                      {...configForm.register("speechRate")}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Velocidade da fala da IA (1.0 = normal, &lt;1.0 = mais lento, &gt;1.0 = mais rápido).
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Duração Máxima da Chamada (segundos)</label>
                    <Input 
                      type="number" 
                      className="mt-1"
                      placeholder="300"
                      min="60"
                      max="1800"
                      {...configForm.register("maxCallDuration")}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Tempo máximo de duração de uma chamada (em segundos).
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="font-medium">Recursos Adicionais</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Análise de Chamadas</p>
                      <p className="text-sm text-neutral-500">
                        Gerar análise de sentimento e insights após cada chamada
                      </p>
                    </div>
                    <Switch
                      checked={configForm.watch("callAnalysis")}
                      onCheckedChange={(checked) => configForm.setValue("callAnalysis", checked)}
                      id="call-analysis"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Transcrição Automática</p>
                      <p className="text-sm text-neutral-500">
                        Gerar transcrições de texto para todas as chamadas
                      </p>
                    </div>
                    <Switch
                      checked={configForm.watch("transcriptionEnabled")}
                      onCheckedChange={(checked) => configForm.setValue("transcriptionEnabled", checked)}
                      id="transcription-enabled"
                    />
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? (
                    "Salvando configurações..."
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Salvar Configurações
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}