import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as chatbotSchema from "@shared/chatbot-schema";

export interface IChatbotStorage {
  // Métodos para gerenciar chatbots
  getChatbots(organizationId: number): Promise<chatbotSchema.Chatbot[]>;
  getChatbot(id: number): Promise<chatbotSchema.Chatbot | undefined>;
  createChatbot(data: chatbotSchema.InsertChatbot): Promise<chatbotSchema.Chatbot>;
  updateChatbot(id: number, data: Partial<chatbotSchema.InsertChatbot>): Promise<chatbotSchema.Chatbot | undefined>;
  deleteChatbot(id: number): Promise<boolean>;

  // Métodos para gerenciar canais
  getChannels(chatbotId: number): Promise<chatbotSchema.ChatbotChannel[]>;
  getChannel(id: number): Promise<chatbotSchema.ChatbotChannel | undefined>;
  createChannel(data: chatbotSchema.InsertChatbotChannel): Promise<chatbotSchema.ChatbotChannel>;
  updateChannel(id: number, data: Partial<chatbotSchema.InsertChatbotChannel>): Promise<chatbotSchema.ChatbotChannel | undefined>;
  deleteChannel(id: number): Promise<boolean>;

  // Métodos para gerenciar fluxos
  getFlows(chatbotId: number): Promise<chatbotSchema.ChatbotFlow[]>;
  getFlow(id: number): Promise<chatbotSchema.ChatbotFlow | undefined>;
  createFlow(data: chatbotSchema.InsertChatbotFlow): Promise<chatbotSchema.ChatbotFlow>;
  updateFlow(id: number, data: Partial<chatbotSchema.InsertChatbotFlow>): Promise<chatbotSchema.ChatbotFlow | undefined>;
  deleteFlow(id: number): Promise<boolean>;

  // Métodos para gerenciar nós
  getNodes(flowId: number): Promise<chatbotSchema.ChatbotNode[]>;
  getNode(id: number): Promise<chatbotSchema.ChatbotNode | undefined>;
  createNode(data: chatbotSchema.InsertChatbotNode): Promise<chatbotSchema.ChatbotNode>;
  updateNode(id: number, data: Partial<chatbotSchema.InsertChatbotNode>): Promise<chatbotSchema.ChatbotNode | undefined>;
  deleteNode(id: number): Promise<boolean>;

  // Métodos para gerenciar arestas
  getEdges(flowId: number): Promise<chatbotSchema.ChatbotEdge[]>;
  getEdge(id: number): Promise<chatbotSchema.ChatbotEdge | undefined>;
  createEdge(data: chatbotSchema.InsertChatbotEdge): Promise<chatbotSchema.ChatbotEdge>;
  updateEdge(id: number, data: Partial<chatbotSchema.InsertChatbotEdge>): Promise<chatbotSchema.ChatbotEdge | undefined>;
  deleteEdge(id: number): Promise<boolean>;

  // Métodos para gerenciar conversas
  getConversations(chatbotId: number, limit?: number, offset?: number): Promise<chatbotSchema.ChatbotConversation[]>;
  getConversation(id: number): Promise<chatbotSchema.ChatbotConversation | undefined>;
  createConversation(data: chatbotSchema.InsertChatbotConversation): Promise<chatbotSchema.ChatbotConversation>;
  updateConversation(id: number, data: Partial<chatbotSchema.InsertChatbotConversation>): Promise<chatbotSchema.ChatbotConversation | undefined>;

  // Métodos para gerenciar mensagens
  getMessages(conversationId: number): Promise<chatbotSchema.ChatbotMessage[]>;
  createMessage(data: chatbotSchema.InsertChatbotMessage): Promise<chatbotSchema.ChatbotMessage>;
}

