import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  PhoneCall,
  Users,
  Clock,
  BarChart,
  PieChart,
  LineChart,
  TrendingUp,
  AlertTriangle,
  Check,
  Download,
  Calendar,
  User,
  History,
  Headphones
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";

// Tipo para as métricas diárias
type DailyMetric = {
  date: string;
  answered: number;
  abandoned: number;
  sla: number;
  avgWaitTime: number;
  avgHandleTime: number;
};

// Tipo para o desempenho do agente
type AgentPerformance = {
  agentId: number;
  agentName: string;
  callsAnswered: number;
  avgHandleTime: number;
  avgAfterCallWork: number;
  customerSatisfaction: number;
  loginTime: number;
  pauseTime: number;
  readiness: number;
};

// Tipo para a distribuição de chamadas
type CallDistribution = {
  hour: number;
  calls: number;
  abandonRate: number;
};

// Tipo para as métricas de fila
type QueueMetric = {
  queueId: number;
  queueName: string;
  totalCalls: number;
  answeredCalls: number;
  abandonedCalls: number;
  avgWaitTime: number;
  avgHandleTime: number;
  slaPercentage: number;
};

// Tipo para pausas de agentes
type AgentPauseMetric = {
  pauseReason: string;
  totalTime: number;
  percentage: number;
  color: string;
};

// Dados simulados
const mockDailyMetrics: DailyMetric[] = [
  { date: "2025-05-01", answered: 45, abandoned: 5, sla: 92, avgWaitTime: 32, avgHandleTime: 189 },
  { date: "2025-05-02", answered: 52, abandoned: 4, sla: 94, avgWaitTime: 28, avgHandleTime: 175 },
  { date: "2025-05-03", answered: 32, abandoned: 6, sla: 87, avgWaitTime: 41, avgHandleTime: 201 },
  { date: "2025-05-04", answered: 40, abandoned: 3, sla: 95, avgWaitTime: 25, avgHandleTime: 183 },
  { date: "2025-05-05", answered: 65, abandoned: 8, sla: 88, avgWaitTime: 39, avgHandleTime: 192 },
  { date: "2025-05-06", answered: 58, abandoned: 5, sla: 91, avgWaitTime: 35, avgHandleTime: 178 },
  { date: "2025-05-07", answered: 50, abandoned: 4, sla: 93, avgWaitTime: 30, avgHandleTime: 180 },
];

const mockAgentPerformance: AgentPerformance[] = [
  { agentId: 1, agentName: "Carlos Oliveira", callsAnswered: 87, avgHandleTime: 195, avgAfterCallWork: 45, customerSatisfaction: 4.7, loginTime: 480, pauseTime: 65, readiness: 86 },
  { agentId: 2, agentName: "Ana Silva", callsAnswered: 72, avgHandleTime: 210, avgAfterCallWork: 50, customerSatisfaction: 4.5, loginTime: 480, pauseTime: 85, readiness: 82 },
  { agentId: 3, agentName: "Roberto Santos", callsAnswered: 93, avgHandleTime: 175, avgAfterCallWork: 40, customerSatisfaction: 4.8, loginTime: 480, pauseTime: 55, readiness: 89 },
  { agentId: 4, agentName: "Maria Costa", callsAnswered: 65, avgHandleTime: 230, avgAfterCallWork: 60, customerSatisfaction: 4.3, loginTime: 480, pauseTime: 95, readiness: 78 },
];

const mockCallDistribution: CallDistribution[] = [
  { hour: 8, calls: 12, abandonRate: 5 },
  { hour: 9, calls: 25, abandonRate: 8 },
  { hour: 10, calls: 38, abandonRate: 12 },
  { hour: 11, calls: 35, abandonRate: 10 },
  { hour: 12, calls: 22, abandonRate: 15 },
  { hour: 13, calls: 18, abandonRate: 11 },
  { hour: 14, calls: 28, abandonRate: 9 },
  { hour: 15, calls: 32, abandonRate: 7 },
  { hour: 16, calls: 27, abandonRate: 8 },
  { hour: 17, calls: 19, abandonRate: 10 },
];

