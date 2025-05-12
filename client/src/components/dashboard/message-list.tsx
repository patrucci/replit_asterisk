import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Client } from "@shared/schema";
import { MessageModal } from "@/components/messages/message-modal";

interface MessageListProps {
  clients: Client[];
  className?: string;
}

// Mock messages data - in a real app, this would come from API
const mockMessages = [
  {
    id: 1,
    clientId: 1,
    content: "Obrigada pelo atendimento de ontem. Gostaria de agendar uma nova consulta para a próxima semana.",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
    isFromClient: true
  },
  {
    id: 2,
    clientId: 2,
    content: "Recebi os documentos que você enviou. Vou analisá-los e retorno com minha avaliação até sexta-feira.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    isFromClient: true
  }
];

export function MessageList({ clients, className }: MessageListProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Format time
  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: false, locale: ptBR });
  };

  // Get client by ID
  const getClient = (clientId: number) => {
    return clients.find(client => client.id === clientId);
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

  // Handle reply to message
  const handleReply = (clientId: number) => {
    const client = getClient(clientId);
    if (client) {
      setSelectedClient(client);
      setIsMessageModalOpen(true);
    }
  };

  const displayMessages = mockMessages.slice(0, 2);

  return (
    <>
      <Card className={className}>
        <CardHeader className="p-5 border-b border-neutral-200">
          <h3 className="text-base font-semibold text-neutral-800">Mensagens Recentes</h3>
        </CardHeader>
        
        <CardContent className="p-0">
          {displayMessages.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">
              Não há mensagens recentes.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {displayMessages.map((message) => {
                const client = getClient(message.clientId);
                if (!client) return null;
                
                return (
                  <div key={message.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start">
                      <div className="h-10 w-10 rounded-full bg-primary-light text-white flex items-center justify-center font-medium flex-shrink-0">
                        {getClientInitials(client.name)}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-neutral-800">{client.name}</p>
                          <span className="text-xs text-neutral-500">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 line-clamp-2">{message.content}</p>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-xs text-primary font-medium"
                            onClick={() => handleReply(client.id)}
                          >
                            Responder
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-center">
            <Button variant="link" asChild>
              <Link href="/messages" className="text-sm text-primary font-medium">
                Ver todas as mensagens
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message Modal */}
      {selectedClient && (
        <MessageModal 
          client={selectedClient}
          isOpen={isMessageModalOpen}
          onClose={() => setIsMessageModalOpen(false)}
        />
      )}
    </>
  );
}
