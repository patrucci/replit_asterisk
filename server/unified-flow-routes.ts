import { Request, Response, Express } from "express";
import { unifiedFlowStorage } from "./storage/unified-flow-storage";
import * as unifiedSchema from "@shared/unified-flow-schema";

export function setupUnifiedFlowRoutes(app: Express, requireAuth: any) {
  // ----- Rotas para fluxos unificados -----
  app.get("/api/unified-flows", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const flows = await unifiedFlowStorage.getFlows(organizationId);
      res.json(flows);
    } catch (error: any) {
      console.error("Erro ao buscar fluxos unificados:", error);
      res.status(500).json({ 
        error: "Erro ao buscar fluxos unificados", 
        details: error.message 
      });
    }
  });

  app.get("/api/unified-flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      res.json(flow);
    } catch (error: any) {
      console.error("Erro ao buscar fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao buscar fluxo unificado", 
        details: error.message 
      });
    }
  });

  app.post("/api/unified-flows", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      
      const result = unifiedSchema.insertUnifiedFlowSchema.safeParse({
        ...req.body,
        organizationId
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const flow = await unifiedFlowStorage.createFlow(result.data);
      res.status(201).json(flow);
    } catch (error: any) {
      console.error("Erro ao criar fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao criar fluxo unificado", 
        details: error.message 
      });
    }
  });

  app.put("/api/unified-flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = unifiedSchema.insertUnifiedFlowSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const updatedFlow = await unifiedFlowStorage.updateFlow(flowId, result.data);
      res.json(updatedFlow);
    } catch (error: any) {
      console.error("Erro ao atualizar fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao atualizar fluxo unificado", 
        details: error.message 
      });
    }
  });

  app.delete("/api/unified-flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const success = await unifiedFlowStorage.deleteFlow(flowId);
      
      if (success) {
        res.json({ success: true, message: "Fluxo excluído com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao excluir fluxo" });
      }
    } catch (error: any) {
      console.error("Erro ao excluir fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao excluir fluxo unificado", 
        details: error.message 
      });
    }
  });

  // ----- Rotas para nós -----
  app.get("/api/unified-flows/:flowId/nodes", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const nodes = await unifiedFlowStorage.getNodes(flowId);
      res.json(nodes);
    } catch (error: any) {
      console.error("Erro ao buscar nós do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao buscar nós", 
        details: error.message 
      });
    }
  });

  app.post("/api/unified-flows/:flowId/nodes", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      // Log dos dados recebidos para debug
      console.log("Dados recebidos para criar nó:", JSON.stringify(req.body, null, 2));
      
      const result = unifiedSchema.insertUnifiedNodeSchema.safeParse({
        ...req.body,
        flowId
      });
      
      if (!result.success) {
        console.log("Erro de validação:", JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const node = await unifiedFlowStorage.createNode(result.data);
      res.status(201).json(node);
    } catch (error: any) {
      console.error("Erro ao criar nó do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao criar nó", 
        details: error.message 
      });
    }
  });

  app.put("/api/unified-nodes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = parseInt(req.params.id);
      const node = await unifiedFlowStorage.getNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ error: "Nó não encontrado" });
      }
      
      // Verificar permissão através do fluxo
      const flow = await unifiedFlowStorage.getFlow(node.flowId);
      if (!flow || flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = unifiedSchema.insertUnifiedNodeSchema.omit({ flowId: true }).partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const updatedNode = await unifiedFlowStorage.updateNode(nodeId, result.data);
      res.json(updatedNode);
    } catch (error: any) {
      console.error("Erro ao atualizar nó do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao atualizar nó", 
        details: error.message 
      });
    }
  });

  app.delete("/api/unified-nodes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = parseInt(req.params.id);
      const node = await unifiedFlowStorage.getNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ error: "Nó não encontrado" });
      }
      
      // Verificar permissão através do fluxo
      const flow = await unifiedFlowStorage.getFlow(node.flowId);
      if (!flow || flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const success = await unifiedFlowStorage.deleteNode(nodeId);
      
      if (success) {
        res.json({ success: true, message: "Nó excluído com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao excluir nó" });
      }
    } catch (error: any) {
      console.error("Erro ao excluir nó do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao excluir nó", 
        details: error.message 
      });
    }
  });

  // ----- Rotas para arestas -----
  app.get("/api/unified-flows/:flowId/edges", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const edges = await unifiedFlowStorage.getEdges(flowId);
      res.json(edges);
    } catch (error: any) {
      console.error("Erro ao buscar arestas do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao buscar arestas", 
        details: error.message 
      });
    }
  });

  app.post("/api/unified-flows/:flowId/edges", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = unifiedSchema.insertUnifiedEdgeSchema.safeParse({
        ...req.body,
        flowId
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const edge = await unifiedFlowStorage.createEdge(result.data);
      res.status(201).json(edge);
    } catch (error: any) {
      console.error("Erro ao criar aresta do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao criar aresta", 
        details: error.message 
      });
    }
  });

  app.put("/api/unified-edges/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const edgeId = parseInt(req.params.id);
      const edge = await unifiedFlowStorage.getEdge(edgeId);
      
      if (!edge) {
        return res.status(404).json({ error: "Aresta não encontrada" });
      }
      
      // Verificar permissão através do fluxo
      const flow = await unifiedFlowStorage.getFlow(edge.flowId);
      if (!flow || flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = unifiedSchema.insertUnifiedEdgeSchema.omit({ flowId: true }).partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const updatedEdge = await unifiedFlowStorage.updateEdge(edgeId, result.data);
      res.json(updatedEdge);
    } catch (error: any) {
      console.error("Erro ao atualizar aresta do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao atualizar aresta", 
        details: error.message 
      });
    }
  });

  app.delete("/api/unified-edges/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const edgeId = parseInt(req.params.id);
      const edge = await unifiedFlowStorage.getEdge(edgeId);
      
      if (!edge) {
        return res.status(404).json({ error: "Aresta não encontrada" });
      }
      
      // Verificar permissão através do fluxo
      const flow = await unifiedFlowStorage.getFlow(edge.flowId);
      if (!flow || flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const success = await unifiedFlowStorage.deleteEdge(edgeId);
      
      if (success) {
        res.json({ success: true, message: "Aresta excluída com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao excluir aresta" });
      }
    } catch (error: any) {
      console.error("Erro ao excluir aresta do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao excluir aresta", 
        details: error.message 
      });
    }
  });

  // ----- Rotas para gatilhos -----
  app.get("/api/unified-flows/:flowId/triggers", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const triggers = await unifiedFlowStorage.getTriggers(flowId);
      res.json(triggers);
    } catch (error: any) {
      console.error("Erro ao buscar gatilhos do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao buscar gatilhos", 
        details: error.message 
      });
    }
  });

  app.post("/api/unified-flows/:flowId/triggers", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await unifiedFlowStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verificar permissão
      if (flow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = unifiedSchema.insertUnifiedTriggerSchema.safeParse({
        ...req.body,
        flowId
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const trigger = await unifiedFlowStorage.createTrigger(result.data);
      res.status(201).json(trigger);
    } catch (error: any) {
      console.error("Erro ao criar gatilho do fluxo unificado:", error);
      res.status(500).json({ 
        error: "Erro ao criar gatilho", 
        details: error.message 
      });
    }
  });

  // Rotas adicionais para gatilhos omitidas por brevidade

  // ----- Rotas para variáveis -----
  app.get("/api/unified-variables", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const variables = await unifiedFlowStorage.getVariables(organizationId);
      res.json(variables);
    } catch (error: any) {
      console.error("Erro ao buscar variáveis globais:", error);
      res.status(500).json({ 
        error: "Erro ao buscar variáveis", 
        details: error.message 
      });
    }
  });

  app.post("/api/unified-variables", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      
      const result = unifiedSchema.insertUnifiedVariableSchema.safeParse({
        ...req.body,
        organizationId
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: result.error.format() 
        });
      }
      
      const variable = await unifiedFlowStorage.createVariable(result.data);
      res.status(201).json(variable);
    } catch (error: any) {
      console.error("Erro ao criar variável global:", error);
      res.status(500).json({ 
        error: "Erro ao criar variável", 
        details: error.message 
      });
    }
  });

  // Rotas adicionais para variáveis omitidas por brevidade
}