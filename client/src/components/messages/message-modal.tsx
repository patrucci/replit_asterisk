import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Client, Message, InsertMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { X, RefreshCw, Send } from "lucide-react";

interface MessageModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageModal({ client, isOpen, onClose }: MessageModalProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Sim, traga o documento X",
    "Não é necessário",
    "Vamos reagendar?"
  ]);

  // Fetch messages for this client
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/clients", client.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${client.id}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: isOpen
  });

  // Get AI suggestions
  const suggestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/message-suggestions", {
        clientId: client.id,
        context: "atendimento cliente consulta"
      });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const messageData: Partial<InsertMessage> = {
        content,
        isFromClient: false
      };
      const res = await apiRequest("POST", `/api/clients/${client.id}/messages`, messageData);
      return await res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id, "messages"] });
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso."
      });
    },
    onError: () => {
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive"
      });
    }
  });

  // Format time for messages
  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: false, locale: ptBR });
  };

  // Generate client initials
  const getClientInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  const handleInsertSuggestion = (text: string) => {
    setMessage(text);
  };

  const handleRefreshSuggestions = () => {
    suggestionsMutation.mutate();
  };

  // Mock messages if none are available
  const displayMessages = messages.length > 0 ? messages : [
    {
      id: 1,
      clientId: client.id,
      userId: 1,
      content: "Olá, gostaria de confirmar nosso horário para amanhã às 14h.",
      timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
      isFromClient: true
    },
    {
      id: 2,
      clientId: client.id,
      userId: 1,
      content: "Olá, sim, está confirmado para amanhã às 14h. Aguardo você no escritório.",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      isFromClient: false
    },
    {
      id: 3,
      clientId: client.id,
      userId: 1,
      content: "Obrigada! Preciso levar algum documento adicional?",
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      isFromClient: true
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b border-neutral-200 flex flex-row items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-primary-light text-white flex items-center justify-center font-medium">
              {getClientInitials(client.name)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-neutral-800">{client.name}</p>
              <p className="text-xs text-neutral-500">{client.phone}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>
        
        <div className="p-4 flex-1 overflow-y-auto bg-neutral-50 min-h-[300px]">
          <div className="space-y-4">
            {displayMessages.map((msg) => (
              msg.isFromClient ? (
                // Incoming message
                <div key={msg.id} className="flex items-end">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-light text-white flex items-center justify-center text-xs font-medium">
                    {getClientInitials(client.name)}
                  </div>
                  <div className="ml-2 bg-white rounded-lg rounded-bl-none px-4 py-2 max-w-[75%] shadow-sm">
                    <p className="text-sm text-neutral-800">{msg.content}</p>
                    <p className="text-xs text-neutral-500 text-right mt-1">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ) : (
                // Outgoing message
                <div key={msg.id} className="flex items-end justify-end">
                  <div className="bg-primary text-white rounded-lg rounded-br-none px-4 py-2 max-w-[75%] shadow-sm">
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs text-primary-foreground/80 text-right mt-1">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-200 sticky bottom-0 bg-white">
          <div className="flex space-x-2">
            {/* AI suggestions */}
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex space-x-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap text-xs bg-primary/10 text-primary hover:bg-primary/20 border-none"
                    onClick={() => handleInsertSuggestion(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              className="bg-primary/10 text-primary hover:bg-primary/20 border-none"
              onClick={handleRefreshSuggestions}
              disabled={suggestionsMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${suggestionsMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="mt-2 flex">
            <Input
              type="text"
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-r-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button
              className="rounded-l-none"
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || !message.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