export class ChatbotStorage implements IChatbotStorage {
  // Implementação dos chatbots
  async getChatbots(organizationId: number): Promise<chatbotSchema.Chatbot[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbots)
      .where(eq(chatbotSchema.chatbots.organizationId, organizationId));
  }

  async getChatbot(id: number): Promise<chatbotSchema.Chatbot | undefined> {
    const [chatbot] = await db
      .select()
      .from(chatbotSchema.chatbots)
      .where(eq(chatbotSchema.chatbots.id, id));
    return chatbot;
  }

  async createChatbot(data: chatbotSchema.InsertChatbot): Promise<chatbotSchema.Chatbot> {
    const [chatbot] = await db
      .insert(chatbotSchema.chatbots)
      .values(data)
      .returning();
    return chatbot;
  }

  async updateChatbot(id: number, data: Partial<chatbotSchema.InsertChatbot>): Promise<chatbotSchema.Chatbot | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbots)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatbotSchema.chatbots.id, id))
      .returning();
    return updated;
  }

  async deleteChatbot(id: number): Promise<boolean> {
    try {
      // Primeiro obtemos todos os fluxos associados a este chatbot
      const flows = await this.getFlows(id);
      
      // Para cada fluxo, precisamos excluir todos os nós e arestas
      for (const flow of flows) {
        // Excluir todas as arestas do fluxo
        await db
          .delete(chatbotSchema.chatbotEdges)
          .where(eq(chatbotSchema.chatbotEdges.flowId, flow.id));
        
        // Excluir todos os nós do fluxo
        await db
          .delete(chatbotSchema.chatbotNodes)
          .where(eq(chatbotSchema.chatbotNodes.flowId, flow.id));
        
        // Excluir o fluxo
        await db
          .delete(chatbotSchema.chatbotFlows)
          .where(eq(chatbotSchema.chatbotFlows.id, flow.id));
      }
      
      // Excluir todos os canais do chatbot
      await db
        .delete(chatbotSchema.chatbotChannels)
        .where(eq(chatbotSchema.chatbotChannels.chatbotId, id));
      
      // Excluir todas as conversas e mensagens associadas
      const conversations = await this.getConversations(id);
      for (const conversation of conversations) {
        // Excluir todas as mensagens da conversa
        await db
          .delete(chatbotSchema.chatbotMessages)
          .where(eq(chatbotSchema.chatbotMessages.conversationId, conversation.id));
      }
      
      // Excluir todas as conversas
      await db
        .delete(chatbotSchema.chatbotConversations)
        .where(eq(chatbotSchema.chatbotConversations.chatbotId, id));
      
      // Finalmente, excluir o chatbot
      const result = await db
        .delete(chatbotSchema.chatbots)
        .where(eq(chatbotSchema.chatbots.id, id));
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Erro ao excluir chatbot:", error);
      return false;
    }
  }

  // Implementação dos canais
  async getChannels(chatbotId: number): Promise<chatbotSchema.ChatbotChannel[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotChannels)
      .where(eq(chatbotSchema.chatbotChannels.chatbotId, chatbotId));
  }

  async getChannel(id: number): Promise<chatbotSchema.ChatbotChannel | undefined> {
    const [channel] = await db
      .select()
      .from(chatbotSchema.chatbotChannels)
      .where(eq(chatbotSchema.chatbotChannels.id, id));
    return channel;
  }

  async createChannel(data: chatbotSchema.InsertChatbotChannel): Promise<chatbotSchema.ChatbotChannel> {
    const [channel] = await db
      .insert(chatbotSchema.chatbotChannels)
      .values(data)
      .returning();
    return channel;
  }

  async updateChannel(id: number, data: Partial<chatbotSchema.InsertChatbotChannel>): Promise<chatbotSchema.ChatbotChannel | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbotChannels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatbotSchema.chatbotChannels.id, id))
      .returning();
    return updated;
  }

  async deleteChannel(id: number): Promise<boolean> {
    const result = await db
      .delete(chatbotSchema.chatbotChannels)
      .where(eq(chatbotSchema.chatbotChannels.id, id));
    return result.rowCount > 0;
  }

  // Implementação dos fluxos
  async getFlows(chatbotId: number): Promise<chatbotSchema.ChatbotFlow[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotFlows)
      .where(eq(chatbotSchema.chatbotFlows.chatbotId, chatbotId));
  }

  async getFlow(id: number): Promise<chatbotSchema.ChatbotFlow | undefined> {
    const [flow] = await db
      .select()
      .from(chatbotSchema.chatbotFlows)
      .where(eq(chatbotSchema.chatbotFlows.id, id));
    return flow;
  }

  async createFlow(data: chatbotSchema.InsertChatbotFlow): Promise<chatbotSchema.ChatbotFlow> {
    const [flow] = await db
      .insert(chatbotSchema.chatbotFlows)
      .values(data)
      .returning();
    return flow;
  }

  async updateFlow(id: number, data: Partial<chatbotSchema.InsertChatbotFlow>): Promise<chatbotSchema.ChatbotFlow | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbotFlows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatbotSchema.chatbotFlows.id, id))
      .returning();
    return updated;
  }

  async deleteFlow(id: number): Promise<boolean> {
    const result = await db
      .delete(chatbotSchema.chatbotFlows)
      .where(eq(chatbotSchema.chatbotFlows.id, id));
    return result.rowCount > 0;
  }

  // Implementação dos nós
  async getNodes(flowId: number): Promise<chatbotSchema.ChatbotNode[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotNodes)
      .where(eq(chatbotSchema.chatbotNodes.flowId, flowId));
  }

  async getNode(id: number): Promise<chatbotSchema.ChatbotNode | undefined> {
    const [node] = await db
      .select()
      .from(chatbotSchema.chatbotNodes)
      .where(eq(chatbotSchema.chatbotNodes.id, id));
    return node;
  }

  async createNode(data: chatbotSchema.InsertChatbotNode): Promise<chatbotSchema.ChatbotNode> {
    const [node] = await db
      .insert(chatbotSchema.chatbotNodes)
      .values(data)
      .returning();
    return node;
  }

  async updateNode(id: number, data: Partial<chatbotSchema.InsertChatbotNode>): Promise<chatbotSchema.ChatbotNode | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbotNodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatbotSchema.chatbotNodes.id, id))
      .returning();
    return updated;
  }

  async deleteNode(id: number): Promise<boolean> {
    const result = await db
      .delete(chatbotSchema.chatbotNodes)
      .where(eq(chatbotSchema.chatbotNodes.id, id));
    return result.rowCount > 0;
  }

  // Implementação das arestas
  async getEdges(flowId: number): Promise<chatbotSchema.ChatbotEdge[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotEdges)
      .where(eq(chatbotSchema.chatbotEdges.flowId, flowId));
  }

  async getEdge(id: number): Promise<chatbotSchema.ChatbotEdge | undefined> {
    const [edge] = await db
      .select()
      .from(chatbotSchema.chatbotEdges)
      .where(eq(chatbotSchema.chatbotEdges.id, id));
    return edge;
  }

  async createEdge(data: chatbotSchema.InsertChatbotEdge): Promise<chatbotSchema.ChatbotEdge> {
    const [edge] = await db
      .insert(chatbotSchema.chatbotEdges)
      .values(data)
      .returning();
    return edge;
  }

  async updateEdge(id: number, data: Partial<chatbotSchema.InsertChatbotEdge>): Promise<chatbotSchema.ChatbotEdge | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbotEdges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chatbotSchema.chatbotEdges.id, id))
      .returning();
    return updated;
  }

  async deleteEdge(id: number): Promise<boolean> {
    const result = await db
      .delete(chatbotSchema.chatbotEdges)
      .where(eq(chatbotSchema.chatbotEdges.id, id));
    return result.rowCount > 0;
  }

  // Implementação das conversas
  async getConversations(chatbotId: number, limit = 100, offset = 0): Promise<chatbotSchema.ChatbotConversation[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotConversations)
      .where(eq(chatbotSchema.chatbotConversations.chatbotId, chatbotId))
      .limit(limit)
      .offset(offset);
  }

  async getConversation(id: number): Promise<chatbotSchema.ChatbotConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(chatbotSchema.chatbotConversations)
      .where(eq(chatbotSchema.chatbotConversations.id, id));
    return conversation;
  }

  async createConversation(data: chatbotSchema.InsertChatbotConversation): Promise<chatbotSchema.ChatbotConversation> {
    const [conversation] = await db
      .insert(chatbotSchema.chatbotConversations)
      .values(data)
      .returning();
    return conversation;
  }

  async updateConversation(id: number, data: Partial<chatbotSchema.InsertChatbotConversation>): Promise<chatbotSchema.ChatbotConversation | undefined> {
    const [updated] = await db
      .update(chatbotSchema.chatbotConversations)
      .set(data)
      .where(eq(chatbotSchema.chatbotConversations.id, id))
      .returning();
    return updated;
  }

  // Implementação das mensagens
  async getMessages(conversationId: number): Promise<chatbotSchema.ChatbotMessage[]> {
    return await db
      .select()
      .from(chatbotSchema.chatbotMessages)
      .where(eq(chatbotSchema.chatbotMessages.conversationId, conversationId))
      .orderBy(chatbotSchema.chatbotMessages.timestamp);
  }

  async createMessage(data: chatbotSchema.InsertChatbotMessage): Promise<chatbotSchema.ChatbotMessage> {
    const [message] = await db
      .insert(chatbotSchema.chatbotMessages)
      .values(data)
      .returning();
    return message;
  }
}

export const chatbotStorage = new ChatbotStorage();