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
      // In a real implementation, we would fetch real call history from a database
      // For this example, we'll just return a mock response
      res.json([
        {
          id: "call1",
          clientName: "João Silva",
          clientPhone: "(11) 99123-4567",
          callDate: "2025-05-10 14:30",
          duration: "2:45",
          purpose: "Agendamento",
          status: "completed",
          recording: "call_joao_20250510.mp3",
          transcription: "Transcrição da conversa com João...",
          analysis: {
            sentiment: "positive",
            nextSteps: ["Confirmar consulta um dia antes", "Preparar documentação"],
            keyInsights: ["Cliente prefere horários pela manhã", "Mencionou dor nas costas"]
          }
        },
        {
          id: "call2",
          clientName: "Maria Oliveira",
          clientPhone: "(21) 98765-4321",
          callDate: "2025-05-11 10:15",
          duration: "3:20",
          purpose: "Confirmação",
          status: "completed",
          recording: "call_maria_20250511.mp3",
          analysis: {
            sentiment: "neutral",
            nextSteps: ["Enviar lembretes adicionais"],
            keyInsights: ["Cliente confirmou presença com ressalvas", "Pode se atrasar"]
          }
        }
      ]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch call history" });
    }
  });
  
  // Get call detail
  app.get("/api/asterisk/calls/:callId", requireAuth, async (req, res) => {
    try {
      const { callId } = req.params;
      
      // In a real implementation, we would fetch the call details from a database
      // For this example, we'll just return a mock response based on the call ID
      if (callId === "call1") {
        res.json({
          id: "call1",
          clientName: "João Silva",
          clientPhone: "(11) 99123-4567",
          callDate: "2025-05-10 14:30",
          duration: "2:45",
          purpose: "Agendamento",
          status: "completed",
          recording: "call_joao_20250510.mp3",
          transcription: "Transcrição da conversa com João...",
          analysis: {
            sentiment: "positive",
            nextSteps: ["Confirmar consulta um dia antes", "Preparar documentação"],
            keyInsights: ["Cliente prefere horários pela manhã", "Mencionou dor nas costas"]
          }
        });
      } else {
        res.status(404).json({ message: "Call not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch call details" });
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
      if (!asteriskAMIManager.isConnected()) {
        console.log("[SIMULAÇÃO] Retornando filas simuladas");
        // Dados simulados para teste
        const simulatedQueues = [
          {
            queueId: "queue1",
            name: "suporte",
            strategy: "leastrecent",
            calls: Math.floor(Math.random() * 10),
            completed: Math.floor(Math.random() * 50),
            abandoned: Math.floor(Math.random() * 10),
            serviceLevel: 80,
            avgWaitTime: Math.floor(Math.random() * 120 + 30),
            avgTalkTime: Math.floor(Math.random() * 300 + 120),
            maxWaitTime: Math.floor(Math.random() * 300 + 60),
            agents: 3,
            activeAgents: Math.floor(Math.random() * 3 + 1)
          },
          {
            queueId: "queue2",
            name: "vendas",
            strategy: "ringall",
            calls: Math.floor(Math.random() * 15),
            completed: Math.floor(Math.random() * 80),
            abandoned: Math.floor(Math.random() * 15),
            serviceLevel: 75,
            avgWaitTime: Math.floor(Math.random() * 150 + 45),
            avgTalkTime: Math.floor(Math.random() * 400 + 180),
            maxWaitTime: Math.floor(Math.random() * 400 + 120),
            agents: 5,
            activeAgents: Math.floor(Math.random() * 4 + 2)
          },
          {
            queueId: "queue3",
            name: "financeiro",
            strategy: "random",
            calls: Math.floor(Math.random() * 5),
            completed: Math.floor(Math.random() * 30),
            abandoned: Math.floor(Math.random() * 5),
            serviceLevel: 90,
            avgWaitTime: Math.floor(Math.random() * 90 + 20),
            avgTalkTime: Math.floor(Math.random() * 250 + 100),
            maxWaitTime: Math.floor(Math.random() * 200 + 40),
            agents: 2,
            activeAgents: Math.floor(Math.random() * 2 + 1)
          }
        ];
        return res.json(simulatedQueues);
      }
      
      const queues = Array.from(asteriskAMIManager.getQueueStats().values());
      return res.json(queues);
    } catch (error) {
      console.error('Erro ao obter filas:', error);
      return res.status(500).json({ message: "Erro ao obter filas" });
    }
  });
  
  // Rota para obter estatísticas de agentes
  app.get("/api/asterisk/agents", requireAuth, async (req, res) => {
    try {
      if (!asteriskAMIManager.isConnected()) {
        console.log("[SIMULAÇÃO] Retornando agentes simulados");
        // Dados simulados para teste
        const simulatedAgents = [
          {
            agentId: "agent1",
            name: "João Silva",
            status: ["available", "busy", "paused"][Math.floor(Math.random() * 3)],
            lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            callsTaken: Math.floor(Math.random() * 20),
            callsAbandoned: Math.floor(Math.random() * 5),
            avgTalkTime: Math.floor(120 + Math.random() * 180),
            totalTalkTime: Math.floor(1800 + Math.random() * 3600),
            pauseTime: Math.floor(Math.random() * 1200),
            loginTime: new Date(Date.now() - Math.random() * 28800000).toISOString(),
            queues: ["queue1", "queue2"]
          },
          {
            agentId: "agent2",
            name: "Maria Santos",
            status: ["available", "busy", "paused"][Math.floor(Math.random() * 3)],
            lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            callsTaken: Math.floor(Math.random() * 20),
            callsAbandoned: Math.floor(Math.random() * 5),
            avgTalkTime: Math.floor(120 + Math.random() * 180),
            totalTalkTime: Math.floor(1800 + Math.random() * 3600),
            pauseTime: Math.floor(Math.random() * 1200),
            loginTime: new Date(Date.now() - Math.random() * 28800000).toISOString(),
            queues: ["queue1", "queue3"]
          },
          {
            agentId: "agent3",
            name: "Carlos Oliveira",
            status: ["available", "busy", "paused"][Math.floor(Math.random() * 3)],
            lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            callsTaken: Math.floor(Math.random() * 20),
            callsAbandoned: Math.floor(Math.random() * 5),
            avgTalkTime: Math.floor(120 + Math.random() * 180),
            totalTalkTime: Math.floor(1800 + Math.random() * 3600),
            pauseTime: Math.floor(Math.random() * 1200),
            loginTime: new Date(Date.now() - Math.random() * 28800000).toISOString(),
            queues: ["queue2", "queue3"]
          },
          {
            agentId: "agent4",
            name: "Ana Pereira",
            status: ["available", "busy", "paused"][Math.floor(Math.random() * 3)],
            lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            callsTaken: Math.floor(Math.random() * 20),
            callsAbandoned: Math.floor(Math.random() * 5),
            avgTalkTime: Math.floor(120 + Math.random() * 180),
            totalTalkTime: Math.floor(1800 + Math.random() * 3600),
            pauseTime: Math.floor(Math.random() * 1200),
            loginTime: new Date(Date.now() - Math.random() * 28800000).toISOString(),
            queues: ["queue1", "queue2", "queue3"]
          }
        ];
        return res.json(simulatedAgents);
      }
      
      const agents = Array.from(asteriskAMIManager.getAgentStats().values());
      return res.json(agents);
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
      if (!asteriskAMIManager.isConnected()) {
        console.log("[SIMULAÇÃO] Retornando chamadas em fila simuladas");
        
        // Dados simulados de chamadas em fila
        const simulatedCalls = [];
        
        // Gerar entre 0 e 5 chamadas simuladas aleatoriamente
        const callCount = Math.floor(Math.random() * 6);
        
        for (let i = 0; i < callCount; i++) {
          const callerId = `551198765${Math.floor(Math.random() * 10000)}`;
          simulatedCalls.push({
            uniqueId: `call-${Date.now()}-${i}`,
            callerId,
            callerIdName: `Cliente ${i + 1}`,
            queue: `queue${Math.floor(Math.random() * 3) + 1}`,
            position: i + 1,
            waitTime: Math.floor(Math.random() * 300),
            timestamp: Date.now() - Math.floor(Math.random() * 300000)
          });
        }
        
        return res.json(simulatedCalls);
      }
      
      // Dados reais, se disponíveis
      // TODO: Implementar obtenção de chamadas reais quando o Asterisk estiver conectado
      const calls = [];
      return res.json(calls);
    } catch (error) {
      console.error('Erro ao obter chamadas em fila:', error);
      return res.status(500).json({ message: "Erro ao obter chamadas em fila" });
    }
  });
  
  // Rota para obter chamadas ativas simuladas
  app.get("/api/asterisk/active-calls", requireAuth, async (req, res) => {
    try {
      if (!asteriskAMIManager.isConnected()) {
        console.log("[SIMULAÇÃO] Retornando chamadas ativas simuladas");
        
        // Dados simulados de chamadas ativas
        const simulatedActiveCalls = [];
        
        // Gerar entre 0 e 3 chamadas ativas simuladas aleatoriamente
        const callCount = Math.floor(Math.random() * 4);
        
        for (let i = 0; i < callCount; i++) {
          const callerId = `551198765${Math.floor(Math.random() * 10000)}`;
          const agentId = `agent${Math.floor(Math.random() * 4) + 1}`;
          const agentName = ["João Silva", "Maria Santos", "Carlos Oliveira", "Ana Pereira"][parseInt(agentId.slice(-1)) - 1];
          
          simulatedActiveCalls.push({
            uniqueId: `call-${Date.now()}-${i}`,
            callerId,
            callerIdName: `Cliente Ativo ${i + 1}`,
            queue: `queue${Math.floor(Math.random() * 3) + 1}`,
            agentId,
            memberName: agentName,
            timestamp: Date.now() - Math.floor(Math.random() * 300000),
            duration: Math.floor(Math.random() * 600)
          });
        }
        
        return res.json(simulatedActiveCalls);
      }
      
      // Dados reais, se disponíveis
      // TODO: Implementar obtenção de chamadas ativas reais quando o Asterisk estiver conectado
      const calls = [];
      return res.json(calls);
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
