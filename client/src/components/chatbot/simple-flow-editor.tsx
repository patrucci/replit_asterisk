import { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ChatbotFlow } from '@shared/chatbot-schema';
import { 
  Save, 
  ArrowLeft, 
  MessageSquare,
  Keyboard,
  GitBranch,
  Server,
  List,
  Clock,
  ImagePlus,
  X,
  Plus,
  Loader2,
  Trash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Componentes de nós simples
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

function MediaNode({ data }: { data: any }) {
  return (
    <div className="p-3 border-2 rounded-md bg-pink-50 border-pink-200 w-56">
      <div className="font-medium text-xs mb-1 text-pink-800 flex items-center">
        <ImagePlus className="h-3 w-3 mr-1" />
        {data.label}
      </div>
      <div className="text-xs line-clamp-2 text-neutral-600">
        {data.mediaType || "imagem"}
      </div>
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
    </div>
  );
}

// Definição dos tipos de nós
const nodeTypes = {
  message: MessageNode,
  input: InputNode,
  condition: ConditionNode,
  api_request: ApiRequestNode,
  menu: MenuNode,
  wait: WaitNode,
  media: MediaNode,
  end: EndNode,
};

// Obter rótulos para os tipos de nós
function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: 'Mensagem',
    input: 'Entrada',
    condition: 'Condição',
    api_request: 'API',
    menu: 'Menu',
    wait: 'Espera',
    media: 'Mídia',
    end: 'Finalizar',
  };
  
  return labels[type] || type;
}

// Valores padrão para cada tipo de nó
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
    },
    condition: {
      label: 'Nova Condição',
      condition: '{{variavel}} == "valor"',
    },
    api_request: {
      label: 'Nova Requisição API',
      method: 'GET',
      url: 'https://',
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
    media: {
      label: 'Nova Mídia',
      mediaType: 'image',
      mediaUrl: '',
    },
    end: {
      label: 'Finalizar',
      endMessage: 'Obrigado por utilizar nosso serviço!',
    },
  };
  
  return defaults[type] || { label: 'Novo Nó' };
}

// Componente de edição de nó
interface NodeEditorProps {
  node: Node;
  onClose: () => void;
  onSave: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
}

