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
  type: string;
  name: string;
  data: any;
  position: { x: number; y: number };
}

interface UnifiedEdge {
  id: number;
  flowId: number;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
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
    mutationFn: async (data: { flowId: number, type: string, name: string, data: any, position: { x: number, y: number } }) => {
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

  // Função para adicionar um novo nó
  const handleAddNode = (type: string) => {
    setNodeType(type);
    setShowAddNodeForm(true);
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
    
    switch (nodeType) {
      case 'call_input':
        nodeData = { prompt: 'Chamada recebida' };
        break;
      case 'voice_response':
        nodeData = { message: 'Olá, como posso ajudar?' };
        break;
      case 'message_input':
        nodeData = { prompt: 'Nova mensagem recebida' };
        break;
      case 'chatbot_response':
        nodeData = { message: 'Olá, como posso ajudar?' };
        break;
      case 'condition':
        nodeData = { condition: 'true', description: 'Verificar condição' };
        break;
      default:
        nodeData = {};
    }

    // Calcula uma posição aleatória no canvas
    const position = {
      x: 100 + Math.floor(Math.random() * 300),
      y: 100 + Math.floor(Math.random() * 300)
    };

    addNodeMutation.mutate({
      flowId: flow.id,
      type: nodeType,
      name: nodeName,
      data: nodeData,
      position
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
              <CardContent>
                <div className="grid gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start text-left"
                    onClick={() => handleAddNode('call_input')}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Entrada de Chamada
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left"
                    onClick={() => handleAddNode('voice_response')}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Resposta de Voz
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left"
                    onClick={() => handleAddNode('message_input')}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Mensagem de Texto
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left"
                    onClick={() => handleAddNode('chatbot_response')}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Resposta de Chatbot
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left"
                    onClick={() => handleAddNode('condition')}
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Condição
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
                      
                      <div className="flex justify-between pt-4">
                        <Button variant="outline" onClick={() => {
                          setShowAddNodeForm(false);
                          setNodeName('');
                          setNodeType('');
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
                          <CardDescription>Tipo: {node.type}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-muted-foreground">
                            Posição: X: {node.position.x}, Y: {node.position.y}
                          </div>
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