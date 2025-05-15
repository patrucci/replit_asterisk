import { useState, useEffect } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { NodeEditor } from './unified-flow-node-editor';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Phone,
  MessageSquare,
  ArrowRightLeft,
  Loader2,
  Edit
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Utilizamos uma interface local para evitar erros de importação
interface UnifiedFlow {
  id: number;
  organizationId: number;
  name: string;
  description?: string;
  flowType?: string;
  active?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UnifiedNode {
  id: number;
  flowId: number;
  nodeType: string;
  name: string;
  data: any;
  position: { x: number; y: number };
  supportedChannels?: string[];
}

interface UnifiedEdge {
  id: number;
  flowId: number;
  sourceNodeId: number;
  targetNodeId: number;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  condition?: any;
}

export default function UnifiedFlowEditorPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [match, params] = useRoute('/unified-flow/:id');
  const [flow, setFlow] = useState<UnifiedFlow | null>(null);
  const [nodes, setNodes] = useState<UnifiedNode[]>([]);
  const [edges, setEdges] = useState<UnifiedEdge[]>([]);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [nodeType, setNodeType] = useState<string>('');
  const [nodeName, setNodeName] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  // Estado para edição de nó
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [isNodeEditorDialogOpen, setIsNodeEditorDialogOpen] = useState(false);
  const [editNodeData, setEditNodeData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para gerenciamento de canais
  const [isChannelsConfigOpen, setIsChannelsConfigOpen] = useState(false);
  const [flowChannels, setFlowChannels] = useState<string[]>(['all']);

  // Buscar detalhes do fluxo
  const { data: flowData, isLoading: isLoadingFlow, error: flowError } = useQuery({
    queryKey: ['/api/unified-flows', params?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/unified-flows/${params?.id}`);
      return await response.json();
    },
    enabled: !!params?.id
  });

  // Buscar nós do fluxo
  const { data: nodesData, isLoading: isLoadingNodes } = useQuery({
    queryKey: ['/api/unified-flows', params?.id, 'nodes'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/unified-flows/${params?.id}/nodes`);
      return await response.json();
    },
    enabled: !!params?.id
  });

