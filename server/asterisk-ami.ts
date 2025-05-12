import { EventEmitter } from 'events';
import AsteriskAmiClient from 'asterisk-ami-client';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import * as net from 'net';
import * as util from 'util';

// Interface para eventos de chamada
interface CallEvent {
  event: string;
  callerId?: string;
  callerIdName?: string;
  channel?: string;
  destChannel?: string;
  destCallerIdNum?: string;
  destCallerIdName?: string;
  queue?: string;
  member?: string;
  position?: number;
  originalPosition?: number;
  holdTime?: number;
  timestamp: number;
  uniqueId?: string;
  linkedId?: string;
  memberName?: string;
  memberInterface?: string;
  agentName?: string;
  agentId?: string;
  queueName?: string;
  waitTime?: number;
  duration?: number;
  talkTime?: number;
  reason?: string;
  variables?: Record<string, string>;
}

// Interface para mensagens de websocket
interface WebSocketMessage {
  type: 'event' | 'state' | 'stats' | 'error' | 'auth';
  data: any;
}

// Interface para estatísticas de agente
interface AgentStats {
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

// Interface para estatísticas de fila
interface QueueStats {
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

// Classe para gerenciar a conexão com o Asterisk AMI
class AsteriskAMIManager extends EventEmitter {
  private client: any;
  private connected: boolean = false;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private agentStats: Map<string, AgentStats> = new Map();
  private queueStats: Map<string, QueueStats> = new Map();
  private activeCalls: Map<string, CallEvent> = new Map();
  private callHistory: CallEvent[] = [];
  private queueCalls: Map<string, CallEvent[]> = new Map();
  private connectionSettings: {
    host: string;
    port: number;
    username: string;
    password: string;
  } | null = null;

  constructor() {
    super();
    this.client = new AsteriskAmiClient({
      reconnect: true,
      keepAlive: true,
      // Parâmetros de configuração simplificados
    });

    this.setupEventListeners();
  }

  // Verifica se está conectado
  isConnected(): boolean {
    return this.connected;
  }

  // Retorna as estatísticas de filas
  getQueueStats(): Map<string, QueueStats> {
    return this.queueStats;
  }

  // Retorna as estatísticas de agentes
  getAgentStats(): Map<string, AgentStats> {
    return this.agentStats;
  }

  // Inicializar conexão com o Asterisk
  async connect(host: string, port: number, username: string, password: string) {
    try {
      console.log(`Iniciando conexão com Asterisk AMI: ${host}:${port}`);
      
      // Mensagem de diagnóstico
      console.log('Verificando configurações do servidor Asterisk...');
      console.log(`Host: ${host}, Porta: ${port}, Usuário: ${username}`);

      // Armazenar as configurações para reconexão automática
      this.connectionSettings = {
        host,
        port,
        username,
        password
      };

      // Testar a conexão primeiro
      const testResult = await this.testConnection(host, port, username, password);
      if (!testResult.success) {
        console.error('Teste de conexão falhou:', testResult.message);
        return false;
      }
      
      console.log('Teste de conexão bem-sucedido, estabelecendo conexão permanente...');
      
      // Se o cliente já existir, desconectar antes de criar um novo
      if (this.client) {
        console.log('Fechando conexão anterior...');
        try {
          this.client.disconnect();
        } catch (e) {
          console.error('Erro ao desconectar cliente anterior:', e);
        }
      }
      
      // Criar nova instância do cliente AMI
      try {
        this.client = new AsteriskAmiClient();
        
        // Configurar handlers para a nova instância
        this.client.on('connect', () => {
          console.log(`Conexão TCP permanente estabelecida com ${host}:${port}`);
        });
        
        this.client.on('login', () => {
          console.log(`Autenticação permanente bem-sucedida com ${host}:${port}`);
          this.connected = true;
        });
        
        this.client.on('disconnect', () => {
          console.log(`Desconectado do AMI ${host}:${port}`);
          this.connected = false;
        });
        
        this.setupEventListeners();
        
        // Conectar ao servidor Asterisk
        await this.client.connect(username, password, {
          host: host, 
          port: port,
          keepAlive: true,
          emitEventsByTypes: true,
          reconnect: true
        });
        
        return true;
      } catch (e) {
        console.error('Erro ao criar nova instância AMI:', e);
        this.connected = false;
        return false;
      }
    } catch (error) {
      console.error('Erro geral ao conectar ao Asterisk AMI:', error);
      this.connected = false;
      return false;
    }
  }

  // Configurar os listeners de eventos do Asterisk
  private setupEventListeners() {
    // Eventos relacionados a filas
    this.client.on('QueueCallerJoin', (event: any) => this.handleQueueCallerJoin(event));
    this.client.on('QueueCallerLeave', (event: any) => this.handleQueueCallerLeave(event));
    this.client.on('QueueCallerAbandon', (event: any) => this.handleQueueCallerAbandon(event));
    this.client.on('QueueMemberAdded', (event: any) => this.handleQueueMemberAdded(event));
    this.client.on('QueueMemberRemoved', (event: any) => this.handleQueueMemberRemoved(event));
    this.client.on('QueueMemberStatus', (event: any) => this.handleQueueMemberStatus(event));
    this.client.on('QueueMemberPause', (event: any) => this.handleQueueMemberPause(event));
    
    // Eventos relacionados a chamadas
    this.client.on('Newchannel', (event: any) => this.handleNewChannel(event));
    this.client.on('Hangup', (event: any) => this.handleHangup(event));
    this.client.on('Bridge', (event: any) => this.handleBridge(event));
    this.client.on('Unbridge', (event: any) => this.handleUnbridge(event));
    this.client.on('AgentConnect', (event: any) => this.handleAgentConnect(event));
    this.client.on('AgentComplete', (event: any) => this.handleAgentComplete(event));
    
    // Eventos de erro
    this.client.on('error', (error: any) => {
      console.error('Erro no Asterisk AMI:', error);
      this.broadcastToClients({
        type: 'error',
        data: {
          message: 'Erro na conexão com o Asterisk',
          error: error.message
        }
      });
    });
    
    // Evento de reconexão
    this.client.on('reconnection', () => {
      console.log('Reconectando ao Asterisk AMI...');
      this.broadcastToClients({
        type: 'state',
        data: {
          connected: false,
          reconnecting: true
        }
      });
    });
    
    // Evento de conexão
    this.client.on('connect', () => {
      console.log('Conexão estabelecida com Asterisk AMI');
      this.connected = true;
      this.broadcastToClients({
        type: 'state',
        data: {
          connected: true,
          reconnecting: false
        }
      });
    });
  }
  
