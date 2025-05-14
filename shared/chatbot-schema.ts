import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./schema";

// Enums para os tipos de canais e nós do fluxo
export const channelTypeEnum = pgEnum('channel_type', ['whatsapp', 'telegram', 'webchat', 'sms', 'api']);
export const nodeTypeEnum = pgEnum('node_type', [
  'message',     // Mensagem simples
  'input',       // Captura de entrada do usuário
  'condition',   // Condição lógica
  'api_request', // Chamada de API
  'menu',        // Menu interativo
  'wait',        // Espera
  'goto',        // Salto para outro ponto do fluxo
  'media',       // Envio de mídia (imagem, vídeo, etc)
  'end'          // Finaliza o fluxo
]);

// Tabela de bots
export const chatbots = pgTable("chatbots", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de canais para cada bot
export const chatbotChannels = pgTable("chatbot_channels", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id),
  channelType: channelTypeEnum("channel_type").notNull(),
  name: text("name").notNull(),
  credentials: jsonb("credentials").notNull(), // Credenciais de autenticação específicas do canal
  webhookUrl: text("webhook_url"), // URL do webhook para receber mensagens
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de fluxos para cada bot
export const chatbotFlows = pgTable("chatbot_flows", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Indica se este é o fluxo inicial
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de nós do fluxo
export const chatbotNodes = pgTable("chatbot_nodes", {
  id: serial("id").primaryKey(),
  flowId: integer("flow_id").notNull().references(() => chatbotFlows.id),
  nodeType: nodeTypeEnum("node_type").notNull(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(), // Dados específicos do nó (conteúdo da mensagem, configuração do menu, etc)
  position: jsonb("position").notNull(), // Posição x, y no editor
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de conexões entre nós
export const chatbotEdges = pgTable("chatbot_edges", {
  id: serial("id").primaryKey(),
  flowId: integer("flow_id").notNull().references(() => chatbotFlows.id),
  sourceNodeId: integer("source_node_id").notNull().references(() => chatbotNodes.id),
  targetNodeId: integer("target_node_id").notNull().references(() => chatbotNodes.id),
  sourceHandle: text("source_handle"), // Ponto de saída no nó de origem
  targetHandle: text("target_handle"), // Ponto de entrada no nó de destino
  label: text("label"), // Etiqueta da conexão
  condition: jsonb("condition"), // Condição para seguir este caminho
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de conversas
export const chatbotConversations = pgTable("chatbot_conversations", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id),
  channelId: integer("channel_id").notNull().references(() => chatbotChannels.id),
  externalUserId: text("external_user_id").notNull(), // ID do usuário no canal externo (WhatsApp, Telegram, etc)
  userData: jsonb("user_data"), // Dados coletados sobre o usuário
  currentNodeId: integer("current_node_id").references(() => chatbotNodes.id),
  status: text("status").default("active"), // active, ended, failed
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

// Tabela de mensagens
export const chatbotMessages = pgTable("chatbot_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatbotConversations.id),
  nodeId: integer("node_id").references(() => chatbotNodes.id),
  direction: text("direction").notNull(), // incoming, outgoing
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert Schemas
export const insertChatbotSchema = createInsertSchema(chatbots).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChatbotChannelSchema = createInsertSchema(chatbotChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChatbotFlowSchema = createInsertSchema(chatbotFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChatbotNodeSchema = createInsertSchema(chatbotNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChatbotEdgeSchema = createInsertSchema(chatbotEdges).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChatbotConversationSchema = createInsertSchema(chatbotConversations).omit({
  id: true,
  startedAt: true,
  endedAt: true
});

export const insertChatbotMessageSchema = createInsertSchema(chatbotMessages).omit({
  id: true,
  timestamp: true
});

// Export Types
export type Chatbot = typeof chatbots.$inferSelect;
export type InsertChatbot = z.infer<typeof insertChatbotSchema>;

export type ChatbotChannel = typeof chatbotChannels.$inferSelect;
export type InsertChatbotChannel = z.infer<typeof insertChatbotChannelSchema>;

export type ChatbotFlow = typeof chatbotFlows.$inferSelect;
export type InsertChatbotFlow = z.infer<typeof insertChatbotFlowSchema>;

export type ChatbotNode = typeof chatbotNodes.$inferSelect;
export type InsertChatbotNode = z.infer<typeof insertChatbotNodeSchema>;

export type ChatbotEdge = typeof chatbotEdges.$inferSelect;
export type InsertChatbotEdge = z.infer<typeof insertChatbotEdgeSchema>;

export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type InsertChatbotConversation = z.infer<typeof insertChatbotConversationSchema>;

export type ChatbotMessage = typeof chatbotMessages.$inferSelect;
export type InsertChatbotMessage = z.infer<typeof insertChatbotMessageSchema>;