import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
      }
      
      // Tentar conectar ao AMI
      const connected = await asteriskAMIManager.connect(host, parseInt(port), username, password);
      
      if (connected) {
        // Salvar as configurações no banco de dados
        try {
          const settings = await storage.getAsteriskSettings(req.user!.organizationId);
          
          if (settings) {
            await storage.updateAsteriskSettings(req.user!.organizationId, {
              host,
              port: parseInt(port),
              username,
              password,
              connected: true
            });
          } else {
            // Criar novas configurações usando updateAsteriskSettings
            await storage.updateAsteriskSettings(req.user!.organizationId, {
              host,
              port: parseInt(port),
              username,
              password,
              connected: true
            });
          }
        } catch (dbError) {
          console.error("Erro ao salvar configurações do Asterisk:", dbError);
          // Continuar mesmo com erro de banco, pois a conexão já foi feita
        }
        
        return res.json({ success: true, message: "Conectado ao Asterisk AMI com sucesso" });
      } else {
        return res.status(500).json({ success: false, message: "Falha ao conectar com o Asterisk AMI" });
      }
    } catch (error) {
      console.error('Erro ao conectar com Asterisk:', error);
      return res.status(500).json({ message: "Erro ao conectar com o Asterisk" });
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
        return res.status(400).json({ message: "Não conectado ao Asterisk AMI" });
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
        return res.status(400).json({ message: "Não conectado ao Asterisk AMI" });
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
  
  // Rota para testar conexão com o Asterisk
  app.post("/api/asterisk/test", requireAuth, async (req, res) => {
    try {
      const { host, port, username, password } = req.body;
      
      // Validar os dados
      if (!host || !port || !username || !password) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
      }
      
      // Criar um cliente AMI temporário apenas para teste
      const AsteriskAmi = require('asterisk-ami-client');
      const client = new AsteriskAmi();
      
      try {
        // Tentativa de conexão com timeout de 5 segundos
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            client.disconnect();
            reject(new Error("Timeout ao conectar ao Asterisk"));
          }, 5000);
          
          client.connect(host, parseInt(port), username, password)
            .then(() => {
              clearTimeout(timeout);
              client.disconnect();
              resolve(true);
            })
            .catch((err: Error) => {
              clearTimeout(timeout);
              reject(err);
            });
        });
        
        return res.json({ 
          success: true, 
          message: "Teste de conexão com o Asterisk AMI bem-sucedido" 
        });
      } catch (error) {
        const connError = error as Error;
        return res.status(400).json({ 
          success: false, 
          message: `Falha ao testar conexão: ${connError.message || 'Erro desconhecido'}` 
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão com Asterisk:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao testar conexão com o Asterisk" 
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
