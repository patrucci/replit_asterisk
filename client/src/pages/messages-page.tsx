import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client } from "@shared/schema";
import { MainLayout } from "@/components/layout/main-layout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare } from "lucide-react";
import { MessageList } from "@/components/messages/message-list";

export default function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Filter clients by search term
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate client initials
  const getClientInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Mensagens</h2>
          <p className="text-sm text-neutral-500">Gerencie todas as suas comunicações com clientes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>Contatos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
              <Input
                placeholder="Buscar contatos..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="divide-y divide-neutral-200 max-h-[600px] overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="py-4 text-center text-neutral-500">
                  Nenhum contato encontrado.
                </div>
              ) : (
                filteredClients.map(client => (
                  <div 
                    key={client.id}
                    className={`py-3 px-2 cursor-pointer transition-colors ${selectedClient?.id === client.id ? 'bg-primary/10' : 'hover:bg-neutral-50'}`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary-light text-white flex items-center justify-center font-medium">
                        {getClientInitials(client.name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-800">{client.name}</p>
                        <p className="text-xs text-neutral-500 truncate">{client.phone}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-500 hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClient(client);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message list */}
        <div className="lg:col-span-2">
          {selectedClient ? (
            <>
              <div className="mb-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-full bg-primary-light text-white flex items-center justify-center font-medium">
                      {getClientInitials(selectedClient.name)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedClient.name}</h3>
                      <div className="flex space-x-4 text-sm text-neutral-500">
                        <span>{selectedClient.phone}</span>
                        <span>•</span>
                        <span>{selectedClient.email}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <MessageList clientId={selectedClient.id} />
            </>
          ) : (
            <Card className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-700 mb-2">Nenhuma conversa selecionada</h3>
                <p className="text-neutral-500">Selecione um contato para visualizar e enviar mensagens.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
