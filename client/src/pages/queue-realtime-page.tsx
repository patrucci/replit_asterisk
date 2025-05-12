import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  PhoneOutgoing, 
  PhoneIncoming, 
  Phone, 
  PauseCircle, 
  PlayCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Users, 
  List, 
  BarChart2, 
  Settings,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  History,
  Check,
  X,
  Bell,
  BellOff
} from 'lucide-react';

// Definições de tipos
interface Agent {
  agentId: string;
  name: string;
  status: string;
  lastCall: string;
  callsTaken: number;
  callsAbandoned: number;
  avgTalkTime: number;
  totalTalkTime: number;
  pauseTime: number;
  loginTime: string;
  queues: string[];
}

interface Queue {
  queueId: string;
  name: string;
  strategy: string;
  calls: number;
  completed: number;
  abandoned: number;
  serviceLevel: number;
  avgWaitTime: number;
  avgTalkTime: number;
  maxWaitTime: number;
  agents: number;
  activeAgents: number;
}

interface Call {
  event: string;
  callerId?: string;
  callerIdName?: string;
  channel?: string;
  destChannel?: string;
  queue?: string;
  position?: number;
  uniqueId?: string;
  waitTime?: number;
  duration?: number;
  agentId?: string;
  timestamp: number;
  memberName?: string;
}

interface QueueMonitorState {
  agents: Agent[];
  queues: Queue[];
  activeCalls: Call[];
  callsInQueue: Call[];
  connected: boolean;
  selectedQueue: string;
  selectedAgent: string;
}

