import { useState } from "react";
import { Link } from "wouter";
import { Client } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Eye } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageModal } from "@/components/messages/message-modal";

interface ClientTableProps {
  clients: Client[];
  className?: string;
}

export function ClientTable({ clients, className }: ClientTableProps) {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Call client mutation
  const callMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/calls`, {
        type: "outbound",
        notes: "Call initiated from client list",
        duration: 0
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Chamada iniciada",
        description: "A chamada está sendo iniciada...",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao iniciar chamada",
        description: "Não foi possível iniciar a chamada. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleCall = (clientId: number) => {
    callMutation.mutate(clientId);
  };

  const handleMessage = (client: Client) => {
    setSelectedClient(client);
    setIsMessageModalOpen(true);
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

  const recentClients = clients.slice(0, 5);

  return (
    <>
      <Card className={className}>
        <CardHeader className="p-5 border-b border-neutral-200 flex flex-row items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-800">Clientes Recentes</h3>
          <Button variant="link" asChild>
            <Link href="/clients">Ver Todos</Link>
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Área
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {recentClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-neutral-500">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  recentClients.map((client) => (
                    <tr key={client.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary-light text-white flex items-center justify-center font-medium">
                            {getClientInitials(client.name)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-neutral-800">{client.name}</div>
                            <div className="text-sm text-neutral-500">{client.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-500">{client.area}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {client.status === "active" ? "Ativo" : client.status === "pending" ? "Pendente" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary-dark h-8 w-8"
                            onClick={() => handleCall(client.id)}
                            disabled={callMutation.isPending}
                          >
                            <Phone className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary-dark h-8 w-8"
                            onClick={() => handleMessage(client)}
                          >
                            <MessageSquare className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary-dark h-8 w-8"
                            asChild
                          >
                            <Link href={`/clients/${client.id}`}>
                              <Eye className="h-5 w-5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
