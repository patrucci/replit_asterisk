import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  MarkerType,
  updateEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ChatbotFlow, ChatbotNode, ChatbotEdge } from '@shared/chatbot-schema';
import { 
  Save, 
  ArrowLeft, 
  MessageSquare,
  Keyboard,
  GitBranch,
  Server,
  List,
  Clock,
  CornerDownRight,
  ImagePlus,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Componentes de tipo de nó
function MessageNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-blue-50 border-blue-200 w-56">
      <div className="font-medium text-xs mb-1 text-blue-800 flex items-center">
        <MessageSquare className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-3 text-neutral-600">
        {data.content || "Sem conteúdo"}
      </div>
    </div>
  );
}

function InputNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-green-50 border-green-200 w-56">
      <div className="font-medium text-xs mb-1 text-green-800 flex items-center">
        <Keyboard className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-3 text-neutral-600">
        {data.question || "Sem pergunta"}
      </div>
      <div className="text-xs mt-1 text-green-600">
        Variável: {data.variableName || "não definida"}
      </div>
    </div>
  );
}

function ConditionNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-yellow-50 border-yellow-200 w-56">
      <div className="font-medium text-xs mb-1 text-yellow-800 flex items-center">
        <GitBranch className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-3 text-neutral-600">
        {data.condition || "Condição não definida"}
      </div>
    </div>
  );
}

function ApiRequestNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-purple-50 border-purple-200 w-56">
      <div className="font-medium text-xs mb-1 text-purple-800 flex items-center">
        <Server className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-2 text-neutral-600">
        {data.method || "GET"} {data.url || "URL não definida"}
      </div>
      <div className="text-xs mt-1 text-purple-600">
        Resultado: {data.resultVariable || "não definido"}
      </div>
    </div>
  );
}

function MenuNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-indigo-50 border-indigo-200 w-56">
      <div className="font-medium text-xs mb-1 text-indigo-800 flex items-center">
        <List className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-2 text-neutral-600">
        {data.prompt || "Texto não definido"}
      </div>
      <div className="text-xs mt-1 text-indigo-600">
        {data.options && data.options.length > 0 
          ? `${data.options.filter((o: any) => o.text).length} opções` 
          : "Sem opções"}
      </div>
    </div>
  );
}

function WaitNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-gray-50 border-gray-200 w-56">
      <div className="font-medium text-xs mb-1 text-gray-800 flex items-center">
        <Clock className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs text-neutral-600">
        Aguardar {data.duration || 5} segundos
      </div>
    </div>
  );
}

function GotoNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-orange-50 border-orange-200 w-56">
      <div className="font-medium text-xs mb-1 text-orange-800 flex items-center">
        <CornerDownRight className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs text-neutral-600">
        Ir para fluxo: {data.targetFlow || "mesmo fluxo"}
      </div>
    </div>
  );
}

function MediaNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-pink-50 border-pink-200 w-56">
      <div className="font-medium text-xs mb-1 text-pink-800 flex items-center">
        <ImagePlus className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-2 text-neutral-600">
        {data.mediaType || "imagem"}: {data.mediaUrl ? "URL definida" : "URL não definida"}
      </div>
      {data.caption && (
        <div className="text-xs mt-1 line-clamp-1 text-neutral-600">
          {data.caption}
        </div>
      )}
    </div>
  );
}

function EndNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-red-50 border-red-200 w-56">
      <div className="font-medium text-xs mb-1 text-red-800 flex items-center">
        <X className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-2 text-neutral-600">
        {data.endMessage || "Finalizar conversa"}
      </div>
      {data.storeConversation && (
        <div className="text-xs mt-1 text-red-600">
          Armazenar conversa
        </div>
      )}
    </div>
  );
}

// Definição dos tipos de nós personalizados
const nodeTypes = {
  message: MessageNode,
  input: InputNode,
  condition: ConditionNode,
  api_request: ApiRequestNode,
  menu: MenuNode,
  wait: WaitNode,
  goto: GotoNode,
  media: MediaNode,
  end: EndNode,
};

// Botão para tipo de nó
function NodeTypeButton({ label, description, icon, onClick }: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="flex flex-col items-center justify-center h-20 text-center p-2"
      onClick={onClick}
    >
      <div className="mb-1">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </Button>
  );
}

