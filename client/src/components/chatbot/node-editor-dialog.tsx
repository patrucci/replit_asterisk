import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Node } from 'reactflow';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';

// Editor para edição de nós de forma isolada
export function NodeEditorDialog({ 
  isOpen, 
  onClose, 
  node, 
  flowId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  node: Node | null;
  flowId: number;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Se não houver nó selecionado, não renderizar o dialog
  if (!node) return null;
  
  const nodeType = node.type || 'message';
  
  // Cada tipo de nó tem um formulário diferente
  const NodeForm = () => {
    const form = useForm({
      defaultValues: {
        label: node.data?.label || '',
        ...node.data
      }
    });
    
    // Atualizando o nó no banco de dados
    const updateNodeMutation = useMutation({
      mutationFn: async ({ id, data }: { id: number, data: any }) => {
        const res = await apiRequest('PUT', `/api/nodes/${id}`, data);
        return await res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/flows', flowId, 'nodes'] });
        toast({
          title: 'Nó atualizado',
          description: 'O nó foi atualizado com sucesso!',
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: 'Erro ao atualizar nó',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
    
    // Excluindo o nó do banco de dados
    const deleteNodeMutation = useMutation({
      mutationFn: async (id: number) => {
        await apiRequest('DELETE', `/api/nodes/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/flows', flowId, 'nodes'] });
        toast({
          title: 'Nó excluído',
          description: 'O nó foi excluído com sucesso!',
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: 'Erro ao excluir nó',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
    
    const onSubmit = useCallback((data: any) => {
      setIsSubmitting(true);
      
      updateNodeMutation.mutate({
        id: node.data.originalId,
        data: {
          name: data.label,
          data,
        },
      });
    }, [node.data.originalId]);
    
    const onDelete = useCallback(() => {
      if (confirm('Tem certeza que deseja excluir este nó?')) {
        deleteNodeMutation.mutate(node.data.originalId);
      }
    }, [node.data.originalId]);
    
    // Renderizar formulário baseado no tipo de nó
    return (
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Nome do nó</Label>
            <Input
              id="label"
              {...form.register('label')}
            />
          </div>
          
          {/* Campos específicos para cada tipo de nó */}
          {nodeType === 'message' && (
            <div className="grid gap-2">
              <Label htmlFor="content">Mensagem</Label>
              <Textarea
                id="content"
                rows={4}
                {...form.register('content')}
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
                  {...form.register('question')}
                  placeholder="Digite a pergunta que será feita ao usuário..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="variableName">Nome da variável</Label>
                <Input
                  id="variableName"
                  {...form.register('variableName')}
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
                  onValueChange={(value) => form.setValue('validation', value)}
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
          
          {nodeType === 'api_request' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="url">URL da API</Label>
                <Input
                  id="url"
                  {...form.register('url')}
                  placeholder="https://exemplo.com/api"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Método</Label>
                <Select 
                  defaultValue={node.data.method || 'GET'}
                  onValueChange={(value) => form.setValue('method', value)}
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
                  rows={3}
                  {...form.register('headers')}
                  placeholder={"{\n  \"Content-Type\": \"application/json\"\n}"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">Body (JSON)</Label>
                <Textarea
                  id="body"
                  rows={3}
                  {...form.register('body')}
                  placeholder={"{\n  \"chave\": \"valor\"\n}"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="resultVariable">Variável de resultado</Label>
                <Input
                  id="resultVariable"
                  {...form.register('resultVariable')}
                  placeholder="Ex: resultadoAPI"
                />
                <p className="text-xs text-neutral-500">
                  A resposta da API será armazenada nesta variável
                </p>
              </div>
            </>
          )}
          
          <div className="flex justify-between pt-4">
            <Button 
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Excluir
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </form>
    );
  };
  
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          if (confirm('Deseja fechar o editor? Alterações não salvas serão perdidas.')) {
            onClose();
          }
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Impede fechamento ao clicar fora
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Impede fechamento ao pressionar ESC
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar {getNodeTypeLabel(nodeType)}</DialogTitle>
          <DialogDescription>
            Configure as propriedades do nó.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <NodeForm />
        </div>
      </DialogContent>
    </Dialog>
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