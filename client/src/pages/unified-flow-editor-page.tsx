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
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Phone,
  MessageSquare,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);

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
      case 'call_input':
        nodeData = { prompt: 'Chamada recebida' };
        nodeType2send = 'input';
        break;
      case 'voice_response':
        nodeData = { message: 'Olá, como posso ajudar?' };
        nodeType2send = 'message';
        break;
      case 'message_input':
        nodeData = { prompt: 'Nova mensagem recebida' };
        nodeType2send = 'input';
        break;
      case 'chatbot_response':
        nodeData = { message: 'Olá, como posso ajudar?' };
        nodeType2send = 'message';
        break;
      case 'condition':
        nodeData = { condition: 'true', description: 'Verificar condição' };
        nodeType2send = 'condition';
        break;
      default:
        nodeData = {};
        nodeType2send = 'message';
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

  // Se ocorreu um erro, mostrar mensagem
  if (flowError) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center gap-4 mt-10">
          <div className="text-destructive text-lg font-semibold">
            Erro ao carregar detalhes do fluxo unificado
          </div>
          <Button onClick={() => navigate('/unified-flow')}>Voltar para lista</Button>
        </div>
      </div>
    );
  }

  // Se está carregando, mostrar indicador
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-full mt-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/unified-flow')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{flow?.name || 'Editor de Fluxo Unificado'}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => {
              if (flow) {
                updateFlowMutation.mutate({
                  name: flow.name,
                  description: flow.description,
                  active: flow.active
                });
              }
            }}
            disabled={updateFlowMutation.isPending}
          >
            {updateFlowMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Painel esquerdo - Configurações */}
        <div className="col-span-12 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
              <CardDescription>Configure as propriedades do fluxo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flowName">Nome do fluxo</Label>
                  <Input
                    id="flowName"
                    value={flow?.name || ''}
                    onChange={(e) => setFlow(prev => prev ? {...prev, name: e.target.value} : null)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="flowDescription">Descrição</Label>
                  <Input
                    id="flowDescription"
                    value={flow?.description || ''}
                    onChange={(e) => setFlow(prev => prev ? {...prev, description: e.target.value} : null)}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flowActive"
                    checked={flow?.active || false}
                    onCheckedChange={(checked) => 
                      setFlow(prev => prev ? {...prev, active: checked === true} : null)
                    }
                  />
                  <label
                    htmlFor="flowActive"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Ativo
                  </label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-5">
              <div className="text-sm text-muted-foreground">
                ID: {flow?.id}
              </div>
              <div className="text-sm text-muted-foreground">
                Criado: {flow?.createdAt ? new Date(flow.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </CardFooter>
          </Card>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Componentes</CardTitle>
                <CardDescription>Arraste os componentes para o fluxo</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-b px-2 py-1 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">Componentes Comuns</p>
                </div>
                <div className="p-3 grid gap-2">
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('condition')}
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Condição
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('menu')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h2A1.5 1.5 0 0 1 5 1.5v2A1.5 1.5 0 0 1 3.5 5h-2A1.5 1.5 0 0 1 0 3.5v-2zM1.5 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-2zM0 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8zm1 3v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2H1zm14-1V8a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2h14zM2 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
                    </svg>
                    Menu Interativo
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('api_request')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                    </svg>
                    Chamada API
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('wait')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                    </svg>
                    Espera
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('goto')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5zm14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5z"/>
                    </svg>
                    Salto
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('end')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    Finalizar
                  </Button>
                </div>

                <div className="border-b px-2 py-1 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">Telefonia (Asterisk)</p>
                </div>
                <div className="p-3 grid gap-2">
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('call_input')}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Entrada de Chamada
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('answer')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511zm10.762.135a.5.5 0 0 1 .708 0l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 0 1-.708-.708L14.293 4H9.5a.5.5 0 0 1 0-1h4.793l-1.647-1.646a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    Atender Chamada
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('hangup')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path fill-rule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511zM15.854.146a.5.5 0 0 1 0 .708L11.707 5H13a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 1 0v1.293L14.146.146a.5.5 0 0 1 .708 0z"/>
                    </svg>
                    Desligar Chamada
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('tts')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M12.258 3h-8.51l-.083 2.46h.479c.26-1.544.758-1.783 2.693-1.845l.424-.013v7.827c0 .663-.144.82-1.3.923v.52h4.082v-.52c-1.162-.103-1.306-.26-1.306-.923V3.602l.431.013c1.934.062 2.434.301 2.693 1.846h.479L12.258 3z"/>
                    </svg>
                    Text-to-Speech
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('playback')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>
                    </svg>
                    Reproduzir Áudio
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('record')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M8 12a4 4 0 0 1-4-4V6.5c0-.22.347-2.5 4-2.5s4 2.28 4 2.5V8a4 4 0 0 1-4 4zm-4-1v1h8v-1a5.002 5.002 0 0 0 2-4V6.5C14 6.247 13.978 0 8 0S2 6.247 2 6.5V8a5.002 5.002 0 0 0 2 3z"/>
                    </svg>
                    Gravar Áudio
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('voice_response')}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Resposta de Voz
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('dial')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                    </svg>
                    Discar
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('queue')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                      <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
                    </svg>
                    Fila
                  </Button>
                </div>

                <div className="border-b px-2 py-1 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">Chatbot</p>
                </div>
                <div className="p-3 grid gap-2">
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('message_input')}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Entrada de Mensagem
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('chatbot_response')}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Resposta de Chatbot
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('webhook')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
                    </svg>
                    Webhook
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('typing')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M2 10V9h12v1H2zm0-4h12v1H2V6zm12-3v1H2V3h12zM2 12v1h12v-1H2z"/>
                    </svg>
                    Digitando
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('media')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                      <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                    </svg>
                    Mídia
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('location')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                    </svg>
                    Localização
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('file')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/>
                    </svg>
                    Arquivo
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left h-8 text-xs"
                    onClick={() => handleAddNode('contact')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
                      <path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zM11 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5zm.5 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4zm2 3a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-2zm0 3a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-2z"/>
                    </svg>
                    Contato
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nodeName">Nome do Componente</Label>
                        <Input
                          id="nodeName"
                          placeholder="Ex: Resposta Inicial"
                          value={nodeName}
                          onChange={(e) => setNodeName(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Canais Suportados</Label>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {availableChannels.map(channel => (
                            <div 
                              key={channel.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox 
                                id={`channel-${channel.id}`}
                                checked={selectedChannels.includes(channel.id)}
                                onCheckedChange={() => toggleChannel(channel.id)}
                                disabled={
                                  channel.id !== 'all' && 
                                  selectedChannels.includes('all')
                                }
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
                      
                      <div className="flex justify-between pt-4">
                        <Button variant="outline" onClick={() => {
                          setShowAddNodeForm(false);
                          setNodeName('');
                          setNodeType('');
                          setSelectedChannels([]);
                        }}>
                          Cancelar
                        </Button>
                        
                        <Button 
                          onClick={handleSubmitNodeForm}
                          disabled={addNodeMutation.isPending}
                        >
                          {addNodeMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : nodes.length > 0 ? (
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {nodes.map((node) => (
                      <Card key={node.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{node.name}</CardTitle>
                          <CardDescription>Tipo: {node.nodeType}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-muted-foreground">
                            Posição: X: {node.position.x}, Y: {node.position.y}
                          </div>
                          {node.supportedChannels && node.supportedChannels.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Canais: {node.supportedChannels.join(', ')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
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
  );
}