  // Buscar arestas do fluxo
  const { data: edgesData, isLoading: isLoadingEdges } = useQuery({
    queryKey: ['/api/unified-flows', params?.id, 'edges'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/unified-flows/${params?.id}/edges`);
      return await response.json();
    },
    enabled: !!params?.id
  });

  // Carregar dados
  useEffect(() => {
    if (flowData) {
      setFlow(flowData);
    }
    if (nodesData) {
      setNodes(nodesData);
    }
    if (edgesData) {
      setEdges(edgesData);
    }

    if (!isLoadingFlow && !isLoadingNodes && !isLoadingEdges) {
      setIsLoading(false);
    }
  }, [flowData, nodesData, edgesData, isLoadingFlow, isLoadingNodes, isLoadingEdges]);

  // Mutação para atualizar fluxo
  const updateFlowMutation = useMutation({
    mutationFn: async (data: Partial<UnifiedFlow>) => {
      const response = await apiRequest('PUT', `/api/unified-flows/${params?.id}`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Fluxo atualizado',
        description: 'O fluxo unificado foi atualizado com sucesso.',
      });
      setFlow(data);
      queryClient.invalidateQueries({ queryKey: ['/api/unified-flows'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar fluxo',
        description: error.message || 'Ocorreu um erro ao atualizar o fluxo unificado.',
        variant: 'destructive',
      });
    }
  });

  // Mutação para adicionar nó
  const addNodeMutation = useMutation({
    mutationFn: async (data: { 
      flowId: number, 
      nodeType: string, 
      name: string, 
      data: any, 
      position: { x: number, y: number },
      supportedChannels?: string[]
    }) => {
      const response = await apiRequest('POST', `/api/unified-flows/${params?.id}/nodes`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Componente adicionado',
        description: 'O componente foi adicionado ao fluxo com sucesso.',
      });
      setNodes(prev => [...prev, data]);
      setNodeType('');
      setNodeName('');
      setShowAddNodeForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/unified-flows', params?.id, 'nodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao adicionar componente',
        description: error.message || 'Ocorreu um erro ao adicionar o componente ao fluxo.',
        variant: 'destructive',
      });
    }
  });

  // Mutação para atualizar nó existente
  const updateNodeMutation = useMutation({
    mutationFn: async (data: { 
      id: number,
      name?: string, 
      data?: any,
      position?: { x: number, y: number },
      supportedChannels?: string[]
    }) => {
      const response = await apiRequest('PUT', `/api/unified-nodes/${data.id}`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Componente atualizado',
        description: 'O componente foi atualizado com sucesso.',
      });
      setNodes(prev => prev.map(node => node.id === data.id ? data : node));
      setSelectedNode(null);
      setIsNodeEditorDialogOpen(false);
      setEditNodeData({});
      queryClient.invalidateQueries({ queryKey: ['/api/unified-flows', params?.id, 'nodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar componente',
        description: error.message || 'Ocorreu um erro ao atualizar o componente.',
        variant: 'destructive',
      });
    }
  });

  // Canais disponíveis para seleção
  const availableChannels = [
    { id: 'all', name: 'Todos os canais' },
    { id: 'voice', name: 'Telefonia' },
    { id: 'chat', name: 'Chat (todos)' },
    { id: 'whatsapp', name: 'WhatsApp' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'webchat', name: 'Webchat' },
    { id: 'sms', name: 'SMS' },
    { id: 'asterisk', name: 'Asterisk' }
  ];

  // Função para adicionar um novo nó
  const handleAddNode = (type: string) => {
    setNodeType(type);
    setSelectedChannels(['all']); // Por padrão, seleciona todos os canais
    setShowAddNodeForm(true);
  };

  // Função para alternar a seleção de um canal
  const toggleChannel = (channelId: string) => {
    if (channelId === 'all') {
      // Se 'all' está sendo selecionado, limpa os outros
      if (!selectedChannels.includes('all')) {
        setSelectedChannels(['all']);
      } else {
        // Se 'all' está sendo desmarcado, não faz nada (sempre deve ter pelo menos um canal)
      }
    } else {
      // Se qualquer outro canal está sendo selecionado, remove 'all'
      if (selectedChannels.includes(channelId)) {
        // Removendo um canal
        const newSelectedChannels = selectedChannels.filter(c => c !== channelId);
        // Se não sobrar nenhum canal, adiciona 'all'
        if (newSelectedChannels.length === 0) {
          setSelectedChannels(['all']);
        } else {
          setSelectedChannels(newSelectedChannels);
        }
      } else {
        // Adicionando um canal
        const newSelectedChannels = selectedChannels.filter(c => c !== 'all').concat(channelId);
        setSelectedChannels(newSelectedChannels);
      }
    }
  };

  // Função para abrir o editor de nó
  const handleEditNode = (node: UnifiedNode) => {
    console.log("Editando nó:", node); // Debug
    setSelectedNode(node);
    
    // Populando dados iniciais com defaults baseados no tipo de nó
    let initialData = { ...node.data };
    
    // Inicializa campos específicos por tipo, se estiverem vazios
    switch(node.nodeType) {
      case 'message':
        initialData = { 
          message: initialData.message || 'Digite a mensagem aqui',
          ...initialData 
        };
        break;
      case 'input':
        initialData = { 
          prompt: initialData.prompt || 'O que você gostaria de saber?', 
          timeout: initialData.timeout || 30,
          ...initialData 
        };
        break;
      case 'condition':
        initialData = { 
          condition: initialData.condition || 'context.lastMessage == "sim"',
          description: initialData.description || 'Verifica se a última mensagem é "sim"',
          ...initialData 
        };
        break;
      case 'api_request':
      case 'api_integration':
        initialData = { 
          url: initialData.url || 'https://api.example.com/data',
          method: initialData.method || 'GET',
          headers: initialData.headers || {},
          ...initialData 
        };
        break;
      case 'menu':
        initialData = { 
          prompt: initialData.prompt || 'Escolha uma opção:',
          options: initialData.options || [
            { value: '1', label: 'Opção 1' },
            { value: '2', label: 'Opção 2' }
          ],
          ...initialData 
        };
        break;
      case 'play_tts':
        initialData = { 
          text: initialData.text || 'Texto a ser convertido em fala',
          voice: initialData.voice || 'female1',
          ...initialData 
        };
        break;
      case 'get_input':
        initialData = { 
          prompt: initialData.prompt || 'Digite um número de 1 a 5',
          timeout: initialData.timeout || 10,
          maxDigits: initialData.maxDigits || 1,
          ...initialData 
        };
        break;
    }
    
    setEditNodeData({
      name: node.name,
      data: initialData,
      supportedChannels: node.supportedChannels || ['all']
    });
    
    setIsNodeEditorDialogOpen(true);
  };

  // Função para fechar o editor de nó
  const handleCloseNodeEditor = () => {
    setSelectedNode(null);
    setIsNodeEditorDialogOpen(false);
    setEditNodeData({});
  };

  // Função para salvar as alterações de um nó
  const handleSaveNodeEdits = (editedNode: { 
    id: number, 
    name: string, 
    data: any, 
    supportedChannels?: string[]
  }) => {
    if (!editedNode.name || !editedNode.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o componente.',
        variant: 'destructive',
      });
      return;
    }

    console.log("Salvando nó editado:", editedNode);
    updateNodeMutation.mutate(editedNode);
  };

  // Função para enviar o formulário de adição de nó
  const handleSubmitNodeForm = () => {
    if (!nodeName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o componente.',
        variant: 'destructive',
      });
      return;
    }

    if (!flow?.id) return;

    // Dados específicos baseados no tipo de nó
    let nodeData = {};
    let nodeType2send = '';
    
    switch (nodeType) {
      // Nós comuns a todos os canais
      case 'call_input':
        nodeData = { prompt: 'Chamada recebida', timeout: 30 };
        nodeType2send = 'input';
        break;
      case 'voice_response':
        nodeData = { message: 'Olá, como posso ajudar?', voice: 'female1' };
        nodeType2send = 'message';
        break;
      case 'message_input':
        nodeData = { prompt: 'Nova mensagem recebida', timeout: 30 };
        nodeType2send = 'input';
        break;
      case 'chatbot_response':
        nodeData = { message: 'Olá, como posso ajudar?' };
        nodeType2send = 'message';
        break;
      case 'condition':
        nodeData = { condition: 'context.lastInput == "sim"', description: 'Verificar se a entrada foi "sim"' };
        nodeType2send = 'condition';
        break;
        
      // Nós específicos para chatbot
      case 'CHATBOT_BASIC_MESSAGE':
        nodeData = { message: 'Digite a mensagem aqui' };
        nodeType2send = 'message';
        break;
      case 'CHATBOT_COLLECT_USER_INPUT':
        nodeData = { prompt: 'O que você gostaria de saber?', timeout: 30 };
        nodeType2send = 'input';
        break;
      case 'CHATBOT_CONDITIONAL':
        nodeData = { condition: 'context.lastMessage == "sim"', description: 'Verifica se a última mensagem é "sim"' };
        nodeType2send = 'condition';
        break;
      case 'CHATBOT_API_REQUEST':
        nodeData = { url: 'https://api.example.com/data', method: 'GET', headers: {} };
        nodeType2send = 'api_request';
        break;
      case 'CHATBOT_MENU_OPTIONS':
        nodeData = { 
          prompt: 'Escolha uma opção:', 
          options: [
            { value: '1', label: 'Opção 1' },
            { value: '2', label: 'Opção 2' }
          ] 
        };
        nodeType2send = 'menu';
        break;
        
      // Nós específicos para Asterisk
      case 'ASTERISK_PLAY_TTS':
        nodeData = { text: 'Texto a ser convertido em fala', voice: 'female1' };
        nodeType2send = 'play_tts';
        break;
      case 'ASTERISK_GET_INPUT':
        nodeData = { prompt: 'Digite um número de 1 a 5', timeout: 10, maxDigits: 1 };
        nodeType2send = 'get_input';
        break;
      case 'ASTERISK_TRANSFER':
        nodeData = { destination: 'extension', number: '1000' };
        nodeType2send = 'transfer';
        break;
      case 'ASTERISK_CONDITIONAL':
        nodeData = { condition: 'input == 1', description: 'Verifica se a entrada é igual a 1' };
        nodeType2send = 'condition';
        break;
      case 'ASTERISK_PLAY_AUDIO':
        nodeData = { audioFile: 'welcome.wav' };
        nodeType2send = 'play_audio';
        break;
      case 'ASTERISK_QUEUE':
        nodeData = { queueName: 'support', timeout: 300 };
        nodeType2send = 'queue';
        break;
      case 'ASTERISK_VOICEMAIL':
        nodeData = { extension: '1000' };
        nodeType2send = 'voicemail';
        break;
      case 'ASTERISK_HANGUP':
        nodeData = { reason: 'normal', message: 'Obrigado pela sua ligação' };
        nodeType2send = 'hangup';
        break;
        
      // Nós de integração
      case 'API_INTEGRATION':
        nodeData = { url: '', method: 'GET', headers: {}, body: {} };
        nodeType2send = 'api_integration';
        break;
      case 'DATABASE_QUERY':
        nodeData = { query: '', params: [] };
        nodeType2send = 'db_query';
        break;
      case 'AI_INTEGRATION':
        nodeData = { prompt: '', model: 'gpt-4o', maxTokens: 1000 };
        nodeType2send = 'ai_integration';
        break;
        
      default:
        nodeData = {};
        nodeType2send = nodeType;
    }

    // Calcula uma posição aleatória no canvas
    const position = {
      x: 100 + Math.floor(Math.random() * 300),
      y: 100 + Math.floor(Math.random() * 300)
    };

    addNodeMutation.mutate({
      flowId: flow.id,
      nodeType: nodeType2send,
      name: nodeName,
      data: nodeData,
      position,
      supportedChannels: selectedChannels
    });
  };

  return (
    <>
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/unified-flow')} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{flow?.name || 'Fluxo Unificado'}</h1>
        </div>
        
        {/* Grid principal com painel esquerdo e direito */}
        <div className="grid grid-cols-12 gap-6">
          {/* Painel esquerdo - Lista de componentes disponíveis */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="h-[800px] overflow-auto">
              <CardHeader className="border-b">
                <CardTitle>Componentes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="components" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="components">Componentes</TabsTrigger>
                    <TabsTrigger value="channels">Canais</TabsTrigger>
                    <TabsTrigger value="editor">Lista de Nós</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="components" className="p-0">
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Componentes Comuns</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('message')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Mensagem
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('input')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Entrada
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('condition')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Condição
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('menu')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Menu
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Chatbot</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('CHATBOT_BASIC_MESSAGE')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Mensagem de Texto
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('CHATBOT_COLLECT_USER_INPUT')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Coletar Entrada
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('CHATBOT_CONDITIONAL')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Condição
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('CHATBOT_API_REQUEST')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Requisição API
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('CHATBOT_MENU_OPTIONS')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Menu de Opções
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Asterisk (Telefonia)</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_PLAY_TTS')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Reproduzir TTS
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_GET_INPUT')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Obter Entrada
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_TRANSFER')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Transferir
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_CONDITIONAL')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Condição
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_PLAY_AUDIO')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Reproduzir Áudio
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_QUEUE')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Fila
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_VOICEMAIL')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Correio de Voz
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('ASTERISK_HANGUP')}>
                            <Phone className="h-4 w-4 mr-2" />
                            Desligar
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Integrações</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('API_INTEGRATION')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            API Externa
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('DATABASE_QUERY')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Consulta de Banco
                          </Button>
                          <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddNode('AI_INTEGRATION')}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Inteligência Artificial
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="editor" className="p-0">
                    {nodes.length > 0 ? (
                      <div className="p-4 space-y-4">
                        {nodes.map((node) => (
                          <Card key={node.id} className="overflow-hidden">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">{node.name}</CardTitle>
                              <CardDescription>Tipo: {node.nodeType}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                              <div className="text-xs text-muted-foreground">
                                Posição: X: {node.position.x}, Y: {node.position.y}
                              </div>
                              {node.supportedChannels && node.supportedChannels.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Canais: {node.supportedChannels.join(', ')}
                                </div>
                              )}
                              {node.data && (
                                <div className="mt-2 p-2 bg-muted/30 rounded-sm text-xs">
                                  {Object.entries(node.data).map(([key, value]) => (
                                    <div key={key} className="flex justify-between mb-1">
                                      <span className="font-medium">{key}:</span>
                                      <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                            <CardFooter className="pt-2 pb-2 bg-muted/30 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-7"
                                onClick={() => handleEditNode(node)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Configurar
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        Nenhum componente adicionado ao fluxo.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Painel direito - Editor visual */}
          <div className="col-span-12 lg:col-span-9">
            <Card className="h-[800px]">
              <CardHeader className="border-b">
                <CardTitle>Editor Visual</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full bg-neutral-50">
                {showAddNodeForm ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                      <h3 className="text-xl font-semibold mb-4">Adicionar Componente</h3>
                      
                      <div className="mb-4">
                        <Label htmlFor="node-name" className="mb-1 block">Nome do Componente</Label>
                        <Input 
                          id="node-name" 
                          placeholder="Digite um nome para o componente" 
                          value={nodeName}
                          onChange={(e) => setNodeName(e.target.value)}
                        />
                      </div>
                      
                      <div className="mb-4">
                        <Label className="mb-1 block">Tipo: {nodeType}</Label>
                      </div>
                      
                      <div className="mb-6">
                        <Label className="mb-1 block">Canais Suportados</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {availableChannels.map(channel => (
                            <div key={channel.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`channel-${channel.id}`} 
                                checked={selectedChannels.includes(channel.id)}
                                onCheckedChange={() => toggleChannel(channel.id)}
                                disabled={channel.id !== 'all' && selectedChannels.includes('all')}
                              />
                              <Label 
                                htmlFor={`channel-${channel.id}`}
                                className="text-xs cursor-pointer"
                              >
                                {channel.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddNodeForm(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSubmitNodeForm} disabled={addNodeMutation.isPending}>
                          {addNodeMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : nodes.length > 0 ? (
                  <div className="p-6">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        {nodes.length} componente(s) adicionado(s) ao fluxo. O editor visual está em desenvolvimento.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nodes.map((node) => (
                          <Card key={node.id} className="overflow-hidden h-[120px] flex flex-col">
                            <CardHeader className="p-3 pb-2">
                              <CardTitle className="text-base">{node.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {node.nodeType}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 pb-2 text-xs flex-grow">
                              <div className="line-clamp-2">
                                {node.data && Object.keys(node.data).length > 0 ? (
                                  Object.entries(node.data)
                                    .filter(([key, value]) => value && (typeof value === 'string' || typeof value === 'number'))
                                    .slice(0, 1)
                                    .map(([key, value]) => (
                                      <span key={key}>
                                        {key}: {value as string}
                                      </span>
                                    ))
                                ) : (
                                  <span className="text-muted-foreground">Sem dados</span>
                                )}
                              </div>
                            </CardContent>
                            <CardFooter className="p-0 mt-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full rounded-none text-xs h-7 hover:bg-muted"
                                onClick={() => handleEditNode(node)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-center">
                      <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Editor em Desenvolvimento</h3>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        Selecione um componente do painel esquerdo para adicionar ao seu fluxo unificado.
                      </p>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        O editor visual avançado está em desenvolvimento e em breve permitirá conectar os componentes.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog para edição de nós */}
      <Dialog open={isNodeEditorDialogOpen} onOpenChange={(open) => {
        if (!open) handleCloseNodeEditor();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurar Componente</DialogTitle>
            <DialogDescription>
              Configure as propriedades do componente {selectedNode?.nodeType}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Nome do componente */}
            <div className="space-y-2">
              <Label htmlFor="editNodeName">Nome do Componente</Label>
              <Input
                id="editNodeName"
                value={editNodeData.name || ''}
                onChange={(e) => setEditNodeData({...editNodeData, name: e.target.value})}
              />
            </div>
            
            {/* Campos específicos por tipo de nó */}
            {/* Nós de mensagem */}
            {(selectedNode?.nodeType === 'message' || 
              selectedNode?.nodeType === 'chatbot_response' || 
              selectedNode?.nodeType === 'voice_response') && (
              <div className="space-y-2">
                <Label htmlFor="messageText">Mensagem</Label>
                <Textarea
                  id="messageText"
                  value={editNodeData.data?.message || ''}
                  onChange={(e) => setEditNodeData({
                    ...editNodeData, 
                    data: {...editNodeData.data, message: e.target.value}
                  })}
                  rows={4}
                />
                {selectedNode?.nodeType === 'voice_response' && (
                  <div className="mt-2">
                    <Label htmlFor="voiceType">Tipo de Voz</Label>
                    <select
                      id="voiceType"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={editNodeData.data?.voice || 'female1'}
                      onChange={(e) => setEditNodeData({
                        ...editNodeData, 
                        data: {...editNodeData.data, voice: e.target.value}
                      })}
                    >
                      <option value="female1">Feminina 1</option>
                      <option value="female2">Feminina 2</option>
                      <option value="male1">Masculina 1</option>
                      <option value="male2">Masculina 2</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            
            {/* Nós de entrada/input */}
            {(selectedNode?.nodeType === 'input' || 
              selectedNode?.nodeType === 'call_input' || 
              selectedNode?.nodeType === 'message_input' || 
              selectedNode?.nodeType === 'get_input') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="promptText">Texto da Pergunta</Label>
                  <Textarea
                    id="promptText"
                    value={editNodeData.data?.prompt || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, prompt: e.target.value}
                    })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timeoutValue">Timeout (segundos)</Label>
                  <Input
                    id="timeoutValue"
                    type="number"
                    value={editNodeData.data?.timeout || 30}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, timeout: parseInt(e.target.value)}
                    })}
                  />
                </div>
                
                {/* Campos específicos para entrada de telefonia */}
                {(selectedNode?.nodeType === 'get_input') && (
                  <div className="space-y-2">
                    <Label htmlFor="maxDigits">Número Máximo de Dígitos</Label>
                    <Input
                      id="maxDigits"
                      type="number"
                      value={editNodeData.data?.maxDigits || 1}
                      onChange={(e) => setEditNodeData({
                        ...editNodeData, 
                        data: {...editNodeData.data, maxDigits: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Nós de condição */}
            {(selectedNode?.nodeType === 'condition') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="conditionExpr">Expressão da Condição</Label>
                  <Input
                    id="conditionExpr"
                    value={editNodeData.data?.condition || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, condition: e.target.value}
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="conditionDescription">Descrição</Label>
                  <Input
                    id="conditionDescription"
                    value={editNodeData.data?.description || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, description: e.target.value}
                    })}
                  />
                </div>
              </div>
            )}
            
            {/* Nós de API */}
            {(selectedNode?.nodeType === 'api_request' || 
              selectedNode?.nodeType === 'api_integration') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiUrl">URL da API</Label>
                  <Input
                    id="apiUrl"
                    value={editNodeData.data?.url || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, url: e.target.value}
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiMethod">Método</Label>
                  <select
                    id="apiMethod"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editNodeData.data?.method || 'GET'}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, method: e.target.value}
                    })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="requestHeaders">Headers (JSON)</Label>
                  <Textarea
                    id="requestHeaders"
                    value={typeof editNodeData.data?.headers === 'object' 
                      ? JSON.stringify(editNodeData.data.headers, null, 2) 
                      : '{}'}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        setEditNodeData({
                          ...editNodeData, 
                          data: {...editNodeData.data, headers}
                        });
                      } catch (error) {
                        // Ignora erro de parsing
                      }
                    }}
                    rows={3}
                    placeholder='{"Content-Type": "application/json"}'
                  />
                </div>
                
                {editNodeData.data?.method === 'POST' || editNodeData.data?.method === 'PUT' ? (
                  <div className="space-y-2">
                    <Label htmlFor="requestBody">Body (JSON)</Label>
                    <Textarea
                      id="requestBody"
                      value={typeof editNodeData.data?.body === 'object' 
                        ? JSON.stringify(editNodeData.data.body, null, 2) 
                        : '{}'}
                      onChange={(e) => {
                        try {
                          const body = JSON.parse(e.target.value);
                          setEditNodeData({
                            ...editNodeData, 
                            data: {...editNodeData.data, body}
                          });
                        } catch (error) {
                          // Ignora erro de parsing
                        }
                      }}
                      rows={3}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                ) : null}
              </div>
            )}
            
            {/* Nós de menu */}
            {selectedNode?.nodeType === 'menu' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="menuPrompt">Texto do Menu</Label>
                  <Textarea
                    id="menuPrompt"
                    value={editNodeData.data?.prompt || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, prompt: e.target.value}
                    })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Opções</Label>
                  {(editNodeData.data?.options || []).map((option: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2 mt-2">
                      <Input
                        placeholder="Valor"
                        className="flex-shrink-0 w-24"
                        value={option.value || ''}
                        onChange={(e) => {
                          const newOptions = [...(editNodeData.data?.options || [])];
                          newOptions[index] = {...newOptions[index], value: e.target.value};
                          setEditNodeData({
                            ...editNodeData,
                            data: {...editNodeData.data, options: newOptions}
                          });
                        }}
                      />
                      <Input
                        placeholder="Rótulo"
                        className="flex-grow"
                        value={option.label || ''}
                        onChange={(e) => {
                          const newOptions = [...(editNodeData.data?.options || [])];
                          newOptions[index] = {...newOptions[index], label: e.target.value};
                          setEditNodeData({
                            ...editNodeData,
                            data: {...editNodeData.data, options: newOptions}
                          });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newOptions = [...(editNodeData.data?.options || [])];
                          newOptions.splice(index, 1);
                          setEditNodeData({
                            ...editNodeData,
                            data: {...editNodeData.data, options: newOptions}
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const newOptions = [...(editNodeData.data?.options || []), {value: '', label: ''}];
                      setEditNodeData({
                        ...editNodeData,
                        data: {...editNodeData.data, options: newOptions}
                      });
                    }}
                  >
                    Adicionar Opção
                  </Button>
                </div>
              </div>
            )}
            
            {/* Nós de Asterisk específicos */}
            {selectedNode?.nodeType === 'play_tts' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ttsText">Texto para Fala</Label>
                  <Textarea
                    id="ttsText"
                    value={editNodeData.data?.text || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, text: e.target.value}
                    })}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ttsVoice">Voz</Label>
                  <select
                    id="ttsVoice"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editNodeData.data?.voice || 'female1'}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, voice: e.target.value}
                    })}
                  >
                    <option value="female1">Feminina 1</option>
                    <option value="female2">Feminina 2</option>
                    <option value="male1">Masculina 1</option>
                    <option value="male2">Masculina 2</option>
                  </select>
                </div>
              </div>
            )}
            
            {selectedNode?.nodeType === 'play_audio' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="audioFile">Arquivo de Áudio</Label>
                  <Input
                    id="audioFile"
                    value={editNodeData.data?.audioFile || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, audioFile: e.target.value}
                    })}
                  />
                </div>
              </div>
            )}
            
            {selectedNode?.nodeType === 'transfer' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="destination">Tipo de Destino</Label>
                  <select
                    id="destination"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editNodeData.data?.destination || 'extension'}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, destination: e.target.value}
                    })}
                  >
                    <option value="extension">Ramal</option>
                    <option value="number">Número Externo</option>
                    <option value="queue">Fila</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transferNumber">Número/Ramal/Fila</Label>
                  <Input
                    id="transferNumber"
                    value={editNodeData.data?.number || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, number: e.target.value}
                    })}
                  />
                </div>
              </div>
            )}
            
            {selectedNode?.nodeType === 'queue' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="queueName">Nome da Fila</Label>
                  <Input
                    id="queueName"
                    value={editNodeData.data?.queueName || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, queueName: e.target.value}
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="queueTimeout">Timeout (segundos)</Label>
                  <Input
                    id="queueTimeout"
                    type="number"
                    value={editNodeData.data?.timeout || 300}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, timeout: parseInt(e.target.value)}
                    })}
                  />
                </div>
              </div>
            )}
            
            {selectedNode?.nodeType === 'voicemail' && (
              <div className="space-y-2">
                <Label htmlFor="extension">Ramal</Label>
                <Input
                  id="extension"
                  value={editNodeData.data?.extension || ''}
                  onChange={(e) => setEditNodeData({
                    ...editNodeData, 
                    data: {...editNodeData.data, extension: e.target.value}
                  })}
                />
              </div>
            )}
            
            {selectedNode?.nodeType === 'hangup' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hangupReason">Motivo</Label>
                  <select
                    id="hangupReason"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editNodeData.data?.reason || 'normal'}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, reason: e.target.value}
                    })}
                  >
                    <option value="normal">Normal</option>
                    <option value="busy">Ocupado</option>
                    <option value="congestion">Congestionamento</option>
                    <option value="no_answer">Sem Resposta</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hangupMessage">Mensagem Final</Label>
                  <Input
                    id="hangupMessage"
                    value={editNodeData.data?.message || ''}
                    onChange={(e) => setEditNodeData({
                      ...editNodeData, 
                      data: {...editNodeData.data, message: e.target.value}
                    })}
                  />
                </div>
              </div>
            )}
            
            {/* Canais suportados para qualquer tipo de nó */}
            <div className="space-y-2 pt-2 border-t mt-4">
              <Label>Canais Suportados</Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {availableChannels.map(channel => (
                  <div 
                    key={channel.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox 
                      id={`edit-channel-${channel.id}`}
                      checked={(editNodeData.supportedChannels || []).includes(channel.id)}
                      onCheckedChange={() => {
                        const channels = [...(editNodeData.supportedChannels || [])];
                        
                        if (channel.id === 'all') {
                          // Se 'all' está sendo selecionado, limpa os outros
                          if (!channels.includes('all')) {
                            setEditNodeData({...editNodeData, supportedChannels: ['all']});
                          }
                        } else {
                          // Se qualquer outro canal está sendo selecionado
                          if (channels.includes(channel.id)) {
                            // Removendo o canal
                            const newChannels = channels.filter(c => c !== channel.id);
                            if (newChannels.length === 0) {
                              setEditNodeData({...editNodeData, supportedChannels: ['all']});
                            } else {
                              setEditNodeData({...editNodeData, supportedChannels: newChannels});
                            }
                          } else {
                            // Adicionando o canal
                            const newChannels = channels.filter(c => c !== 'all').concat(channel.id);
                            setEditNodeData({...editNodeData, supportedChannels: newChannels});
                          }
                        }
                      }}
                      disabled={
                        channel.id !== 'all' && 
                        (editNodeData.supportedChannels || []).includes('all')
                      }
                    />
                    <Label 
                      htmlFor={`edit-channel-${channel.id}`}
                      className="text-xs cursor-pointer"
                    >
                      {channel.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseNodeEditor}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleSaveNodeEdits({
                id: selectedNode?.id || 0,
                name: editNodeData.name,
                data: editNodeData.data,
                supportedChannels: editNodeData.supportedChannels
              })}
              disabled={updateNodeMutation.isPending}
            >
              {updateNodeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}