const mockQueueMetrics: QueueMetric[] = [
  { queueId: 1, queueName: "Atendimento Geral", totalCalls: 245, answeredCalls: 212, abandonedCalls: 33, avgWaitTime: 35, avgHandleTime: 195, slaPercentage: 87 },
  { queueId: 2, queueName: "Suporte Técnico", totalCalls: 189, answeredCalls: 172, abandonedCalls: 17, avgWaitTime: 42, avgHandleTime: 230, slaPercentage: 82 },
  { queueId: 3, queueName: "Agendamentos", totalCalls: 210, answeredCalls: 195, abandonedCalls: 15, avgWaitTime: 28, avgHandleTime: 165, slaPercentage: 92 },
];

const mockAgentPauses: AgentPauseMetric[] = [
  { pauseReason: "Intervalo", totalTime: 120, percentage: 35, color: "#0088FE" },
  { pauseReason: "Almoço", totalTime: 90, percentage: 26, color: "#00C49F" },
  { pauseReason: "Treinamento", totalTime: 60, percentage: 17, color: "#FFBB28" },
  { pauseReason: "Reunião", totalTime: 45, percentage: 13, color: "#FF8042" },
  { pauseReason: "Outros", totalTime: 30, percentage: 9, color: "#8884D8" },
];

export default function QueueDashboardPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [selectedQueue, setSelectedQueue] = useState("all");

  // Consulta para métricas diárias
  const { data: dailyMetrics, isLoading: isLoadingDailyMetrics } = useQuery({
    queryKey: ["/api/queue-metrics/daily", selectedPeriod],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockDailyMetrics;
    },
  });

  // Consulta para desempenho dos agentes
  const { data: agentPerformance, isLoading: isLoadingAgentPerformance } = useQuery({
    queryKey: ["/api/queue-metrics/agents", selectedPeriod, selectedQueue],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      await new Promise(resolve => setTimeout(resolve, 600));
      return mockAgentPerformance;
    },
  });

  // Consulta para distribuição de chamadas
  const { data: callDistribution, isLoading: isLoadingCallDistribution } = useQuery({
    queryKey: ["/api/queue-metrics/distribution", selectedPeriod, selectedQueue],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      await new Promise(resolve => setTimeout(resolve, 700));
      return mockCallDistribution;
    },
  });

  // Consulta para métricas por fila
  const { data: queueMetrics, isLoading: isLoadingQueueMetrics } = useQuery({
    queryKey: ["/api/queue-metrics/queues", selectedPeriod],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      await new Promise(resolve => setTimeout(resolve, 750));
      return mockQueueMetrics;
    },
  });

  // Consulta para pausas de agentes
  const { data: agentPauses, isLoading: isLoadingAgentPauses } = useQuery({
    queryKey: ["/api/queue-metrics/pauses", selectedPeriod],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      await new Promise(resolve => setTimeout(resolve, 550));
      return mockAgentPauses;
    },
  });

  // Função para exportar dados
  const handleExportData = () => {
    toast({
      title: "Exportação iniciada",
      description: "Os dados estão sendo preparados para exportação.",
    });
    
    // Aqui seria feita a exportação real dos dados
    setTimeout(() => {
      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados com sucesso.",
      });
    }, 2000);
  };

  // Função para formatação de segundos
  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para formatação de minutos
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Dashboard de Filas</h2>
        <p className="text-sm text-neutral-500">Análise de métricas e desempenho do call center</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedQueue} onValueChange={setSelectedQueue}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filas</SelectItem>
              <SelectItem value="1">Atendimento Geral</SelectItem>
              <SelectItem value="2">Suporte Técnico</SelectItem>
              <SelectItem value="3">Agendamentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={handleExportData}>
          <Download className="h-4 w-4 mr-2" />
          Exportar dados
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full mb-6">
          <TabsTrigger value="overview">
            <BarChart className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="h-4 w-4 mr-2" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="queues">
            <PhoneCall className="h-4 w-4 mr-2" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <Clock className="h-4 w-4 mr-2" />
            Distribuição
          </TabsTrigger>
        </TabsList>

        {/* Aba de Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Total de Chamadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queueMetrics?.reduce((acc, queue) => acc + queue.totalCalls, 0) || 0}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  <span className="text-green-600">+12%</span> vs. período anterior
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">SLA Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queueMetrics 
                    ? Math.round(queueMetrics.reduce((acc, queue) => acc + queue.slaPercentage, 0) / queueMetrics.length)
                    : 0}%
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  <span className="text-green-600">+3%</span> vs. período anterior
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Taxa de Abandono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queueMetrics
                    ? Math.round((queueMetrics.reduce((acc, queue) => acc + queue.abandonedCalls, 0) / 
                        queueMetrics.reduce((acc, queue) => acc + queue.totalCalls, 0)) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1 rotate-180" />
                  <span className="text-red-600">+2%</span> vs. período anterior
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">Tempo Médio de Atendimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queueMetrics
                    ? formatSeconds(Math.round(queueMetrics.reduce((acc, queue) => acc + queue.avgHandleTime, 0) / queueMetrics.length))
                    : "0:00"}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  <span className="text-yellow-600">-5s</span> vs. período anterior
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Métricas Diárias */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Métricas Diárias</CardTitle>
              <CardDescription>
                Chamadas atendidas, abandonadas e SLA por dia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart
                    data={dailyMetrics || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="answered" name="Atendidas" stroke="#0369a1" activeDot={{ r: 8 }} />
                    <Line yAxisId="left" type="monotone" dataKey="abandoned" name="Abandonadas" stroke="#f43f5e" />
                    <Line yAxisId="right" type="monotone" dataKey="sla" name="SLA (%)" stroke="#10b981" />
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Visão geral das filas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribuição de chamadas por fila */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Fila</CardTitle>
                <CardDescription>
                  Volume de chamadas por fila
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={queueMetrics?.map(queue => ({
                          name: queue.queueName,
                          value: queue.totalCalls
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {queueMetrics?.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Distribuição de pausas de agentes */}
            <Card>
              <CardHeader>
                <CardTitle>Razões de Pausa</CardTitle>
                <CardDescription>
                  Distribuição do tempo de pausa por motivo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={agentPauses}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="totalTime"
                        nameKey="pauseReason"
                      >
                        {agentPauses?.map((entry) => (
                          <Cell key={`cell-${entry.pauseReason}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba de Agentes */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho dos Agentes</CardTitle>
              <CardDescription>
                Métricas individuais de produtividade e qualidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Agente</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Atendidas</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Tempo Médio</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Pós-chamada</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Satisfação</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Tempo Logado</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Disponibilidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance?.map((agent) => (
                      <tr key={agent.agentId} className="border-b hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm font-medium">{agent.agentName}</td>
                        <td className="py-3 px-4 text-sm">{agent.callsAnswered}</td>
                        <td className="py-3 px-4 text-sm">{formatSeconds(agent.avgHandleTime)}</td>
                        <td className="py-3 px-4 text-sm">{formatSeconds(agent.avgAfterCallWork)}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center">
                            <span className={`mr-2 ${
                              agent.customerSatisfaction >= 4.5 ? "text-green-500" :
                              agent.customerSatisfaction >= 4.0 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {agent.customerSatisfaction.toFixed(1)}
                            </span>
                            <div className="bg-neutral-200 h-1.5 w-16 rounded-full">
                              <div
                                className={`h-1.5 rounded-full ${
                                  agent.customerSatisfaction >= 4.5 ? "bg-green-500" :
                                  agent.customerSatisfaction >= 4.0 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${(agent.customerSatisfaction / 5) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{formatMinutes(agent.loginTime)}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center">
                            <span className={`mr-2 ${
                              agent.readiness >= 85 ? "text-green-500" :
                              agent.readiness >= 75 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {agent.readiness}%
                            </span>
                            <div className="bg-neutral-200 h-1.5 w-16 rounded-full">
                              <div
                                className={`h-1.5 rounded-full ${
                                  agent.readiness >= 85 ? "bg-green-500" :
                                  agent.readiness >= 75 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${agent.readiness}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico de Chamadas Atendidas por Agente */}
            <Card>
              <CardHeader>
                <CardTitle>Chamadas Atendidas</CardTitle>
                <CardDescription>
                  Volume de chamadas por agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={agentPerformance?.map(agent => ({
                        name: agent.agentName,
                        calls: agent.callsAnswered
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="calls" name="Chamadas Atendidas" fill="#0088FE" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Tempo Médio de Atendimento */}
            <Card>
              <CardHeader>
                <CardTitle>Tempo Médio de Atendimento</CardTitle>
                <CardDescription>
                  Duração média das chamadas por agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={agentPerformance?.map(agent => ({
                        name: agent.agentName,
                        time: agent.avgHandleTime
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatSeconds(Number(value))} />
                      <Bar dataKey="time" name="Tempo Médio" fill="#00C49F" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba de Filas */}
        <TabsContent value="queues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho das Filas</CardTitle>
              <CardDescription>
                Métricas detalhadas por fila de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Fila</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Total</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Atendidas</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Abandonadas</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">% Abandono</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Tempo Espera</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Tempo Atendimento</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueMetrics?.map((queue) => (
                      <tr key={queue.queueId} className="border-b hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm font-medium">{queue.queueName}</td>
                        <td className="py-3 px-4 text-sm">{queue.totalCalls}</td>
                        <td className="py-3 px-4 text-sm">{queue.answeredCalls}</td>
                        <td className="py-3 px-4 text-sm">{queue.abandonedCalls}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={
                            queue.abandonedCalls / queue.totalCalls <= 0.05 ? "text-green-500" :
                            queue.abandonedCalls / queue.totalCalls <= 0.1 ? "text-yellow-500" :
                            "text-red-500"
                          }>
                            {((queue.abandonedCalls / queue.totalCalls) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{formatSeconds(queue.avgWaitTime)}</td>
                        <td className="py-3 px-4 text-sm">{formatSeconds(queue.avgHandleTime)}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={
                            queue.slaPercentage >= 90 ? "text-green-500" :
                            queue.slaPercentage >= 80 ? "text-yellow-500" :
                            "text-red-500"
                          }>
                            {queue.slaPercentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico de SLA */}
            <Card>
              <CardHeader>
                <CardTitle>Nível de Serviço (SLA)</CardTitle>
                <CardDescription>
                  Comparação de SLA entre filas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={queueMetrics?.map(queue => ({
                        name: queue.queueName,
                        sla: queue.slaPercentage,
                        target: 85
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sla" name="SLA Atual" fill="#0088FE" />
                      <Bar dataKey="target" name="Meta SLA" fill="#FFBB28" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Abandono */}
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Abandono</CardTitle>
                <CardDescription>
                  Percentual de chamadas abandonadas por fila
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={queueMetrics?.map(queue => ({
                        name: queue.queueName,
                        rate: ((queue.abandonedCalls / queue.totalCalls) * 100).toFixed(1),
                        target: 5
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="rate" name="Taxa Atual (%)" fill="#FF8042" />
                      <Bar dataKey="target" name="Meta (%)" fill="#FFBB28" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba de Distribuição */}
        <TabsContent value="distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Chamadas por Hora</CardTitle>
              <CardDescription>
                Volume de chamadas e taxa de abandono por horário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart
                    data={callDistribution}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" label={{ value: 'Hora do Dia', position: 'insideBottom', offset: -5 }} />
                    <YAxis yAxisId="left" label={{ value: 'Chamadas', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Taxa Abandono (%)', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="calls" name="Volume de Chamadas" fill="#8884d8" />
                    <Line yAxisId="right" type="monotone" dataKey="abandonRate" name="Taxa de Abandono (%)" stroke="#ff7300" />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Histórico de SLA */}
            <Card>
              <CardHeader>
                <CardTitle>Evolução do SLA</CardTitle>
                <CardDescription>
                  Histórico de SLA durante o período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dailyMetrics}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Area type="monotone" dataKey="sla" name="SLA (%)" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Histórico de tempos médios */}
            <Card>
              <CardHeader>
                <CardTitle>Tempos Médios</CardTitle>
                <CardDescription>
                  Evolução do tempo de espera e atendimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReLineChart
                      data={dailyMetrics}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatSeconds(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="avgWaitTime" name="Tempo de Espera" stroke="#8884d8" />
                      <Line type="monotone" dataKey="avgHandleTime" name="Tempo de Atendimento" stroke="#82ca9d" />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}