// Componente para o nó arrastrável
function DraggableNode({ type, label, icon }: { 
  type: string; 
  label: string; 
  icon: React.ReactNode;
}) {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  return (
    <div
      className="border border-dashed border-neutral-300 rounded-md p-2 flex flex-col items-center justify-center cursor-grab bg-white hover:bg-neutral-50 text-center h-20"
      onDragStart={onDragStart}
      draggable
    >
      <div className="text-muted-foreground mb-1">{icon}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: 'Mensagem',
    input: 'Entrada',
    condition: 'Condição',
    api_request: 'API',
    menu: 'Menu',
    wait: 'Espera',
    goto: 'Redirecionamento',
    media: 'Mídia',
    end: 'Finalizar',
  };
  
  return labels[type] || type;
}

function getNodeTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    message: 'Envia uma mensagem para o usuário',
    input: 'Solicita uma entrada do usuário',
    condition: 'Cria um fluxo condicional',
    api_request: 'Faz uma chamada para API externa',
    menu: 'Apresenta opções para o usuário',
    wait: 'Adiciona um tempo de espera',
    goto: 'Redireciona para outro fluxo',
    media: 'Envia uma mídia para o usuário',
    end: 'Finaliza a conversa',
  };
  
  return descriptions[type] || '';
}

function getNodeDefaults(type: string) {
  const defaults: Record<string, any> = {
    message: {
      label: 'Nova Mensagem',
      content: 'Olá! Como posso ajudar?',
    },
    input: {
      label: 'Nova Entrada',
      question: 'Por favor, responda a seguinte pergunta:',
      variableName: 'resposta',
      validation: 'none',
    },
    condition: {
      label: 'Nova Condição',
      condition: '{{variavel}} == "valor"',
    },
    api_request: {
      label: 'Nova Requisição API',
      method: 'GET',
      url: 'https://',
      headers: '',
      body: '',
      resultVariable: 'resultado',
    },
    menu: {
      label: 'Novo Menu',
      prompt: 'Selecione uma opção:',
      options: [
        { text: 'Opção 1', value: '1' },
        { text: 'Opção 2', value: '2' },
      ],
    },
    wait: {
      label: 'Nova Espera',
      duration: 5,
    },
    goto: {
      label: 'Novo Redirecionamento',
      targetFlow: '',
    },
    media: {
      label: 'Nova Mídia',
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
    end: {
      label: 'Finalizar',
      endMessage: 'Obrigado por utilizar nosso serviço!',
      storeConversation: true,
    },
  };
  
  return defaults[type] || { label: 'Novo Nó' };
}

// Componente principal do editor de fluxo
export function ChatbotFlowEditor({ flow, onBack }: { flow: ChatbotFlow, onBack: () => void }) {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Buscar nós e arestas do fluxo
  const { data: flowNodes = [], isLoading: isLoadingNodes } = useQuery({
    queryKey: ['/api/flows', flow.id, 'nodes'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/flows/${flow.id}/nodes`);
      const data = await response.json();
      return data as ChatbotNode[];
    }
  });
  
  const { data: flowEdges = [], isLoading: isLoadingEdges } = useQuery({
    queryKey: ['/api/flows', flow.id, 'edges'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/flows/${flow.id}/edges`);
      const data = await response.json();
      return data as ChatbotEdge[];
    }
  });
  
  // Mutações para operações CRUD
  const { mutate: createNode, isPending: isCreatingNode } = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/flows/${flow.id}/nodes`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar nó',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const { mutate: updateNode, isPending: isUpdatingNode } = useMutation({
    mutationFn: async (nodeId: string, data: any) => {
      const response = await apiRequest('PUT', `/api/nodes/${nodeId}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar nó',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const { mutate: deleteNode, isPending: isDeletingNode } = useMutation({
    mutationFn: async (nodeId: string) => {
      const response = await apiRequest('DELETE', `/api/nodes/${nodeId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir nó',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const { mutate: createEdge, isPending: isCreatingEdge } = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/flows/${flow.id}/edges`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'edges'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar conexão',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Flag para verificar se está salvando
  const isSaving = isCreatingNode || isUpdatingNode || isDeletingNode || isCreatingEdge;
  
  // Converter nós e arestas do banco de dados para o formato do react-flow
  useEffect(() => {
    if (flowNodes.length > 0) {
      const rfNodes = flowNodes.map((node) => ({
        id: node.id.toString(),
        type: node.nodeType,
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.name,
          ...node.data,
        },
      }));
      
      setNodes(rfNodes);
    }
  }, [flowNodes, setNodes]);
  
  useEffect(() => {
    if (flowEdges.length > 0) {
      const rfEdges = flowEdges.map((edge) => ({
        id: edge.id.toString(),
        source: edge.sourceId.toString(),
        target: edge.targetId.toString(),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        animated: edge.animated,
        type: 'default',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        data: edge.data,
      }));
      
      setEdges(rfEdges);
    }
  }, [flowEdges, setEdges]);
  
  // Função para lidar com a conexão de arestas
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      setIsDirty(true);
      
      createEdge({
        sourceId: parseInt(params.source!),
        targetId: parseInt(params.target!),
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        label: '',
        animated: false,
        data: {},
      });
    },
    [setEdges, createEdge]
  );
  
  // Funções para arrastar e soltar novos nós
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      
      if (!reactFlowInstance) return;
      
      const type = event.dataTransfer.getData('application/reactflow');
      
      if (!type) return;
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      // Adicionar o nó ao banco de dados
      createNode({
        nodeType: type,
        name: getNodeTypeLabel(type),
        position,
        data: getNodeDefaults(type),
      });
      
      setIsDirty(true);
    },
    [reactFlowInstance, createNode]
  );
  
  const onAddNode = useCallback(
    (type: string, position = { x: 100, y: 100 }) => {
      createNode({
        nodeType: type,
        name: getNodeTypeLabel(type),
        position,
        data: getNodeDefaults(type),
      });
      
      setIsDirty(true);
      setIsAddNodeDialogOpen(false);
    },
    [createNode]
  );
  
  // Função para abrir o diálogo de adição de nó
  const handleAddNode = () => {
    setIsAddNodeDialogOpen(true);
  };
  
  // Funções para interação com nós e arestas
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    setSelectedNode(node);
    setSidebarVisible(true);
  }, []);
  
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    setIsDirty(true);
    
    // Atualizar a posição do nó no banco de dados
    updateNode(node.id, {
      position: node.position
    });
  }, [updateNode]);
  
  // Função para salvar o fluxo
  const handleSave = useCallback(() => {
    if (isDirty) {
      setIsDirty(false);
      toast({
        title: 'Fluxo salvo',
        description: 'Todas as alterações foram salvas com sucesso.',
      });
    }
  }, [isDirty, toast]);
  
  // Função para atualização da posição do nó
  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            position,
          };
        }
        return node;
      })
    );
    
    setIsDirty(true);
  }, [setNodes]);
  
  // Estado para armazenar alterações pendentes
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Função para atualização de dados do nó com debounce
  const handleUpdateNodeData = (nodeId: string, newData: any) => {
    // Atualiza o nó visualmente imediatamente
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
        }
        return node;
      })
    );
    
    setIsDirty(true);
    
    // Armazena as alterações pendentes
    setPendingChanges(prev => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        ...newData
      }
    }));
    
    // Cancela o timeout anterior se existir
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Define um novo timeout para salvar após 1 segundo de inatividade
    const timeout = setTimeout(() => {
      saveNodeChanges(nodeId);
    }, 1000);
    
    setSaveTimeout(timeout);
  };
  
  // Função para salvar as alterações pendentes
  const saveNodeChanges = (nodeId: string) => {
    const changes = pendingChanges[nodeId];
    if (!changes) return;
    
    // Busca o nó atualizado
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      // Salva no banco de dados
      updateNode(nodeId, {
        data: {
          ...node.data,
        },
      });
      
      // Limpa as alterações pendentes para este nó
      setPendingChanges(prev => {
        const newPending = { ...prev };
        delete newPending[nodeId];
        return newPending;
      });
      
      // Exibe feedback de salvamento
      toast({
        title: "Alterações salvas",
        description: "As configurações do nó foram salvas com sucesso.",
        duration: 2000,
      });
    }
  };
  
  // Renderização do editor
  return (
    <div className="h-screen flex">
      {/* Área principal do editor */}
      <div className={`h-full ${sidebarVisible ? 'w-2/3' : 'w-full'} flex flex-col transition-all duration-200`}>
        <div className="border-b p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium">{flow.name}</h2>
            {isDirty && <span className="ml-2 text-xs text-muted-foreground">(não salvo)</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddNode}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Nó
            </Button>
            <Button 
              variant={isDirty ? "default" : "outline"} 
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex-grow relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDragStop={onNodeDragStop}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              onNodesDelete={(nodes) => {
                setIsDirty(true);
                nodes.forEach((node) => deleteNode(node.id));
                
                // Fechar o painel se o nó selecionado foi excluído
                if (selectedNode && nodes.some(n => n.id === selectedNode.id)) {
                  setSelectedNode(null);
                  setSidebarVisible(false);
                }
              }}
              onEdgesDelete={(edges) => {
                setIsDirty(true);
                // Implementar exclusão de arestas se necessário
              }}
              onPaneClick={() => {
                // Opcional: desselecionar nó ao clicar no painel
                // setSelectedNode(null);
                // setSidebarVisible(false);
              }}
            >
              <Background variant="dots" gap={12} size={1} />
              <Controls />
              <MiniMap nodeStrokeWidth={3} zoomable pannable />
              
              <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-sm font-medium mb-2">Adicionar nós</div>
                <div className="grid grid-cols-2 gap-2">
                  <DraggableNode type="message" label="Mensagem" icon={<MessageSquare className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="input" label="Entrada" icon={<Keyboard className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="condition" label="Condição" icon={<GitBranch className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="api_request" label="API" icon={<Server className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="menu" label="Menu" icon={<List className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="wait" label="Espera" icon={<Clock className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="media" label="Mídia" icon={<ImagePlus className="h-3 w-3 mr-1" />} />
                  <DraggableNode type="end" label="Fim" icon={<X className="h-3 w-3 mr-1" />} />
                </div>
              </Panel>
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
      
      {/* Painel lateral de edição com formulário manual */}
      {sidebarVisible && selectedNode && (
        <div className="h-full w-1/3 bg-background border-l border-border overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Editar {getNodeTypeLabel(selectedNode.type || 'message')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSidebarVisible(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="node-label">Nome do nó</Label>
              <Input 
                id="node-label" 
                value={selectedNode.data.label || ''} 
                onChange={(e) => {
                  handleUpdateNodeData(selectedNode.id, { label: e.target.value });
                }}
              />
            </div>
            
            {selectedNode.type === 'message' && (
              <div className="space-y-2">
                <Label htmlFor="content">Mensagem</Label>
                <Textarea
                  id="content"
                  value={selectedNode.data.content || ''}
                  rows={5}
                  onChange={(e) => {
                    handleUpdateNodeData(selectedNode.id, { content: e.target.value });
                  }}
                />
              </div>
            )}
            
            {selectedNode.type === 'input' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="question">Pergunta</Label>
                  <Textarea
                    id="question"
                    value={selectedNode.data.question || ''}
                    rows={3}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { question: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variableName">Nome da variável</Label>
                  <Input
                    id="variableName"
                    value={selectedNode.data.variableName || ''}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { variableName: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validation">Validação</Label>
                  <Select
                    value={selectedNode.data.validation || 'none'}
                    onValueChange={(value) => {
                      handleUpdateNodeData(selectedNode.id, { validation: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a validação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {selectedNode.type === 'api_request' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="method">Método</Label>
                  <Select
                    value={selectedNode.data.method || 'GET'}
                    onValueChange={(value) => {
                      handleUpdateNodeData(selectedNode.id, { method: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={selectedNode.data.url || ''}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { url: e.target.value });
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resultVariable">Variável para resultado</Label>
                  <Input
                    id="resultVariable"
                    value={selectedNode.data.resultVariable || ''}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { resultVariable: e.target.value });
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="headers">Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={selectedNode.data.headers || ''}
                    rows={3}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { headers: e.target.value });
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="body">Body (JSON)</Label>
                  <Textarea
                    id="body"
                    value={selectedNode.data.body || ''}
                    rows={3}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { body: e.target.value });
                    }}
                  />
                </div>
              </>
            )}
            
            {selectedNode.type === 'menu' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="prompt">Texto do menu</Label>
                  <Textarea
                    id="prompt"
                    value={selectedNode.data.prompt || ''}
                    rows={3}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { prompt: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opções</Label>
                  {(selectedNode.data.options || []).map((option: any, index: number) => (
                    <div key={index} className="flex space-x-2 mb-2">
                      <Input
                        placeholder="Texto"
                        value={option.text || ''}
                        onChange={(e) => {
                          const newOptions = [...(selectedNode.data.options || [])];
                          newOptions[index] = { ...option, text: e.target.value };
                          handleUpdateNodeData(selectedNode.id, { options: newOptions });
                        }}
                      />
                      <Input
                        placeholder="Valor"
                        value={option.value || ''}
                        onChange={(e) => {
                          const newOptions = [...(selectedNode.data.options || [])];
                          newOptions[index] = { ...option, value: e.target.value };
                          handleUpdateNodeData(selectedNode.id, { options: newOptions });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newOptions = [...(selectedNode.data.options || [])];
                          newOptions.splice(index, 1);
                          handleUpdateNodeData(selectedNode.id, { options: newOptions });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(selectedNode.data.options || []), { text: '', value: '' }];
                      handleUpdateNodeData(selectedNode.id, { options: newOptions });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar opção
                  </Button>
                </div>
              </>
            )}
            
            {selectedNode.type === 'condition' && (
              <div className="space-y-2">
                <Label htmlFor="condition">Condição</Label>
                <Textarea
                  id="condition"
                  value={selectedNode.data.condition || ''}
                  rows={3}
                  onChange={(e) => {
                    handleUpdateNodeData(selectedNode.id, { condition: e.target.value });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Use {{variavel}} para referenciar variáveis na condição.
                </p>
              </div>
            )}
            
            {selectedNode.type === 'wait' && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={selectedNode.data.duration || 5}
                  onChange={(e) => {
                    handleUpdateNodeData(selectedNode.id, { duration: parseInt(e.target.value) });
                  }}
                />
              </div>
            )}
            
            {selectedNode.type === 'media' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mediaType">Tipo de mídia</Label>
                  <Select
                    value={selectedNode.data.mediaType || 'image'}
                    onValueChange={(value) => {
                      handleUpdateNodeData(selectedNode.id, { mediaType: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mediaUrl">URL da mídia</Label>
                  <Input
                    id="mediaUrl"
                    value={selectedNode.data.mediaUrl || ''}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { mediaUrl: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caption">Legenda</Label>
                  <Textarea
                    id="caption"
                    value={selectedNode.data.caption || ''}
                    rows={2}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { caption: e.target.value });
                    }}
                  />
                </div>
              </>
            )}
            
            {selectedNode.type === 'end' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="endMessage">Mensagem final</Label>
                  <Textarea
                    id="endMessage"
                    value={selectedNode.data.endMessage || ''}
                    rows={3}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { endMessage: e.target.value });
                    }}
                  />
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <input
                    type="checkbox"
                    id="storeConversation"
                    checked={selectedNode.data.storeConversation || false}
                    onChange={(e) => {
                      handleUpdateNodeData(selectedNode.id, { storeConversation: e.target.checked });
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="storeConversation">Armazenar conversa no histórico</Label>
                </div>
              </>
            )}
            
            <div className="pt-4 flex justify-end">
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => {
                  setSelectedNode(null);
                  setSidebarVisible(false);
                }}
              >
                Fechar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este nó?')) {
                    deleteNode(selectedNode.id);
                    setSelectedNode(null);
                    setSidebarVisible(false);
                  }
                }}
              >
                Excluir nó
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Dialog para adicionar nó */}
      <Dialog open={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nó</DialogTitle>
            <DialogDescription>
              Selecione o tipo de nó que deseja adicionar ao fluxo
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            <NodeTypeButton 
              label="Mensagem" 
              description="Enviar mensagem ao usuário"
              icon={<MessageSquare className="h-4 w-4" />}
              onClick={() => onAddNode('message')}
            />
            
            <NodeTypeButton 
              label="Entrada" 
              description="Solicitar dados do usuário"
              icon={<Keyboard className="h-4 w-4" />}
              onClick={() => onAddNode('input')}
            />
            
            <NodeTypeButton 
              label="Condição" 
              description="Bifurcar com base em condição"
              icon={<GitBranch className="h-4 w-4" />}
              onClick={() => onAddNode('condition')}
            />
            
            <NodeTypeButton 
              label="API" 
              description="Fazer chamada a API externa"
              icon={<Server className="h-4 w-4" />}
              onClick={() => onAddNode('api_request')}
            />
            
            <NodeTypeButton 
              label="Menu" 
              description="Apresentar opções ao usuário"
              icon={<List className="h-4 w-4" />}
              onClick={() => onAddNode('menu')}
            />
            
            <NodeTypeButton 
              label="Espera" 
              description="Aguardar um tempo específico"
              icon={<Clock className="h-4 w-4" />}
              onClick={() => onAddNode('wait')}
            />
            
            <NodeTypeButton 
              label="Mídia" 
              description="Enviar imagem/vídeo/áudio"
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => onAddNode('media')}
            />
            
            <NodeTypeButton 
              label="Fim" 
              description="Finalizar conversa"
              icon={<X className="h-4 w-4" />}
              onClick={() => onAddNode('end')}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddNodeDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}