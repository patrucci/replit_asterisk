import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupAsteriskRoutes } from "./asterisk-routes";
import { setupQueueRoutes } from "./queue-routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { 
  insertClientSchema, 
  insertAppointmentSchema, 
  insertPaymentSchema, 
  insertMessageSchema, 
  insertCallSchema 
} from "@shared/schema";
import { generateMessageSuggestions } from "./openai";
import { 
  generateCallScript, 
  analyzeCallTranscription, 
  generateResponse, 
  formatScriptWithValues,
  asteriskInterface
} from "./asterisk-ai";
import { asteriskAMIManager } from "./asterisk-ami";

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Configuração para armazenamento de arquivos de áudio
const storage_audio = multer.diskStorage({
  destination: (req, file, cb) => {
    // Criar pasta de áudio se não existir
    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    // Garantir nomes de arquivo únicos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Filtro para tipos de arquivo de áudio
const audioFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/gsm', 'audio/x-gsm'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Apenas WAV, MP3 e GSM são permitidos.'));
  }
};

// Configuração do Multer para upload de arquivos
const upload = multer({ 
  storage: storage_audio,
  fileFilter: audioFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB
  }
});

// Interface para arquivos de áudio
interface AudioFile {
  id: string;
  name: string;
  filename: string;
  duration?: number;
  size?: number;
  uploaded: string;
  language?: string;
}

