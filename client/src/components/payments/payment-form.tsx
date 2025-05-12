import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertPaymentSchema, Payment, Client } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PaymentFormProps {
  payment?: Payment;
  onSave?: (payment: Payment) => void;
  onCancel: () => void;
}

// Convert amount between cents and currency display format
const centsToCurrency = (cents: number) => (cents / 100).toFixed(2);
const currencyToCents = (currency: string) => Math.round(parseFloat(currency) * 100);

// Payment form schema
const paymentFormSchema = insertPaymentSchema.extend({
  amount: z.string()
    .refine(value => !isNaN(parseFloat(value)), {
      message: "O valor deve ser um número válido",
    })
    .refine(value => parseFloat(value) > 0, {
      message: "O valor deve ser maior que zero",
    }),
  dueDate: z.string(),
  clientId: z.number().int().positive("Selecione um cliente"),
  description: z.string().min(3, "A descrição deve ter pelo menos 3 caracteres"),
}).omit({ userId: true, paymentDate: true });

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function PaymentForm({ payment, onSave, onCancel }: PaymentFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing] = useState(!!payment);

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Format date for form input
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), "yyyy-MM-dd");
  };

  // Create form
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: payment ? {
      clientId: payment.clientId,
      amount: centsToCurrency(payment.amount),
      description: payment.description,
      dueDate: formatDateForInput(payment.dueDate),
      status: payment.status,
    } : {
      clientId: 0,
      amount: "",
      description: "",
      dueDate: formatDateForInput(new Date().toISOString()),
      status: "pending",
    },
  });

  // Create payment mutation
  const createMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      const paymentData = {
        ...data,
        amount: currencyToCents(data.amount),
        userId: user?.id,
      };
      const res = await apiRequest("POST", "/api/payments", paymentData);
      return await res.json();
    },
    onSuccess: (newPayment: Payment) => {
      toast({
        title: "Pagamento criado",
        description: "O pagamento foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      if (onSave) onSave(newPayment);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar pagamento",
        description: error.message || "Não foi possível criar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update payment mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      const paymentData = {
        ...data,
        amount: currencyToCents(data.amount),
      };
      const res = await apiRequest("PUT", `/api/payments/${payment?.id}`, paymentData);
      return await res.json();
    },
    onSuccess: (updatedPayment: Payment) => {
      toast({
        title: "Pagamento atualizado",
        description: "O pagamento foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      if (onSave) onSave(updatedPayment);
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar pagamento",
        description: error.message || "Não foi possível atualizar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: PaymentFormValues) => {
    if (isEditing && payment) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Pagamento" : "Novo Pagamento"}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0,00" 
                        {...field} 
                        onChange={(e) => {
                          // Clean input: allow only numbers and one decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição do pagamento" {...field} />
                  </FormControl>
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
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Atrasado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
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