function NodeEditor({ node, onClose, onSave, onDelete }: NodeEditorProps) {
  const [formState, setFormState] = useState({ ...node.data });
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const type = node.type || 'message';

  const handleChange = (field: string, value: any) => {
    setFormState((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(node.id, formState);
    onClose();
  };
  
  const handleRequestDelete = () => {
    setIsDeleteConfirm(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Editar {getNodeTypeLabel(type)}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="label">Nome do nó</Label>
          <Input
            id="label"
            value={formState.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
          />
        </div>

        {type === 'message' && (
          <div className="space-y-2">
            <Label htmlFor="content">Mensagem</Label>
            <Textarea
              id="content"
              value={formState.content || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={5}
            />
          </div>
        )}

        {type === 'input' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="question">Pergunta</Label>
              <Textarea
                id="question"
                value={formState.question || ''}
                onChange={(e) => handleChange('question', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variableName">Nome da variável</Label>
              <Input
                id="variableName"
                value={formState.variableName || ''}
                onChange={(e) => handleChange('variableName', e.target.value)}
              />
            </div>
          </>
        )}

        {type === 'api_request' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="method">Método</Label>
              <Select
                value={formState.method || 'GET'}
                onValueChange={(value) => handleChange('method', value)}
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
                value={formState.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resultVariable">Variável de resultado</Label>
              <Input
                id="resultVariable"
                value={formState.resultVariable || ''}
                onChange={(e) => handleChange('resultVariable', e.target.value)}
              />
            </div>
          </>
        )}

        {type === 'menu' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="prompt">Texto do menu</Label>
              <Textarea
                id="prompt"
                value={formState.prompt || ''}
                onChange={(e) => handleChange('prompt', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Opções do menu</Label>
              {(formState.options || []).map((option: any, index: number) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <Input
                    placeholder="Texto"
                    value={option.text || ''}
                    onChange={(e) => {
                      const newOptions = [...(formState.options || [])];
                      newOptions[index] = { ...option, text: e.target.value };
                      handleChange('options', newOptions);
                    }}
                  />
                  <Input
                    placeholder="Valor"
                    value={option.value || ''}
                    onChange={(e) => {
                      const newOptions = [...(formState.options || [])];
                      newOptions[index] = { ...option, value: e.target.value };
                      handleChange('options', newOptions);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOptions = [...(formState.options || [])];
                      newOptions.splice(index, 1);
                      handleChange('options', newOptions);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newOptions = [...(formState.options || []), { text: '', value: '' }];
                  handleChange('options', newOptions);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar opção
              </Button>
            </div>
          </>
        )}

        {type === 'wait' && (
          <div className="space-y-2">
            <Label htmlFor="duration">Duração (segundos)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={formState.duration || 5}
              onChange={(e) => handleChange('duration', parseInt(e.target.value))}
            />
          </div>
        )}

        {isDeleteConfirm ? (
          <div className="bg-red-50 p-3 rounded-md border border-red-200 mb-4">
            <p className="text-sm text-red-800 mb-2">Tem certeza que deseja excluir este nó?</p>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="destructive" 
                size="sm"
                onClick={() => onDelete(node.id)}
              >
                Sim, excluir
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setIsDeleteConfirm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleRequestDelete}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash className="h-4 w-4 mr-1" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

// Componente principal do editor
export function SimpleFlowEditor({ flow, onBack }: { flow: ChatbotFlow, onBack: () => void }) {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isDirty, setIsDirty] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);

  // Buscar nós e arestas do fluxo
  const { data: flowNodes = [] } = useQuery({
    queryKey: ['/api/flows', flow.id, 'nodes'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/flows/${flow.id}/nodes`);
      return await response.json();
    }
  });
  
  const { data: flowEdges = [] } = useQuery({
    queryKey: ['/api/flows', flow.id, 'edges'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/flows/${flow.id}/edges`);
      return await response.json();
    }
  });

  // Mutações para nós
  const { mutate: updateNode } = useMutation({
    mutationFn: async (params: { id: string, data: any }) => {
      const response = await apiRequest('PUT', `/api/nodes/${params.id}`, params.data);
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

  const { mutate: deleteNode } = useMutation({
    mutationFn: async (nodeId: string) => {
      const response = await apiRequest('DELETE', `/api/nodes/${nodeId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'edges'] });
      setSelectedNode(null);
      toast({
        title: 'Nó excluído',
        description: 'O nó foi excluído com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir nó',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const { mutate: createNode } = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/flows/${flow.id}/nodes`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
      setIsAddNodeDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar nó',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Mutação para arestas
  const { mutate: createEdge } = useMutation({
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

  // Atualizar o estado do React Flow com os dados do banco
  useEffect(() => {
    if (flowNodes && flowNodes.length > 0) {
      const rfNodes = flowNodes.map((node: any) => ({
        id: node.id.toString(),
        type: node.nodeType,
        position: node.position || { x: 100, y: 100 },
        data: {
          ...node.data,
          label: node.name,
        },
      }));
      setNodes(rfNodes);
    }
    
    if (flowEdges && flowEdges.length > 0) {
      const rfEdges = flowEdges.map((edge: any) => ({
        id: edge.id.toString(),
        source: edge.sourceNodeId.toString(),
        target: edge.targetNodeId.toString(),
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }));
      setEdges(rfEdges);
    }
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Callback para conexão de nós
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      setIsDirty(true);
      
      createEdge({
        sourceNodeId: parseInt(params.source!),
        targetNodeId: parseInt(params.target!),
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        label: '',
      });
    },
    [setEdges, createEdge]
  );

  // Funções para arrastar e soltar
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
      
      const nodeData = getNodeDefaults(type);
      
      createNode({
        nodeType: type,
        name: nodeData.label,
        position,
        data: nodeData,
      });
      
      setIsDirty(true);
    },
    [reactFlowInstance, createNode]
  );

  // Função para adicionar nó a partir do diálogo
  const handleAddNodeType = (type: string) => {
    if (!reactFlowInstance) return;
    
    const position = {
      x: Math.random() * 300,
      y: Math.random() * 300,
    };
    
    const nodeData = getNodeDefaults(type);
    
    createNode({
      nodeType: type,
      name: nodeData.label,
      position,
      data: nodeData,
    });
  };

  // Handler para salvar alterações em um nó
  const handleSaveNode = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...newData,
            },
          };
        }
        return node;
      })
    );
    
    setIsDirty(true);
    
    // Atualizar o nó no banco de dados
    updateNode({
      id: nodeId,
      data: {
        ...newData,
        name: newData.label,
      },
    });
  };

  // Função para abrir o editor de nós
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    setSelectedNode(node);
  };

  // Função para salvar o fluxo
  const handleSave = () => {
    setIsDirty(false);
    toast({
      title: 'Fluxo salvo',
      description: 'Todas as alterações foram salvas com sucesso.',
    });
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-medium">{flow.name}</h2>
          {isDirty && <span className="ml-2 text-xs text-muted-foreground">(não salvo)</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAddNodeDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Nó
          </Button>
          <Button 
            variant={isDirty ? "default" : "outline"} 
            size="sm"
            onClick={handleSave}
          >
            <Save className="h-4 w-4 mr-1" />
            Salvar
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Editor de fluxo */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              fitView
            >
              <Background color="#f8f8f8" gap={12} size={1} />
              <Controls />
              <MiniMap nodeStrokeWidth={3} zoomable pannable />
              
              <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border">
                <div className="text-sm font-medium mb-2">Arrastar para adicionar:</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(nodeTypes).map((type) => (
                    <div
                      key={type}
                      className="border border-dashed border-gray-300 p-2 rounded-md bg-white text-xs cursor-grab text-center"
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', type);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      draggable
                    >
                      {getNodeTypeLabel(type)}
                    </div>
                  ))}
                </div>
              </Panel>
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        
        {/* Painel lateral para edição */}
        {selectedNode && (
          <div className="w-1/3 border-l border-gray-200 overflow-y-auto">
            <NodeEditor 
              node={selectedNode} 
              onClose={() => setSelectedNode(null)} 
              onSave={handleSaveNode}
              onDelete={(nodeId) => deleteNode(nodeId)}
            />
          </div>
        )}
      </div>
      
      {/* Diálogo para adicionar nó */}
      <Dialog open={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nó</DialogTitle>
            <DialogDescription>
              Selecione o tipo de nó que deseja adicionar
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            {Object.keys(nodeTypes).map((type) => (
              <Button
                key={type}
                variant="outline"
                className="flex flex-col items-center justify-center h-20 text-center p-2"
                onClick={() => handleAddNodeType(type)}
              >
                <div className="font-medium">{getNodeTypeLabel(type)}</div>
              </Button>
            ))}
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