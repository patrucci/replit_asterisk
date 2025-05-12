import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  Users,
  Plus,
  Edit,
  Trash,
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  Clock,
  MoveHorizontal,
  Music,
  Volume,
  Timer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

// Tipos simulados (em uma implementação real, importaríamos de @shared/queue-schema)
type Queue = {
  id: number;
  name: string;
  description: string;
  strategy: string;
  timeout: number;
  maxWaitTime: number;
  musicOnHold: string;
  announcement: string;
  wrapUpTime: number;
};

type Agent = {
  id: number;
  name: string;
  extension: string;
  status: "available" | "unavailable" | "busy" | "paused" | "offline";
  groupId: number;
  groupName: string;
  skills: string[];
};

type QueueStats = {
  queueId: number;
  queueName: string;
  agentsActive: number;
  callsInQueue: number;
  answeredCalls: number;
  abandonedCalls: number;
  avgWaitTime: number;
  avgHandleTime: number;
  slaPercentage: number;
};

// Dados simulados
const mockQueues: Queue[] = [
  {
    id: 1,
    name: "Atendimento Geral",
    description: "Fila principal para atendimento de clientes",
    strategy: "ringall",
    timeout: 60,
    maxWaitTime: 300,
    musicOnHold: "default",
    announcement: "Bem-vindo ao atendimento. Aguarde, você será atendido em breve.",
    wrapUpTime: 30,
  },
  {
    id: 2,
    name: "Suporte Técnico",
    description: "Fila para atendimento de questões técnicas",
    strategy: "leastrecent",
    timeout: 45,
    maxWaitTime: 240,
    musicOnHold: "jazz",
    announcement: "Você está na fila de suporte técnico. Sua chamada é muito importante para nós.",
    wrapUpTime: 20,
  },
  {
    id: 3, 
    name: "Agendamentos",
    description: "Fila exclusiva para agendamento de consultas",
    strategy: "fewestcalls",
    timeout: 30,
    maxWaitTime: 180,
    musicOnHold: "classical",
    announcement: "Você ligou para o setor de agendamentos. Por favor, aguarde.",
    wrapUpTime: 15,
  },
];

const mockAgents: Agent[] = [
  {
    id: 1,
    name: "Carlos Oliveira",
    extension: "1001",
    status: "available",
    groupId: 1,
    groupName: "Atendimento",
    skills: ["geral", "vendas"],
  },
  {
    id: 2,
    name: "Ana Silva",
    extension: "1002",
    status: "busy",
    groupId: 2,
    groupName: "Suporte",
    skills: ["técnico", "software"],
  },
  {
    id: 3,
    name: "Roberto Santos",
    extension: "1003",
    status: "offline",
    groupId: 1,
    groupName: "Atendimento",
    skills: ["geral", "financeiro"],
  },
  {
    id: 4,
    name: "Maria Costa",
    extension: "1004",
    status: "paused",
    groupId: 2,
    groupName: "Suporte",
    skills: ["hardware", "redes"],
  }
];

const mockQueueStats: QueueStats[] = [
  {
    queueId: 1,
    queueName: "Atendimento Geral",
    agentsActive: 2,
    callsInQueue: 3,
    answeredCalls: 45,
    abandonedCalls: 7,
    avgWaitTime: 62,
    avgHandleTime: 187,
    slaPercentage: 84,
  },
  {
    queueId: 2,
    queueName: "Suporte Técnico",
    agentsActive: 1,
    callsInQueue: 2,
    answeredCalls: 28,
    abandonedCalls: 5,
    avgWaitTime: 45,
    avgHandleTime: 324,
    slaPercentage: 78,
  },
  {
    queueId: 3,
    queueName: "Agendamentos",
    agentsActive: 0,
    callsInQueue: 1,
    answeredCalls: 33,
    abandonedCalls: 2,
    avgWaitTime: 38,
    avgHandleTime: 142,
    slaPercentage: 92,
  },
];

