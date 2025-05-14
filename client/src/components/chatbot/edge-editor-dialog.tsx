import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Edge } from 'reactflow';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';

// Editor para edição de arestas de forma isolada
export function EdgeEditorDialog({ 
  isOpen, 
  onClose, 
  edge, 
  flowId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  edge: Edge | null;
  flowId: number;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Se não houver aresta selecionada, não renderizar o dialog
  if (!edge) return null;
  
  // Formulário de edição de aresta
  const EdgeForm = () => {
    const form = useForm({
      defaultValues: {
        label: edge.label || '',
        condition: edge.data?.condition || null,
      }
    });
    
    // Atualizando a aresta no banco de dados
    const updateEdgeMutation = useMutation({
      mutationFn: async ({ id, data }: { id: number, data: any }) => {
        const res = await apiRequest('PUT', `/api/edges/${id}`, data);
        return await res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/flows', flowId, 'edges'] });
        toast({
          title: 'Conexão atualizada',
          description: 'A conexão foi atualizada com sucesso!',
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: 'Erro ao atualizar conexão',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
    
    // Excluindo a aresta do banco de dados
    const deleteEdgeMutation = useMutation({
      mutationFn: async (id: number) => {
        await apiRequest('DELETE', `/api/edges/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/flows', flowId, 'edges'] });
        toast({
          title: 'Conexão excluída',
          description: 'A conexão foi excluída com sucesso!',
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: 'Erro ao excluir conexão',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
    
    const onSubmit = useCallback((data: any) => {
      setIsSubmitting(true);
      
      updateEdgeMutation.mutate({
        id: edge.data?.originalId,
        data: {
          label: data.label,
          condition: data.condition,
        },
      });
    }, [edge.data?.originalId]);
    
    const onDelete = useCallback(() => {
      if (confirm('Tem certeza que deseja excluir esta conexão?')) {
        deleteEdgeMutation.mutate(edge.data?.originalId);
      }
    }, [edge.data?.originalId]);
    
    return (
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Rótulo da conexão</Label>
            <Input
              id="label"
              {...form.register('label')}
              placeholder="Ex: Sim, Não, Próximo"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="condition">Condição (opcional)</Label>
            <Textarea
              id="condition"
              rows={3}
              {...form.register('condition')}
              placeholder="Ex: resposta == 'sim'"
            />
            <p className="text-xs text-neutral-500">
              A condição determina quando esta conexão será seguida
            </p>
          </div>
          
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
          <DialogTitle>Editar conexão</DialogTitle>
          <DialogDescription>
            Configure as propriedades da conexão entre os nós.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <EdgeForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}