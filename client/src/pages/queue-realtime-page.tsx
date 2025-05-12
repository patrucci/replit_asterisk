import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PhoneCall,
  Phone,
  PhoneOff,
  Users,
  User,
  Clock,
  Timer,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  Settings,
  PauseCircle,
  History,
  Headset,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Interfaces
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
  const [wsUrl, setWsUrl] = useState('');
  const [activeTab, setActiveTab] = useState('queues');
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<Agent | null>(null);
  const [showAgentPauseDialog, setShowAgentPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState('lunch');
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<{time: number, status: string}[]>([]);
  const websocket = useRef<WebSocket | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  // Inicializar WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsEndpoint = `${protocol}//${window.location.host}/queue-events`;
    
    setWsUrl(wsEndpoint);
    
    connectWebSocket(wsEndpoint);
    
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
      
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
        requestStats();
      }, refreshInterval);
    }
    
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [autoRefresh, refreshInterval]);
  
  // Conectar ao WebSocket
  const connectWebSocket = (url: string) => {
    try {
      if (websocket.current) {
        websocket.current.close();
      }
      
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
        setState(prev => ({ ...prev, connected: true }));
        
        // Registrar na história de conexões
        const historyEntry = { time: Date.now(), status: 'connected' };
        setConnectionHistory(prev => [...prev, historyEntry].slice(-10));
        
        // Solicitar estatísticas iniciais
        requestStats();
        
        toast({
          title: 'Conectado',
          description: 'Conexão com o servidor estabelecida',
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'stats':
              updateStats(data.data);
              break;
            
            case 'event':
              handleEvent(data.data);
              break;
            
            case 'state':
              setState(prev => ({ ...prev, connected: data.data.connected }));
              break;
            
            case 'error':
              toast({
                title: 'Erro',
                description: data.data.message,
                variant: 'destructive',
              });
              break;
            
            case 'agent':
              setSelectedAgentDetails(data.data);
              setShowAgentDialog(true);
              break;
              
            default:
              console.log('Mensagem desconhecida:', data);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Conexão WebSocket fechada');
        setState(prev => ({ ...prev, connected: false }));
        
        // Registrar na história de conexões
        const historyEntry = { time: Date.now(), status: 'disconnected' };
        setConnectionHistory(prev => [...prev, historyEntry].slice(-10));
        
        // Tentar reconectar após 5 segundos
        setTimeout(() => {
          connectWebSocket(url);
        }, 5000);
        
        toast({
          title: 'Desconectado',
          description: 'Conexão perdida. Tentando reconectar...',
          variant: 'destructive',
        });
      };
      
      ws.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        
        toast({
          title: 'Erro de conexão',
          description: 'Não foi possível conectar ao servidor',
          variant: 'destructive',
        });
      };
      
      websocket.current = ws;
    } catch (error) {
      console.error('Erro ao criar WebSocket:', error);
      
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao servidor',
        variant: 'destructive',
      });
    }
  };
  
  // Solicitar estatísticas atuais
  const requestStats = () => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        command: 'getStats'
      }));
    }
  };
  
  // Atualizar estatísticas
  const updateStats = (data: any) => {
    setState(prev => ({
      ...prev,
      agents: data.agents || [],
      queues: data.queues || [],
      activeCalls: data.activeCalls || [],
      callsInQueue: data.callsInQueue || []
    }));
  };
  
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
    } else if (eventType === 'Newchannel') {
      setState(prev => ({
        ...prev,
        activeCalls: [...prev.activeCalls, call]
      }));
    } else if (eventType === 'Hangup') {
      setState(prev => ({
        ...prev,
        activeCalls: prev.activeCalls.filter(c => c.uniqueId !== call.uniqueId)
      }));
    } else if (eventType === 'AgentConnect') {
      playNotificationSound('call-answered');
      
      toast({
        title: 'Chamada atendida',
        description: `Agente ${call.memberName || call.agentId || 'Unknown'} atendeu a chamada`,
      });
    }
    
    // Após qualquer evento, solicitamos estatísticas atualizadas
    requestStats();
  };
  
  // Reproduzir som de notificação
  const playNotificationSound = (type: string) => {
    // Em uma implementação real, reproduziria diferentes sons para diferentes eventos
    const audio = new Audio();
    
    switch (type) {
      case 'queue-join':
        audio.src = '/sounds/queue-join.mp3';
        break;
      case 'call-answered':
        audio.src = '/sounds/call-answered.mp3';
        break;
      case 'call-abandoned':
        audio.src = '/sounds/call-abandoned.mp3';
        break;
      default:
        audio.src = '/sounds/notification.mp3';
    }
    
    audio.play().catch(e => console.error('Erro ao reproduzir som:', e));
  };
  
  // Solicitar detalhes do agente
  const requestAgentDetails = (agentId: string) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        command: 'getAgentDetails',
        agentId
      }));
    }
  };
  
  // Pausar agente
  const pauseAgent = (agentId: string) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        command: 'pauseAgent',
        agentId,
        reason: pauseReason
      }));
      
      setShowAgentPauseDialog(false);
      
      toast({
        title: 'Agente pausado',
        description: `Agente pausado com motivo: ${pauseReason}`,
      });
    }
  };
  
  // Despausar agente
  const unpauseAgent = (agentId: string) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        command: 'unpauseAgent',
        agentId
      }));
      
      toast({
        title: 'Agente despausado',
        description: 'Agente retornou ao atendimento',
      });
    }
  };
  
  // Formatação de tempo em segundos
  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return "00:00";
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Obter cor associada ao status do agente
  const getAgentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-500';
      case 'in use':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-amber-500';
      case 'unavailable':
        return 'bg-red-500';
      case 'busy':
        return 'bg-purple-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Filtragem de dados
  const filteredAgents = state.selectedQueue === 'all'
    ? state.agents
    : state.agents.filter(agent => agent.queues.includes(state.selectedQueue));
  
  const filteredQueues = state.selectedAgent === 'all'
    ? state.queues
    : state.queues.filter(queue => {
        return state.agents
          .find(a => a.agentId === state.selectedAgent)?.queues
          .includes(queue.queueId);
      });
  
  const filteredCallsInQueue = state.selectedQueue === 'all'
    ? state.callsInQueue
    : state.callsInQueue.filter(call => call.queue === state.selectedQueue);
  
  // Estatísticas gerais
  const totalAgents = filteredAgents.length;
  const availableAgents = filteredAgents.filter(a => 
    a.status.toLowerCase() === 'available'
  ).length;
  
  const totalCalls = filteredCallsInQueue.length;
  const totalActiveCalls = state.activeCalls.length;
  
  // Calcular tempo médio na fila
  const avgWaitTime = filteredCallsInQueue.length > 0
    ? filteredCallsInQueue.reduce((sum, call) => sum + (call.waitTime || 0), 0) / filteredCallsInQueue.length
    : 0;
  
  // Componente para exibir tempo de espera
  const CallWaitTime = ({ call }: { call: Call }) => {
    const [elapsed, setElapsed] = useState(0);
    
    useEffect(() => {
      const initialWait = call.waitTime || 0;
      const startTime = call.timestamp || Date.now();
      
      const interval = setInterval(() => {
        const now = Date.now();
        const waitTime = initialWait + Math.floor((now - startTime) / 1000);
        setElapsed(waitTime);
      }, 1000);
      
      return () => clearInterval(interval);
    }, [call]);
    
    // Determinar classe de cor com base no tempo de espera
    const getWaitTimeClass = () => {
      if (elapsed < 30) return "text-green-500";
      if (elapsed < 60) return "text-amber-500";
      if (elapsed < 180) return "text-orange-500";
      return "text-red-500 font-bold";
    };
    
    return (
      <span className={getWaitTimeClass()}>{formatTime(elapsed)}</span>
    );
  };
  
  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Monitoramento em Tempo Real</h2>
        <p className="text-sm text-neutral-500">
          Status das filas e agentes com atualização em tempo real
          {state.connected ? (
            <Badge variant="success" className="ml-2 bg-green-500">Conectado</Badge>
          ) : (
            <Badge variant="destructive" className="ml-2">Desconectado</Badge>
          )}
        </p>
      </div>
      
      {/* Controles */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <Select 
            value={state.selectedQueue} 
            onValueChange={(value) => setState(prev => ({ ...prev, selectedQueue: value }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar Fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Filas</SelectItem>
              {state.queues.map((queue) => (
                <SelectItem key={queue.queueId} value={queue.queueId}>
                  {queue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={state.selectedAgent} 
            onValueChange={(value) => setState(prev => ({ ...prev, selectedAgent: value }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Agentes</SelectItem>
              {state.agents.map((agent) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={requestStats}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setConfigDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
        </div>
      </div>
      
      {/* Estatísticas de visão geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Agentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{availableAgents} / {totalAgents}</div>
            <Progress value={(availableAgents / (totalAgents || 1)) * 100} className="h-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Chamadas em Fila</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{totalCalls}</div>
            <div className="text-sm text-neutral-600">Tempo médio: {formatTime(avgWaitTime)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Chamadas Ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{totalActiveCalls}</div>
            <div className="text-sm text-neutral-600">
              {state.connected ? (
                <span className="text-green-500">Monitorando em tempo real</span>
              ) : (
                <span className="text-red-500">Conexão perdida</span>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Taxa de Ocupação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {totalAgents > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {Math.round(((totalAgents - availableAgents) / totalAgents) * 100)}%
                </div>
                <Progress 
                  value={((totalAgents - availableAgents) / totalAgents) * 100} 
                  className="h-2" 
                />
              </>
            ) : (
              <div className="text-xl">Sem agentes</div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Abas principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full mb-6">
          <TabsTrigger value="queues">
            <PhoneCall className="h-4 w-4 mr-2" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="h-4 w-4 mr-2" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="calls">
            <Phone className="h-4 w-4 mr-2" />
            Chamadas
          </TabsTrigger>
        </TabsList>
        
        {/* Aba de Filas */}
        <TabsContent value="queues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status das Filas</CardTitle>
              <CardDescription>
                Monitoramento do tráfego de chamadas e nível de serviço
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Fila</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Estratégia</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Agentes</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Em Fila</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Atendidas</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Abandonadas</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Nível de Serviço</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Tempo Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueues.map((queue) => {
                      // Contar chamadas em fila para esta fila específica
                      const queueCalls = state.callsInQueue.filter(
                        call => call.queue === queue.queueId
                      ).length;
                      
                      return (
                        <tr key={queue.queueId} className="border-b hover:bg-neutral-50">
                          <td className="py-3 px-4 text-sm font-medium">{queue.name}</td>
                          <td className="py-3 px-4 text-sm">{queue.strategy}</td>
                          <td className="py-3 px-4 text-sm text-center">
                            <div className="flex items-center justify-center">
                              <Badge className={queue.activeAgents > 0 ? 'bg-green-500' : 'bg-red-500'}>
                                {queue.activeAgents} / {queue.agents}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-center">
                            <Badge variant={queueCalls > 0 ? 'default' : 'outline'}>
                              {queueCalls}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-center">{queue.completed}</td>
                          <td className="py-3 px-4 text-sm text-center">
                            <span className={queue.abandoned > 0 ? 'text-red-500' : 'text-neutral-500'}>
                              {queue.abandoned}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-center">
                            <div className="flex flex-col items-center">
                              <span className={
                                queue.serviceLevel >= 90 ? 'text-green-500' : 
                                queue.serviceLevel >= 80 ? 'text-amber-500' : 
                                'text-red-500'
                              }>
                                {queue.serviceLevel}%
                              </span>
                              <Progress 
                                value={queue.serviceLevel} 
                                className="h-1 w-16 mt-1" 
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-center">
                            {formatTime(queue.avgWaitTime)}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {filteredQueues.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-neutral-500">
                          Nenhuma fila encontrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Gráfico de chamadas nas filas */}
          {filteredQueues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Chamadas</CardTitle>
                <CardDescription>
                  Comparação de chamadas atendidas e abandonadas por fila
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredQueues.map(q => ({
                        name: q.name,
                        Atendidas: q.completed,
                        Abandonadas: q.abandoned,
                        "Em Fila": state.callsInQueue.filter(c => c.queue === q.queueId).length
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Atendidas" stackId="a" fill="#4ade80" />
                      <Bar dataKey="Abandonadas" stackId="a" fill="#f87171" />
                      <Bar dataKey="Em Fila" stackId="a" fill="#60a5fa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Aba de Agentes */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status dos Agentes</CardTitle>
              <CardDescription>
                Monitoramento de disponibilidade e produtividade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Agente</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Filas</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Atendidas</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Tempo Médio</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Última Chamada</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.agentId} className="border-b hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm font-medium">{agent.name}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${getAgentStatusColor(agent.status)}`}></span>
                            {agent.status}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {agent.queues.map((queueId, index) => {
                              const queue = state.queues.find(q => q.queueId === queueId);
                              return (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {queue?.name || queueId}
                                </Badge>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-center">{agent.callsTaken}</td>
                        <td className="py-3 px-4 text-sm text-center">{formatTime(agent.avgTalkTime)}</td>
                        <td className="py-3 px-4 text-sm">{agent.lastCall}</td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => requestAgentDetails(agent.agentId)}
                            >
                              <User className="h-4 w-4" />
                              <span className="sr-only">Detalhes</span>
                            </Button>
                            
                            {agent.status.toLowerCase() === 'paused' ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => unpauseAgent(agent.agentId)}
                              >
                                <Play className="h-4 w-4" />
                                <span className="sr-only">Despausar</span>
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedAgentDetails(agent);
                                  setShowAgentPauseDialog(true);
                                }}
                              >
                                <Pause className="h-4 w-4" />
                                <span className="sr-only">Pausar</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {filteredAgents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-neutral-500">
                          Nenhum agente encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Distribuição de status dos agentes */}
          {filteredAgents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status dos Agentes</CardTitle>
                  <CardDescription>
                    Distribuição atual de estados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { 
                              name: "Disponível", 
                              value: filteredAgents.filter(a => a.status.toLowerCase() === 'available').length,
                              color: "#22c55e"
                            },
                            { 
                              name: "Em Atendimento", 
                              value: filteredAgents.filter(a => a.status.toLowerCase() === 'in use').length,
                              color: "#3b82f6"
                            },
                            { 
                              name: "Pausado", 
                              value: filteredAgents.filter(a => a.status.toLowerCase() === 'paused').length,
                              color: "#f59e0b"
                            },
                            { 
                              name: "Indisponível", 
                              value: filteredAgents.filter(a => ['unavailable', 'busy'].includes(a.status.toLowerCase())).length,
                              color: "#ef4444"
                            },
                            { 
                              name: "Offline", 
                              value: filteredAgents.filter(a => a.status.toLowerCase() === 'offline').length,
                              color: "#9ca3af"
                            }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {filteredAgents.length > 0 && ([
                            { name: "Disponível", value: 0, color: "#22c55e" },
                            { name: "Em Atendimento", value: 0, color: "#3b82f6" },
                            { name: "Pausado", value: 0, color: "#f59e0b" },
                            { name: "Indisponível", value: 0, color: "#ef4444" },
                            { name: "Offline", value: 0, color: "#9ca3af" }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          )))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Chamadas Atendidas</CardTitle>
                  <CardDescription>
                    Volume de atendimento por agente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={filteredAgents
                          .filter(agent => agent.callsTaken > 0)
                          .map(agent => ({
                            name: agent.name,
                            Chamadas: agent.callsTaken
                          }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Chamadas" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        {/* Aba de Chamadas */}
        <TabsContent value="calls" className="space-y-6">
          {/* Chamadas em fila */}
          <Card>
            <CardHeader>
              <CardTitle>Chamadas em Fila</CardTitle>
              <CardDescription>
                Chamadas aguardando atendimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Número</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Nome</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Fila</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Posição</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Tempo em Espera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCallsInQueue.map((call) => {
                      const queue = state.queues.find(q => q.queueId === call.queue);
                      
                      return (
                        <tr key={call.uniqueId} className="border-b hover:bg-neutral-50 animate-pulse">
                          <td className="py-3 px-4 text-sm">{call.callerId || "Unknown"}</td>
                          <td className="py-3 px-4 text-sm">{call.callerIdName || "Unknown"}</td>
                          <td className="py-3 px-4 text-sm">{queue?.name || call.queue}</td>
                          <td className="py-3 px-4 text-sm text-center">{call.position || "-"}</td>
                          <td className="py-3 px-4 text-sm text-center">
                            <CallWaitTime call={call} />
                          </td>
                        </tr>
                      );
                    })}
                    
                    {filteredCallsInQueue.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-neutral-500">
                          Nenhuma chamada em fila
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Chamadas ativas */}
          <Card>
            <CardHeader>
              <CardTitle>Chamadas Ativas</CardTitle>
              <CardDescription>
                Chamadas em andamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Número</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Nome</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Canal</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Agente</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.activeCalls.map((call) => (
                      <tr key={call.uniqueId} className="border-b hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm">{call.callerId || "Unknown"}</td>
                        <td className="py-3 px-4 text-sm">{call.callerIdName || "Unknown"}</td>
                        <td className="py-3 px-4 text-sm">{call.channel || "-"}</td>
                        <td className="py-3 px-4 text-sm">{call.memberName || call.agentId || "-"}</td>
                        <td className="py-3 px-4 text-sm text-center">
                          <CallWaitTime call={call} />
                        </td>
                      </tr>
                    ))}
                    
                    {state.activeCalls.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-neutral-500">
                          Nenhuma chamada ativa
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Modal de detalhes do agente */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Agente</DialogTitle>
            <DialogDescription>
              Informações detalhadas e histórico de chamadas
            </DialogDescription>
          </DialogHeader>
          
          {selectedAgentDetails && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Nome</h3>
                  <p>{selectedAgentDetails.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Status</h3>
                  <div className="flex items-center mt-1">
                    <span className={`w-2 h-2 rounded-full mr-2 ${getAgentStatusColor(selectedAgentDetails.status)}`}></span>
                    {selectedAgentDetails.status}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">ID / Ramal</h3>
                  <p>{selectedAgentDetails.agentId}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Login</h3>
                  <p>{selectedAgentDetails.loginTime}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Chamadas Atendidas</h3>
                  <p>{selectedAgentDetails.callsTaken}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Tempo Médio</h3>
                  <p>{formatTime(selectedAgentDetails.avgTalkTime)}</p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <h3 className="text-sm font-medium mb-2">Filas Associadas</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedAgentDetails.queues.map((queueId, index) => {
                  const queue = state.queues.find(q => q.queueId === queueId);
                  return (
                    <Badge key={index} className="bg-blue-500">
                      {queue?.name || queueId}
                    </Badge>
                  );
                })}
                
                {selectedAgentDetails.queues.length === 0 && (
                  <p className="text-sm text-neutral-500">Nenhuma fila associada</p>
                )}
              </div>
              
              {/* Histórico de chamadas aqui - não exibido por brevidade no código */}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de pausa de agente */}
      <Dialog open={showAgentPauseDialog} onOpenChange={setShowAgentPauseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Pausar Agente</DialogTitle>
            <DialogDescription>
              Selecione o motivo da pausa
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Select
              value={pauseReason}
              onValueChange={setPauseReason}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lunch">Almoço</SelectItem>
                <SelectItem value="break">Intervalo</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="training">Treinamento</SelectItem>
                <SelectItem value="personal">Razão Pessoal</SelectItem>
                <SelectItem value="administrative">Tarefa Administrativa</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentPauseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => pauseAgent(selectedAgentDetails?.agentId || '')}>
              Pausar Agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de configurações */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>
              Personalize as configurações de atualização
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Atualização Automática</h3>
                <p className="text-sm text-neutral-500">
                  Atualizar dados automaticamente
                </p>
              </div>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Intervalo de Atualização</h3>
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => setRefreshInterval(parseInt(value, 10))}
                disabled={!autoRefresh}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o intervalo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1 segundo</SelectItem>
                  <SelectItem value="2000">2 segundos</SelectItem>
                  <SelectItem value="5000">5 segundos</SelectItem>
                  <SelectItem value="10000">10 segundos</SelectItem>
                  <SelectItem value="30000">30 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">URL do WebSocket</h3>
              <div className="flex gap-2">
                <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />
                <Button variant="outline" onClick={() => connectWebSocket(wsUrl)}>
                  Reconectar
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Histórico de Conexão</h3>
              <div className="max-h-[100px] overflow-y-auto border rounded-md p-2">
                {connectionHistory.map((entry, index) => (
                  <div key={index} className="text-xs flex justify-between py-1">
                    <span>{new Date(entry.time).toLocaleTimeString()}</span>
                    <Badge 
                      variant={entry.status === 'connected' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {entry.status}
                    </Badge>
                  </div>
                ))}
                
                {connectionHistory.length === 0 && (
                  <p className="text-xs text-neutral-500">Nenhum histórico disponível</p>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}