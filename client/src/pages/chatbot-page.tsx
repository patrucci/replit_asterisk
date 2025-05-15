import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  Trash, 
  Edit, 
  Copy, 
  LayoutGrid, 
  ListFilter,
  Smartphone,
  Globe,
  Code,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Send,
  BellRing 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { SimpleFlowEditor } from "@/components/chatbot/simple-flow-editor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FacebookChannelCredentialsForm } from "@/components/chatbot/facebook-channel-credentials-form";
import { InstagramChannelCredentialsForm } from "@/components/chatbot/instagram-channel-credentials-form";
import { LinkedInChannelCredentialsForm } from "@/components/chatbot/linkedin-channel-credentials-form";
import type { 
  Chatbot, 
  ChatbotChannel, 
  ChatbotFlow,
  ChatbotNode,
  ChatbotEdge,
  ChatbotConversation
} from "@shared/chatbot-schema";

// Schema de validação para criação/edição de chatbots
const chatbotFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

// Schema de validação para criação/edição de canais
const channelFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  channelType: z.enum(["whatsapp", "telegram", "webchat", "sms", "api", "facebook", "instagram", "linkedin"]),
  credentials: z.record(z.string()),
  webhookUrl: z.string().optional(),
  active: z.boolean().default(true),
});

// Schemas específicos para as credenciais dos canais sociais
const facebookCredentialsSchema = z.object({
  pageId: z.string().optional(),
  pageAccessToken: z.string().optional(),
  appSecret: z.string().optional(),
});

const instagramCredentialsSchema = z.object({
  instagramAccountId: z.string().optional(),
  accessToken: z.string().optional(),
});

const linkedinCredentialsSchema = z.object({
  linkedinPageId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
});

