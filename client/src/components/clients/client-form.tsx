import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertClientSchema, Client } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ClientFormProps {
  client?: Client;
  onSave?: (client: Client) => void;
  onCancel: () => void;
}

// Create client form schema
const clientFormSchema = insertClientSchema.extend({
  area: z.string().min(2, "A área de atuação é obrigatória"),
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "O telefone deve ter pelo menos 8 caracteres"),
}).omit({ userId: true });

type ClientFormValues = z.infer<typeof clientFormSchema>;

export function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing] = useState(!!client);

  // Create form
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? {
      name: client.name,
      email: client.email,
      phone: client.phone,
      area: client.area,
      notes: client.notes || "",
      status: client.status || "active",
    } : {
      name: "",
      email: "",
      phone: "",
      area: "",
      notes: "",
      status: "active",
    },
  });

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const clientData = {
        ...data,
        userId: user?.id,
      };
      const res = await apiRequest("POST", "/api/clients", clientData);
      return await res.json();
    },
    onSuccess: (newClient: Client) => {
      toast({
        title: "Cliente criado",
        description: "O cliente foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (onSave) onSave(newClient);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar cliente",
        description: error.message || "Não foi possível criar o cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const res = await apiRequest("PUT", `/api/clients/${client?.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedClient: Client) => {
      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (onSave) onSave(updatedClient);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message || "Não foi possível atualizar o cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: ClientFormValues) => {
    if (isEditing && client) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Cliente" : "Novo Cliente"}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área de Atuação</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Direito Familiar, Consultoria Empresarial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações adicionais sobre o cliente"
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
