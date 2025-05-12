import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Client, Appointment, Call } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Phone, MessageSquare, FileText } from "lucide-react";
import { MessageModal } from "@/components/messages/message-modal";

interface EventListProps {
  appointments: Appointment[];
  clients: Client[];
  className?: string;
}

const typeColors = {
  "consult": { bg: "bg-blue-100", text: "text-blue-800", label: "Consulta" },
  "meeting": { bg: "bg-green-100", text: "text-green-800", label: "Reunião" },
  "hearing": { bg: "bg-green-100", text: "text-green-800", label: "Audiência" },
  "consultation": { bg: "bg-purple-100", text: "text-purple-800", label: "Consultoria" },
  "other": { bg: "bg-gray-100", text: "text-gray-800", label: "Outro" },
};

const typeIcons = {
  "consult": { bg: "bg-primary/10", text: "text-primary" },
  "meeting": { bg: "bg-primary/10", text: "text-primary" },
  "hearing": { bg: "bg-secondary/10", text: "text-secondary" },
  "consultation": { bg: "bg-accent/10", text: "text-accent" },
  "other": { bg: "bg-neutral-100", text: "text-neutral-500" },
};

export function EventList({ appointments, clients, className }: EventListProps) {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Simulate a call to client
  const callMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const callData: Partial<Call> = {
        clientId,
        type: "outbound",
        duration: 0,
        notes: "Call initiated from dashboard",
      };
      const res = await apiRequest("POST", `/api/clients/${clientId}/calls`, callData);
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

  // Handle client call
  const handleCall = (clientId: number) => {
    callMutation.mutate(clientId);
  };

  // Handle message to client
  const handleMessage = (client: Client) => {
    setSelectedClient(client);
    setIsMessageModalOpen(true);
  };

  // Sort appointments by start time
  const sortedAppointments = [...appointments].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Get client by ID
  const getClient = (clientId: number) => {
    return clients.find(client => client.id === clientId);
  };

  // Format time
  const formatTime = (date: string) => {
    return format(new Date(date), "HH:mm", { locale: ptBR });
  };

  // Get type info for appointment
  const getTypeInfo = (type: string) => {
    return typeColors[type as keyof typeof typeColors] || typeColors.other;
  };

  // Get icon styling for appointment type
  const getIconStyle = (type: string) => {
    return typeIcons[type as keyof typeof typeIcons] || typeIcons.other;
  };

  return (
    <>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="p-5 border-b border-neutral-200 flex flex-row items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-800">Agenda de Hoje</h3>
          <div className="flex space-x-2">
            <Button size="sm" className="text-xs">
              + Evento
            </Button>
            <Button size="sm" variant="outline" className="text-xs">
              Ver Calendário
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {sortedAppointments.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">
              Não há eventos agendados para hoje.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {sortedAppointments.map((appointment) => {
                const client = getClient(appointment.clientId);
                const typeInfo = getTypeInfo(appointment.type);
                const iconStyle = getIconStyle(appointment.type);
                
                return (
                  <div key={appointment.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start">
                      <div className={cn("rounded p-2 mr-4", iconStyle.bg, iconStyle.text)}>
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-neutral-800">
                            {appointment.title}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className={cn("font-medium", typeInfo.bg, typeInfo.text)}
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center text-xs text-neutral-500 mb-2">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                        </div>
                        {client && (
                          <div className="flex space-x-2">
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="p-0 h-6 text-xs text-primary font-medium"
                              onClick={() => handleCall(client.id)}
                              disabled={callMutation.isPending}
                            >
                              <Phone className="h-4 w-4 mr-1" />
                              Ligar
                            </Button>
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="p-0 h-6 text-xs text-primary font-medium"
                              onClick={() => handleMessage(client)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Mensagem
                            </Button>
                            {appointment.notes && (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="p-0 h-6 text-xs text-primary font-medium"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Ver Detalhes
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-center">
            <Button variant="link" className="text-sm text-primary font-medium">
              Ver todos os eventos
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