// Schema de validação para criação/edição de fluxos
const flowFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export default function ChatbotPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("chatbots");
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChatbotChannel | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
  const [isFlowEditor, setIsFlowEditor] = useState(false);
  const [isNewChatbotDialogOpen, setIsNewChatbotDialogOpen] = useState(false);
  const [isNewChannelDialogOpen, setIsNewChannelDialogOpen] = useState(false);
  const [isEditChannelDialogOpen, setIsEditChannelDialogOpen] = useState(false);
  const [isNewFlowDialogOpen, setIsNewFlowDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para gerenciar os formulários de credenciais das redes sociais
  const [facebookCredentials, setFacebookCredentials] = useState(facebookCredentialsSchema.parse({}));
  const [instagramCredentials, setInstagramCredentials] = useState(instagramCredentialsSchema.parse({}));
  const [linkedinCredentials, setLinkedinCredentials] = useState(linkedinCredentialsSchema.parse({}));
  const [channelCredentials, setChannelCredentials] = useState<Record<string, string>>({}); // Para outros canais
  
  // Queries para buscar dados
  const { data: chatbots = [], isLoading: isLoadingChatbots } = useQuery({
    queryKey: ["/api/chatbots"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chatbots");
      return await res.json() as Chatbot[];
    },
  });

  const { data: channels = [], isLoading: isLoadingChannels } = useQuery({
    queryKey: ["/api/chatbots", selectedChatbot?.id, "channels"],
    queryFn: async () => {
      if (!selectedChatbot) return [];
      const res = await apiRequest("GET", `/api/chatbots/${selectedChatbot.id}/channels`);
      return await res.json() as ChatbotChannel[];
    },
    enabled: !!selectedChatbot,
  });

  const { data: flows = [], isLoading: isLoadingFlows } = useQuery({
    queryKey: ["/api/chatbots", selectedChatbot?.id, "flows"],
    queryFn: async () => {
      if (!selectedChatbot) return [];
      const res = await apiRequest("GET", `/api/chatbots/${selectedChatbot.id}/flows`);
      return await res.json() as ChatbotFlow[];
    },
    enabled: !!selectedChatbot,
  });

  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ["/api/chatbots", selectedChatbot?.id, "conversations"],
    queryFn: async () => {
      if (!selectedChatbot) return [];
      const res = await apiRequest("GET", `/api/chatbots/${selectedChatbot.id}/conversations`);
      return await res.json() as ChatbotConversation[];
    },
    enabled: !!selectedChatbot && activeTab === "conversations",
  });

  // Mutations para criar/editar/excluir chatbots, canais e fluxos
  const createChatbotMutation = useMutation({
    mutationFn: async (data: z.infer<typeof chatbotFormSchema>) => {
      const res = await apiRequest("POST", "/api/chatbots", data);
      return await res.json() as Chatbot;
    },
    onSuccess: (newChatbot) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setIsNewChatbotDialogOpen(false);
      setSelectedChatbot(newChatbot);
      setIsSubmitting(false);
      toast({
        title: "Chatbot criado",
        description: "O chatbot foi criado com sucesso!",
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao criar chatbot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateChatbotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<z.infer<typeof chatbotFormSchema>> }) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, data);
      return await res.json() as Chatbot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      toast({
        title: "Chatbot atualizado",
        description: "O chatbot foi atualizado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar chatbot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteChatbotMutation = useMutation({
    mutationFn: async (id: number) => {
      toast({
        title: "Excluindo chatbot",
        description: "Esta operação pode levar alguns segundos...",
      });
      await apiRequest("DELETE", `/api/chatbots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setSelectedChatbot(null);
      setIsSubmitting(false);
      toast({
        title: "Chatbot excluído",
        description: "O chatbot foi excluído com sucesso!",
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao excluir chatbot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof channelFormSchema>) => {
      if (!selectedChatbot) throw new Error("Nenhum chatbot selecionado");
      const res = await apiRequest("POST", `/api/chatbots/${selectedChatbot.id}/channels`, data);
      return await res.json() as ChatbotChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "channels"] });
      setIsNewChannelDialogOpen(false);
      setIsSubmitting(false);
      toast({
        title: "Canal criado",
        description: "O canal foi criado com sucesso!",
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao criar canal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<z.infer<typeof channelFormSchema>> }) => {
      console.log("Atualizando canal:", id, "com dados:", data);
      const res = await apiRequest("PUT", `/api/channels/${id}`, data);
      return await res.json() as ChatbotChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "channels"] });
      setIsEditChannelDialogOpen(false);
      setIsSubmitting(false);
      toast({
        title: "Canal atualizado",
        description: "O canal foi atualizado com sucesso!",
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao atualizar canal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "channels"] });
      setSelectedChannel(null);
      toast({
        title: "Canal excluído",
        description: "O canal foi excluído com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir canal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFlowMutation = useMutation({
    mutationFn: async (data: z.infer<typeof flowFormSchema>) => {
      if (!selectedChatbot) throw new Error("Nenhum chatbot selecionado");
      const res = await apiRequest("POST", `/api/chatbots/${selectedChatbot.id}/flows`, data);
      return await res.json() as ChatbotFlow;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "flows"] });
      setIsNewFlowDialogOpen(false);
      
      // Selecionar o novo fluxo e abrir o editor
      setSelectedFlow(data);
      setIsFlowEditor(true);
      
      toast({
        title: "Fluxo criado",
        description: "O fluxo foi criado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFlowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<z.infer<typeof flowFormSchema>> }) => {
      const res = await apiRequest("PUT", `/api/flows/${id}`, data);
      return await res.json() as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "flows"] });
      toast({
        title: "Fluxo atualizado",
        description: "O fluxo foi atualizado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFlowMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/flows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots", selectedChatbot?.id, "flows"] });
      setSelectedFlow(null);
      toast({
        title: "Fluxo excluído",
        description: "O fluxo foi excluído com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getEmbedCodeMutation = useMutation({
    mutationFn: async (channelId: number) => {
      const res = await apiRequest("GET", `/api/chatbot/embed/${channelId}`);
      return await res.json() as { embedCode: string };
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.embedCode);
      toast({
        title: "Código copiado",
        description: "O código de incorporação foi copiado para a área de transferência!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao gerar código",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Formulários
  const chatbotForm = useForm<z.infer<typeof chatbotFormSchema>>({
    resolver: zodResolver(chatbotFormSchema),
    defaultValues: {
      name: "",
      description: "",
      active: true,
    },
  });

  const channelForm = useForm<z.infer<typeof channelFormSchema>>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      channelType: "webchat",
      credentials: {},
      webhookUrl: "",
      active: true,
    },
  });

  const flowForm = useForm<z.infer<typeof flowFormSchema>>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
    },
  });

  // Atualizar formulários quando um item é selecionado
  useEffect(() => {
    if (selectedChatbot) {
      chatbotForm.reset({
        name: selectedChatbot.name,
        description: selectedChatbot.description || "",
        active: selectedChatbot.active === null ? undefined : selectedChatbot.active,
      });
    } else {
      chatbotForm.reset({
        name: "",
        description: "",
        active: true,
      });
    }
  }, [selectedChatbot, chatbotForm]);

  useEffect(() => {
    if (selectedChannel && isEditChannelDialogOpen) {
      console.log("Editando canal:", selectedChannel);
      console.log("Credenciais do canal:", selectedChannel.credentials);
      
      const credentials = selectedChannel.credentials as Record<string, string> || {};
      
      // Configurar as credenciais para o tipo de canal específico
      if (selectedChannel.channelType === "facebook") {
        setFacebookCredentials(facebookCredentialsSchema.parse({
          pageId: credentials.pageId || "",
          pageAccessToken: credentials.pageAccessToken || "",
          appSecret: credentials.appSecret || ""
        }));
      } else if (selectedChannel.channelType === "instagram") {
        setInstagramCredentials(instagramCredentialsSchema.parse({
          instagramAccountId: credentials.instagramAccountId || "",
          accessToken: credentials.accessToken || ""
        }));
      } else if (selectedChannel.channelType === "linkedin") {
        setLinkedinCredentials(linkedinCredentialsSchema.parse({
          linkedinPageId: credentials.linkedinPageId || "",
          clientId: credentials.clientId || "",
          clientSecret: credentials.clientSecret || "",
          accessToken: credentials.accessToken || ""
        }));
      } else {
        // Para outros canais
        setChannelCredentials(credentials);
      }
      
      // Resetar o formulário com os valores atuais
      channelForm.reset({
        name: selectedChannel.name,
        channelType: selectedChannel.channelType,
        credentials: credentials,
        webhookUrl: selectedChannel.webhookUrl || "",
        active: selectedChannel.active === null ? undefined : selectedChannel.active,
      });
    } else if (isNewChannelDialogOpen) {
      // Limpar as credenciais para o novo canal
      setChannelCredentials({});
      setFacebookCredentials(facebookCredentialsSchema.parse({}));
      setInstagramCredentials(instagramCredentialsSchema.parse({}));
      setLinkedinCredentials(linkedinCredentialsSchema.parse({}));
      
      channelForm.reset({
        name: "",
        channelType: "webchat",
        credentials: {},
        webhookUrl: "",
        active: true,
      });
    }
  }, [selectedChannel, isEditChannelDialogOpen, isNewChannelDialogOpen, channelForm]);

  useEffect(() => {
    if (selectedFlow) {
      flowForm.reset({
        name: selectedFlow.name,
        description: selectedFlow.description || "",
        isDefault: selectedFlow.isDefault === null ? undefined : selectedFlow.isDefault,
      });
    } else {
      flowForm.reset({
        name: "",
        description: "",
        isDefault: false,
      });
    }
  }, [selectedFlow, flowForm]);

  // Renderização condicional: editor de fluxo ou página principal
  if (isFlowEditor && selectedFlow) {
    return (
      <SimpleFlowEditor 
        flow={selectedFlow} 
        onBack={() => setIsFlowEditor(false)} 
      />
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Chatbots</h2>
        <p className="text-sm text-neutral-500">Gerencie seus chatbots, canais e fluxos de conversação.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Painel lateral */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Chatbots</CardTitle>
              <CardDescription>
                Selecione um chatbot para gerenciar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {isLoadingChatbots ? (
                  <div className="p-4 text-center text-sm text-neutral-500">Carregando chatbots...</div>
                ) : chatbots.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">
                    Nenhum chatbot encontrado
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    {chatbots.map((chatbot) => (
                      <Button
                        key={chatbot.id}
                        variant={selectedChatbot?.id === chatbot.id ? "default" : "ghost"}
                        onClick={() => setSelectedChatbot(chatbot)}
                        className="w-full justify-start rounded-none text-left px-4"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span className="truncate">{chatbot.name}</span>
                        {!chatbot.active && (
                          <Badge variant="outline" className="ml-2 text-xs">Inativo</Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t p-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                onClick={() => {
                  setSelectedChatbot(null);
                  setIsNewChatbotDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Chatbot
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Painel principal */}
        <div className="md:col-span-3">
          {!selectedChatbot ? (
            <Card>
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-medium mb-2">Nenhum chatbot selecionado</h3>
                <p className="text-sm text-neutral-500 mb-4">
                  Selecione um chatbot existente ou crie um novo para começar.
                </p>
                <Button 
                  onClick={() => setIsNewChatbotDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar novo chatbot
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      {selectedChatbot.name}
                      {!selectedChatbot.active && (
                        <Badge variant="outline" className="ml-2">Inativo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {selectedChatbot.description || "Sem descrição"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        // Editar chatbot (prefere-se usar o form já renderizado)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-red-500"
                      onClick={() => {
                        if (!isSubmitting && confirm("Tem certeza que deseja excluir este chatbot? Esta ação não pode ser desfeita e excluirá todos os fluxos, canais e conversas associados.")) {
                          setIsSubmitting(true);
                          deleteChatbotMutation.mutate(selectedChatbot.id);
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="channels" onValueChange={setActiveTab} value={activeTab}>
                  <TabsList className="w-full border-b rounded-none">
                    <TabsTrigger value="channels" className="flex-1">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Canais
                    </TabsTrigger>
                    <TabsTrigger value="flows" className="flex-1">
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Fluxos
                    </TabsTrigger>
                    <TabsTrigger value="conversations" className="flex-1">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Conversas
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Tab de Canais */}
                  <TabsContent value="channels" className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Canais</h3>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedChannel(null);
                          setIsNewChannelDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Canal
                      </Button>
                    </div>
                    
                    {isLoadingChannels ? (
                      <div className="p-4 text-center text-sm text-neutral-500">Carregando canais...</div>
                    ) : channels.length === 0 ? (
                      <Alert>
                        <AlertTitle>Nenhum canal configurado</AlertTitle>
                        <AlertDescription>
                          Para começar a usar seu chatbot, adicione pelo menos um canal de comunicação.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {channels.map((channel) => (
                          <Card key={channel.id} className="overflow-hidden">
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-base flex items-center">
                                  {channel.name}
                                  {!channel.active && (
                                    <Badge variant="outline" className="ml-2 text-xs">Inativo</Badge>
                                  )}
                                </CardTitle>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      // Limpar o formulário antes de abrir o modal para evitar conflitos
                                      channelForm.reset({
                                        name: "",
                                        channelType: "webchat",
                                        credentials: {},
                                        webhookUrl: "",
                                        active: true
                                      });
                                      // Definir o canal selecionado e abrir o modal
                                      setSelectedChannel(channel);
                                      setIsEditChannelDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500"
                                    onClick={() => {
                                      if (confirm("Tem certeza que deseja excluir este canal?")) {
                                        deleteChannelMutation.mutate(channel.id);
                                      }
                                    }}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <CardDescription className="text-xs">
                                {getChannelTypeLabel(channel.channelType)}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              {channel.channelType === "webchat" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => getEmbedCodeMutation.mutate(channel.id)}
                                >
                                  <Code className="h-4 w-4 mr-2" />
                                  Copiar código de incorporação
                                </Button>
                              )}
                              {channel.channelType === "facebook" && (
                                <div className="text-xs text-neutral-500">
                                  <p><strong>Página:</strong> {getCredential(channel.credentials, "pageId")}</p>
                                  <p><strong>Webhook:</strong> {channel.webhookUrl || "Não configurado"}</p>
                                </div>
                              )}
                              {channel.channelType === "instagram" && (
                                <div className="text-xs text-neutral-500">
                                  <p><strong>Conta:</strong> {getCredential(channel.credentials, "instagramAccountId")}</p>
                                  <p><strong>Webhook:</strong> {channel.webhookUrl || "Não configurado"}</p>
                                </div>
                              )}
                              {channel.channelType === "linkedin" && (
                                <div className="text-xs text-neutral-500">
                                  <p><strong>Página:</strong> {getCredential(channel.credentials, "linkedinPageId")}</p>
                                  <p><strong>Webhook:</strong> {channel.webhookUrl || "Não configurado"}</p>
                                </div>
                              )}
                              {channel.channelType === "whatsapp" && (
                                <div className="text-xs text-neutral-500">
                                  <p><strong>Número:</strong> {getCredential(channel.credentials, "phoneNumber")}</p>
                                  <p><strong>Webhook:</strong> {channel.webhookUrl || "Não configurado"}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab de Fluxos */}
                  <TabsContent value="flows" className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Fluxos</h3>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedFlow(null);
                          setIsNewFlowDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Fluxo
                      </Button>
                    </div>
                    
                    {isLoadingFlows ? (
                      <div className="p-4 text-center text-sm text-neutral-500">Carregando fluxos...</div>
                    ) : flows.length === 0 ? (
                      <Alert>
                        <AlertTitle>Nenhum fluxo configurado</AlertTitle>
                        <AlertDescription>
                          Para começar a usar seu chatbot, crie pelo menos um fluxo de conversação.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {flows.map((flow) => (
                          <Card key={flow.id} className="overflow-hidden">
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-base flex items-center">
                                  {flow.name}
                                  {flow.isDefault && (
                                    <Badge className="ml-2 text-xs bg-green-500">Principal</Badge>
                                  )}
                                </CardTitle>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setSelectedFlow(flow);
                                      setIsFlowEditor(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500"
                                    onClick={() => {
                                      if (confirm("Tem certeza que deseja excluir este fluxo?")) {
                                        deleteFlowMutation.mutate(flow.id);
                                      }
                                    }}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <CardDescription className="text-xs">
                                {flow.description || "Sem descrição"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setSelectedFlow(flow);
                                  setIsFlowEditor(true);
                                }}
                              >
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                Editar fluxo
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab de Conversas */}
                  <TabsContent value="conversations" className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Conversas</h3>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filtrar por canal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os canais</SelectItem>
                          {channels.map(channel => (
                            <SelectItem key={channel.id} value={channel.id.toString()}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {isLoadingConversations ? (
                      <div className="p-4 text-center text-sm text-neutral-500">Carregando conversas...</div>
                    ) : conversations.length === 0 ? (
                      <Alert>
                        <AlertTitle>Nenhuma conversa encontrada</AlertTitle>
                        <AlertDescription>
                          Quando usuários iniciarem conversas com seu chatbot, elas aparecerão aqui.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        {conversations.map((conversation) => {
                          const channel = channels.find(c => c.id === conversation.channelId);
                          return (
                            <Card key={conversation.id} className="overflow-hidden">
                              <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-base">
                                    Conversa #{conversation.id}
                                  </CardTitle>
                                  <Badge variant={conversation.status === "active" ? "default" : "outline"}>
                                    {getStatusLabel(conversation.status)}
                                  </Badge>
                                </div>
                                <CardDescription className="text-xs">
                                  Iniciada em {new Date(conversation.startedAt).toLocaleString()}
                                  {channel && ` • Canal: ${channel.name}`}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    // Visualizar conversa
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab de Configurações */}
                  <TabsContent value="settings" className="p-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-4">Configurações do Chatbot</h3>
                      
                      <Form {...chatbotForm}>
                        <form onSubmit={chatbotForm.handleSubmit((data) => {
                          updateChatbotMutation.mutate({ id: selectedChatbot.id, data });
                        })} className="space-y-4">
                          <FormField
                            control={chatbotForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormDescription>
                                  Nome para identificar o chatbot
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={chatbotForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Descrição</FormLabel>
                                <FormControl>
                                  <Textarea {...field} />
                                </FormControl>
                                <FormDescription>
                                  Uma breve descrição para identificar o propósito deste chatbot
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={chatbotForm.control}
                            name="active"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Chatbot ativo
                                  </FormLabel>
                                  <FormDescription>
                                    Quando desativado, o chatbot não responderá a mensagens
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
                          
                          <Button type="submit" className="w-full">
                            Salvar alterações
                          </Button>
                        </form>
                      </Form>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo para criar novo chatbot */}
      <Dialog open={isNewChatbotDialogOpen} onOpenChange={setIsNewChatbotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo chatbot</DialogTitle>
            <DialogDescription>
              Preencha as informações abaixo para criar um novo chatbot.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...chatbotForm}>
            <form onSubmit={chatbotForm.handleSubmit((data) => {
              if (!isSubmitting) {
                setIsSubmitting(true);
                createChatbotMutation.mutate(data);
              }
            })} className="space-y-4">
              <FormField
                control={chatbotForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome para identificar o chatbot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={chatbotForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormDescription>
                      Uma breve descrição para identificar o propósito deste chatbot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={chatbotForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Chatbot ativo
                      </FormLabel>
                      <FormDescription>
                        Quando desativado, o chatbot não responderá a mensagens
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
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsNewChatbotDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar chatbot'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para criar novo canal */}
      <Dialog open={isNewChannelDialogOpen} onOpenChange={setIsNewChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo canal</DialogTitle>
            <DialogDescription>
              Configure um novo canal de comunicação para o chatbot.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...channelForm}>
            <form onSubmit={(e) => {
              e.preventDefault();
              channelForm.handleSubmit((data) => {
                setIsSubmitting(true);
                
                // Preparar dados com as credenciais corretas baseado no tipo de canal
                let newData = {...data};
                const channelType = data.channelType;
                
                if (channelType === "facebook") {
                  newData.credentials = { ...facebookCredentials };
                } else if (channelType === "instagram") {
                  newData.credentials = { ...instagramCredentials };
                } else if (channelType === "linkedin") {
                  newData.credentials = { ...linkedinCredentials };
                }
                
                createChannelMutation.mutate(newData);
              })();
            }} className="space-y-4">
              <FormField
                control={channelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome para identificar o canal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={channelForm.control}
                name="channelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de canal</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de canal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="webchat">Widget para site</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione o tipo de canal para configurar
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campos específicos para cada tipo de canal */}
              {channelForm.watch("channelType") === "facebook" && (
                <FacebookChannelCredentialsForm 
                  credentials={facebookCredentials}
                  onChange={(key, value) => {
                    const updatedCredentials = {
                      ...facebookCredentials,
                      [key]: value
                    };
                    setFacebookCredentials(updatedCredentials);
                    channelForm.setValue("credentials", {
                      ...channelForm.getValues("credentials"),
                      ...updatedCredentials
                    });
                  }}
                />
              )}
              
              {channelForm.watch("channelType") === "instagram" && (
                <InstagramChannelCredentialsForm 
                  credentials={instagramCredentials}
                  onChange={(key, value) => {
                    const updatedCredentials = {
                      ...instagramCredentials,
                      [key]: value
                    };
                    setInstagramCredentials(updatedCredentials);
                    channelForm.setValue("credentials", {
                      ...channelForm.getValues("credentials"),
                      ...updatedCredentials
                    });
                  }}
                />
              )}
              
              {channelForm.watch("channelType") === "linkedin" && (
                <LinkedInChannelCredentialsForm 
                  credentials={linkedinCredentials}
                  onChange={(key, value) => {
                    const updatedCredentials = {
                      ...linkedinCredentials,
                      [key]: value
                    };
                    setLinkedinCredentials(updatedCredentials);
                    channelForm.setValue("credentials", {
                      ...channelForm.getValues("credentials"),
                      ...updatedCredentials
                    });
                  }}
                />
              )}
              
              {channelForm.watch("channelType") === "whatsapp" && (
                <>
                  <FormItem>
                    <FormLabel>Número de telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: +5511999999999"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            phoneNumber: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.phoneNumber || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Número do WhatsApp que será usado para enviar mensagens
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de acesso</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            accessToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.accessToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso à API do WhatsApp
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do WhatsApp
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {channelForm.watch("channelType") === "telegram" && (
                <>
                  <FormItem>
                    <FormLabel>Token do Bot</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            botToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.botToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token obtido do BotFather no Telegram
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Nome do Bot</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: MeuEmpresaBot"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            botName: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.botName || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Nome do seu bot no Telegram
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do Telegram (configurada automaticamente)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "sms" && (
                <>
                  <FormItem>
                    <FormLabel>Provedor de SMS</FormLabel>
                    <Select 
                      value={channelForm.getValues("credentials")?.provider || "twilio"}
                      onValueChange={(value) => {
                        const credentials = channelForm.getValues("credentials") || {};
                        channelForm.setValue("credentials", {
                          ...credentials,
                          provider: value
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="zenvia">Zenvia</SelectItem>
                        <SelectItem value="totalvoice">TotalVoice</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione o provedor de SMS
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>ID da Conta (SID)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            accountSid: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.accountSid || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      ID da sua conta no provedor de SMS
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de autenticação</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Token de autenticação"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            authToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.authToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token de autenticação para a API de SMS
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Número de origem</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: +5511999999999"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            fromNumber: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.fromNumber || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Número que será exibido como remetente das mensagens
                    </FormDescription>
                  </FormItem>
                </>
              )}
              
              {channelForm.watch("channelType") === "api" && (
                <>
                  <FormItem>
                    <FormLabel>Token de API</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Token para autenticação na API"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            apiToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.apiToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token que será utilizado para autenticar requisições externas
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Formato de resposta</FormLabel>
                    <Select 
                      value={channelForm.getValues("credentials")?.responseFormat || "json"}
                      onValueChange={(value) => {
                        const credentials = channelForm.getValues("credentials") || {};
                        channelForm.setValue("credentials", {
                          ...credentials,
                          responseFormat: value
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Formato de resposta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Formato de resposta da API
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>URL de callback</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="URL para receber respostas assíncronas"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            callbackUrl: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.callbackUrl || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      URL onde o sistema irá enviar atualizações assíncronas
                    </FormDescription>
                  </FormItem>
                </>
              )}
              
              {channelForm.watch("channelType") === "webchat" && (
                <>
                  <FormItem>
                    <FormLabel>Nome do widget</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Suporte"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          const updatedCredentials = {
                            ...credentials,
                            widgetName: e.target.value
                          };
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        defaultValue=""
                        key={`widget-name-input-${Date.now()}`}
                      />
                    </FormControl>
                    <FormDescription>
                      Nome que será exibido no widget do chat
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Cor primária</FormLabel>
                    <FormControl>
                      <Input 
                        type="color"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          const updatedCredentials = {
                            ...credentials,
                            primaryColor: e.target.value
                          };
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        defaultValue="#4F46E5"
                        key={`color-input-${Date.now()}`}
                        className="h-10 w-full"
                      />
                    </FormControl>
                    <FormDescription>
                      Cor principal do widget
                    </FormDescription>
                  </FormItem>
                </>
              )}
              
              <FormField
                control={channelForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Canal ativo
                      </FormLabel>
                      <FormDescription>
                        Quando desativado, o canal não receberá ou enviará mensagens
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
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsNewChannelDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar canal'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar canal */}
      <Dialog open={isEditChannelDialogOpen} onOpenChange={setIsEditChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar canal</DialogTitle>
            <DialogDescription>
              Edite as configurações do canal de comunicação.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...channelForm}>
            <form onSubmit={(e) => {
              e.preventDefault();
              channelForm.handleSubmit((data) => {
                if (selectedChannel) {
                  setIsSubmitting(true);
                  
                  // Preparar dados com as credenciais corretas baseado no tipo de canal
                  let updatedData = {...data};
                  const channelType = data.channelType;
                  
                  if (channelType === "facebook") {
                    updatedData.credentials = { ...facebookCredentials };
                  } else if (channelType === "instagram") {
                    updatedData.credentials = { ...instagramCredentials };
                  } else if (channelType === "linkedin") {
                    updatedData.credentials = { ...linkedinCredentials };
                  }
                  
                  updateChannelMutation.mutate({ id: selectedChannel.id, data: updatedData });
                  // A fechar do diálogo é tratada no onSuccess do mutation
                }
              })();
            }} className="space-y-4">
              <FormField
                control={channelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome para identificar o canal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={channelForm.control}
                name="channelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de canal</FormLabel>
                    <FormControl>
                      <Input disabled value={getChannelTypeLabel(field.value)} />
                    </FormControl>
                    <FormDescription>
                      O tipo de canal não pode ser alterado
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Para debug durante a edição */}
              <div className="text-xs text-neutral-500 p-2 mb-2 bg-neutral-50 rounded">
                <pre>{JSON.stringify(channelForm.getValues().credentials, null, 2)}</pre>
              </div>
              
              {/* Campos específicos para cada tipo de canal (igual ao diálogo de criação) */}
              {channelForm.watch("channelType") === "whatsapp" && (
                <>
                  <FormItem>
                    <FormLabel>Número de telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: +5511999999999"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            phoneNumber: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.phoneNumber || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Número do WhatsApp que será usado para enviar mensagens
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de acesso</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            accessToken: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.accessToken || ""}

                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso à API do WhatsApp
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do WhatsApp
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "facebook" && (
                <>
                  <FormItem>
                    <FormLabel>ID da Página</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ID da página do Facebook"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            pageId: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.pageId || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      ID da página do Facebook que será conectada ao chatbot
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de Acesso da Página</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Token de acesso da página"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            pageAccessToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.pageAccessToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso da página do Facebook para integração com a API do Messenger
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Segredo do Aplicativo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Segredo do aplicativo"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            appSecret: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.appSecret || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Segredo do aplicativo Facebook usado para verificar as mensagens recebidas
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do Facebook Messenger
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "instagram" && (
                <>
                  <FormItem>
                    <FormLabel>ID da Conta do Instagram</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ID da conta do Instagram"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            instagramAccountId: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.instagramAccountId || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      ID da conta comercial do Instagram conectada à página do Facebook
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de Acesso</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Token de acesso"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            accessToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.accessToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso para a API do Instagram
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do Instagram
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "linkedin" && (
                <>
                  <FormItem>
                    <FormLabel>ID da Página LinkedIn</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ID da página LinkedIn"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            linkedinPageId: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.linkedinPageId || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      ID da página LinkedIn que será conectada ao chatbot
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Client ID do aplicativo LinkedIn"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            clientId: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.clientId || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Client ID do aplicativo LinkedIn para autenticação OAuth
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Client Secret do aplicativo LinkedIn"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            clientSecret: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.clientSecret || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Client Secret do aplicativo LinkedIn para autenticação OAuth
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Token de Acesso</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Token de acesso"
                        type="password"
                        onChange={(e) => {
                          const credentials = channelForm.getValues("credentials") || {};
                          channelForm.setValue("credentials", {
                            ...credentials,
                            accessToken: e.target.value
                          });
                        }}
                        value={channelForm.getValues("credentials")?.accessToken || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso para a API do LinkedIn
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do LinkedIn
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "telegram" && (
                <>
                  <FormItem>
                    <FormLabel>Token do Bot</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        type="password"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            botToken: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.botToken || ""}

                      />
                    </FormControl>
                    <FormDescription>
                      Token obtido do BotFather no Telegram
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Nome do Bot</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: MeuEmpresaBot"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            botName: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.botName || ""}

                      />
                    </FormControl>
                    <FormDescription>
                      Nome do seu bot no Telegram
                    </FormDescription>
                  </FormItem>
                  
                  <FormField
                    control={channelForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de webhook</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações do Telegram
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {channelForm.watch("channelType") === "webchat" && (
                <>
                  <FormItem>
                    <FormLabel>Nome do widget</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Suporte"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            widgetName: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.widgetName || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Nome que será exibido no widget do chat
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Cor primária</FormLabel>
                    <FormControl>
                      <Input 
                        type="color"
                        onChange={(e) => {
                          const updatedCredentials = {
                            ...channelCredentials,
                            primaryColor: e.target.value
                          };
                          setChannelCredentials(updatedCredentials);
                          channelForm.setValue("credentials", updatedCredentials);
                        }}
                        value={channelCredentials.primaryColor || "#4F46E5"}

                        className="h-10 w-full"
                      />
                    </FormControl>
                    <FormDescription>
                      Cor principal do widget
                    </FormDescription>
                  </FormItem>
                </>
              )}
              
              <FormField
                control={channelForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Canal ativo
                      </FormLabel>
                      <FormDescription>
                        Permite desativar o canal temporariamente sem excluí-lo
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
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditChannelDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para criar novo fluxo */}
      <Dialog open={isNewFlowDialogOpen} onOpenChange={setIsNewFlowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo fluxo</DialogTitle>
            <DialogDescription>
              Configure um novo fluxo de conversação para o chatbot.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...flowForm}>
            <form onSubmit={flowForm.handleSubmit((data) => {
              createFlowMutation.mutate(data);
            })} className="space-y-4">
              <FormField
                control={flowForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome para identificar o fluxo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={flowForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormDescription>
                      Uma breve descrição para identificar o propósito deste fluxo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={flowForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Fluxo principal
                      </FormLabel>
                      <FormDescription>
                        Quando ativado, este fluxo será o inicial para todas as conversas
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
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsNewFlowDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Criar fluxo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

// Funções auxiliares
function getChannelTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    webchat: "Widget para site",
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    sms: "SMS",
    api: "API"
  };
  return labels[type] || type;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Ativa",
    ended: "Finalizada",
    failed: "Falhou"
  };
  return labels[status] || status;
}

function getCredential(credentials: Record<string, any>, key: string): string {
  return credentials[key] || "Não configurado";
}