  // Inicializar dados de filas e agentes
  private async initializeQueuesAndAgents() {
    try {
      // Obter status das filas
      const queueStatusResponse = await this.client.action({
        Action: 'QueueStatus'
      });
      
      if (queueStatusResponse) {
        this.parseQueueStatus(queueStatusResponse);
      }
      
      // Obter status dos agentes
      const agentsStatusResponse = await this.client.action({
        Action: 'Agents'
      });
      
      if (agentsStatusResponse) {
        this.parseAgentsStatus(agentsStatusResponse);
      }
      
      // Broadcast das estatísticas iniciais
      this.broadcastStats();
    } catch (error) {
      console.error('Erro ao inicializar filas e agentes:', error);
    }
  }
  
  // Parsear resposta de status das filas
  private parseQueueStatus(response: any) {
    if (Array.isArray(response.events)) {
      const queueSummaries = new Map<string, any>();
      
      response.events.forEach((event: any) => {
        if (event.event === 'QueueParams') {
          const queueName = event.queue;
          queueSummaries.set(queueName, {
            name: queueName,
            strategy: event.strategy || 'ringall',
            calls: parseInt(event.calls || '0', 10),
            completed: parseInt(event.completed || '0', 10),
            abandoned: parseInt(event.abandoned || '0', 10),
            serviceLevel: parseFloat(event.servicelevel || '0'),
            avgWaitTime: parseFloat(event.holdtime || '0'),
            maxWaitTime: 0,
            agents: 0,
            activeAgents: 0
          });
        } else if (event.event === 'QueueMember') {
          const queueName = event.queue;
          const queueSummary = queueSummaries.get(queueName);
          
          if (queueSummary) {
            queueSummary.agents++;
            
            if (event.status === '1' || event.status === '2') {
              queueSummary.activeAgents++;
            }
          }
        }
      });
      
      // Atualizar estatísticas de fila
      queueSummaries.forEach((summary, queueName) => {
        this.queueStats.set(queueName, {
          queueId: queueName,
          ...summary
        });
      });
    }
  }
  
  // Parsear resposta de status dos agentes
  private parseAgentsStatus(response: any) {
    if (Array.isArray(response.events)) {
      response.events.forEach((event: any) => {
        if (event.event === 'AgentsComplete') return;
        
        if (event.event === 'Agents') {
          const agentId = event.agent;
          
          if (agentId) {
            const agentStatus = event.status || 'UNKNOWN';
            const agentName = event.name || `Agent ${agentId}`;
            
            this.agentStats.set(agentId, {
              agentId,
              name: agentName,
              status: agentStatus,
              lastCall: event.lastcall || 'N/A',
              callsTaken: parseInt(event.callstaken || '0', 10),
              callsAbandoned: 0,
              avgTalkTime: 0,
              totalTalkTime: 0,
              pauseTime: 0,
              loginTime: event.loggedin || 'N/A',
              queues: []
            });
          }
        }
      });
    }
  }
  
  // Configurar WebSocket server para comunicação em tempo real
  private simulationTimer: NodeJS.Timeout | null = null;
  private simulationMode = false; // Desativar modo de simulação para usar dados reais do Asterisk
  
