import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertAppointmentSchema, Appointment, Client } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AppointmentFormProps {
  appointment?: Partial<Appointment>;
  onSave?: (appointment: Appointment) => void;
  onCancel: () => void;
}

// Appointment form schema
const appointmentFormSchema = insertAppointmentSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres"),
  clientId: z.number().int().positive("Selecione um cliente"),
  type: z.string().min(1, "Selecione um tipo"),
}).omit({ userId: true });

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export function AppointmentForm({ appointment, onSave, onCancel }: AppointmentFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing] = useState(!!appointment?.id);

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Format date for form input
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), "yyyy-MM-dd'T'HH:mm");
  };

  // Create form
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      title: appointment?.title || "",
      clientId: appointment?.clientId || 0,
      startTime: formatDateForInput(appointment?.startTime),
      endTime: formatDateForInput(appointment?.endTime),
      type: appointment?.type || "meeting",
      notes: appointment?.notes || "",
      status: appointment?.status || "scheduled",
    },
  });

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      const appointmentData = {
        ...data,
        userId: user?.id,
      };
      const res = await apiRequest("POST", "/api/appointments", appointmentData);
      return await res.json();
    },
    onSuccess: (newAppointment: Appointment) => {
      toast({
        title: "Evento criado",
        description: "O evento foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      if (onSave) onSave(newAppointment);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar evento",
        description: error.message || "Não foi possível criar o evento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      const res = await apiRequest("PUT", `/api/appointments/${appointment?.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedAppointment: Appointment) => {
      toast({
        title: "Evento atualizado",
        description: "O evento foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      if (onSave) onSave(updatedAppointment);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar evento",
        description: error.message || "Não foi possível atualizar o evento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: AppointmentFormValues) => {
    if (isEditing && appointment?.id) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Evento" : "Novo Evento"}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Título do evento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value ? field.value.toString() : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora de Início</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora de Término</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="consult">Consulta</SelectItem>
                        <SelectItem value="hearing">Audiência</SelectItem>
                        <SelectItem value="consultation">Consultoria</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações adicionais sobre o evento"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