// Armazenamento em memória para arquivos de áudio
// Em uma implementação completa, isso estaria no banco de dados
let audioFiles: AudioFile[] = [];

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Setup Asterisk routes
  setupAsteriskRoutes(app, requireAuth);
  
  // Setup Queue routes
  setupQueueRoutes(app, requireAuth);

  // Client routes
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const clients = await storage.getClients(req.user!.id, req.user!.organizationId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(Number(req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this client" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.id);
      const existingClient = await storage.getClient(clientId);
      
      if (!existingClient) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (existingClient.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this client" });
      }
      
      const validatedData = insertClientSchema.partial().parse(req.body);
      const updatedClient = await storage.updateClient(clientId, validatedData);
      res.json(updatedClient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.id);
      const existingClient = await storage.getClient(clientId);
      
      if (!existingClient) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (existingClient.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this client" });
      }
      
      const success = await storage.deleteClient(clientId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete client" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Appointment routes
  app.get("/api/appointments", requireAuth, async (req, res) => {
    try {
      const appointments = await storage.getAppointments(req.user!.id, req.user!.organizationId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAppointmentSchema.parse({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      const appointment = await storage.createAppointment(validatedData);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.put("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const existingAppointment = await storage.getAppointment(appointmentId);
      
      if (!existingAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      if (existingAppointment.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this appointment" });
      }
      
      const validatedData = insertAppointmentSchema.partial().parse(req.body);
      const updatedAppointment = await storage.updateAppointment(appointmentId, validatedData);
      res.json(updatedAppointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const existingAppointment = await storage.getAppointment(appointmentId);
      
      if (!existingAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      if (existingAppointment.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this appointment" });
      }
      
      const success = await storage.deleteAppointment(appointmentId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete appointment" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  // Payment routes
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPayments(req.user!.id, req.user!.organizationId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.put("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const existingPayment = await storage.getPayment(paymentId);
      
      if (!existingPayment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      if (existingPayment.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this payment" });
      }
      
      const validatedData = insertPaymentSchema.partial().parse(req.body);
      const updatedPayment = await storage.updatePayment(paymentId, validatedData);
      res.json(updatedPayment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const existingPayment = await storage.getPayment(paymentId);
      
      if (!existingPayment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      if (existingPayment.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this payment" });
      }
      
      const success = await storage.deletePayment(paymentId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete payment" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment" });
    }
  });

  // Message routes
  app.get("/api/clients/:clientId/messages", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const client = await storage.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access messages for this client" });
      }
      
      const messages = await storage.getMessages(clientId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/clients/:clientId/messages", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const client = await storage.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to send messages to this client" });
      }
      
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        clientId,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        isFromClient: false,
      });
      
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Simulated call tracking
  app.post("/api/clients/:clientId/calls", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const client = await storage.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to log calls for this client" });
      }
      
      const validatedData = insertCallSchema.parse({
        ...req.body,
        clientId,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      
      const call = await storage.createCall(validatedData);
      res.status(201).json(call);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid call data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to log call" });
    }
  });

  // OpenAI integration for message suggestions
  app.post("/api/ai/message-suggestions", requireAuth, async (req, res) => {
    try {
      const { clientId, context } = req.body;
      
      if (!clientId || !context) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const client = await storage.getClient(Number(clientId));
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to generate suggestions for this client" });
      }
      
      const suggestions = await generateMessageSuggestions(client, context);
      res.json({ suggestions });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate message suggestions" });
    }
  });

  // Asterisk AI routes
  
  // Generate call script
  app.post("/api/asterisk/generate-script", requireAuth, async (req, res) => {
    try {
      const { clientId, purpose, appointmentDate, appointmentType, customInstructions, useCustomInstructions } = req.body;
      
      if (!clientId || !purpose) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const client = await storage.getClient(Number(clientId));
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to generate script for this client" });
      }
      
      const script = await generateCallScript({
        client,
        purpose,
        appointmentDate,
        appointmentType,
        customInstructions,
        useCustomInstructions
      });
      
      res.json({ script });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate call script" });
    }
  });
  
  // Make a call with AI
  app.post("/api/asterisk/make-call", requireAuth, async (req, res) => {
    try {
      const { 
        clientId, 
        script, 
        customScript,
        useCustomScript,
        scheduleCall,
        callTime,
        maxAttempts, 
        voiceType,
        purpose
      } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const client = await storage.getClient(Number(clientId));
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (client.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to call this client" });
      }
      
      // In a real implementation, we would schedule the call or initiate it immediately
      // For now, we just return a success response with a call ID
      const callId = `call-${Date.now()}`;
      
      if (scheduleCall) {
        // Simulate scheduling a call for later
        res.json({ 
          success: true, 
          callId,
          message: "Call scheduled successfully",
          scheduledTime: callTime
        });
      } else {
        // Simulate initiating a call immediately
        // This would involve triggering Asterisk to make the call
        res.json({ 
          success: true, 
          callId,
          message: "Call initiated successfully" 
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate call" });
    }
  });
  
  // Get call history
  app.get("/api/asterisk/call-history", requireAuth, async (req, res) => {
    try {
      console.log("Retornando lista vazia de histórico de chamadas");
      
      // Em um ambiente real, buscaríamos o histórico de chamadas do banco de dados
      // Por enquanto, retornamos um array vazio em vez de dados simulados
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar histórico de chamadas" });
    }
  });
  
  // Get call detail
  app.get("/api/asterisk/calls/:callId", requireAuth, async (req, res) => {
    try {
      const { callId } = req.params;
      console.log(`Buscando detalhes da chamada ${callId}`);
      
      // Em um ambiente real, buscaríamos os detalhes da chamada do banco de dados
      // Por enquanto, retornamos 404 para qualquer ID de chamada
      res.status(404).json({ message: "Chamada não encontrada" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar detalhes da chamada" });
    }
  });
  
  // Save Asterisk AI settings
  app.post("/api/asterisk/settings", requireAuth, async (req, res) => {
    try {
      const { 
        enabled, 
        responseTimeout, 
        confidenceThreshold, 
        callAnalysis, 
        transcriptionEnabled,
        defaultVoice,
        speechRate,
        maxCallDuration,
        apiModel
      } = req.body;
      
      // In a real implementation, we would save these settings to a database
      // For this example, we'll just return a success response
      res.json({ 
        success: true, 
        message: "Settings saved successfully",
        settings: {
          enabled,
          responseTimeout,
          confidenceThreshold,
          callAnalysis,
          transcriptionEnabled,
          defaultVoice,
          speechRate,
          maxCallDuration,
          apiModel
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // Rota para configurar a conexão com o Asterisk AMI
  app.post("/api/asterisk/connect", requireAuth, async (req, res) => {
    try {
      const { host, port, username, password } = req.body;
      
      // Validar os dados
      if (!host || !port || !username || !password) {
        return res.status(400).json({ 
          success: false,
          message: "Todos os campos são obrigatórios" 
        });
      }
      
      console.log(`Tentando conectar ao AMI: ${host}:${port} com usuário ${username}...`);

      // Converter porta para número
      const portNumber = parseInt(port, 10);
      
      // Tentar estabelecer uma conexão com o AMI
      try {
        // Primeiro testar a conexão usando o método testConnection
        const testResult = await asteriskAMIManager.testConnection(host, portNumber, username, password);
        
        if (!testResult.success) {
          console.log('Teste de conexão falhou:', testResult.message);
          return res.status(400).json({
            success: false,
            message: `Não foi possível conectar ao servidor Asterisk em ${host}:${portNumber}`,
            details: testResult.message || "Falha na conexão com o servidor Asterisk."
          });
        }
        
        // Se o teste passou, tentar conectar
        await asteriskAMIManager.connect(host, portNumber, username, password);
        
        // Salvar as credenciais do Asterisk no banco de dados se necessário
        // TODO: Implementar salvamento das credenciais
        
        return res.status(200).json({
          success: true,
          message: "Conectado com sucesso ao servidor Asterisk",
          host: host,
          port: portNumber,
          username: username
        });
      } catch (connectionError) {
        console.error('Erro específico de conexão:', connectionError);
        return res.status(400).json({ 
          success: false, 
          message: `Não foi possível conectar ao servidor Asterisk em ${host}:${portNumber}`, 
          details: connectionError instanceof Error ? 
            connectionError.message : 
            "Aparentemente a conexão com o servidor Asterisk não está funcionando corretamente. Por favor, verifique se o servidor Asterisk está acessível na rede e se as credenciais estão corretas."
        });
      }
    } catch (error) {
      console.error('Erro ao conectar com Asterisk:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao conectar com o Asterisk",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Rota para verificar o status da conexão Asterisk
  app.get("/api/asterisk/status", requireAuth, async (req, res) => {
    try {
      let settings;
      try {
        settings = await storage.getAsteriskSettings(req.user!.organizationId);
      } catch (dbError) {
        console.error("Erro ao obter configurações do Asterisk:", dbError);
      }
      
      // Verificar se o asteriskAMIManager está conectado
      const isConnected = asteriskAMIManager.isConnected();
      
      return res.json({
        connected: isConnected,
        configured: !!settings,
        host: settings?.host,
        port: settings?.port,
        username: settings?.username,
        message: isConnected ? "Conectado ao Asterisk AMI" : "Desconectado do Asterisk AMI"
      });
    } catch (error) {
      console.error('Erro ao verificar status do Asterisk:', error);
      return res.status(500).json({ message: "Erro ao verificar status do Asterisk" });
    }
  });
  
  // Rota para obter estatísticas de filas
  app.get("/api/asterisk/queues", requireAuth, async (req, res) => {
    try {
      // Primeiro, vamos buscar filas reais do banco de dados
      const organizationId = req.user!.organizationId;
      console.log("Buscando filas do banco de dados para organização:", organizationId);
      
      try {
        const dbQueues = await storage.getQueues(organizationId);
        console.log("Filas encontradas no banco de dados:", dbQueues.length);
        
        if (dbQueues && dbQueues.length > 0) {
          // Mapear filas do banco de dados para o formato esperado pela interface
          const mappedQueues = dbQueues.map(queue => {
            return {
              queueId: queue.id.toString(),
              name: queue.name,
              strategy: queue.strategy || "ringall",
              calls: 0, // Sem chamadas simuladas
              completed: 0, // Sem chamadas completadas simuladas
              abandoned: 0, // Sem chamadas abandonadas simuladas
              serviceLevel: 0, // Sem dados de SLA simulados
              avgWaitTime: 0, // Sem tempo de espera médio simulado
              avgTalkTime: 0, // Sem tempo de conversa médio simulado
              maxWaitTime: queue.maxWaitTime || 0,
              agents: 0, // Valor será atualizado com agentes reais do banco
              activeAgents: 0 // Valor será atualizado com agentes ativos reais
            };
          });
          
          return res.json(mappedQueues);
        }
      } catch (dbError) {
        console.error("Erro ao buscar filas do banco de dados:", dbError);
      }
      
      // Se chegou aqui, não conseguiu buscar do banco ou não tem dados
      if (asteriskAMIManager.isConnected()) {
        console.log("Usando dados do Asterisk AMI");
        const queues = Array.from(asteriskAMIManager.getQueueStats().values());
        return res.json(queues);
      } else {
        console.log("Retornando lista vazia de filas quando não há conexão com Asterisk");
        // Retornar um array vazio se não houver conexão com Asterisk
        return res.json([]);
      }
    } catch (error) {
      console.error('Erro ao obter filas:', error);
      return res.status(500).json({ message: "Erro ao obter filas" });
    }
  });
  
  // Rota para obter estatísticas de agentes
  app.get("/api/asterisk/agents", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      console.log("Buscando agentes do banco de dados para organização:", organizationId);

      try {
        const dbAgents = await storage.getAgents(organizationId);
        console.log("Encontrados", dbAgents.length, "agentes no banco de dados");

        if (dbAgents && dbAgents.length > 0) {
          // Mapear os agentes do banco de dados para o formato esperado pela interface
          const mappedAgents = dbAgents.map(agent => {
            return {
              agentId: agent.id.toString(),
              name: agent.name,
              extension: agent.extension,
              status: agent.status,
              lastCall: null, // Sem chamada recente real
              callsTaken: 0, // Sem chamadas atendidas simuladas
              callsAbandoned: 0, // Sem chamadas abandonadas simuladas
              avgTalkTime: 0, // Sem tempo médio de conversa simulado
              totalTalkTime: 0, // Sem tempo total de conversa simulado
              pauseTime: agent.status === 'paused' ? 0 : 0, // Sem tempo de pausa simulado
              loginTime: new Date().toISOString(), // Hora atual como login time
              queues: [] // Lista vazia de filas associadas
            };
          });
          
          return res.json(mappedAgents);
        }
      } catch (dbError) {
        console.error("Erro ao buscar agentes do banco de dados:", dbError);
      }

      // Se chegou aqui, não conseguiu buscar do banco ou não tem dados
      // Mesmo se o Asterisk estiver conectado, não queremos obter agentes simulados
      console.log("Apenas retornando os agentes do banco de dados");
      
      // Já estamos buscando os agentes do banco de dados e retornando-os acima,
      // então se chegou aqui, significa que não temos agentes do banco de dados
      // ou houve algum erro ao recuperá-los. Nesse caso, retornamos um array vazio.
      return res.json([]);
    } catch (error) {
      console.error('Erro ao obter agentes:', error);
      return res.status(500).json({ message: "Erro ao obter agentes" });
    }
  });
  
  // Rota para controlar o status de agentes
  app.post("/api/asterisk/agent/pause", requireAuth, async (req, res) => {
    try {
      const { agentId, reason } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ message: "ID do agente é obrigatório" });
      }
      
      await asteriskAMIManager.pauseAgent(agentId, reason || "Pausa via ProConnect CRM");
      return res.json({ success: true, message: "Agente pausado com sucesso" });
    } catch (error) {
      console.error('Erro ao pausar agente:', error);
      return res.status(500).json({ message: "Erro ao pausar agente" });
    }
  });
  
  app.post("/api/asterisk/agent/unpause", requireAuth, async (req, res) => {
    try {
      const { agentId } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ message: "ID do agente é obrigatório" });
      }
      
      await asteriskAMIManager.unpauseAgent(agentId);
      return res.json({ success: true, message: "Agente retomado com sucesso" });
    } catch (error) {
      console.error('Erro ao retomar agente:', error);
      return res.status(500).json({ message: "Erro ao retomar agente" });
    }
  });
  
  // Rota para obter chamadas em fila simuladas
  app.get("/api/asterisk/queue-calls", requireAuth, async (req, res) => {
    try {
      console.log("Retornando lista vazia de chamadas em fila");
      
      // Retornar array vazio - nenhuma chamada em fila
      return res.json([]);
    } catch (error) {
      console.error('Erro ao obter chamadas em fila:', error);
      return res.status(500).json({ message: "Erro ao obter chamadas em fila" });
    }
  });
  
  // Rota para obter chamadas ativas
  app.get("/api/asterisk/active-calls", requireAuth, async (req, res) => {
    try {
      console.log("Retornando lista vazia de chamadas ativas");
      
      // Retornar array vazio - nenhuma chamada ativa
      return res.json([]);
    } catch (error) {
      console.error('Erro ao obter chamadas ativas:', error);
      return res.status(500).json({ message: "Erro ao obter chamadas ativas" });
    }
  });
  
  // Rota para testar conexão com o Asterisk
  app.post("/api/asterisk/test", requireAuth, async (req, res) => {
    try {
      const { host, port, username, password } = req.body;
      
      // Validar os dados
      if (!host || !port || !username || !password) {
        return res.status(400).json({ 
          success: false,
          message: "Todos os campos são obrigatórios" 
        });
      }
      
      // Usar o método específico de teste de conexão
      const result = await asteriskAMIManager.testConnection(host, port, username, password);
      
      if (result.success) {
        return res.json({ 
          success: true, 
          message: "Teste de conexão com o Asterisk AMI bem-sucedido" 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: result.message || "Não foi possível estabelecer conexão com o Asterisk AMI" 
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão com Asterisk:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      return res.status(500).json({ 
        success: false, 
        message: `Erro ao testar conexão com Asterisk: ${errorMessage}` 
      });
    }
  });
  
  // API para gerenciamento de arquivos de áudio para IVR
  
  // Listar arquivos de áudio
  app.get("/api/asterisk/audio", requireAuth, async (req, res) => {
    try {
      // Em uma implementação completa, esses arquivos seriam filtrados por organizationId
      res.json(audioFiles);
    } catch (error) {
      console.error("Erro ao listar arquivos de áudio:", error);
      res.status(500).json({ 
        error: "Falha ao listar arquivos de áudio",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Upload de arquivo de áudio
  app.post("/api/asterisk/audio", requireAuth, upload.single('audioFile'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
      }
      
      const file = req.file;
      const name = req.body.name || path.basename(file.originalname, path.extname(file.originalname));
      
      // Criar registro para o arquivo de áudio
      const audioFile: AudioFile = {
        id: uuidv4(),
        name: name,
        filename: file.filename,
        size: file.size,
        uploaded: new Date().toISOString(),
        language: req.body.language || "pt-BR"
      };
      
      // Adicionar ao array de arquivos
      audioFiles.push(audioFile);
      
      res.status(201).json(audioFile);
    } catch (error) {
      console.error("Erro ao fazer upload de arquivo de áudio:", error);
      res.status(500).json({ 
        error: "Falha ao processar o upload do arquivo de áudio",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Armazenamento do plano de discagem em memória (temporário)
  // Em uma implementação completa, isso estaria no banco de dados
  let dialPlanSteps: any[] = [];
  
  // Rota para obter o plano de discagem
  app.get("/api/asterisk/dialplan", requireAuth, async (req, res) => {
    try {
      console.log("Retornando plano de discagem");
      res.json(dialPlanSteps);
    } catch (error) {
      console.error("Erro ao obter plano de discagem:", error);
      res.status(500).json({ 
        error: "Falha ao obter plano de discagem",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Rota para salvar o plano de discagem
  app.post("/api/asterisk/dialplan", requireAuth, async (req, res) => {
    try {
      console.log("Salvando plano de discagem:", JSON.stringify(req.body));
      
      // Validar se steps está presente
      if (!req.body.steps && !Array.isArray(req.body)) {
        return res.status(400).json({ 
          error: "Formato inválido",
          message: "O plano de discagem deve ser um array de passos"
        });
      }
      
      // Atualizar o plano de discagem em memória
      dialPlanSteps = Array.isArray(req.body) ? req.body : req.body.steps;
      
      res.status(200).json({ 
        success: true,
        message: "Plano de discagem salvo com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao salvar plano de discagem:", error);
      res.status(500).json({ 
        error: "Falha ao salvar plano de discagem",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Excluir arquivo de áudio
  app.delete("/api/asterisk/audio/:id", requireAuth, (req, res) => {
    try {
      const fileId = req.params.id;
      const fileIndex = audioFiles.findIndex(file => file.id === fileId);
      
      if (fileIndex === -1) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }
      
      const file = audioFiles[fileIndex];
      
      // Remover o arquivo físico
      const filePath = path.join(process.cwd(), 'uploads', 'audio', file.filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Remover do array
      audioFiles.splice(fileIndex, 1);
      
      res.status(200).json({ success: true, message: "Arquivo removido com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir arquivo de áudio:", error);
      res.status(500).json({ 
        error: "Falha ao excluir o arquivo de áudio",
        message: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  const httpServer = createServer(app);
  
  // Configurar WebSocket para Asterisk AMI
  try {
    // Inicializar conexão com Asterisk AMI
    asteriskAMIManager.setupWebsocket(httpServer, '/queue-events');
    
    // Tentar carregar e conectar com configurações salvas
    const organizationId = 1; // Organização padrão
    storage.getAsteriskSettings(organizationId)
      .then(settings => {
        if (settings && settings.host && settings.port && settings.username && settings.password) {
          asteriskAMIManager.connect(
            settings.host,
            settings.port,
            settings.username,
            settings.password
          ).then(connected => {
            if (connected) {
              console.log('Conectado automaticamente ao Asterisk AMI com as configurações salvas');
            }
          }).catch(err => {
            console.error('Erro ao conectar automaticamente ao Asterisk AMI:', err);
          });
        }
      })
      .catch(err => {
        console.error('Erro ao buscar configurações do Asterisk:', err);
      });
    
    console.log('WebSocket para Asterisk AMI configurado em /queue-events');
  } catch (error) {
    console.error('Erro ao configurar WebSocket para Asterisk AMI:', error);
  }
  
  return httpServer;
}
