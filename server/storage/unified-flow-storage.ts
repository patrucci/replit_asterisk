import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as unifiedSchema from "@shared/unified-flow-schema";

export interface IUnifiedFlowStorage {
  // Métodos para gerenciar fluxos unificados
  getFlows(organizationId: number): Promise<unifiedSchema.UnifiedFlow[]>;
  getFlow(id: number): Promise<unifiedSchema.UnifiedFlow | undefined>;
  createFlow(data: unifiedSchema.InsertUnifiedFlow): Promise<unifiedSchema.UnifiedFlow>;
  updateFlow(id: number, data: Partial<unifiedSchema.InsertUnifiedFlow>): Promise<unifiedSchema.UnifiedFlow | undefined>;
  deleteFlow(id: number): Promise<boolean>;

  // Métodos para gerenciar nós
  getNodes(flowId: number): Promise<unifiedSchema.UnifiedNode[]>;
  getNode(id: number): Promise<unifiedSchema.UnifiedNode | undefined>;
  createNode(data: unifiedSchema.InsertUnifiedNode): Promise<unifiedSchema.UnifiedNode>;
  updateNode(id: number, data: Partial<unifiedSchema.InsertUnifiedNode>): Promise<unifiedSchema.UnifiedNode | undefined>;
  deleteNode(id: number): Promise<boolean>;

  // Métodos para gerenciar arestas
  getEdges(flowId: number): Promise<unifiedSchema.UnifiedEdge[]>;
  getEdge(id: number): Promise<unifiedSchema.UnifiedEdge | undefined>;
  createEdge(data: unifiedSchema.InsertUnifiedEdge): Promise<unifiedSchema.UnifiedEdge>;
  updateEdge(id: number, data: Partial<unifiedSchema.InsertUnifiedEdge>): Promise<unifiedSchema.UnifiedEdge | undefined>;
  deleteEdge(id: number): Promise<boolean>;

  // Métodos para gerenciar gatilhos
  getTriggers(flowId: number): Promise<unifiedSchema.UnifiedTrigger[]>;
  getTrigger(id: number): Promise<unifiedSchema.UnifiedTrigger | undefined>;
  createTrigger(data: unifiedSchema.InsertUnifiedTrigger): Promise<unifiedSchema.UnifiedTrigger>;
  updateTrigger(id: number, data: Partial<unifiedSchema.InsertUnifiedTrigger>): Promise<unifiedSchema.UnifiedTrigger | undefined>;
  deleteTrigger(id: number): Promise<boolean>;

  // Métodos para gerenciar variáveis
  getVariables(organizationId: number): Promise<unifiedSchema.UnifiedVariable[]>;
  getVariable(id: number): Promise<unifiedSchema.UnifiedVariable | undefined>;
  createVariable(data: unifiedSchema.InsertUnifiedVariable): Promise<unifiedSchema.UnifiedVariable>;
  updateVariable(id: number, data: Partial<unifiedSchema.InsertUnifiedVariable>): Promise<unifiedSchema.UnifiedVariable | undefined>;
  deleteVariable(id: number): Promise<boolean>;
}

export class UnifiedFlowStorage implements IUnifiedFlowStorage {
  // Implementação dos métodos para fluxos
  async getFlows(organizationId: number): Promise<unifiedSchema.UnifiedFlow[]> {
    return await db
      .select()
      .from(unifiedSchema.unifiedFlows)
      .where(eq(unifiedSchema.unifiedFlows.organizationId, organizationId));
  }

  async getFlow(id: number): Promise<unifiedSchema.UnifiedFlow | undefined> {
    const [flow] = await db
      .select()
      .from(unifiedSchema.unifiedFlows)
      .where(eq(unifiedSchema.unifiedFlows.id, id));
    return flow;
  }

  async createFlow(data: unifiedSchema.InsertUnifiedFlow): Promise<unifiedSchema.UnifiedFlow> {
    const [flow] = await db
      .insert(unifiedSchema.unifiedFlows)
      .values(data)
      .returning();
    return flow;
  }

