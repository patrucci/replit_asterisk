import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { 
  insertQueueSchema, 
  insertAgentSchema,
  insertQueueAgentSchema,
  insertAgentGroupSchema,
  queues,
  agents,
  agentGroups,
  queueAgents
} from "@shared/queue-schema";

// Modo de simulação
const SIMULATION_MODE = false; // Agora usaremos dados reais do banco de dados

export function setupQueueRoutes(app: Express, requireAuth: any) {
  // Rota pública para verificar o status de conexão da API de filas
  app.get("/api/queue-status.json", (req: Request, res: Response) => {
    res.json({
      mode: SIMULATION_MODE ? "simulation" : "production",
      status: "online",
      timestamp: new Date().toISOString()
    });
  });
  // Rota para listar filas
  app.get("/api/queues", requireAuth, async (req: Request, res: Response) => {
    try {
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Retornando filas simuladas');
        return res.json([
          {
            id: 1,
            name: "Suporte Técnico",
            description: "Fila para atendimento de suporte técnico",
            strategy: "ringall",
            timeout: 60,
            maxWaitTime: 300,
            musicOnHold: "default",
            announcement: "Bem-vindo ao suporte técnico. Aguarde um momento.",
            wrapUpTime: 30,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 2,
            name: "Vendas",
            description: "Fila para atendimento de vendas",
            strategy: "leastrecent",
            timeout: 45,
            maxWaitTime: 180,
            musicOnHold: "jazz",
            announcement: "Obrigado por ligar para o departamento de vendas. Aguarde um momento.",
            wrapUpTime: 20,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 3,
            name: "Administrativo",
            description: "Fila para atendimento administrativo",
            strategy: "fewestcalls",
            timeout: 90,
            maxWaitTime: 400,
            musicOnHold: "classical",
            announcement: "Bem-vindo ao departamento administrativo. Aguarde um momento.",
            wrapUpTime: 45,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          }
        ]);
      }

      const queues = await storage.getQueues(req.user!.organizationId);
      res.json(queues);
    } catch (error) {
      console.error('Erro ao buscar filas:', error);
      res.status(500).json({ message: "Falha ao buscar filas" });
    }
  });

  // Rota para buscar uma fila específica
  app.get("/api/queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const queueId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Retornando fila simulada ${queueId}`);
        const mockQueue = {
          id: queueId,
          name: queueId === 1 ? "Suporte Técnico" : (queueId === 2 ? "Vendas" : "Administrativo"),
          description: `Fila para atendimento ${queueId === 1 ? "de suporte técnico" : (queueId === 2 ? "de vendas" : "administrativo")}`,
          strategy: queueId === 1 ? "ringall" : (queueId === 2 ? "leastrecent" : "fewestcalls"),
          timeout: queueId === 1 ? 60 : (queueId === 2 ? 45 : 90),
          maxWaitTime: queueId === 1 ? 300 : (queueId === 2 ? 180 : 400),
          musicOnHold: queueId === 1 ? "default" : (queueId === 2 ? "jazz" : "classical"),
          announcement: `Bem-vindo ao ${queueId === 1 ? "suporte técnico" : (queueId === 2 ? "departamento de vendas" : "departamento administrativo")}. Aguarde um momento.`,
          wrapUpTime: queueId === 1 ? 30 : (queueId === 2 ? 20 : 45),
          createdAt: new Date().toISOString(),
          userId: req.user!.id,
          organizationId: req.user!.organizationId
        };
        
        return res.json(mockQueue);
      }
      
      const queue = await storage.getQueue(queueId);
      
      if (!queue) {
        return res.status(404).json({ message: "Fila não encontrada" });
      }
      
      if (queue.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ message: "Não autorizado a acessar esta fila" });
      }
      
      res.json(queue);
    } catch (error) {
      console.error('Erro ao buscar fila:', error);
      res.status(500).json({ message: "Falha ao buscar fila" });
    }
  });

  // Rota para criar uma nova fila
  app.post("/api/queues", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertQueueSchema.parse({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Criando fila simulada:', validatedData);
        return res.status(201).json({
          ...validatedData,
          id: Date.now(),
          createdAt: new Date().toISOString()
        });
      }
      
      const queue = await storage.createQueue(validatedData);
      res.status(201).json(queue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos da fila", errors: error.errors });
      }
      console.error('Erro ao criar fila:', error);
      res.status(500).json({ message: "Falha ao criar fila" });
    }
  });

  // Rota para atualizar uma fila
  app.put("/api/queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const queueId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Atualizando fila simulada ${queueId}:`, req.body);
        return res.json({
          ...req.body,
          id: queueId,
          userId: req.user!.id,
          organizationId: req.user!.organizationId,
          updatedAt: new Date().toISOString()
        });
      }
      
      const existingQueue = await storage.getQueue(queueId);
      
      if (!existingQueue) {
        return res.status(404).json({ message: "Fila não encontrada" });
      }
      
      if (existingQueue.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ message: "Não autorizado a atualizar esta fila" });
      }
      
      const validatedData = insertQueueSchema.partial().parse(req.body);
      const updatedQueue = await storage.updateQueue(queueId, validatedData);
      res.json(updatedQueue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos da fila", errors: error.errors });
      }
      console.error('Erro ao atualizar fila:', error);
      res.status(500).json({ message: "Falha ao atualizar fila" });
    }
  });

  // Rota para excluir uma fila
  app.delete("/api/queues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const queueId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Excluindo fila simulada ${queueId}`);
        return res.status(204).send();
      }
      
      const existingQueue = await storage.getQueue(queueId);
      
      if (!existingQueue) {
        return res.status(404).json({ message: "Fila não encontrada" });
      }
      
      if (existingQueue.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ message: "Não autorizado a excluir esta fila" });
      }
      
      const success = await storage.deleteQueue(queueId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Falha ao excluir fila" });
      }
    } catch (error) {
      console.error('Erro ao excluir fila:', error);
      res.status(500).json({ message: "Falha ao excluir fila" });
    }
  });

  // Rotas para estatísticas de filas
  app.get("/api/queue-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Retornando estatísticas simuladas de filas');
        return res.json({
          totalQueueCalls: 256,
          completedCalls: 218,
          abandonedCalls: 38,
          averageWaitTime: 45,
          longestWaitTime: 320,
          serviceLevel: 85,
          queueStats: [
            {
              queueId: 1,
              name: "Suporte Técnico",
              strategy: "ringall",
              calls: 124,
              completed: 112,
              abandoned: 12,
              serviceLevel: 90,
              avgWaitTime: 35,
              avgTalkTime: 180,
              maxWaitTime: 210,
              agents: 5,
              activeAgents: 3,
            },
            {
              queueId: 2,
              name: "Vendas",
              strategy: "leastrecent",
              calls: 87,
              completed: 72,
              abandoned: 15,
              serviceLevel: 82,
              avgWaitTime: 42,
              avgTalkTime: 260,
              maxWaitTime: 280,
              agents: 4,
              activeAgents: 2,
            },
            {
              queueId: 3,
              name: "Administrativo",
              strategy: "fewestcalls",
              calls: 45,
              completed: 34,
              abandoned: 11,
              serviceLevel: 75,
              avgWaitTime: 62,
              avgTalkTime: 320,
              maxWaitTime: 320,
              agents: 3,
              activeAgents: 1,
            }
          ],
          agentStats: [
            {
              agentId: 1,
              name: "João Silva",
              status: "available",
              lastCall: "2023-08-15T14:30:00Z",
              callsTaken: 42,
              callsAbandoned: 5,
              avgTalkTime: 185,
              totalTalkTime: 7770,
              pauseTime: 1200,
              loginTime: "08:30",
              queues: ["Suporte Técnico", "Administrativo"]
            },
            {
              agentId: 2,
              name: "Maria Oliveira",
              status: "busy",
              lastCall: "2023-08-15T14:45:00Z",
              callsTaken: 38,
              callsAbandoned: 2,
              avgTalkTime: 240,
              totalTalkTime: 9120,
              pauseTime: 600,
              loginTime: "09:00",
              queues: ["Vendas"]
            },
            {
              agentId: 3,
              name: "Pedro Santos",
              status: "paused",
              lastCall: "2023-08-15T13:20:00Z",
              callsTaken: 25,
              callsAbandoned: 4,
              avgTalkTime: 195,
              totalTalkTime: 4875,
              pauseTime: 1800,
              loginTime: "08:00",
              queues: ["Administrativo", "Vendas"]
            },
            {
              agentId: 4,
              name: "Ana Costa",
              status: "available",
              lastCall: "2023-08-15T14:10:00Z",
              callsTaken: 35,
              callsAbandoned: 3,
              avgTalkTime: 210,
              totalTalkTime: 7350,
              pauseTime: 900,
              loginTime: "08:15",
              queues: ["Suporte Técnico"]
            },
            {
              agentId: 5,
              name: "Carlos Ferreira",
              status: "unavailable",
              lastCall: "2023-08-15T11:45:00Z",
              callsTaken: 12,
              callsAbandoned: 1,
              avgTalkTime: 165,
              totalTalkTime: 1980,
              pauseTime: 300,
              loginTime: "10:30",
              queues: ["Suporte Técnico", "Vendas"]
            }
          ]
        });
      }
      
      // Em uma implementação real, buscaríamos estatísticas do banco de dados
      // Aqui você implementaria a lógica para buscar estatísticas das filas
      
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      console.error('Erro ao buscar estatísticas de filas:', error);
      res.status(500).json({ message: "Falha ao buscar estatísticas de filas" });
    }
  });

  // Rota para obter agentes
  app.get("/api/agents", requireAuth, async (req: Request, res: Response) => {
    try {
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Retornando agentes simulados');
        return res.json([
          {
            id: 1,
            name: "João Silva",
            extension: "1001",
            email: "joao.silva@example.com",
            status: "available",
            groupId: 1,
            skills: ["suporte", "técnico", "hardware"],
            maxConcurrentCalls: 2,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 2,
            name: "Maria Oliveira",
            extension: "1002",
            email: "maria.oliveira@example.com",
            status: "busy",
            groupId: 2,
            skills: ["vendas", "negociação", "produtos"],
            maxConcurrentCalls: 1,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 3,
            name: "Pedro Santos",
            extension: "1003",
            email: "pedro.santos@example.com",
            status: "paused",
            groupId: 3,
            skills: ["administrativo", "financeiro"],
            maxConcurrentCalls: 1,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 4,
            name: "Ana Costa",
            extension: "1004",
            email: "ana.costa@example.com",
            status: "available",
            groupId: 1,
            skills: ["suporte", "software", "configuração"],
            maxConcurrentCalls: 3,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          },
          {
            id: 5,
            name: "Carlos Ferreira",
            extension: "1005",
            email: "carlos.ferreira@example.com",
            status: "unavailable",
            groupId: 2,
            skills: ["vendas", "pós-venda", "suporte"],
            maxConcurrentCalls: 2,
            createdAt: new Date().toISOString(),
            userId: req.user!.id,
            organizationId: req.user!.organizationId
          }
        ]);
      }
      
      // Em uma implementação real, buscaríamos agentes do banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
      res.status(500).json({ message: "Falha ao buscar agentes" });
    }
  });
  
  // Rota para buscar um agente específico
  app.get("/api/agents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Retornando agente simulado ${agentId}`);
        
        // Simulação de agente com base no ID
        const mockNames = ["João Silva", "Maria Oliveira", "Pedro Santos", "Ana Costa", "Carlos Ferreira"];
        const mockExtensions = ["1001", "1002", "1003", "1004", "1005"];
        const mockStatus = ["available", "busy", "paused", "unavailable", "offline"];
        const mockEmails = [
          "joao.silva@example.com", 
          "maria.oliveira@example.com", 
          "pedro.santos@example.com", 
          "ana.costa@example.com", 
          "carlos.ferreira@example.com"
        ];
        
        const index = (agentId - 1) % 5;
        
        return res.json({
          id: agentId,
          name: mockNames[index],
          extension: mockExtensions[index],
          email: mockEmails[index],
          status: mockStatus[index],
          groupId: (index % 3) + 1,
          skills: ["suporte", "técnico", "atendimento"],
          maxConcurrentCalls: 2,
          createdAt: new Date().toISOString(),
          userId: req.user!.id,
          organizationId: req.user!.organizationId
        });
      }
      
      // Em uma implementação real, buscaríamos o agente do banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      console.error('Erro ao buscar agente:', error);
      res.status(500).json({ message: "Falha ao buscar agente" });
    }
  });
  
  // Rota para criar um novo agente
  app.post("/api/agents", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertAgentSchema.parse({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });
      
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Criando agente simulado:', validatedData);
        return res.status(201).json({
          ...validatedData,
          id: Date.now(),
          createdAt: new Date().toISOString()
        });
      }
      
      // Em uma implementação real, criaríamos o agente no banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos do agente", errors: error.errors });
      }
      console.error('Erro ao criar agente:', error);
      res.status(500).json({ message: "Falha ao criar agente" });
    }
  });
  
  // Rota para atualizar um agente
  app.put("/api/agents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Atualizando agente simulado ${agentId}:`, req.body);
        return res.json({
          ...req.body,
          id: agentId,
          userId: req.user!.id,
          organizationId: req.user!.organizationId,
          updatedAt: new Date().toISOString()
        });
      }
      
      // Em uma implementação real, atualizaríamos o agente no banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos do agente", errors: error.errors });
      }
      console.error('Erro ao atualizar agente:', error);
      res.status(500).json({ message: "Falha ao atualizar agente" });
    }
  });
  
  // Rota para atualizar o status de um agente
  app.patch("/api/agents/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status não fornecido" });
      }
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Atualizando status do agente simulado ${agentId} para ${status}`);
        return res.json({
          id: agentId,
          status,
          updatedAt: new Date().toISOString()
        });
      }
      
      // Em uma implementação real, atualizaríamos o status do agente no banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      console.error('Erro ao atualizar status do agente:', error);
      res.status(500).json({ message: "Falha ao atualizar status do agente" });
    }
  });
  
  // Rota para excluir um agente
  app.delete("/api/agents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = Number(req.params.id);
      
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Excluindo agente simulado ${agentId}`);
        return res.status(204).send();
      }
      
      // Em uma implementação real, excluiríamos o agente do banco de dados
      return res.status(501).json({ message: "Funcionalidade ainda não implementada" });
    } catch (error) {
      console.error('Erro ao excluir agente:', error);
      res.status(500).json({ message: "Falha ao excluir agente" });
    }
  });
}