export default function QueuesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Estado para formulários
  const [queueForm, setQueueForm] = useState<Partial<Queue>>({
    name: "",
    description: "",
    strategy: "ringall",
    timeout: 60,
    maxWaitTime: 300,
    musicOnHold: "default",
    announcement: "",
    wrapUpTime: 30,
  });
  
  const [agentForm, setAgentForm] = useState<Partial<Agent>>({
    name: "",
    extension: "",
    status: "offline",
    groupId: 1,
    skills: [],
  });

  // Consulta para obter filas
  const { data: queues, isLoading: isLoadingQueues } = useQuery({
    queryKey: ["/api/queues"],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      return mockQueues;
    }
  });

  // Consulta para obter agentes
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      return mockAgents;
    }
  });

  // Consulta para estatísticas
  const { data: queueStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/queue-stats"],
    queryFn: async () => {
      // Em uma implementação real, buscaríamos do backend
      return mockQueueStats;
    }
  });

  // Mutação para criar/atualizar fila
  const queueMutation = useMutation({
    mutationFn: async (queue: Partial<Queue>) => {
      // Simulação de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (editingQueue) {
        // Atualização
        return { ...editingQueue, ...queue };
      } else {
        // Criação
        return { ...queue, id: Date.now() };
      }
    },
    onSuccess: () => {
      toast({
        title: editingQueue ? "Fila atualizada" : "Fila criada",
        description: `A fila foi ${editingQueue ? "atualizada" : "criada"} com sucesso.`,
      });
      
      setShowQueueDialog(false);
      setEditingQueue(null);
      setQueueForm({
        name: "",
        description: "",
        strategy: "ringall",
        timeout: 60,
        maxWaitTime: 300,
        musicOnHold: "default",
        announcement: "",
        wrapUpTime: 30,
      });
      
      // Atualizar a lista de filas
      queryClient.invalidateQueries({ queryKey: ["/api/queues"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: `Não foi possível ${editingQueue ? "atualizar" : "criar"} a fila.`,
        variant: "destructive",
      });
    }
  });

  // Mutação para criar/atualizar agente
  const agentMutation = useMutation({
    mutationFn: async (agent: Partial<Agent>) => {
      // Simulação de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (editingAgent) {
        // Atualização
        return { ...editingAgent, ...agent };
      } else {
        // Criação
        return { ...agent, id: Date.now() };
      }
    },
    onSuccess: () => {
      toast({
        title: editingAgent ? "Agente atualizado" : "Agente criado",
        description: `O agente foi ${editingAgent ? "atualizado" : "criado"} com sucesso.`,
      });
      
      setShowAgentDialog(false);
      setEditingAgent(null);
      setAgentForm({
        name: "",
        extension: "",
        status: "offline",
        groupId: 1,
        skills: [],
      });
      
      // Atualizar a lista de agentes
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: `Não foi possível ${editingAgent ? "atualizar" : "criar"} o agente.`,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar status do agente
  const updateAgentStatusMutation = useMutation({
    mutationFn: async ({ agentId, status }: { agentId: number, status: string }) => {
      // Simulação de API
      await new Promise(resolve => setTimeout(resolve, 500));
      return { id: agentId, status };
    },
    onSuccess: (data) => {
      toast({
        title: "Status atualizado",
        description: `O status do agente foi alterado para ${translateStatus(data.status)}.`,
      });
      
      // Atualizar a lista de agentes
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do agente.",
        variant: "destructive",
      });
    }
  });

  // Função para remover uma fila
  const handleDeleteQueue = async (queueId: number) => {
    try {
      // Simulação de API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: "Fila removida",
        description: "A fila foi removida com sucesso.",
      });
      
      // Atualizar a lista de filas
      queryClient.invalidateQueries({ queryKey: ["/api/queues"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a fila.",
        variant: "destructive",
      });
    }
  };

  // Função para remover um agente
  const handleDeleteAgent = async (agentId: number) => {
    try {
      // Simulação de API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: "Agente removido",
        description: "O agente foi removido com sucesso.",
      });
      
      // Atualizar a lista de agentes
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o agente.",
        variant: "destructive",
      });
    }
  };

  // Função para traduzir o status do agente
  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      available: "Disponível",
      unavailable: "Indisponível",
      busy: "Em Atendimento",
      paused: "Em Pausa",
      offline: "Offline",
    };
    
    return statusMap[status] || status;
  };

  // Função para obter a cor do badge de status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-yellow-500";
      case "paused":
        return "bg-blue-500";
      case "unavailable":
        return "bg-red-500";
      case "offline":
        return "bg-neutral-500";
      default:
        return "bg-neutral-500";
    }
  };

  // Função para traduzir a estratégia da fila
  const translateStrategy = (strategy: string) => {
    const strategyMap: Record<string, string> = {
      ringall: "Toca para Todos",
      leastrecent: "Menos Recente",
      fewestcalls: "Menos Chamadas",
      random: "Aleatório",
      rrmemory: "Round Robin",
      linear: "Linear",
    };
    
    return strategyMap[strategy] || strategy;
  };

  // Função para formatar segundos em minutos:segundos
  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para formatar performance SLA
  const formatSLA = (percentage: number) => {
    let color = "text-red-500";
    if (percentage >= 90) {
      color = "text-green-500";
    } else if (percentage >= 80) {
      color = "text-yellow-500";
    } else if (percentage >= 70) {
      color = "text-orange-500";
    }
    
    return <span className={`font-medium ${color}`}>{percentage}%</span>;
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Filas de Atendimento</h2>
        <p className="text-sm text-neutral-500">Gerencie suas filas, agentes e monitore o desempenho em tempo real</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full mb-6">
          <TabsTrigger value="overview">
            <PhoneCall className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="queues">
            <PhoneCall className="h-4 w-4 mr-2" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="h-4 w-4 mr-2" />
            Agentes
          </TabsTrigger>
        </TabsList>

        {/* Aba de Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Estatísticas gerais */}
            {queueStats?.map((stat) => (
              <Card key={stat.queueId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{stat.queueName}</CardTitle>
                    <Badge variant={stat.agentsActive > 0 ? "default" : "destructive"}>
                      {stat.agentsActive} agente{stat.agentsActive !== 1 ? 's' : ''} online
                    </Badge>
                  </div>
                  <CardDescription>
                    {stat.callsInQueue} chamada{stat.callsInQueue !== 1 ? 's' : ''} na fila
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500">Chamadas Atendidas</p>
                        <p className="text-xl font-medium">{stat.answeredCalls}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500">Abandonadas</p>
                        <p className="text-xl font-medium">{stat.abandonedCalls}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500">Tempo Médio de Espera</p>
                        <p className="text-xl font-medium">{formatSeconds(stat.avgWaitTime)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500">Tempo Médio de Atendimento</p>
                        <p className="text-xl font-medium">{formatSeconds(stat.avgHandleTime)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-neutral-50 p-4">
                  <div className="w-full">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">SLA</p>
                      {formatSLA(stat.slaPercentage)}
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full ${
                          stat.slaPercentage >= 90 ? 'bg-green-500' : 
                          stat.slaPercentage >= 80 ? 'bg-yellow-500' : 
                          stat.slaPercentage >= 70 ? 'bg-orange-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${stat.slaPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          {/* Status dos agentes */}
          <Card>
            <CardHeader>
              <CardTitle>Status dos Agentes</CardTitle>
              <CardDescription>
                Monitoramento em tempo real dos agentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Ramal</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Habilidades</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents?.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.extension}</TableCell>
                        <TableCell>{agent.groupName}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(agent.status)}`}></span>
                            {translateStatus(agent.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {agent.skills.map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Ações</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              {agent.status !== "available" && (
                                <DropdownMenuItem
                                  onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: "available" })}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Disponível
                                </DropdownMenuItem>
                              )}
                              
                              {agent.status !== "paused" && (
                                <DropdownMenuItem
                                  onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: "paused" })}
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar
                                </DropdownMenuItem>
                              )}
                              
                              {agent.status !== "offline" && (
                                <DropdownMenuItem
                                  onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: "offline" })}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Desconectar
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => {
                                  setAgentForm(agent);
                                  setEditingAgent(agent);
                                  setShowAgentDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {!isLoadingAgents && (!agents || agents.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                          Nenhum agente configurado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Filas */}
        <TabsContent value="queues" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Filas Configuradas</h3>
            <Button onClick={() => {
              setEditingQueue(null);
              setQueueForm({
                name: "",
                description: "",
                strategy: "ringall",
                timeout: 60,
                maxWaitTime: 300,
                musicOnHold: "default",
                announcement: "",
                wrapUpTime: 30,
              });
              setShowQueueDialog(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Fila
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Estratégia</TableHead>
                      <TableHead>Timeout</TableHead>
                      <TableHead>Música</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queues?.map((queue) => (
                      <TableRow key={queue.id}>
                        <TableCell className="font-medium">{queue.name}</TableCell>
                        <TableCell>{queue.description}</TableCell>
                        <TableCell>{translateStrategy(queue.strategy)}</TableCell>
                        <TableCell>{formatSeconds(queue.timeout)}</TableCell>
                        <TableCell>{queue.musicOnHold}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingQueue(queue);
                                setQueueForm(queue);
                                setShowQueueDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteQueue(queue.id)}
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {!isLoadingQueues && (!queues || queues.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                          Nenhuma fila configurada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Agentes */}
        <TabsContent value="agents" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Agentes Configurados</h3>
            <Button onClick={() => {
              setEditingAgent(null);
              setAgentForm({
                name: "",
                extension: "",
                status: "offline",
                groupId: 1,
                skills: [],
              });
              setShowAgentDialog(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agente
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Ramal</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Habilidades</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents?.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.extension}</TableCell>
                        <TableCell>{agent.groupName}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(agent.status)}`}></span>
                            {translateStatus(agent.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {agent.skills.map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingAgent(agent);
                                setAgentForm(agent);
                                setShowAgentDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAgent(agent.id)}
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {!isLoadingAgents && (!agents || agents.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                          Nenhum agente configurado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para criar/editar fila */}
      <Dialog open={showQueueDialog} onOpenChange={setShowQueueDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingQueue ? "Editar Fila" : "Nova Fila"}</DialogTitle>
            <DialogDescription>
              {editingQueue 
                ? "Altere as informações da fila conforme necessário" 
                : "Preencha as informações para criar uma nova fila"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="queue-name">Nome da Fila</Label>
              <Input
                id="queue-name"
                value={queueForm.name || ""}
                onChange={(e) => setQueueForm({ ...queueForm, name: e.target.value })}
                placeholder="Ex: Suporte Técnico"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="queue-description">Descrição</Label>
              <Textarea
                id="queue-description"
                value={queueForm.description || ""}
                onChange={(e) => setQueueForm({ ...queueForm, description: e.target.value })}
                placeholder="Ex: Fila para atendimento de suporte técnico"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="queue-strategy">Estratégia</Label>
                <Select
                  value={queueForm.strategy}
                  onValueChange={(value) => setQueueForm({ ...queueForm, strategy: value })}
                >
                  <SelectTrigger id="queue-strategy">
                    <SelectValue placeholder="Selecione uma estratégia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ringall">Toca para Todos</SelectItem>
                    <SelectItem value="leastrecent">Menos Recente</SelectItem>
                    <SelectItem value="fewestcalls">Menos Chamadas</SelectItem>
                    <SelectItem value="random">Aleatório</SelectItem>
                    <SelectItem value="rrmemory">Round Robin</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="queue-timeout">Timeout (segundos)</Label>
                <Input
                  id="queue-timeout"
                  type="number"
                  value={queueForm.timeout || 60}
                  onChange={(e) => setQueueForm({ ...queueForm, timeout: parseInt(e.target.value) })}
                  min={5}
                  max={300}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="queue-maxWaitTime">Tempo Máx. Espera (segundos)</Label>
                <Input
                  id="queue-maxWaitTime"
                  type="number"
                  value={queueForm.maxWaitTime || 300}
                  onChange={(e) => setQueueForm({ ...queueForm, maxWaitTime: parseInt(e.target.value) })}
                  min={60}
                  max={1800}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="queue-wrapUpTime">Tempo de Wrap-Up (segundos)</Label>
                <Input
                  id="queue-wrapUpTime"
                  type="number"
                  value={queueForm.wrapUpTime || 30}
                  onChange={(e) => setQueueForm({ ...queueForm, wrapUpTime: parseInt(e.target.value) })}
                  min={0}
                  max={300}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="queue-music">Música de Espera</Label>
              <Select
                value={queueForm.musicOnHold}
                onValueChange={(value) => setQueueForm({ ...queueForm, musicOnHold: value })}
              >
                <SelectTrigger id="queue-music">
                  <SelectValue placeholder="Selecione uma música" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="classical">Clássica</SelectItem>
                  <SelectItem value="jazz">Jazz</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="custom">Personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="queue-announcement">Anúncio</Label>
              <Textarea
                id="queue-announcement"
                value={queueForm.announcement || ""}
                onChange={(e) => setQueueForm({ ...queueForm, announcement: e.target.value })}
                placeholder="Ex: Bem-vindo ao atendimento. Aguarde um momento."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQueueDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => queueMutation.mutate(queueForm)}
              disabled={!queueForm.name || queueMutation.isPending}
            >
              {queueMutation.isPending ? "Salvando..." : (editingQueue ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para criar/editar agente */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Editar Agente" : "Novo Agente"}</DialogTitle>
            <DialogDescription>
              {editingAgent 
                ? "Altere as informações do agente conforme necessário" 
                : "Preencha as informações para criar um novo agente"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="agent-name">Nome do Agente</Label>
              <Input
                id="agent-name"
                value={agentForm.name || ""}
                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="agent-extension">Ramal</Label>
              <Input
                id="agent-extension"
                value={agentForm.extension || ""}
                onChange={(e) => setAgentForm({ ...agentForm, extension: e.target.value })}
                placeholder="Ex: 1001"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="agent-group">Grupo</Label>
                <Select
                  value={agentForm.groupId?.toString()}
                  onValueChange={(value) => setAgentForm({ ...agentForm, groupId: parseInt(value) })}
                >
                  <SelectTrigger id="agent-group">
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Atendimento</SelectItem>
                    <SelectItem value="2">Suporte</SelectItem>
                    <SelectItem value="3">Vendas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="agent-status">Status Inicial</Label>
                <Select
                  value={agentForm.status}
                  onValueChange={(value: any) => setAgentForm({ ...agentForm, status: value })}
                >
                  <SelectTrigger id="agent-status">
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="unavailable">Indisponível</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="agent-skills">Habilidades (separadas por vírgula)</Label>
              <Input
                id="agent-skills"
                value={Array.isArray(agentForm.skills) ? agentForm.skills.join(", ") : ""}
                onChange={(e) => setAgentForm({ 
                  ...agentForm, 
                  skills: e.target.value.split(",").map(skill => skill.trim()).filter(Boolean) 
                })}
                placeholder="Ex: atendimento, suporte, vendas"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => agentMutation.mutate(agentForm)}
              disabled={!agentForm.name || !agentForm.extension || agentMutation.isPending}
            >
              {agentMutation.isPending ? "Salvando..." : (editingAgent ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}