  async updateFlow(id: number, data: Partial<unifiedSchema.InsertUnifiedFlow>): Promise<unifiedSchema.UnifiedFlow | undefined> {
    const [updated] = await db
      .update(unifiedSchema.unifiedFlows)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(unifiedSchema.unifiedFlows.id, id))
      .returning();
    return updated;
  }

  async deleteFlow(id: number): Promise<boolean> {
    try {
      // Primeiro, excluir todos os triggers do fluxo
      await db
        .delete(unifiedSchema.unifiedTriggers)
        .where(eq(unifiedSchema.unifiedTriggers.flowId, id));
      
      // Excluir todas as arestas do fluxo
      await db
        .delete(unifiedSchema.unifiedEdges)
        .where(eq(unifiedSchema.unifiedEdges.flowId, id));
      
      // Excluir todos os nós do fluxo
      await db
        .delete(unifiedSchema.unifiedNodes)
        .where(eq(unifiedSchema.unifiedNodes.flowId, id));
      
      // Finalmente, excluir o próprio fluxo
      const result = await db
        .delete(unifiedSchema.unifiedFlows)
        .where(eq(unifiedSchema.unifiedFlows.id, id));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error("Erro ao excluir fluxo unificado:", error);
      return false;
    }
  }

  // Implementação dos métodos para nós
  async getNodes(flowId: number): Promise<unifiedSchema.UnifiedNode[]> {
    return await db
      .select()
      .from(unifiedSchema.unifiedNodes)
      .where(eq(unifiedSchema.unifiedNodes.flowId, flowId));
  }

  async getNode(id: number): Promise<unifiedSchema.UnifiedNode | undefined> {
    const [node] = await db
      .select()
      .from(unifiedSchema.unifiedNodes)
      .where(eq(unifiedSchema.unifiedNodes.id, id));
    return node;
  }

  async createNode(data: unifiedSchema.InsertUnifiedNode): Promise<unifiedSchema.UnifiedNode> {
    const [node] = await db
      .insert(unifiedSchema.unifiedNodes)
      .values(data)
      .returning();
    return node;
  }

  async updateNode(id: number, data: Partial<unifiedSchema.InsertUnifiedNode>): Promise<unifiedSchema.UnifiedNode | undefined> {
    const [updated] = await db
      .update(unifiedSchema.unifiedNodes)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(unifiedSchema.unifiedNodes.id, id))
      .returning();
    return updated;
  }

  async deleteNode(id: number): Promise<boolean> {
    try {
      // Primeiro excluir todas as arestas que conectam a este nó
      await db
        .delete(unifiedSchema.unifiedEdges)
        .where(
          and(
            eq(unifiedSchema.unifiedEdges.sourceNodeId, id),
            eq(unifiedSchema.unifiedEdges.targetNodeId, id)
          )
        );
      
      // Depois excluir o nó
      const result = await db
        .delete(unifiedSchema.unifiedNodes)
        .where(eq(unifiedSchema.unifiedNodes.id, id));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error("Erro ao excluir nó:", error);
      return false;
    }
  }

  // Implementação dos métodos para arestas
  async getEdges(flowId: number): Promise<unifiedSchema.UnifiedEdge[]> {
    return await db
      .select()
      .from(unifiedSchema.unifiedEdges)
      .where(eq(unifiedSchema.unifiedEdges.flowId, flowId));
  }

  async getEdge(id: number): Promise<unifiedSchema.UnifiedEdge | undefined> {
    const [edge] = await db
      .select()
      .from(unifiedSchema.unifiedEdges)
      .where(eq(unifiedSchema.unifiedEdges.id, id));
    return edge;
  }

  async createEdge(data: unifiedSchema.InsertUnifiedEdge): Promise<unifiedSchema.UnifiedEdge> {
    const [edge] = await db
      .insert(unifiedSchema.unifiedEdges)
      .values(data)
      .returning();
    return edge;
  }

  async updateEdge(id: number, data: Partial<unifiedSchema.InsertUnifiedEdge>): Promise<unifiedSchema.UnifiedEdge | undefined> {
    const [updated] = await db
      .update(unifiedSchema.unifiedEdges)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(unifiedSchema.unifiedEdges.id, id))
      .returning();
    return updated;
  }

  async deleteEdge(id: number): Promise<boolean> {
    const result = await db
      .delete(unifiedSchema.unifiedEdges)
      .where(eq(unifiedSchema.unifiedEdges.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Implementação dos métodos para gatilhos
  async getTriggers(flowId: number): Promise<unifiedSchema.UnifiedTrigger[]> {
    return await db
      .select()
      .from(unifiedSchema.unifiedTriggers)
      .where(eq(unifiedSchema.unifiedTriggers.flowId, flowId));
  }

  async getTrigger(id: number): Promise<unifiedSchema.UnifiedTrigger | undefined> {
    const [trigger] = await db
      .select()
      .from(unifiedSchema.unifiedTriggers)
      .where(eq(unifiedSchema.unifiedTriggers.id, id));
    return trigger;
  }

  async createTrigger(data: unifiedSchema.InsertUnifiedTrigger): Promise<unifiedSchema.UnifiedTrigger> {
    const [trigger] = await db
      .insert(unifiedSchema.unifiedTriggers)
      .values(data)
      .returning();
    return trigger;
  }

  async updateTrigger(id: number, data: Partial<unifiedSchema.InsertUnifiedTrigger>): Promise<unifiedSchema.UnifiedTrigger | undefined> {
    const [updated] = await db
      .update(unifiedSchema.unifiedTriggers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(unifiedSchema.unifiedTriggers.id, id))
      .returning();
    return updated;
  }

  async deleteTrigger(id: number): Promise<boolean> {
    const result = await db
      .delete(unifiedSchema.unifiedTriggers)
      .where(eq(unifiedSchema.unifiedTriggers.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Implementação dos métodos para variáveis
  async getVariables(organizationId: number): Promise<unifiedSchema.UnifiedVariable[]> {
    return await db
      .select()
      .from(unifiedSchema.unifiedVariables)
      .where(eq(unifiedSchema.unifiedVariables.organizationId, organizationId));
  }

  async getVariable(id: number): Promise<unifiedSchema.UnifiedVariable | undefined> {
    const [variable] = await db
      .select()
      .from(unifiedSchema.unifiedVariables)
      .where(eq(unifiedSchema.unifiedVariables.id, id));
    return variable;
  }

  async createVariable(data: unifiedSchema.InsertUnifiedVariable): Promise<unifiedSchema.UnifiedVariable> {
    const [variable] = await db
      .insert(unifiedSchema.unifiedVariables)
      .values(data)
      .returning();
    return variable;
  }

  async updateVariable(id: number, data: Partial<unifiedSchema.InsertUnifiedVariable>): Promise<unifiedSchema.UnifiedVariable | undefined> {
    const [updated] = await db
      .update(unifiedSchema.unifiedVariables)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(unifiedSchema.unifiedVariables.id, id))
      .returning();
    return updated;
  }

  async deleteVariable(id: number): Promise<boolean> {
    const result = await db
      .delete(unifiedSchema.unifiedVariables)
      .where(eq(unifiedSchema.unifiedVariables.id, id));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

// Exportando uma instância para uso em toda a aplicação
export const unifiedFlowStorage = new UnifiedFlowStorage();