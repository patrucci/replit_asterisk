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
        await this.client.connect(host, port, username, password, {
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
  setupWebsocket(server: Server, path: string = '/queue-events') {
    this.wss = new WebSocketServer({ server, path });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Nova conexão WebSocket');
      this.clients.add(ws);
      
      // Enviar estatísticas atuais para o novo cliente
      this.sendStatsToClient(ws);
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          
          // Processar comandos do cliente
          if (data.command === 'getStats') {
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
    ws.send(JSON.stringify({
      type: 'stats',
      data: {
        agents: Array.from(this.agentStats.values()),
        queues: Array.from(this.queueStats.values()),
        activeCalls: Array.from(this.activeCalls.values()),
        callsInQueue: this.getCallsInQueue()
      }
    }));
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
          const AmiClient = require('asterisk-ami-client');
          console.log('Criando cliente AMI...');
          
          const testClient = new AmiClient();
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
          testClient.connect(host, port, username, password, {
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
  private testTCPConnection(host: string, port: number): Promise<{success: boolean, message?: string}> {
    return new Promise((resolve) => {
      console.log(`Iniciando teste TCP básico para ${host}:${port}...`);
      
      const socket = new net.Socket();
      let timeoutId: NodeJS.Timeout;
      
      // Configurar timeout
      timeoutId = setTimeout(() => {
        socket.destroy();
        console.log(`TCP timeout atingido para ${host}:${port}`);
        resolve({
          success: false,
          message: `Timeout ao tentar conectar ao servidor ${host}:${port} após 5 segundos. Verifique se o servidor está online e acessível.`
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
        
        let errorMsg = `Erro ao conectar via TCP: `;
        if (err.code === 'ECONNREFUSED') {
          errorMsg += `Conexão recusada em ${host}:${port}. Verifique se o servidor está rodando e a porta está correta.`;
        } else if (err.code === 'ETIMEDOUT') {
          errorMsg += `Timeout ao conectar em ${host}:${port}. Verifique se o servidor é acessível pela rede.`;
        } else if (err.code === 'ENOTFOUND') {
          errorMsg += `Host não encontrado: ${host}. Verifique se o nome ou IP está correto.`;
        } else {
          errorMsg += `${err.message || String(err)}`;
        }
        
        socket.destroy();
        resolve({
          success: false,
          message: errorMsg
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
        resolve({
          success: false,
          message: `Exceção ao conectar: ${err instanceof Error ? err.message : String(err)}`
        });
      }
    });
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
}

// Instância única do gerenciador Asterisk AMI
export const asteriskAMIManager = new AsteriskAMIManager();

export default asteriskAMIManager;