import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Payment, Client } from "@shared/schema";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { PaymentForm } from "@/components/payments/payment-form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Edit, Plus, Search, Trash } from "lucide-react";
import { PaymentPieChart } from "@/components/payments/payment-chart";

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

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

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const client = getClient(payment.clientId);
    const matchesSearch = client && 
      (client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       payment.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Apply status filter
    if (statusFilter === "all") {
      return matchesSearch;
    } else if (statusFilter === "overdue") {
      return matchesSearch && 
        (payment.status === "overdue" || 
         (payment.status === "pending" && isPast(new Date(payment.dueDate))));
    } else {
      return matchesSearch && payment.status === statusFilter;
    }
  });

  // Calculate totals
  const totalPending = payments
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalPaid = payments
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalOverdue = payments
    .filter(p => p.status === "overdue" || (p.status === "pending" && isPast(new Date(p.dueDate))))
    .reduce((sum, p) => sum + p.amount, 0);

  // Mock payment stats for the chart
  const paymentStats = [
    { name: "Pendente", value: totalPending, color: "#FBBF24" },
    { name: "Pago", value: totalPaid, color: "#10B981" },
    { name: "Atrasado", value: totalOverdue, color: "#EF4444" },
  ];

  const handleEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowForm(true);
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Pagamentos</h2>
          <p className="text-sm text-neutral-500">Gerencie todas as suas cobranças e pagamentos.</p>
        </div>
        <Button onClick={() => {
          setSelectedPayment(null);
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Pagamento
        </Button>
      </div>

      {showForm ? (
        <PaymentForm 
          payment={selectedPayment || undefined}
          onCancel={() => {
            setShowForm(false);
            setSelectedPayment(null);
          }}
          onSave={() => {
            setShowForm(false);
            setSelectedPayment(null);
          }}
        />
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Total Pendente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-yellow-500">
                  {formatCurrency(totalPending)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Total Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-green-500">
                  {formatCurrency(totalPaid)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Total Atrasado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-500">
                  {formatCurrency(totalOverdue)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
              <Input
                placeholder="Buscar pagamentos..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payments table */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Pagamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-neutral-500">
                            Nenhum pagamento encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => {
                          const client = getClient(payment.clientId);
                          return (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">{client?.name || "Cliente"}</TableCell>
                              <TableCell>{payment.description}</TableCell>
                              <TableCell>{formatCurrency(payment.amount)}</TableCell>
                              <TableCell>{formatDate(payment.dueDate)}</TableCell>
                              <TableCell>
                                <PaymentStatusBadge status={payment.status} dueDate={payment.dueDate} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditPayment(payment)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Payment chart */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Pagamentos</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[300px] w-full">
                    <PaymentPieChart data={paymentStats} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
