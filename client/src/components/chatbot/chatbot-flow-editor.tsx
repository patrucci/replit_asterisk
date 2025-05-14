import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NodeEditorDialog } from './node-editor-dialog';
import { EdgeEditorDialog } from './edge-editor-dialog';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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

// Componente NodeEditor para editar propriedades de nós
function NodeEditor({ node, onSave, onDelete }: { 
  node: Node, 
  onSave: (data: any) => void,
  onDelete: () => void
}) {
  const nodeType = node.type || 'message';
  // Não precisamos mais de uma chave para o formulário
  
  // Usar useMemo para criar valores padrão e evitar recriação a cada renderização
  const defaultValues = useMemo(() => ({
    label: node.data.label || '',
    ...node.data,
  }), [node.id]); // Usar node.id como dependência para manter estável
  
  // Usar uma única instância do formulário por nó
  const nodeForm = useForm({
    defaultValues,
  });

  // Função estável para submissão
  const onSubmit = useCallback((data: any) => {
    onSave(data);
  }, [onSave]);

  return (
    <div>
      <form onSubmit={nodeForm.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Nome do nó</Label>
            <Input
              id="label"
              {...nodeForm.register('label')}
            />
          </div>
          
          {/* Campos específicos para cada tipo de nó */}
          {nodeType === 'message' && (
            <div className="grid gap-2">
              <Label htmlFor="content">Mensagem</Label>
              <Textarea
                id="content"
                rows={4}
                {...nodeForm.register('content')}
                placeholder="Digite a mensagem que será enviada ao usuário..."
              />
              <p className="text-xs text-neutral-500">
                Dica: Você pode usar marcadores como {'{nome}'} para inserir variáveis.
              </p>
            </div>
          )}
          
          {nodeType === 'input' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="question">Pergunta</Label>
                <Textarea
                  id="question"
                  rows={3}
                  {...nodeForm.register('question')}
                  placeholder="Digite a pergunta que será feita ao usuário..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="variableName">Nome da variável</Label>
                <Input
                  id="variableName"
                  {...nodeForm.register('variableName')}
                  placeholder="Ex: nome, email, telefone"
                />
                <p className="text-xs text-neutral-500">
                  A resposta do usuário será armazenada nesta variável
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validation">Validação</Label>
                <Select 
                  defaultValue={node.data.validation || 'none'}
                  onValueChange={(value) => nodeForm.setValue('validation', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de validação" />
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
          
          {nodeType === 'condition' && (
            <div className="grid gap-2">
              <Label htmlFor="condition">Condição</Label>
              <Textarea
                id="condition"
                rows={3}
                {...nodeForm.register('condition')}
                placeholder="Ex: nome != null || idade > 18"
              />
              <p className="text-xs text-neutral-500">
                Use chaves duplas {'{{'} e {'}}'} para acessar variáveis
              </p>
            </div>
          )}
          
          {nodeType === 'api_request' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="url">URL da API</Label>
                <Input
                  id="url"
                  {...nodeForm.register('url')}
                  placeholder="https://api.exemplo.com/endpoint"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Método</Label>
                <Select 
                  defaultValue={node.data.method || 'GET'}
                  onValueChange={(value) => nodeForm.setValue('method', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o método HTTP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="headers">Headers (JSON)</Label>
                <Textarea
                  id="headers"
                  rows={2}
                  {...nodeForm.register('headers')}
                  placeholder='{"Content-Type": "application/json"}'
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">Body (JSON)</Label>
                <Textarea
                  id="body"
                  rows={3}
                  {...nodeForm.register('body')}
                  placeholder='{"key": "value"}'
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="resultVariable">Variável para resultado</Label>
                <Input
                  id="resultVariable"
                  {...nodeForm.register('resultVariable')}
                  placeholder="Ex: apiResponse"
                />
              </div>
            </>
          )}
          
          {nodeType === 'menu' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="prompt">Texto do menu</Label>
                <Textarea
                  id="prompt"
                  rows={3}
                  {...nodeForm.register('prompt')}
                  placeholder="Digite o texto que apresentará as opções..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Opções</Label>
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Opção ${index + 1}`}
                        {...nodeForm.register(`options.${index}.text`)}
                        defaultValue={node.data.options?.[index]?.text || ''}
                      />
                      <Input
                        placeholder="Valor"
                        {...nodeForm.register(`options.${index}.value`)}
                        defaultValue={node.data.options?.[index]?.value || ''}
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  A opção selecionada pelo usuário será armazenada na variável 'menuSelection'
                </p>
              </div>
            </>
          )}
          
          {nodeType === 'wait' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duração (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  {...nodeForm.register('duration')}
                  defaultValue={node.data.duration || 5}
                />
              </div>
            </>
          )}
          
          {nodeType === 'goto' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="targetFlow">Fluxo de destino</Label>
                <Input
                  id="targetFlow"
                  {...nodeForm.register('targetFlow')}
                  placeholder="ID do fluxo de destino"
                />
                <p className="text-xs text-neutral-500">
                  Deixe em branco para continuar no fluxo atual
                </p>
              </div>
            </>
          )}
          
          {nodeType === 'media' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mediaType">Tipo de mídia</Label>
                <Select 
                  defaultValue={node.data.mediaType || 'image'}
                  onValueChange={(value) => nodeForm.setValue('mediaType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de mídia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="file">Arquivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mediaUrl">URL da mídia</Label>
                <Input
                  id="mediaUrl"
                  {...nodeForm.register('mediaUrl')}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="caption">Legenda</Label>
                <Textarea
                  id="caption"
                  rows={2}
                  {...nodeForm.register('caption')}
                  placeholder="Legenda opcional para a mídia"
                />
              </div>
            </>
          )}
          
          {nodeType === 'end' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="endMessage">Mensagem de encerramento</Label>
                <Textarea
                  id="endMessage"
                  rows={3}
                  {...nodeForm.register('endMessage')}
                  placeholder="Mensagem opcional para encerrar a conversa"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  id="storeConversation"
                  checked={nodeForm.watch('storeConversation') || false}
                  onCheckedChange={(checked) => nodeForm.setValue('storeConversation', checked)}
                />
                <Label htmlFor="storeConversation">Armazenar conversa</Label>
              </div>
            </>
          )}
          
          <div className="flex justify-between pt-4">
            <Button 
              type="button"
              variant="destructive"
              onClick={onDelete}
            >
              Excluir
            </Button>
            <Button type="submit">Salvar alterações</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Componente EdgeEditor para editar propriedades de arestas
function EdgeEditor({ edge, onSave, onDelete }: { 
  edge: Edge, 
  onSave: (data: any) => void,
  onDelete: () => void
}) {
  // Não precisamos mais de uma chave para o formulário
  
  // Usar useMemo para criar valores padrão e evitar recriação a cada renderização
  const defaultValues = useMemo(() => ({
    label: edge.label || '',
    condition: edge.data?.condition || null,
  }), [edge.id]); // Usar edge.id como dependência para manter estável
  
  const edgeForm = useForm({
    defaultValues,
  });

  // Função estável para submissão
  const onSubmit = useCallback((data: any) => {
    onSave(data);
  }, [onSave]);

  return (
    <div>
      <form onSubmit={edgeForm.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Rótulo da conexão</Label>
            <Input
              id="label"
              {...edgeForm.register('label')}
              placeholder="Ex: Sim, Não, Próximo"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="condition">Condição (opcional)</Label>
            <Textarea
              id="condition"
              rows={3}
              {...edgeForm.register('condition')}
              placeholder="Ex: resposta === 'sim'"
            />
            <p className="text-xs text-neutral-500">
              Use chaves duplas {'{{'} e {'}}'} para acessar variáveis. Deixe em branco para uma conexão sem condição.
            </p>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button 
              type="button"
              variant="destructive"
              onClick={onDelete}
            >
              Excluir
            </Button>
            <Button type="submit">Salvar alterações</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Componente DraggableNode para arrastar e soltar
function DraggableNode({ type, label, icon }: { type: string, label: string, icon: React.ReactNode }) {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow/type', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="border p-2 rounded-md flex items-center justify-center text-xs bg-white hover:bg-gray-50 cursor-grab"
      onDragStart={onDragStart}
      draggable
    >
      {icon}
      {label}
    </div>
  );
}

// Componente NodeTypeButton para o diálogo de adicionar nó
function NodeTypeButton({ type, label, description, icon, onClick }: { 
  type: string, 
  label: string, 
  description: string,
  icon: React.ReactNode,
  onClick: () => void 
}) {
  return (
    <Button
      variant="outline"
      className="h-auto py-4 px-4 flex flex-col items-center justify-center text-center"
      onClick={onClick}
    >
      <div className="mb-2">{icon}</div>
      <div className="font-medium">{label}</div>
      <div className="text-xs text-neutral-500 mt-1">{description}</div>
    </Button>
  );
}

// Funções auxiliares
function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: 'Mensagem',
    input: 'Entrada',
    condition: 'Condição',
    api_request: 'API',
    menu: 'Menu',
    wait: 'Espera',
    goto: 'Ir para',
    media: 'Mídia',
    end: 'Fim'
  };
  return labels[type] || type;
}

function getDefaultNodeData(type: string): any {
  const defaults: Record<string, any> = {
    message: {
      label: 'Nova Mensagem',
      content: 'Digite sua mensagem aqui...',
    },
    input: {
      label: 'Nova Entrada',
      question: 'Digite sua pergunta aqui...',
      variableName: 'resposta',
      validation: 'none',
    },
    condition: {
      label: 'Nova Condição',
      condition: '',
    },
    api_request: {
      label: 'Nova API',
      url: '',
      method: 'GET',
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
      endMessage: 'Obrigado pelo contato!',
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
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false);
  const [isEditEdgeDialogOpen, setIsEditEdgeDialogOpen] = useState(false);
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  // Buscar nós e arestas do fluxo
  const { data: flowNodes = [], isLoading: isLoadingNodes } = useQuery({
    queryKey: ['/api/flows', flow.id, 'nodes'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/flows/${flow.id}/nodes`);
      return await res.json() as ChatbotNode[];
    },
  });

  const { data: flowEdges = [], isLoading: isLoadingEdges } = useQuery({
    queryKey: ['/api/flows', flow.id, 'edges'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/flows/${flow.id}/edges`);
      return await res.json() as ChatbotEdge[];
    },
  });

  // Mutations para criar/atualizar/excluir nós e arestas
  const createNodeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/flows/${flow.id}/nodes`, data);
      return await res.json() as ChatbotNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
      setIsAddNodeDialogOpen(false);
      toast({
        title: 'Nó criado',
        description: 'O nó foi criado com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar nó',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest('PUT', `/api/nodes/${id}`, data);
      return await res.json() as ChatbotNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
      setIsEditNodeDialogOpen(false);
      toast({
        title: 'Nó atualizado',
        description: 'O nó foi atualizado com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar nó',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/nodes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'nodes'] });
      toast({
        title: 'Nó excluído',
        description: 'O nó foi excluído com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir nó',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/flows/${flow.id}/edges`, data);
      return await res.json() as ChatbotEdge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'edges'] });
      toast({
        title: 'Conexão criada',
        description: 'A conexão foi criada com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar conexão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateEdgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest('PUT', `/api/edges/${id}`, data);
      return await res.json() as ChatbotEdge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'edges'] });
      setIsEditEdgeDialogOpen(false);
      toast({
        title: 'Conexão atualizada',
        description: 'A conexão foi atualizada com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar conexão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/edges/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flows', flow.id, 'edges'] });
      toast({
        title: 'Conexão excluída',
        description: 'A conexão foi excluída com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir conexão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Converter nós e arestas para o formato do ReactFlow
  useEffect(() => {
    if (flowNodes.length > 0) {
      const rfNodes = flowNodes.map((node: ChatbotNode) => {
        return {
          id: node.id.toString(),
          type: node.nodeType,
          position: node.position as { x: number, y: number },
          data: {
            ...(node.data as object),
            label: node.name,
            originalId: node.id, 
          },
        };
      });
      setNodes(rfNodes);
    }
  }, [flowNodes, setNodes]);

  useEffect(() => {
    if (flowEdges.length > 0) {
      const rfEdges = flowEdges.map((edge: ChatbotEdge) => {
        return {
          id: edge.id.toString(),
          source: edge.sourceNodeId.toString(),
          target: edge.targetNodeId.toString(),
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined,
          label: edge.label || undefined,
          data: {
            condition: edge.condition,
            originalId: edge.id,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        };
      });
      setEdges(rfEdges);
    }
  }, [flowEdges, setEdges]);

  // Manipuladores de eventos
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `temp-${Date.now()}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      // Salvar no banco de dados
      createEdgeMutation.mutate({
        flowId: flow.id,
        sourceNodeId: parseInt(connection.source!),
        targetNodeId: parseInt(connection.target!),
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        label: '',
        condition: null,
      });
      
      setIsDirty(true);
    },
    [setEdges, createEdgeMutation, flow.id]
  );

  // Tratamento de clique em nós - versão com diálogo fixo
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    // Impedir a propagação do evento para evitar interações indesejadas
    event.stopPropagation();
    event.preventDefault();
    
    // Atualizar o nó selecionado e abrir o diálogo
    setSelectedNode(node);
    setIsEditNodeDialogOpen(true);
  };

  // Tratamento de clique em arestas - versão com diálogo fixo
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    // Impedir a propagação do evento para evitar interações indesejadas
    event.stopPropagation();
    event.preventDefault();
    
    // Atualizar a aresta selecionada e abrir o diálogo
    setSelectedEdge(edge);
    setIsEditEdgeDialogOpen(true);
  };

  const onNodeDragStop = (_: React.MouseEvent, node: Node) => {
    // Atualizar posição do nó no banco de dados
    updateNodeMutation.mutate({
      id: node.data.originalId,
      data: {
        position: node.position,
      },
    });
    
    setIsDirty(true);
  };

  const onAddNode = (type: string, position: { x: number, y: number }) => {
    // Criar um novo nó com base no tipo
    const newNodeData = getDefaultNodeData(type);
    
    createNodeMutation.mutate({
      flowId: flow.id,
      nodeType: type,
      name: newNodeData.label,
      data: newNodeData,
      position,
    });
    
    setIsDirty(true);
    setIsAddNodeDialogOpen(false);
  };

  // Manipulador para arrastar e soltar novos nós
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      
      if (!type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      onAddNode(type, position);
    },
    [reactFlowInstance, onAddNode]
  );

  // Renderização do editor de fluxo
  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-medium">{flow.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isDirty ? "default" : "outline"} 
            onClick={() => {
              toast({
                title: 'Fluxo salvo',
                description: 'Todas as alterações foram salvas com sucesso!',
              });
              setIsDirty(false);
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
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
            onEdgeClick={onEdgeClick}
            onNodeDragStop={onNodeDragStop}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
            
            <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border">
              <div className="text-sm font-medium mb-2">Adicionar nós</div>
              <div className="grid grid-cols-2 gap-2">
                <DraggableNode type="message" label="Mensagem" icon={<MessageSquare className="h-3 w-3 mr-1" />} />
                <DraggableNode type="input" label="Entrada" icon={<Keyboard className="h-3 w-3 mr-1" />} />
                <DraggableNode type="condition" label="Condição" icon={<GitBranch className="h-3 w-3 mr-1" />} />
                <DraggableNode type="api_request" label="API" icon={<Server className="h-3 w-3 mr-1" />} />
                <DraggableNode type="menu" label="Menu" icon={<List className="h-3 w-3 mr-1" />} />
                <DraggableNode type="wait" label="Espera" icon={<Clock className="h-3 w-3 mr-1" />} />
                <DraggableNode type="goto" label="Ir para" icon={<CornerDownRight className="h-3 w-3 mr-1" />} />
                <DraggableNode type="media" label="Mídia" icon={<ImagePlus className="h-3 w-3 mr-1" />} />
                <DraggableNode type="end" label="Fim" icon={<X className="h-3 w-3 mr-1" />} />
              </div>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setIsAddNodeDialogOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar nó
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      
      {/* Diálogo para editar nó - VERSÃO FIXA */}
      {selectedNode && (
        <Dialog 
          open={isEditNodeDialogOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setIsEditNodeDialogOpen(false);
            }
          }}
        >
          <DialogContent 
            className="sm:max-w-[500px]"
            onClick={(e) => {
              // Impedir que cliques dentro do diálogo propaguem
              e.stopPropagation();
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar {getNodeTypeLabel(selectedNode.type || 'message')}</DialogTitle>
              <DialogDescription>
                Configure as propriedades do nó.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <NodeEditor 
                node={selectedNode} 
                onSave={(data) => {
                  updateNodeMutation.mutate({
                    id: selectedNode.data.originalId,
                    data: {
                      name: data.label,
                      data,
                    },
                  });
                  setIsDirty(true);
                  // Manter o diálogo aberto após salvar
                }}
                onDelete={() => {
                  if (confirm('Tem certeza que deseja excluir este nó?')) {
                    deleteNodeMutation.mutate(selectedNode.data.originalId);
                    setIsEditNodeDialogOpen(false);
                  }
                }}
              />
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditNodeDialogOpen(false);
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Diálogo para editar aresta - VERSÃO FIXA */}
      {selectedEdge && (
        <Dialog 
          open={isEditEdgeDialogOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setIsEditEdgeDialogOpen(false);
            }
          }}
        >
          <DialogContent 
            className="sm:max-w-[500px]"
            onClick={(e) => {
              // Impedir que cliques dentro do diálogo propaguem
              e.stopPropagation();
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar conexão</DialogTitle>
              <DialogDescription>
                Configure as propriedades da conexão entre os nós.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <EdgeEditor 
                edge={selectedEdge} 
                onSave={(data) => {
                  updateEdgeMutation.mutate({
                    id: selectedEdge.data?.originalId,
                    data: {
                      label: data.label,
                      condition: data.condition,
                    },
                  });
                  setIsDirty(true);
                  // Manter o diálogo aberto após salvar
                }}
                onDelete={() => {
                  if (confirm('Tem certeza que deseja excluir esta conexão?')) {
                    deleteEdgeMutation.mutate(selectedEdge.data?.originalId);
                    setIsEditEdgeDialogOpen(false);
                  }
                }}
              />
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditEdgeDialogOpen(false);
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Diálogo para adicionar nó */}
      <Dialog open={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adicionar nó</DialogTitle>
            <DialogDescription>
              Selecione o tipo de nó que deseja adicionar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              <NodeTypeButton 
                type="message" 
                label="Mensagem" 
                description="Envia uma mensagem ao usuário"
                icon={<MessageSquare className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('message', center);
                }}
              />
              <NodeTypeButton 
                type="input" 
                label="Entrada" 
                description="Captura entrada do usuário"
                icon={<Keyboard className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('input', center);
                }}
              />
              <NodeTypeButton 
                type="condition" 
                label="Condição" 
                description="Avalia condições lógicas"
                icon={<GitBranch className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('condition', center);
                }}
              />
              <NodeTypeButton 
                type="api_request" 
                label="API" 
                description="Realiza chamadas de API"
                icon={<Server className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('api_request', center);
                }}
              />
              <NodeTypeButton 
                type="menu" 
                label="Menu" 
                description="Apresenta opções ao usuário"
                icon={<List className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('menu', center);
                }}
              />
              <NodeTypeButton 
                type="wait" 
                label="Espera" 
                description="Aguarda um período de tempo"
                icon={<Clock className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('wait', center);
                }}
              />
              <NodeTypeButton 
                type="goto" 
                label="Ir para" 
                description="Redireciona para outro fluxo"
                icon={<CornerDownRight className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('goto', center);
                }}
              />
              <NodeTypeButton 
                type="media" 
                label="Mídia" 
                description="Envia imagem, vídeo ou arquivo"
                icon={<ImagePlus className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('media', center);
                }}
              />
              <NodeTypeButton 
                type="end" 
                label="Fim" 
                description="Finaliza o fluxo de conversa"
                icon={<X className="h-4 w-4" />}
                onClick={() => {
                  const center = reactFlowInstance.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  onAddNode('end', center);
                }}
              />
            </div>
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