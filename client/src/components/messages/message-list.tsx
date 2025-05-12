import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Client, Message } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { MessageModal } from "./message-modal";

interface MessageListProps {
  clientId?: number;
  onSelectClient?: (client: Client) => void;
  className?: string;
}

export function MessageList({ clientId, onSelectClient, className }: MessageListProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Fetch all clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch messages for a specific client if clientId is provided
  const { data: clientMessages = [] } = useQuery<Message[]>({
    queryKey: ["/api/clients", clientId, "messages"],
    enabled: !!clientId,
  });

  // Format time
  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR });
  };

  // Get client by ID
  const getClient = (id: number) => {
    return clients.find(client => client.id === id);
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

  // Handle message to client
  const handleMessage = (client: Client) => {
    setSelectedClient(client);
    setIsMessageModalOpen(true);
    if (onSelectClient) {
      onSelectClient(client);
    }
  };

  // If we have a specific clientId, show messages for that client
  // Otherwise, show the most recent message for each client
  const displayMessages = clientId
    ? clientMessages
    : clients.map(client => {
        // For demo purposes, we're creating a mock message for each client
        // In a real app, you'd fetch the most recent message for each client from the API
        return {
          id: client.id,
          clientId: client.id,
          userId: 1,
          content: `Última mensagem para ${client.name}...`,
          timestamp: new Date().toISOString(),
          isFromClient: Math.random() > 0.5, // Randomly assign sender
        };
      });

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {displayMessages.length === 0 ? (
          <Card className="p-5 text-center text-neutral-500">
            Não há mensagens disponíveis.
          </Card>
        ) : (
          displayMessages.map((message) => {
            const client = getClient(message.clientId);
            if (!client) return null;
            
            return (
              <Card key={message.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4">
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
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {message.isFromClient ? <span className="text-neutral-400 mr-1">Cliente:</span> : <span className="text-primary mr-1">Você:</span>}
                        {message.content}
                      </p>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => handleMessage(client)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Responder
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

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
