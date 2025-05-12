import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export function AIAssistant({ className }: { className?: string }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  // AI suggestion templates
  const suggestionTemplates = [
    {
      id: 1,
      text: "📝 Criar mensagem para lembrar cliente sobre pagamento pendente",
      context: "pagamento pendente lembrete cliente"
    },
    {
      id: 2,
      text: "📅 Sugerir horários para próxima semana",
      context: "sugestão horários agenda disponibilidade"
    },
    {
      id: 3,
      text: "📊 Gerar resumo das atividades da semana",
      context: "relatório resumo atividades semana"
    }
  ];

  // AI query mutation
  const aiQueryMutation = useMutation({
    mutationFn: async (context: string) => {
      // In a real implementation, you would call the AI API with more context
      const res = await apiRequest("POST", "/api/ai/message-suggestions", {
        clientId: 1, // Would be selected client in a real implementation
        context
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Assistente AI",
        description: "Sugestões geradas com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Assistente AI - Erro",
        description: "Não foi possível gerar sugestões. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  const handleAIQuery = (context: string) => {
    aiQueryMutation.mutate(context);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleAIQuery(query);
      setQuery("");
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="p-5 border-b border-neutral-200 flex flex-row items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-800">Assistente AI</h3>
        <span className="flex items-center text-xs font-medium text-green-600">
          <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
          Ativo
        </span>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="mb-4">
          <p className="text-sm text-neutral-600 mb-3">Como posso ajudar você hoje?</p>
          <div className="grid grid-cols-1 gap-2">
            {suggestionTemplates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="justify-start text-left h-auto py-2 px-3"
                onClick={() => handleAIQuery(template.context)}
                disabled={aiQueryMutation.isPending}
              >
                <span className="text-sm">{template.text}</span>
              </Button>
            ))}
          </div>
        </div>
        
        <form className="relative" onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="Digite sua pergunta..."
            className="pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={aiQueryMutation.isPending}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-primary hover:text-primary-dark h-8 w-8"
            disabled={aiQueryMutation.isPending || !query.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
