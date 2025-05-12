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
import asteriskAMIManager from "./asterisk-ami";

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

  const httpServer = createServer(app);
  
  // Configurar WebSocket para Asterisk AMI
  try {
    // Inicializar conexão com Asterisk AMI
    asteriskAMIManager.setupWebsocket(httpServer, '/queue-events');
    
    // Para ambiente de desenvolvimento, você pode se conectar a um servidor Asterisk
    // Descomente e configure as linhas abaixo quando tiver um servidor Asterisk disponível
    /*
    asteriskAMIManager.connect(
      process.env.ASTERISK_HOST || 'localhost',
      parseInt(process.env.ASTERISK_PORT || '5038', 10),
      process.env.ASTERISK_USERNAME || 'admin',
      process.env.ASTERISK_PASSWORD || 'password'
    ).then(connected => {
      if (connected) {
        console.log('Conexão com Asterisk AMI estabelecida com sucesso');
      } else {
        console.error('Não foi possível conectar ao Asterisk AMI');
      }
    });
    */
    
    console.log('WebSocket para Asterisk AMI configurado em /queue-events');
  } catch (error) {
    console.error('Erro ao configurar WebSocket para Asterisk AMI:', error);
  }
  
  return httpServer;
}
