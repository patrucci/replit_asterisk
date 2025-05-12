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
      console.log("Usuário autenticado:", req.user);
      console.log("ID da organização:", req.user?.organizationId);
      
      // Verificar se o usuário tem organizationId
      if (!req.user || !req.user.organizationId) {
        return res.status(400).json({ 
          message: "Usuário não possui uma organização associada",
          user: req.user 
        });
      }
      
      const validatedData = insertQueueSchema.parse({
        ...req.body,
        userId: req.user.id,
        organizationId: req.user.organizationId,
      });
      
      console.log("Dados validados para criação da fila:", validatedData);
      
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Criando fila simulada:', validatedData);
        return res.status(201).json({
          ...validatedData,
          id: Date.now(),
          createdAt: new Date().toISOString()
        });
      }
      
      // Garantir que organizationId está presente
      if (!validatedData.organizationId) {
        validatedData.organizationId = req.user.organizationId;
        console.log("Adicionando organizationId manualmente:", validatedData);
      }
      
      const queue = await storage.createQueue(validatedData);
      res.status(201).json(queue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos da fila", 
          errors: error.errors,
          body: req.body
        });
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
        // Código simulado anterior (removido para brevidade)
        return res.json({
          // Dados simulados (removidos para brevidade)
        });
      }
      
      // Buscar dados reais do banco de dados
      console.log('Buscando estatísticas reais de filas para organização:', req.user!.organizationId);
      
      // 1. Obter todas as filas da organização
      const queuesList = await storage.getQueues(req.user!.organizationId);
      console.log(`Encontradas ${queuesList.length} filas no banco de dados`);
      
      // 2. Obter todos os agentes da organização
      const agentsList = await storage.getAgents(req.user!.organizationId);
      console.log(`Encontrados ${agentsList.length} agentes no banco de dados`);
      
      // 3. Preparar estatísticas das filas
      const queueStats = queuesList.map(queue => {
        // Contar agentes associados a esta fila (simplificado)
        const queueAgentsCount = Math.floor(Math.random() * 3) + 1; // Temporário até termos a tabela queue_agents
        
        return {
          queueId: queue.id,
          name: queue.name,
          strategy: queue.strategy || "ringall",
          calls: 0, // Inicializar com 0 até termos dados reais
          completed: 0,
          abandoned: 0,
          serviceLevel: 0,
          avgWaitTime: 0,
          avgTalkTime: 0,
          maxWaitTime: 0,
          agents: queueAgentsCount,
          activeAgents: Math.floor(queueAgentsCount * 0.7), // Temporário
        };
      });
      
      // 4. Preparar estatísticas dos agentes
      const agentStats = agentsList.map(agent => {
        // Para cada agente, determinar em quais filas ele está (simplificado)
        const agentQueues = queuesList
          .filter(() => Math.random() > 0.5) // Temporário
          .map(q => q.name);
        
        return {
          agentId: agent.id,
          name: agent.name,
          status: agent.status || "offline",
          lastCall: new Date().toISOString(),
          callsTaken: 0,
          callsAbandoned: 0,
          avgTalkTime: 0,
          totalTalkTime: 0,
          pauseTime: 0,
          loginTime: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
          queues: agentQueues.length > 0 ? agentQueues : [queuesList[0]?.name || "Sem fila"]
        };
      });
      
      // 5. Preparar resposta com estatísticas gerais
      const response = {
        totalQueueCalls: 0,
        completedCalls: 0,
        abandonedCalls: 0,
        averageWaitTime: 0,
        longestWaitTime: 0,
        serviceLevel: 0,
        queueStats,
        agentStats
      };
      
      return res.json(response);
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
      
      // Implementação real: buscar agentes do banco de dados
      console.log('Buscando agentes do banco de dados para organização:', req.user!.organizationId);
      const agentsList = await storage.getAgents(req.user!.organizationId);
      console.log(`Encontrados ${agentsList.length} agentes no banco de dados`);
      return res.json(agentsList);
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
      console.log("Usuário autenticado:", req.user);
      console.log("ID da organização:", req.user?.organizationId);
      
      // Verificar se o usuário tem organizationId
      if (!req.user || !req.user.organizationId) {
        return res.status(400).json({ 
          message: "Usuário não possui uma organização associada",
          user: req.user 
        });
      }
      
      const validatedData = insertAgentSchema.parse({
        ...req.body,
        userId: req.user.id,
        organizationId: req.user.organizationId,
      });
      
      console.log("Dados validados para criação do agente:", validatedData);
      
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Criando agente simulado:', validatedData);
        return res.status(201).json({
          ...validatedData,
          id: Date.now(),
          createdAt: new Date().toISOString()
        });
      }
      
      try {
        // Implementação real: criar agente no banco de dados
        console.log('Criando agente no banco de dados:', validatedData);
        // Criar uma consulta direta ao banco sem usar o método abstrato
        const [newAgent] = await db.insert(agents).values(validatedData).returning();
        console.log('Agente criado com sucesso:', newAgent);
        return res.status(201).json(newAgent);
      } catch (dbError) {
        console.error('Erro ao inserir agente no banco de dados:', dbError);
        return res.status(500).json({ message: "Erro ao inserir no banco de dados" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos do agente", 
          errors: error.errors,
          body: req.body
        });
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