// Componente principal de monitoramento em tempo real
export default function QueueRealtimePage() {
  const { toast } = useToast();
  const [state, setState] = useState<QueueMonitorState>({
    agents: [],
    queues: [],
    activeCalls: [],
    callsInQueue: [],
    connected: false,
    selectedQueue: 'all',
    selectedAgent: 'all',
  });
  const [activeTab, setActiveTab] = useState('queues');
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<Agent | null>(null);
  const [showAgentPauseDialog, setShowAgentPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState('lunch');
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<{time: number, status: string}[]>([]);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Simulação de eventos aleatórios na interface
  const simulateRandomEvent = (queues: any[], agents: any[], callsInQueue: any[], activeCalls: any[]) => {
    const eventTypes = ["new-call", "call-completed", "agent-status-change", "call-abandoned"];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    switch (eventType) {
      case "new-call":
        console.log("Simulando nova chamada chegando!");
        // Simular notificação de nova chamada
        if (Math.random() > 0.5) {
          playNotificationSound('queue-join');
          
          toast({
            title: 'Nova chamada na fila',
            description: `Cliente ${Math.floor(Math.random() * 100)} entrou na fila`,
          });
        }
        break;
        
      case "call-completed":
        console.log("Simulando chamada completada!");
        if (activeCalls.length > 0 && Math.random() > 0.5) {
          toast({
            title: 'Chamada completada',
            description: `Agente completou chamada com Cliente ${Math.floor(Math.random() * 100)}`,
          });
        }
        break;
        
      case "agent-status-change":
        console.log("Simulando mudança de status de agente!");
        if (agents.length > 0 && Math.random() > 0.7) {
          const statuses = ["available", "busy", "paused"];
          const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
          const agent = agents[Math.floor(Math.random() * agents.length)];
          
          toast({
            title: 'Status de agente alterado',
            description: `${agent.name} agora está ${newStatus}`,
          });
        }
        break;
        
      case "call-abandoned":
        console.log("Simulando chamada abandonada!");
        if (callsInQueue.length > 0 && Math.random() > 0.7) {
          playNotificationSound('call-abandoned');
          
          toast({
            title: 'Chamada abandonada',
            description: `Cliente abandonou a fila após ${Math.floor(Math.random() * 5) + 1} minutos`,
            variant: 'destructive',
          });
        }
        break;
    }
  };

  // Função para buscar todos os dados via HTTP
  const fetchAllData = async () => {
    try {
      console.log('Buscando dados atualizados via HTTP...');
      
      // Buscar dados das filas
      const queuesResponse = await fetch('/api/asterisk/queues');
      const queues = await queuesResponse.json();
      
      // Buscar dados dos agentes
      const agentsResponse = await fetch('/api/asterisk/agents');
      const agents = await agentsResponse.json();
      
      // Buscar dados das chamadas em fila
      const queueCallsResponse = await fetch('/api/asterisk/queue-calls');
      const callsInQueue = await queueCallsResponse.json();
      
      // Buscar dados das chamadas ativas
      const activeCallsResponse = await fetch('/api/asterisk/active-calls');
      const activeCalls = await activeCallsResponse.json();
      
      console.log('Dados recebidos:', { 
        queues: queues.length, 
        agents: agents.length, 
        callsInQueue: callsInQueue.length, 
        activeCalls: activeCalls.length 
      });
      
      // Verificar aleatoriamente se devemos simular um novo evento
      if (Math.random() > 0.7) {
        simulateRandomEvent(queues, agents, callsInQueue, activeCalls);
      }
      
      // Atualizar o estado com os dados recebidos
      updateStats({
        queues,
        agents,
        callsInQueue,
        activeCalls
      });
      
      // Atualizar status de conexão (sempre verdadeiro para o polling)
      if (!state.connected) {
        setState(prev => ({ ...prev, connected: true }));
      }
      
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      
      // Se houver erro, marcar como desconectado
      setState(prev => ({ ...prev, connected: false }));
      
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível obter dados de monitoramento',
        variant: 'destructive',
      });
    }
  };
  
  // Atualizar estatísticas
  const updateStats = (data: any) => {
    console.log('Atualizando estatísticas com dados:', data);
    setState(prev => ({
      ...prev,
      agents: data.agents || [],
      queues: data.queues || [],
      activeCalls: data.activeCalls || [],
      callsInQueue: data.callsInQueue || []
    }));
  };

  // Iniciar polling HTTP
  useEffect(() => {
    console.log('Iniciando modo de polling HTTP para monitoramento em tempo real');
    
    // Configurar polling inicial
    fetchAllData();
    
    // Configurar intervalo de polling
    const pollingInterval = setInterval(() => {
      fetchAllData();
    }, refreshInterval);
    
    // Simular estado de conexão para UI
    setState(prev => ({ ...prev, connected: true }));
    
    // Registrar na história de conexões
    const historyEntry = { time: Date.now(), status: 'connected' };
    setConnectionHistory(prev => [...prev, historyEntry].slice(-10));
    
    // Mensagem de sucesso
    toast({
      title: 'Conectado',
      description: 'Monitoramento em tempo real iniciado com sucesso',
    });
    
    return () => {
      clearInterval(pollingInterval);
      
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);
  
  // Configurar intervalo de atualização automática
  useEffect(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => {
        fetchAllData();
      }, refreshInterval);
    }
    
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [autoRefresh, refreshInterval]);
  
  // Manipular eventos em tempo real
  const handleEvent = (data: any) => {
    // Atualizar lista de chamadas ativas ou em fila com base no tipo de evento
    const eventType = data.eventType;
    const call = data.call;
    
    if (eventType === 'QueueCallerJoin') {
      setState(prev => ({
        ...prev,
        callsInQueue: [...prev.callsInQueue, call]
      }));
      
      playNotificationSound('queue-join');
      
      toast({
        title: 'Nova chamada na fila',
        description: `${call.callerIdName || call.callerId || 'Unknown'} entrou na fila ${call.queue}`,
      });
    } else if (eventType === 'QueueCallerLeave' || eventType === 'QueueCallerAbandon') {
      setState(prev => ({
        ...prev,
        callsInQueue: prev.callsInQueue.filter(c => c.uniqueId !== call.uniqueId)
      }));
      
      if (eventType === 'QueueCallerAbandon') {
        playNotificationSound('call-abandoned');
        
        toast({
          title: 'Chamada abandonada',
          description: `${call.callerIdName || call.callerId || 'Unknown'} abandonou a fila ${call.queue}`,
          variant: 'destructive',
        });
      }
    } else if (eventType === 'AgentConnect') {
      setState(prev => ({
        ...prev,
        callsInQueue: prev.callsInQueue.filter(c => c.uniqueId !== call.uniqueId),
        activeCalls: [...prev.activeCalls, call]
      }));
      
      playNotificationSound('agent-connect');
      
      toast({
        title: 'Chamada atendida',
        description: `${call.memberName || 'Agente'} atendeu chamada de ${call.callerIdName || call.callerId || 'Unknown'}`,
        variant: 'default',
      });
    } else if (eventType === 'AgentComplete') {
      setState(prev => ({
        ...prev,
        activeCalls: prev.activeCalls.filter(c => c.uniqueId !== call.uniqueId)
      }));
      
      toast({
        title: 'Chamada finalizada',
        description: `${call.memberName || 'Agente'} finalizou chamada com ${call.callerIdName || call.callerId || 'Unknown'} (${formatDuration(call.duration || 0)})`,
        variant: 'default',
      });
    } else if (eventType === 'AgentStatusChange') {
      const agent = data.agent;
      
      setState(prev => ({
        ...prev,
        agents: prev.agents.map(a => 
          a.agentId === agent.agentId ? { ...a, ...agent } : a
        )
      }));
      
      toast({
        title: 'Status de agente alterado',
        description: `${agent.name} agora está ${agent.status}`,
        variant: 'default',
      });
    }
  };
  
  // Pausar/despausar um agente
  const toggleAgentPause = async (agentId: string, pause: boolean, reason?: string) => {
    try {
      const endpoint = pause 
        ? '/api/asterisk/agent/pause' 
        : '/api/asterisk/agent/unpause';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          agentId,
          reason: reason || 'Pausa via ProConnect CRM'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao alterar status do agente');
      }
      
      // Atualizar dados imediatamente
      fetchAllData();
      
      toast({
        title: pause ? 'Agente pausado' : 'Agente retomado',
        description: pause 
          ? `Agente pausado com sucesso (${reason})` 
          : 'Agente retomado com sucesso',
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao alterar status do agente:', error);
      
      toast({
        title: 'Erro',
        description: `Não foi possível ${pause ? 'pausar' : 'retomar'} o agente`,
        variant: 'destructive',
      });
    }
  };
  
  // Ver detalhes do agente
  const viewAgentDetails = (agentId: string) => {
    const agent = state.agents.find(a => a.agentId === agentId);
    if (agent) {
      setSelectedAgentDetails(agent);
      setShowAgentDialog(true);
    }
  };
  
  // Reproduzir som de notificação
  const playNotificationSound = (type: 'queue-join' | 'call-abandoned' | 'agent-connect') => {
    // TODO: implementar reprodução de sons
  };
  
  // Filtrar dados com base nos seletores
  const filteredQueues = state.selectedQueue === 'all'
    ? state.queues
    : state.queues.filter(q => q.queueId === state.selectedQueue);
  
  const filteredAgents = state.selectedAgent === 'all'
    ? state.agents
    : state.agents.filter(a => a.agentId === state.selectedAgent);
  
  const filteredCallsInQueue = state.selectedQueue === 'all'
    ? state.callsInQueue
    : state.callsInQueue.filter(c => c.queue === state.selectedQueue);
  
  const filteredActiveCalls = state.selectedQueue === 'all'
    ? state.activeCalls
    : state.activeCalls.filter(c => c.queue === state.selectedQueue);
  
  // Formatar tempo
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };
  
  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      return `${min}m ${sec}s`;
    } else {
      const hrs = Math.floor(seconds / 3600);
      const min = Math.floor((seconds % 3600) / 60);
      return `${hrs}h ${min}m`;
    }
  };
  
  // Obter cor de status para agentes
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'paused':
        return 'bg-orange-500';
      case 'unavailable':
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'busy':
        return 'Em chamada';
      case 'paused':
        return 'Pausado';
      case 'unavailable':
        return 'Indisponível';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  };
  
  // Renderizar tabela de filas
  const renderQueuesTable = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Filas</span>
          <Badge variant={state.connected ? 'default' : 'destructive'} className="ml-2">
            {state.connected ? (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                <span>Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                <span>Desconectado</span>
              </>
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          Visão geral do status das filas em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Select
            value={state.selectedQueue}
            onValueChange={(value) => setState(prev => ({ ...prev, selectedQueue: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filas</SelectItem>
              {state.queues.map(queue => (
                <SelectItem key={queue.queueId} value={queue.queueId}>
                  {queue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchAllData()}
            className="flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            <span>Atualizar</span>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Estratégia</TableHead>
                <TableHead>Em fila</TableHead>
                <TableHead>Completadas</TableHead>
                <TableHead>Abandonadas</TableHead>
                <TableHead>Nível Serviço</TableHead>
                <TableHead>Tempo médio</TableHead>
                <TableHead>Agentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-gray-500">
                    Nenhuma fila encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredQueues.map(queue => (
                  <TableRow key={queue.queueId}>
                    <TableCell className="font-medium">{queue.name}</TableCell>
                    <TableCell>{queue.strategy}</TableCell>
                    <TableCell>{queue.calls}</TableCell>
                    <TableCell>{queue.completed}</TableCell>
                    <TableCell>{queue.abandoned}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={queue.serviceLevel} className="w-16" />
                        <span>{queue.serviceLevel}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatWaitTime(queue.avgWaitTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-green-600">{queue.activeAgents}</span>
                        <span className="text-gray-500">/ {queue.agents}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
  
  // Renderizar tabela de agentes
  const renderAgentsTable = () => (
    <Card>
      <CardHeader>
        <CardTitle>Agentes</CardTitle>
        <CardDescription>
          Status e estatísticas dos agentes em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Select
            value={state.selectedAgent}
            onValueChange={(value) => setState(prev => ({ ...prev, selectedAgent: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {state.agents.map(agent => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última chamada</TableHead>
                <TableHead>Chamadas</TableHead>
                <TableHead>Tempo médio</TableHead>
                <TableHead>Filas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    Nenhum agente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map(agent => (
                  <TableRow key={agent.agentId}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
                        <span>{getStatusText(agent.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(agent.lastCall).toLocaleTimeString()}</TableCell>
                    <TableCell>{agent.callsTaken}</TableCell>
                    <TableCell>{formatWaitTime(agent.avgTalkTime)}</TableCell>
                    <TableCell>{agent.queues.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => viewAgentDetails(agent.agentId)}
                          title="Ver detalhes"
                        >
                          <User className="w-4 h-4" />
                        </Button>
                        
                        {agent.status !== 'paused' ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAgentDetails(agent);
                              setShowAgentPauseDialog(true);
                            }}
                            title="Pausar agente"
                            disabled={agent.status === 'busy'}
                          >
                            <PauseCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleAgentPause(agent.agentId, false)}
                            title="Despausar agente"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
  
  // Renderizar tabela de chamadas em fila
  const renderCallsInQueueTable = () => (
    <Card>
      <CardHeader>
        <CardTitle>Chamadas em Fila</CardTitle>
        <CardDescription>
          Chamadas aguardando atendimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID do Chamador</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Fila</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Tempo de espera</TableHead>
                <TableHead>Entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCallsInQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                    Nenhuma chamada em fila no momento
                  </TableCell>
                </TableRow>
              ) : (
                filteredCallsInQueue.map(call => (
                  <TableRow key={call.uniqueId}>
                    <TableCell>{call.callerId}</TableCell>
                    <TableCell className="font-medium">{call.callerIdName || 'Desconhecido'}</TableCell>
                    <TableCell>{call.queue}</TableCell>
                    <TableCell>{call.position}</TableCell>
                    <TableCell>{formatWaitTime(call.waitTime || 0)}</TableCell>
                    <TableCell>{formatTime(call.timestamp)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
  
  // Renderizar tabela de chamadas ativas
  const renderActiveCallsTable = () => (
    <Card>
      <CardHeader>
        <CardTitle>Chamadas Ativas</CardTitle>
        <CardDescription>
          Chamadas em andamento no momento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID do Chamador</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Fila</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Início</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActiveCalls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                    Nenhuma chamada ativa no momento
                  </TableCell>
                </TableRow>
              ) : (
                filteredActiveCalls.map(call => (
                  <TableRow key={call.uniqueId}>
                    <TableCell>{call.callerId}</TableCell>
                    <TableCell className="font-medium">{call.callerIdName || 'Desconhecido'}</TableCell>
                    <TableCell>{call.memberName}</TableCell>
                    <TableCell>{call.queue}</TableCell>
                    <TableCell>{formatDuration(call.duration || Math.floor((Date.now() - call.timestamp) / 1000))}</TableCell>
                    <TableCell>{formatTime(call.timestamp)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
  
  // Renderizar configurações
  const renderConfig = () => (
    <Card>
      <CardHeader>
        <CardTitle>Configurações</CardTitle>
        <CardDescription>
          Configurações do monitor em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <label htmlFor="refreshInterval" className="text-sm font-medium">
              Intervalo de atualização (ms)
            </label>
            <input
              type="number"
              id="refreshInterval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              min="1000"
              step="1000"
              className="border rounded-md p-2"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 border-gray-300 rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm font-medium">
              Atualização automática
            </label>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Conexões recentes</h3>
            <div className="text-sm">
              {connectionHistory.map((entry, index) => (
                <div key={index} className="flex items-center space-x-2 text-gray-600">
                  <span>{new Date(entry.time).toLocaleTimeString()}</span>
                  <span>-</span>
                  <span className={entry.status === 'connected' ? 'text-green-500' : 'text-red-500'}>
                    {entry.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor em Tempo Real</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real de filas, agentes e chamadas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllData()}
            className="flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            <span>Atualizar</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigDialogOpen(true)}
            className="flex items-center"
          >
            <Settings className="w-4 h-4 mr-1" />
            <span>Configurações</span>
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queues" className="flex items-center">
            <List className="w-4 h-4 mr-2" />
            <span>Filas</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center">
            <Users className="w-4 h-4 mr-2" />
            <span>Agentes</span>
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center">
            <Phone className="w-4 h-4 mr-2" />
            <span>Chamadas</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center">
            <BarChart2 className="w-4 h-4 mr-2" />
            <span>Estatísticas</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="queues" className="space-y-6">
          {renderQueuesTable()}
          {renderCallsInQueueTable()}
        </TabsContent>
        
        <TabsContent value="agents" className="space-y-6">
          {renderAgentsTable()}
        </TabsContent>
        
        <TabsContent value="calls" className="space-y-6">
          {renderCallsInQueueTable()}
          {renderActiveCallsTable()}
        </TabsContent>
        
        <TabsContent value="stats" className="space-y-6">
          {/* Seção de estatísticas a ser implementada */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
              <CardDescription>
                Estatísticas resumidas de atividade das filas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">{filteredActiveCalls.length + filteredCallsInQueue.length}</div>
                  <div className="text-sm text-muted-foreground">Chamadas atuais</div>
                </div>
                
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">
                    {filteredQueues.reduce((sum, q) => sum + q.completed, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Chamadas completadas</div>
                </div>
                
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">
                    {filteredQueues.reduce((sum, q) => sum + q.abandoned, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Chamadas abandonadas</div>
                </div>
                
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">
                    {filteredAgents.filter(a => a.status === 'available').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Agentes disponíveis</div>
                </div>
                
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">
                    {filteredAgents.filter(a => a.status === 'busy').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Agentes em chamada</div>
                </div>
                
                <div className="rounded-md border p-4">
                  <div className="text-3xl font-bold">
                    {Math.round(
                      filteredQueues.reduce((sum, q) => sum + q.avgWaitTime, 0) / 
                      (filteredQueues.length || 1)
                    )}s
                  </div>
                  <div className="text-sm text-muted-foreground">Tempo médio de espera</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Diálogo de configurações */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do monitor</DialogTitle>
            <DialogDescription>
              Ajuste as configurações do monitor em tempo real
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="refresh-interval" className="text-right">
                Intervalo (ms)
              </label>
              <input
                id="refresh-interval"
                type="number"
                min="1000"
                step="1000"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="col-span-3 border rounded-md p-2"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="auto-refresh" className="text-right">
                Auto atualizar
              </label>
              <div className="col-span-3 flex items-center space-x-2">
                <input
                  id="auto-refresh"
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 border-gray-300 rounded"
                />
                <label htmlFor="auto-refresh">
                  {autoRefresh ? 'Ativado' : 'Desativado'}
                </label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="submit" onClick={() => setConfigDialogOpen(false)}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de detalhes do agente */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Agente</DialogTitle>
            <DialogDescription>
              Informações detalhadas sobre o agente
            </DialogDescription>
          </DialogHeader>
          
          {selectedAgentDetails && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Nome</h3>
                  <p>{selectedAgentDetails.name}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAgentDetails.status)}`}></div>
                    <span>{getStatusText(selectedAgentDetails.status)}</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Chamadas atendidas</h3>
                  <p>{selectedAgentDetails.callsTaken}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Última chamada</h3>
                  <p>{new Date(selectedAgentDetails.lastCall).toLocaleString()}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Tempo médio</h3>
                  <p>{formatWaitTime(selectedAgentDetails.avgTalkTime)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Tempo total</h3>
                  <p>{formatWaitTime(selectedAgentDetails.totalTalkTime)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Tempo em pausa</h3>
                  <p>{formatWaitTime(selectedAgentDetails.pauseTime)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Login em</h3>
                  <p>{new Date(selectedAgentDetails.loginTime).toLocaleString()}</p>
                </div>
                
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500">Filas</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedAgentDetails.queues.map(queueId => {
                      const queue = state.queues.find(q => q.queueId === queueId);
                      return (
                        <Badge key={queueId} variant="outline">
                          {queue ? queue.name : queueId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowAgentDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de pausa de agente */}
      <Dialog open={showAgentPauseDialog} onOpenChange={setShowAgentPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar Agente</DialogTitle>
            <DialogDescription>
              Selecione o motivo da pausa para o agente {selectedAgentDetails?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="pause-reason" className="text-right">
                  Motivo
                </label>
                <Select
                  value={pauseReason}
                  onValueChange={setPauseReason}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunch">Almoço</SelectItem>
                    <SelectItem value="break">Intervalo</SelectItem>
                    <SelectItem value="meeting">Reunião</SelectItem>
                    <SelectItem value="training">Treinamento</SelectItem>
                    <SelectItem value="admin">Tarefas administrativas</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentPauseDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedAgentDetails) {
                  toggleAgentPause(selectedAgentDetails.agentId, true, pauseReason);
                  setShowAgentPauseDialog(false);
                }
              }}
            >
              Pausar Agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}