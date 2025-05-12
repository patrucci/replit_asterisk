import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import { Client, Payment } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PaymentListProps {
  payments: Payment[];
  clients: Client[];
  className?: string;
}

export function PaymentList({ payments, clients, className }: PaymentListProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return (amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Format date
  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  // Get client by ID
  const getClient = (clientId: number) => {
    return clients.find(client => client.id === clientId);
  };

  // Get status badge
  const getStatusBadge = (status: string, dueDate: string) => {
    if (status === "paid") {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pago</Badge>;
    } else if (status === "overdue" || (status === "pending" && isPast(new Date(dueDate)))) {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Atrasado</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>;
    }
  };

  const recentPayments = payments.slice(0, 3);

  return (
    <Card className={className}>
      <CardHeader className="p-5 border-b border-neutral-200">
        <h3 className="text-base font-semibold text-neutral-800">Pagamentos Pendentes</h3>
      </CardHeader>
      
      <CardContent className="p-0">
        {recentPayments.length === 0 ? (
          <div className="p-4 text-center text-neutral-500">
            Não há pagamentos pendentes.
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {recentPayments.map((payment) => {
              const client = getClient(payment.clientId);
              return (
                <div key={payment.id} className="p-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {client?.name || "Cliente"}
                      </p>
                      <p className="text-xs text-neutral-500">{payment.description}</p>
                    </div>
                    <span className="text-sm font-semibold text-neutral-800">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      Vencimento: {formatDate(payment.dueDate)}
                    </span>
                    {getStatusBadge(payment.status, payment.dueDate)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-center">
          <Button variant="link" asChild>
            <Link href="/payments" className="text-sm text-primary font-medium">
              Ver todos os pagamentos
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
