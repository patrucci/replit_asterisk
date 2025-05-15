import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  PlusCircle, 
  FilePlus, 
  Trash2, 
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

export default function UnifiedFlowPage() {
  const { toast } = useToast();
  const [newFlowName, setNewFlowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Buscar fluxos unificados
  const { data: flows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/unified-flows'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/unified-flows');
      return await response.json();
    }
  });

  // Mutação para criar novo fluxo
  const createFlowMutation = useMutation({
    mutationFn: async (data: { name: string, description?: string, flowType: string }) => {
      const response = await apiRequest('POST', '/api/unified-flows', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Fluxo criado',
        description: 'O fluxo unificado foi criado com sucesso.',
      });
      setNewFlowName('');
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['/api/unified-flows'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar fluxo',
        description: error.message || 'Ocorreu um erro ao criar o fluxo unificado.',
        variant: 'destructive',
      });
    }
  });

  // Mutação para excluir fluxo
  const deleteFlowMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/unified-flows/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Fluxo excluído',
        description: 'O fluxo unificado foi excluído com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-flows'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir fluxo',
        description: error.message || 'Ocorreu um erro ao excluir o fluxo unificado.',
        variant: 'destructive',
      });
    }
  });

  // Função para criar novo fluxo
  const handleCreateFlow = () => {
    if (!newFlowName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o fluxo unificado.',
        variant: 'destructive',
      });
      return;
    }

    createFlowMutation.mutate({
      name: newFlowName,
      description: `Fluxo unificado: ${newFlowName}`,
      flowType: 'unified'
    });
  };

  // Função para excluir fluxo
  const handleDeleteFlow = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este fluxo unificado? Esta ação não pode ser desfeita.')) {
      deleteFlowMutation.mutate(id);
    }
  };

  // Hook para navegação
  const [, navigate] = useLocation();
  
  // Função para navegar para o editor de fluxo
  const navigateToEditor = (flow: UnifiedFlow) => {
    navigate(`/unified-flow/${flow.id}`);
  };

  // Se estiver carregando, mostrar indicador
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se ocorreu um erro, mostrar mensagem
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-destructive text-lg font-semibold">
          Erro ao carregar fluxos unificados
        </div>
        <Button onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Fluxos Unificados</h1>
        
        {!isCreating ? (
          <Button onClick={() => setIsCreating(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Fluxo
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nome do fluxo"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              className="w-64"
            />
            <Button onClick={handleCreateFlow} disabled={createFlowMutation.isPending}>
              {createFlowMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FilePlus className="mr-2 h-4 w-4" />
              )}
              Criar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreating(false);
                setNewFlowName('');
              }}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flows.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum fluxo unificado</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Crie fluxos para integrar chatbots e planos de discagem do Asterisk.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar novo fluxo
            </Button>
          </div>
        ) : (
          flows.map((flow: UnifiedFlow) => (
            <Card key={flow.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{flow.name}</CardTitle>
                <CardDescription>
                  {flow.description || `Fluxo ID: ${flow.id}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center bg-primary/10 text-primary rounded-full px-3 py-1 text-sm">
                    <span className="font-medium">{flow.flowType || 'unified'}</span>
                  </div>
                  {flow.active ? (
                    <div className="flex items-center bg-green-500/10 text-green-500 rounded-full px-3 py-1 text-sm">
                      <span className="font-medium">Ativo</span>
                    </div>
                  ) : (
                    <div className="flex items-center bg-destructive/10 text-destructive rounded-full px-3 py-1 text-sm">
                      <span className="font-medium">Inativo</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="h-4 w-4 mr-1" />
                      <span className="text-xs">Telefonia</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      <span className="text-xs">Chatbot</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Criado em: {flow.createdAt ? new Date(flow.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/50 border-t pt-3 pb-3 flex justify-between">
                <Button 
                  variant="default" 
                  onClick={() => navigateToEditor(flow)}
                >
                  Editar Fluxo
                </Button>
                <Button 
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteFlow(flow.id)}
                  disabled={deleteFlowMutation.isPending && deleteFlowMutation.variables === flow.id}
                >
                  {deleteFlowMutation.isPending && deleteFlowMutation.variables === flow.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}