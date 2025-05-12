import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EventList } from "@/components/dashboard/event-list";
import { ClientTable } from "@/components/dashboard/client-table";
import { PaymentList } from "@/components/dashboard/payment-list";
import { MessageList } from "@/components/dashboard/message-list";
import { AIAssistant } from "@/components/dashboard/ai-assistant";
import { Users, Calendar, CreditCard } from "lucide-react";
import { Client, Appointment, Payment } from "@shared/schema";

export default function DashboardPage() {
  const { user } = useAuth();

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!user,
  });

  // Fetch appointments
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    enabled: !!user,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  // Calculate statistics
  const totalClients = clients.length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayAppointments = appointments.filter(app => {
    const appDate = new Date(app.startTime);
    appDate.setHours(0, 0, 0, 0);
    return appDate.getTime() === today.getTime();
  });

  const pendingPayments = payments.filter(payment => payment.status === "pending" || payment.status === "overdue");
  const totalPaymentsAmount = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <MainLayout>
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatsCard
          title="Clientes"
          value={totalClients.toString()}
          icon={<Users className="h-5 w-5 text-primary" />}
          trend={8}
          trendLabel="desde o mês passado"
        />
        
        <StatsCard
          title="Agendamentos"
          value={todayAppointments.length.toString()}
          icon={<Calendar className="h-5 w-5 text-secondary" />}
          trendLabel={`${todayAppointments.length} pendentes para hoje`}
          iconBgColor="bg-green-100"
          iconColor="text-secondary"
        />
        
        <StatsCard
          title="Pagamentos"
          value={`R$ ${(totalPaymentsAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<CreditCard className="h-5 w-5 text-accent" />}
          trend={-2}
          trendLabel="desde o mês passado"
          iconBgColor="bg-yellow-100"
          iconColor="text-accent"
        />
      </div>
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar section and Clients */}
        <div className="lg:col-span-2">
          <EventList 
            appointments={todayAppointments} 
            clients={clients} 
            className="mb-8" 
          />
          
          <ClientTable clients={clients} />
        </div>
        
        {/* Sidebar content */}
        <div className="space-y-8">
          {/* Pending payments */}
          <PaymentList payments={pendingPayments} clients={clients} />
          
          {/* Recent messages */}
          <MessageList clients={clients} />
          
          {/* AI Assistant */}
          <AIAssistant />
        </div>
      </div>
    </MainLayout>
  );
}