  setupWebsocket(server: Server, path: string = '/queue-events') {
    this.wss = new WebSocketServer({ server, path });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Nova conexão WebSocket');
      this.clients.add(ws);
      
      // Enviar estatísticas atuais para o novo cliente
      this.sendStatsToClient(ws);
      
      // Modo de simulação está desativado, não iniciar simulação de eventos
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          console.log('Mensagem WebSocket recebida:', data);
          
          // Processar comandos do cliente
          if (data.command === 'getStats') {
            console.log('Enviando estatísticas para o cliente');
            this.sendStatsToClient(ws);
          } else if (data.command === 'getAgentDetails' && data.agentId) {
            this.sendAgentDetailsToClient(ws, data.agentId);
          } else if (data.command === 'getQueueDetails' && data.queueId) {
            this.sendQueueDetailsToClient(ws, data.queueId);
          } else if (data.command === 'pauseAgent' && data.agentId) {
            this.pauseAgent(data.agentId, data.reason || 'Unknown');
          } else if (data.command === 'unpauseAgent' && data.agentId) {
            this.unpauseAgent(data.agentId);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Conexão WebSocket fechada');
        this.clients.delete(ws);
        
        // Se não houver mais clientes conectados, parar simulação
        if (this.simulationMode && this.clients.size === 0 && this.simulationTimer) {
          clearInterval(this.simulationTimer);
          this.simulationTimer = null;
        }
      });
    });
  }
  
  // Pausar um agente
  async pauseAgent(agentId: string, reason: string) {
    try {
      const response = await this.client.action({
        Action: 'QueuePause',
        Interface: agentId,
        Paused: 'true',
        Reason: reason
      });
      
      console.log('Agente pausado:', response);
      return true;
    } catch (error) {
      console.error('Erro ao pausar agente:', error);
      return false;
    }
  }
  
  // Despausar um agente
  async unpauseAgent(agentId: string) {
    try {
      const response = await this.client.action({
        Action: 'QueuePause',
        Interface: agentId,
        Paused: 'false'
      });
      
      console.log('Agente despausado:', response);
      return true;
    } catch (error) {
      console.error('Erro ao despausar agente:', error);
      return false;
    }
  }
  
  // Enviar detalhes de agente para um cliente específico
  private sendAgentDetailsToClient(ws: WebSocket, agentId: string) {
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      const callHistory = this.callHistory.filter(call => 
        call.agentId === agentId || call.memberName === agent.name
      );
      
      ws.send(JSON.stringify({
        type: 'agent',
        data: {
          ...agent,
          callHistory
        }
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          message: 'Agente não encontrado'
        }
      }));
    }
  }
  
  // Enviar detalhes de fila para um cliente específico
  private sendQueueDetailsToClient(ws: WebSocket, queueId: string) {
    const queue = this.queueStats.get(queueId);
    
    if (queue) {
      // Obter chamadas ativas na fila
      const activeCalls = this.queueCalls.get(queueId) || [];
      
      // Obter histórico de chamadas da fila
      const queueCallHistory = this.callHistory.filter(call => 
        call.queue === queueId || call.queueName === queue.name
      );
      
      ws.send(JSON.stringify({
        type: 'queue',
        data: {
          ...queue,
          activeCalls,
          callHistory: queueCallHistory
        }
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          message: 'Fila não encontrada'
        }
      }));
    }
  }
  
  // Enviar estatísticas para um cliente específico
  private sendStatsToClient(ws: WebSocket) {
    console.log('Enviando estatísticas para cliente WebSocket');
    
    // Modo de simulação desativado, apenas estatísticas reais são enviadas
    
    const statsData = {
      type: 'stats',
      data: {
        agents: Array.from(this.agentStats.values()),
        queues: Array.from(this.queueStats.values()),
        activeCalls: Array.from(this.activeCalls.values()),
        callsInQueue: this.getCallsInQueue()
      }
    };
    
    console.log('Estatísticas sendo enviadas:', JSON.stringify(statsData));
    
    try {
      ws.send(JSON.stringify(statsData));
      console.log('Estatísticas enviadas com sucesso');
    } catch (error) {
      console.error('Erro ao enviar estatísticas:', error);
    }
  }
  
  // Obter chamadas em fila
  private getCallsInQueue() {
    const callsInQueue: any[] = [];
    
    this.queueCalls.forEach((calls, queueId) => {
      calls.forEach(call => {
        callsInQueue.push({
          ...call,
          queueId
        });
      });
    });
    
    return callsInQueue;
  }
  
  // Enviar broadcast de estatísticas para todos os clientes
  private broadcastStats() {
    this.broadcastToClients({
      type: 'stats',
      data: {
        agents: Array.from(this.agentStats.values()),
        queues: Array.from(this.queueStats.values()),
        activeCalls: Array.from(this.activeCalls.values()),
        callsInQueue: this.getCallsInQueue()
      }
    });
  }
  
  // Enviar mensagem para todos os clientes WebSocket
  private broadcastToClients(message: WebSocketMessage) {
    if (!this.clients.size) return;
    
    const messageString = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN é o valor 1
        client.send(messageString);
      }
    });
  }
  
  // Iniciar simulação de eventos de fila
  private startSimulation() {
    console.log('Iniciando simulação de eventos de fila');
    
    // Inicializar alguns dados simulados se não existirem ainda
    if (this.queueStats.size === 0) {
      this.initializeSimulatedData();
    }
    
    // Transmitir estatísticas iniciais
    this.broadcastStats();
    
    // Configurar timer para gerar eventos aleatórios
    this.simulationTimer = setInterval(() => {
      this.generateSimulatedEvent();
    }, 5000); // Gerar evento a cada 5 segundos
  }
  
  // Gerar dados iniciais simulados
  private initializeSimulatedData() {
    // Simular filas
    const queues = ['suporte', 'vendas', 'financeiro'];
    
    queues.forEach((queueName, index) => {
      const queueId = `queue${index + 1}`;
      this.queueStats.set(queueId, {
        queueId,
        name: queueName,
        strategy: 'leastrecent',
        calls: 0,
        completed: 0,
        abandoned: 0,
        serviceLevel: 80,
        avgWaitTime: 45,
        avgTalkTime: 180,
        maxWaitTime: 120,
        agents: 3,
        activeAgents: 2
      });
    });
    
    // Simular agentes
    const agents = [
      { id: 'agent1', name: 'João Silva', status: 'available' },
      { id: 'agent2', name: 'Maria Santos', status: 'busy' },
      { id: 'agent3', name: 'Carlos Oliveira', status: 'available' },
      { id: 'agent4', name: 'Ana Pereira', status: 'paused' },
      { id: 'agent5', name: 'Rafael Costa', status: 'unavailable' }
    ];
    
    agents.forEach(agent => {
      this.agentStats.set(agent.id, {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        callsTaken: Math.floor(Math.random() * 20),
        callsAbandoned: Math.floor(Math.random() * 5),
        avgTalkTime: Math.floor(120 + Math.random() * 180),
        totalTalkTime: Math.floor(1800 + Math.random() * 3600),
        pauseTime: Math.floor(Math.random() * 1200),
        loginTime: new Date(Date.now() - Math.random() * 28800000).toISOString(),
        queues: queues.filter(() => Math.random() > 0.3).map((q, i) => `queue${i + 1}`)
      });
    });
  }
  
  // Gerar evento simulado aleatório
  private generateSimulatedEvent() {
    const eventTypes = [
      'QueueCallerJoin',
      'QueueCallerLeave',
      'QueueCallerAbandon',
      'AgentConnect',
      'AgentComplete',
      'AgentStatusChange'
    ];
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const queues = Array.from(this.queueStats.keys());
    const agents = Array.from(this.agentStats.keys());
    
    // Escolher uma fila e um agente aleatório
    const queueId = queues[Math.floor(Math.random() * queues.length)];
    const agentId = agents[Math.floor(Math.random() * agents.length)];
    
    // Gerar ID único para a chamada
    const callId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    switch (eventType) {
      case 'QueueCallerJoin':
        // Simular novo caller na fila
        this.simulateQueueCallerJoin(queueId, callId);
        break;
        
      case 'QueueCallerLeave':
        // Simular caller saindo da fila
        this.simulateQueueCallerLeave(queueId);
        break;
        
      case 'QueueCallerAbandon':
        // Simular caller abandonando a fila
        this.simulateQueueCallerAbandon(queueId);
        break;
        
      case 'AgentConnect':
        // Simular agente atendendo chamada
        this.simulateAgentConnect(queueId, agentId);
        break;
        
      case 'AgentComplete':
        // Simular agente completando chamada
        this.simulateAgentComplete(agentId);
        break;
        
      case 'AgentStatusChange':
        // Simular mudança de status de agente
        this.simulateAgentStatusChange(agentId);
        break;
    }
    
    // Atualizar estatísticas para todos os clientes
    this.broadcastStats();
  }
  
  // Simulações de eventos específicos
  private simulateQueueCallerJoin(queueId: string, callId: string) {
    const callerNames = ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D', 'Cliente E'];
    const callerPhones = ['5511987654321', '5511976543210', '5511965432109', '5511954321098', '5511943210987'];
    
    const callerIndex = Math.floor(Math.random() * callerNames.length);
    const callerName = callerNames[callerIndex];
    const callerPhone = callerPhones[callerIndex];
    
    const queueStat = this.queueStats.get(queueId);
    if (queueStat) {
      queueStat.calls++;
      this.queueStats.set(queueId, queueStat);
    }
    
    const queueEvent: CallEvent = {
      event: 'QueueCallerJoin',
      callerId: callerPhone,
      callerIdName: callerName,
      queue: queueId,
      position: 1,
      channel: `SIP/${callerPhone}`,
      uniqueId: callId,
      timestamp: Date.now(),
      waitTime: 0
    };
    
    // Adicionar à lista de chamadas na fila
    const queueCalls = this.queueCalls.get(queueId) || [];
    queueCalls.push(queueEvent);
    this.queueCalls.set(queueId, queueCalls);
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerJoin',
        call: queueEvent
      }
    });
    
    console.log('Simulado: Nova chamada na fila', queueId);
  }
  
  private simulateQueueCallerLeave(queueId: string) {
    const queueCalls = this.queueCalls.get(queueId) || [];
    if (queueCalls.length === 0) return;
    
    // Remover um chamador aleatório da fila
    const callIndex = Math.floor(Math.random() * queueCalls.length);
    const call = queueCalls[callIndex];
    
    queueCalls.splice(callIndex, 1);
    this.queueCalls.set(queueId, queueCalls);
    
    const queueStat = this.queueStats.get(queueId);
    if (queueStat) {
      queueStat.completed++;
      this.queueStats.set(queueId, queueStat);
    }
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerLeave',
        call: {
          ...call,
          event: 'QueueCallerLeave'
        }
      }
    });
    
    console.log('Simulado: Chamada saiu da fila', queueId);
  }
  
  private simulateQueueCallerAbandon(queueId: string) {
    const queueCalls = this.queueCalls.get(queueId) || [];
    if (queueCalls.length === 0) return;
    
    // Remover um chamador aleatório da fila
    const callIndex = Math.floor(Math.random() * queueCalls.length);
    const call = queueCalls[callIndex];
    
    queueCalls.splice(callIndex, 1);
    this.queueCalls.set(queueId, queueCalls);
    
    const queueStat = this.queueStats.get(queueId);
    if (queueStat) {
      queueStat.abandoned++;
      this.queueStats.set(queueId, queueStat);
    }
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerAbandon',
        call: {
          ...call,
          event: 'QueueCallerAbandon'
        }
      }
    });
    
    console.log('Simulado: Chamada abandonou a fila', queueId);
  }
  
  private simulateAgentConnect(queueId: string, agentId: string) {
    const queueCalls = this.queueCalls.get(queueId) || [];
    if (queueCalls.length === 0) return;
    
    // Pegar o primeiro chamador da fila
    const call = queueCalls[0];
    queueCalls.shift();
    this.queueCalls.set(queueId, queueCalls);
    
    // Atualizar estatísticas do agente
    const agentStat = this.agentStats.get(agentId);
    if (agentStat) {
      agentStat.status = 'busy';
      agentStat.lastCall = new Date().toISOString();
      agentStat.callsTaken++;
      this.agentStats.set(agentId, agentStat);
    }
    
    // Atualizar chamada ativa
    const activeCall: CallEvent = {
      ...call,
      event: 'AgentConnect',
      agentId,
      memberName: agentStat?.name || 'Unknown Agent'
    };
    
    this.activeCalls.set(call.uniqueId || '', activeCall);
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'AgentConnect',
        call: activeCall
      }
    });
    
    console.log('Simulado: Agente conectado à chamada', agentId, queueId);
  }
  
  private simulateAgentComplete(agentId: string) {
    // Encontrar chamadas ativas deste agente
    let callToComplete: [string, CallEvent] | undefined;
    
    for (const [callId, call] of this.activeCalls.entries()) {
      if (call.agentId === agentId) {
        callToComplete = [callId, call];
        break;
      }
    }
    
    if (!callToComplete) return;
    
    const [callId, call] = callToComplete;
    
    // Remover chamada ativa
    this.activeCalls.delete(callId);
    
    // Atualizar estatísticas do agente
    const agentStat = this.agentStats.get(agentId);
    if (agentStat) {
      agentStat.status = 'available';
      agentStat.avgTalkTime = Math.floor((agentStat.avgTalkTime + Math.floor(Math.random() * 120 + 60)) / 2);
      agentStat.totalTalkTime += Math.floor(Math.random() * 120 + 60);
      this.agentStats.set(agentId, agentStat);
    }
    
    // Adicionar ao histórico de chamadas
    this.callHistory.push({
      ...call,
      event: 'AgentComplete',
      duration: Math.floor(Math.random() * 300 + 60) // 1-6 minutos
    });
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'AgentComplete',
        call: {
          ...call,
          event: 'AgentComplete',
          duration: Math.floor(Math.random() * 300 + 60)
        }
      }
    });
    
    console.log('Simulado: Agente completou chamada', agentId);
  }
  
  private simulateAgentStatusChange(agentId: string) {
    const statuses = ['available', 'paused', 'unavailable'];
    
    const agentStat = this.agentStats.get(agentId);
    if (!agentStat) return;
    
    // Não mudar status se agente estiver em chamada
    if (agentStat.status === 'busy') return;
    
    // Escolher um novo status aleatório diferente do atual
    let newStatus = agentStat.status;
    while (newStatus === agentStat.status) {
      newStatus = statuses[Math.floor(Math.random() * statuses.length)];
    }
    
    // Atualizar status do agente
    agentStat.status = newStatus;
    if (newStatus === 'paused') {
      agentStat.pauseTime += Math.floor(Math.random() * 300);
    }
    
    this.agentStats.set(agentId, agentStat);
    
    // Enviar evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'AgentStatusChange',
        agent: agentStat
      }
    });
    
    console.log('Simulado: Agente mudou status', agentId, newStatus);
  }
  
  // Handlers para eventos de fila
  private handleQueueCallerJoin(event: any) {
    const queueEvent: CallEvent = {
      event: 'QueueCallerJoin',
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      queue: event.queue,
      position: parseInt(event.position, 10),
      channel: event.channel,
      uniqueId: event.uniqueid,
      timestamp: Date.now(),
      waitTime: 0
    };
    
    // Adicionar à lista de chamadas na fila
    const queueCalls = this.queueCalls.get(event.queue) || [];
    queueCalls.push(queueEvent);
    this.queueCalls.set(event.queue, queueCalls);
    
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      queueStat.calls++;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerJoin',
        call: queueEvent
      }
    });
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueCallerLeave(event: any) {
    const queueEvent: CallEvent = {
      event: 'QueueCallerLeave',
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      queue: event.queue,
      position: parseInt(event.position, 10),
      channel: event.channel,
      uniqueId: event.uniqueid,
      timestamp: Date.now(),
      waitTime: parseInt(event.waittime, 10) || 0
    };
    
    // Remover da lista de chamadas na fila
    const queueCalls = this.queueCalls.get(event.queue) || [];
    const updatedQueueCalls = queueCalls.filter(call => call.uniqueId !== event.uniqueid);
    this.queueCalls.set(event.queue, updatedQueueCalls);
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerLeave',
        call: queueEvent
      }
    });
    
    // Adicionar ao histórico de chamadas
    this.callHistory.push(queueEvent);
    
    // Limitar o histórico de chamadas a 1000 entradas
    if (this.callHistory.length > 1000) {
      this.callHistory.shift();
    }
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueCallerAbandon(event: any) {
    const queueEvent: CallEvent = {
      event: 'QueueCallerAbandon',
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      queue: event.queue,
      position: parseInt(event.position, 10),
      originalPosition: parseInt(event.originalposition, 10),
      holdTime: parseInt(event.holdtime, 10),
      channel: event.channel,
      uniqueId: event.uniqueid,
      timestamp: Date.now()
    };
    
    // Remover da lista de chamadas na fila
    const queueCalls = this.queueCalls.get(event.queue) || [];
    const updatedQueueCalls = queueCalls.filter(call => call.uniqueId !== event.uniqueid);
    this.queueCalls.set(event.queue, updatedQueueCalls);
    
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      queueStat.abandoned++;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'QueueCallerAbandon',
        call: queueEvent
      }
    });
    
    // Adicionar ao histórico de chamadas
    this.callHistory.push(queueEvent);
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueMemberAdded(event: any) {
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      queueStat.agents++;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Atualizar associação de agente-fila
    const agentId = event.interface;
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      if (!agent.queues.includes(event.queue)) {
        agent.queues.push(event.queue);
        this.agentStats.set(agentId, agent);
      }
    }
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueMemberRemoved(event: any) {
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      queueStat.agents--;
      if (queueStat.agents < 0) queueStat.agents = 0;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Atualizar associação de agente-fila
    const agentId = event.interface;
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      agent.queues = agent.queues.filter(q => q !== event.queue);
      this.agentStats.set(agentId, agent);
    }
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueMemberStatus(event: any) {
    // Atualizar estatísticas do agente
    const agentId = event.interface;
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      agent.status = event.status === '1' ? 'Available' : 
                     event.status === '2' ? 'In Use' : 
                     event.status === '3' ? 'Busy' :
                     event.status === '4' ? 'Invalid' :
                     event.status === '5' ? 'Unavailable' :
                     event.status === '6' ? 'Ringing' :
                     event.status === '7' ? 'Ring+Inuse' :
                     event.status === '8' ? 'On Hold' : 'Unknown';
      
      agent.callsTaken = parseInt(event.callstaken, 10) || agent.callsTaken;
      
      this.agentStats.set(agentId, agent);
    }
    
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      // Recalcular agentes ativos
      queueStat.activeAgents = 0;
      
      this.agentStats.forEach(agent => {
        if (agent.queues.includes(event.queue) && 
            (agent.status === 'Available' || agent.status === 'In Use')) {
          queueStat.activeAgents++;
        }
      });
      
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleQueueMemberPause(event: any) {
    // Atualizar estatísticas do agente
    const agentId = event.interface;
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      if (event.paused === '1') {
        agent.status = 'Paused';
      } else {
        agent.status = 'Available';
      }
      
      this.agentStats.set(agentId, agent);
    }
    
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat && event.paused === '1') {
      queueStat.activeAgents--;
      if (queueStat.activeAgents < 0) queueStat.activeAgents = 0;
      this.queueStats.set(event.queue, queueStat);
    } else if (queueStat && event.paused === '0') {
      queueStat.activeAgents++;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  // Handlers para eventos de chamada
  private handleNewChannel(event: any) {
    const callEvent: CallEvent = {
      event: 'Newchannel',
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      channel: event.channel,
      uniqueId: event.uniqueid,
      timestamp: Date.now()
    };
    
    // Adicionar à lista de chamadas ativas
    this.activeCalls.set(event.uniqueid, callEvent);
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'Newchannel',
        call: callEvent
      }
    });
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleHangup(event: any) {
    // Obter chamada ativa
    const call = this.activeCalls.get(event.uniqueid);
    
    if (call) {
      // Atualizar a chamada
      call.event = 'Hangup';
      call.timestamp = Date.now();
      call.duration = call.timestamp - (call.timestamp || Date.now());
      
      // Remover da lista de chamadas ativas
      this.activeCalls.delete(event.uniqueid);
      
      // Broadcast do evento
      this.broadcastToClients({
        type: 'event',
        data: {
          eventType: 'Hangup',
          call
        }
      });
      
      // Adicionar ao histórico de chamadas
      this.callHistory.push(call);
      
      // Broadcast de estatísticas atualizadas
      this.broadcastStats();
    }
  }
  
  private handleBridge(event: any) {
    // Atualizar chamadas ativas
    const channel1 = event.channel1;
    const channel2 = event.channel2;
    
    this.activeCalls.forEach((call, uniqueId) => {
      if (call.channel === channel1) {
        call.destChannel = channel2;
        call.linkedId = event.linkedid;
        this.activeCalls.set(uniqueId, call);
      } else if (call.channel === channel2) {
        call.destChannel = channel1;
        call.linkedId = event.linkedid;
        this.activeCalls.set(uniqueId, call);
      }
    });
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleUnbridge(event: any) {
    // Nada específico a fazer, apenas broadcast
    this.broadcastStats();
  }
  
  private handleAgentConnect(event: any) {
    const queueEvent: CallEvent = {
      event: 'AgentConnect',
      queue: event.queue,
      member: event.member,
      memberName: event.membername,
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      channel: event.channel,
      uniqueId: event.uniqueid,
      agentId: event.member.split('/').pop(),
      queueName: event.queue,
      holdTime: parseInt(event.holdtime, 10) || 0,
      timestamp: Date.now()
    };
    
    // Atualizar estatísticas do agente
    const agentId = queueEvent.agentId || '';
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      agent.status = 'In Use';
      agent.callsTaken++;
      this.agentStats.set(agentId, agent);
    }
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'AgentConnect',
        call: queueEvent
      }
    });
    
    // Adicionar ao histórico de chamadas
    this.callHistory.push(queueEvent);
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  private handleAgentComplete(event: any) {
    const queueEvent: CallEvent = {
      event: 'AgentComplete',
      queue: event.queue,
      member: event.member,
      memberName: event.membername,
      callerId: event.calleridnum,
      callerIdName: event.calleridname,
      channel: event.channel,
      uniqueId: event.uniqueid,
      agentId: event.member.split('/').pop(),
      queueName: event.queue,
      holdTime: parseInt(event.holdtime, 10) || 0,
      talkTime: parseInt(event.talktime, 10) || 0,
      timestamp: Date.now()
    };
    
    // Atualizar estatísticas do agente
    const agentId = queueEvent.agentId || '';
    const agent = this.agentStats.get(agentId);
    
    if (agent) {
      agent.status = 'Available';
      agent.totalTalkTime += (queueEvent.talkTime || 0);
      agent.avgTalkTime = Math.round(agent.totalTalkTime / agent.callsTaken);
      this.agentStats.set(agentId, agent);
    }
    
    // Atualizar estatísticas da fila
    const queueStat = this.queueStats.get(event.queue);
    if (queueStat) {
      queueStat.completed++;
      queueStat.avgTalkTime = (queueStat.avgTalkTime * (queueStat.completed - 1) + (queueEvent.talkTime || 0)) / queueStat.completed;
      this.queueStats.set(event.queue, queueStat);
    }
    
    // Broadcast do evento
    this.broadcastToClients({
      type: 'event',
      data: {
        eventType: 'AgentComplete',
        call: queueEvent
      }
    });
    
    // Adicionar ao histórico de chamadas
    this.callHistory.push(queueEvent);
    
    // Broadcast de estatísticas atualizadas
    this.broadcastStats();
  }
  
  // Limpar recursos ao fechar
  // Método para testar a conexão sem estabelecer uma conexão permanente
  async testConnection(host: string, port: number, username: string, password: string): Promise<{success: boolean, message?: string}> {
    try {
      console.log(`Tentando testar conexão com Asterisk AMI: ${host}:${port} (usuário: ${username})`);
      
      // Primeiro, vamos fazer um teste TCP básico para verificar se o servidor está acessível
      const tcpTestResult = await this.testTCPConnection(host, port);
      if (!tcpTestResult.success) {
        console.log('Teste TCP falhou:', tcpTestResult.message);
        return tcpTestResult;
      }
      
      console.log('Teste TCP bem-sucedido, tentando autenticação AMI...');
      
      // Se o teste TCP for bem-sucedido, vamos tentar a autenticação AMI
      return new Promise((resolve) => {
        try {
          // Criar uma instância temporária do cliente apenas para o teste
          console.log('Criando cliente AMI...');
          
          const testClient = new AsteriskAmiClient();
          console.log('Cliente AMI criado com sucesso');
          
          // Configurar timeout
          const connectionTimeout = setTimeout(() => {
            console.log('Timeout atingido durante tentativa de autenticação AMI');
            try {
              testClient.disconnect();
            } catch (e) {
              console.error('Erro ao desconectar cliente após timeout:', e);
            }
            resolve({
              success: false,
              message: `Timeout ao tentar autenticar no servidor ${host}:${port} após 10 segundos.`
            });
          }, 10000); // 10 segundos de timeout
          
          // Configurar handlers de eventos
          testClient.on('connect', () => {
            console.log(`Conexão TCP estabelecida com ${host}:${port} via cliente AMI`);
            // A conexão foi estabelecida, mas ainda precisamos autenticar
          });
          
          testClient.on('login', () => {
            console.log(`Autenticação AMI bem-sucedida com ${host}:${port}`);
            clearTimeout(connectionTimeout);
            try {
              testClient.disconnect();
            } catch (e) {
              console.error('Erro ao desconectar cliente após login bem-sucedido:', e);
            }
            resolve({
              success: true,
              message: 'Conexão e autenticação bem-sucedidas'
            });
          });
          
          testClient.on('error', (error: any) => {
            console.error('Erro na conexão AMI:', util.inspect(error, { depth: null }));
            clearTimeout(connectionTimeout);
            try {
              testClient.disconnect();
            } catch (e) {
              console.error('Erro ao desconectar cliente após erro:', e);
            }
            
            // Processar mensagens de erro específicas
            let errorMsg = 'Erro ao conectar ao servidor Asterisk';
            
            if (error && typeof error === 'object') {
              const errorStr = String(error);
              console.log('Mensagem de erro completa:', errorStr);
              
              if (errorStr.includes('Authentication') || errorStr.includes('authentication')) {
                errorMsg = 'Falha na autenticação. Verifique o usuário e senha do AMI.';
              } else if (errorStr.includes('ECONNREFUSED')) {
                errorMsg = `Conexão recusada em ${host}:${port}. Verifique se o servidor Asterisk está rodando e a porta está correta.`;
              } else if (errorStr.includes('ETIMEDOUT')) {
                errorMsg = `Timeout ao conectar em ${host}:${port}. Verifique se o servidor é acessível pela rede.`;
              } else if (errorStr.includes('ENOTFOUND')) {
                errorMsg = `Host não encontrado: ${host}. Verifique se o nome ou IP está correto.`;
              } else {
                errorMsg = `Erro na conexão: ${errorStr}`;
              }
            }
            
            resolve({
              success: false,
              message: errorMsg
            });
          });
          
          // Adicionar mais tratamento de erro
          console.log(`Tentando conectar ao AMI em ${host}:${port}...`);
          
          // Tentar conectar
          testClient.connect(username, password, {
            host: host,
            port: port,
            keepAlive: false,
            emitEventsByTypes: true,
            reconnect: false
          }).catch((err: any) => {
            console.error('Erro ao iniciar conexão:', err);
            clearTimeout(connectionTimeout);
            resolve({
              success: false,
              message: `Erro ao iniciar conexão: ${err ? (err.message || String(err)) : 'Erro desconhecido'}`
            });
          });
        } catch (err) {
          console.error('Erro ao criar instância do cliente AMI:', err);
          resolve({
            success: false,
            message: `Erro ao criar cliente AMI: ${err instanceof Error ? err.message : String(err)}`
          });
        }
      });
    } catch (error) {
      console.error('Erro geral no teste de conexão Asterisk:', error);
      return { 
        success: false, 
        message: `Erro no teste de conexão: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  // Método adicional para testar apenas a conectividade TCP
  testTCPConnection(host: string, port: number): Promise<{success: boolean, message?: string, diagnosticInfo?: string}> {
    return new Promise((resolve) => {
      console.log(`Iniciando teste TCP básico para ${host}:${port}...`);
      
      const socket = new net.Socket();
      let timeoutId: NodeJS.Timeout;
      
      // Configurar timeout
      timeoutId = setTimeout(() => {
        socket.destroy();
        console.log(`TCP timeout atingido para ${host}:${port}`);
        
        this.runConnectionDiagnostics(host, port).then(diagnosticInfo => {
          resolve({
            success: false,
            message: `Timeout ao tentar conectar ao servidor ${host}:${port} após 5 segundos. Verifique se o servidor está online e acessível.`,
            diagnosticInfo
          });
        }).catch(err => {
          resolve({
            success: false,
            message: `Timeout ao tentar conectar ao servidor ${host}:${port} após 5 segundos. Verifique se o servidor está online e acessível.`,
            diagnosticInfo: `Erro ao executar diagnóstico adicional: ${err instanceof Error ? err.message : String(err)}`
          });
        });
      }, 5000); // 5 segundos de timeout
      
      // Configurar eventos
      socket.on('connect', () => {
        clearTimeout(timeoutId);
        console.log(`Conexão TCP bem-sucedida para ${host}:${port}`);
        socket.end();
        resolve({
          success: true,
          message: 'Conexão TCP bem-sucedida'
        });
      });
      
      socket.on('error', (err: any) => {
        clearTimeout(timeoutId);
        console.error(`Erro TCP para ${host}:${port}:`, err);
        
        // Gerar mensagem de erro detalhada
        let errorMsg = `Erro ao conectar via TCP: `;
        let detalhes = "";
        
        if (err.code === 'ECONNREFUSED') {
          errorMsg += `Conexão recusada em ${host}:${port}.`;
          detalhes = `O servidor está recusando conexões nesta porta. Causas possíveis:

1. O serviço Asterisk não está em execução
2. O Asterisk Manager Interface (AMI) não está habilitado
3. O AMI está configurado para ouvir apenas em endereços IP específicos
4. A porta AMI configurada é diferente de ${port}
5. Um firewall está bloqueando a conexão

Verifique as configurações do Asterisk no arquivo 'manager.conf':
- O parâmetro 'enabled' deve ser 'yes'
- O parâmetro 'bindaddr' deve permitir conexões externas (0.0.0.0)
- A 'port' deve corresponder ao valor que você está tentando conectar (${port})
- As credenciais de usuário devem ter as permissões corretas`;
        } else if (err.code === 'ETIMEDOUT') {
          errorMsg += `Timeout ao conectar em ${host}:${port}.`;
          detalhes = `O servidor não respondeu a tempo. Causas possíveis:

1. Problemas de rede entre este cliente e o servidor
2. Um firewall está bloqueando silenciosamente as conexões
3. O endereço IP ou hostname está incorreto`;
        } else if (err.code === 'ENOTFOUND') {
          errorMsg += `Host não encontrado: ${host}.`;
          detalhes = `O hostname não pôde ser resolvido para um endereço IP. Verifique se o nome do servidor está correto.`;
        } else {
          errorMsg += `${err.message || String(err)}`;
          detalhes = "Erro não reconhecido. Verifique os logs do servidor para mais detalhes.";
        }
        
        socket.destroy();
        
        // Executar diagnóstico adicional
        this.runConnectionDiagnostics(host, port).then(diagnosticInfo => {
          resolve({
            success: false,
            message: errorMsg,
            diagnosticInfo: detalhes + "\n\n" + diagnosticInfo
          });
        }).catch(diagErr => {
          resolve({
            success: false,
            message: errorMsg,
            diagnosticInfo: detalhes + "\n\nErro ao executar diagnóstico adicional: " + (diagErr instanceof Error ? diagErr.message : String(diagErr))
          });
        });
      });
      
      // Tentar conectar
      try {
        console.log(`Conectando socket TCP para ${host}:${port}...`);
        socket.connect(port, host);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error(`Exceção ao conectar socket para ${host}:${port}:`, err);
        socket.destroy();
        
        this.runConnectionDiagnostics(host, port).then(diagnosticInfo => {
          resolve({
            success: false,
            message: `Exceção ao conectar: ${err instanceof Error ? err.message : String(err)}`,
            diagnosticInfo
          });
        }).catch(diagErr => {
          resolve({
            success: false,
            message: `Exceção ao conectar: ${err instanceof Error ? err.message : String(err)}`,
            diagnosticInfo: `Erro ao executar diagnóstico adicional: ${diagErr instanceof Error ? diagErr.message : String(diagErr)}`
          });
        });
      }
    });
  }
  
  // Método para diagnóstico avançado da conexão Asterisk
  async runConnectionDiagnostics(host: string, port: number): Promise<string> {
    console.log(`Executando diagnóstico avançado para ${host}:${port}...`);
    
    let diagnosticInfo = "## Diagnóstico de Conexão Asterisk\n\n";
    
    try {
      // Verificar portas alternativas comuns para Asterisk AMI
      const portasAlternativas = [5039, 5037, 8088, 8089];
      let portaAlternativaEncontrada = false;
      let portaSugerida = 0;
      
      // Verificar resolução DNS
      try {
        // Usar NodeJS DNS para resolver o hostname
        const dns = require('dns');
        const { promisify } = require('util');
        const lookup = promisify(dns.lookup);
        
        const resultado = await lookup(host);
        diagnosticInfo += `* Resolução DNS: ${host} => ${resultado.address}\n`;
      } catch (dnsErr) {
        diagnosticInfo += `* Resolução DNS: Falhou - ${dnsErr instanceof Error ? dnsErr.message : String(dnsErr)}\n`;
      }
      
      // Verificar portas alternativas
      diagnosticInfo += `* Porta principal ${port}: FALHA - Conexão recusada\n`;
      
      for (const portaAlternativa of portasAlternativas) {
        if (portaAlternativa === port) continue;
        
        try {
          console.log(`Verificando porta alternativa ${portaAlternativa}...`);
          
          const testResult = await new Promise<boolean>((resolve) => {
            const testSocket = new net.Socket();
            let testTimeoutId: NodeJS.Timeout;
            
            testSocket.on('connect', () => {
              clearTimeout(testTimeoutId);
              testSocket.destroy();
              resolve(true);
            });
            
            testSocket.on('error', () => {
              clearTimeout(testTimeoutId);
              testSocket.destroy();
              resolve(false);
            });
            
            testTimeoutId = setTimeout(() => {
              testSocket.destroy();
              resolve(false);
            }, 2000);
            
            testSocket.connect(portaAlternativa, host);
          });
          
          if (testResult) {
            diagnosticInfo += `* Porta alternativa ${portaAlternativa}: DISPONÍVEL - Tente usar esta porta!\n`;
            portaAlternativaEncontrada = true;
            portaSugerida = portaAlternativa;
          } else {
            diagnosticInfo += `* Porta alternativa ${portaAlternativa}: FECHADA\n`;
          }
        } catch (err) {
          diagnosticInfo += `* Porta alternativa ${portaAlternativa}: ERRO - ${err instanceof Error ? err.message : String(err)}\n`;
        }
      }
      
      diagnosticInfo += "\n";
      
      // Adicionar recomendações com base nos resultados
      if (portaAlternativaEncontrada) {
        diagnosticInfo += `### Porta alternativa encontrada!\n`;
        diagnosticInfo += `Parece que o servidor Asterisk pode estar rodando na porta ${portaSugerida} em vez da porta padrão ${port}.\n`;
        diagnosticInfo += `Recomendação: Tente conectar usando a porta ${portaSugerida} em vez de ${port}.\n\n`;
      }
      
      // Adicionar recomendações gerais
      diagnosticInfo += "### Recomendações para resolver o problema:\n\n";
      diagnosticInfo += "1. **Verifique o arquivo `manager.conf` no servidor Asterisk**\n";
      diagnosticInfo += "   - Certifique-se que `enabled = yes`\n";
      diagnosticInfo += "   - Verifique a porta configurada em `port = 5038`\n";
      diagnosticInfo += "   - Certifique-se que `bindaddr = 0.0.0.0` para permitir conexões externas\n\n";
      
      diagnosticInfo += "2. **Verifique o firewall do servidor**\n";
      diagnosticInfo += "   - A porta 5038 (ou a porta configurada) precisa estar aberta para conexões TCP\n";
      diagnosticInfo += "   - Execute `sudo ufw status` ou `sudo iptables -L` para verificar regras de firewall\n\n";
      
      diagnosticInfo += "3. **Verifique se o serviço Asterisk está rodando**\n";
      diagnosticInfo += "   - No servidor, execute `sudo systemctl status asterisk` ou `sudo service asterisk status`\n";
      diagnosticInfo += "   - Se não estiver rodando, inicie com `sudo systemctl start asterisk`\n\n";
      
      diagnosticInfo += "4. **Verifique a configuração de usuário no AMI**\n";
      diagnosticInfo += "   - O usuário deve ter as permissões corretas configuradas\n";
      diagnosticInfo += "   - A senha deve corresponder exatamente à configurada no servidor\n\n";
      
      return diagnosticInfo;
    } catch (error) {
      console.error("Erro ao executar diagnóstico de conexão:", error);
      return `Erro ao executar diagnóstico: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  close() {
    if (this.client) {
      this.client.disconnect();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.connected = false;
  }
  
  // Tentar reconectar usando as últimas configurações salvas
  async reconnect(): Promise<boolean> {
    if (this.connectionSettings) {
      console.log('Tentando reconectar usando as configurações salvas...');
      const { host, port, username, password } = this.connectionSettings;
      return await this.connect(host, port, username, password);
    } else {
      console.log('Não há configurações salvas para reconexão');
      return false;
    }
  }
}

// Instância única do gerenciador Asterisk AMI
export const asteriskAMIManager = new AsteriskAMIManager();

export default asteriskAMIManager;