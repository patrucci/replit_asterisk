import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./schema";

// Enum para os tipos de nós/ações nos fluxos unificados
export const nodeTypeEnum = pgEnum('unified_node_type', [
  // Nós comuns (compatíveis com chatbot e discagem)
  'message',       // Mensagem de texto/voz
  'input',         // Captura de entrada do usuário (texto ou DTMF)
  'condition',     // Condição lógica
  'api_request',   // Chamada de API
  'menu',          // Menu interativo
  'wait',          // Espera
  'goto',          // Salto para outro ponto do fluxo
  'media',         // Envio de mídia (imagem, vídeo, etc)
  'end',           // Finaliza o fluxo
  
  // Nós específicos de telefonia
  'answer',        // Atender chamada
  'hangup',        // Desligar chamada
  'dial',          // Discar para um número
  'playback',      // Reproduzir audio
  'record',        // Gravar áudio
  'queue',         // Enviar para fila
  'voicemail',     // Enviar para caixa postal
  'tts',           // Text-to-Speech
  
  // Nós específicos de chatbot
  'webhook',       // Webhook externo 
  'typing',        // Indicador de digitação
  'location',      // Solicitar/enviar localização
  'file',          // Envio de arquivo
  'contact',       // Envio de contato
]);

// Enum para os canais suportados
export const channelTypeEnum = pgEnum('unified_channel_type', [
  'all',           // Todos os canais
  'voice',         // Canais de voz/telefonia
  'chat',          // Canais de chat
  'whatsapp',      // WhatsApp
  'telegram',      // Telegram
  'facebook',      // Facebook
  'instagram',     // Instagram
  'linkedin',      // LinkedIn
  'webchat',       // Webchat
  'sms',           // SMS
  'asterisk',      // Asterisk (telefonia)
  'custom',        // Canal personalizado
]);

// Tabela principal dos fluxos unificados
export const unifiedFlows = pgTable("unified_flows", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  flowType: text("flow_type").notNull().default("standard"), // standard, ivr, chatbot, etc.
  active: boolean("active").default(true),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de nós dos fluxos unificados
export const unifiedNodes = pgTable("unified_nodes", {
  id: serial("id").primaryKey(),
  flowId: integer("flow_id").notNull().references(() => unifiedFlows.id),
  nodeType: nodeTypeEnum("node_type").notNull(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(), // Dados específicos do nó
  position: jsonb("position").notNull(), // Posição x, y no editor
  supportedChannels: jsonb("supported_channels"), // Canais suportados por este nó
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de conexões entre nós
export const unifiedEdges = pgTable("unified_edges", {
  id: serial("id").primaryKey(),
  flowId: integer("flow_id").notNull().references(() => unifiedFlows.id),
  sourceNodeId: integer("source_node_id").notNull().references(() => unifiedNodes.id),
  targetNodeId: integer("target_node_id").notNull().references(() => unifiedNodes.id),
  sourceHandle: text("source_handle"), // Ponto de saída no nó de origem
  targetHandle: text("target_handle"), // Ponto de entrada no nó de destino
  label: text("label"), // Etiqueta da conexão
  condition: jsonb("condition"), // Condição para seguir este caminho
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para gatilhos que iniciam fluxos unificados
export const unifiedTriggers = pgTable("unified_triggers", {
  id: serial("id").primaryKey(),
  flowId: integer("flow_id").notNull().references(() => unifiedFlows.id),
  triggerType: text("trigger_type").notNull(), // inbound_call, webhook, schedule, api, etc.
  channelType: channelTypeEnum("channel_type").notNull(),
  configuration: jsonb("configuration").notNull(), // Configuração específica do gatilho
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para variáveis globais dos fluxos unificados
export const unifiedVariables = pgTable("unified_variables", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  defaultValue: text("default_value"),
  description: text("description"),
  scope: text("scope").notNull().default("global"), // global, flow, session
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas para inserção via zod
export const insertUnifiedFlowSchema = createInsertSchema(unifiedFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUnifiedNodeSchema = createInsertSchema(unifiedNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  data: z.record(z.any()).optional().default({}),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional().default({ x: 0, y: 0 }),
  supportedChannels: z.array(z.string()).optional()
});

export const insertUnifiedEdgeSchema = createInsertSchema(unifiedEdges).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  condition: z.record(z.any()).optional()
});

export const insertUnifiedTriggerSchema = createInsertSchema(unifiedTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  configuration: z.record(z.any()).optional().default({})
});

export const insertUnifiedVariableSchema = createInsertSchema(unifiedVariables).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Tipos exportados
export type UnifiedFlow = typeof unifiedFlows.$inferSelect;
export type InsertUnifiedFlow = z.infer<typeof insertUnifiedFlowSchema>;

export type UnifiedNode = typeof unifiedNodes.$inferSelect;
export type InsertUnifiedNode = z.infer<typeof insertUnifiedNodeSchema>;

export type UnifiedEdge = typeof unifiedEdges.$inferSelect;
export type InsertUnifiedEdge = z.infer<typeof insertUnifiedEdgeSchema>;

export type UnifiedTrigger = typeof unifiedTriggers.$inferSelect;
export type InsertUnifiedTrigger = z.infer<typeof insertUnifiedTriggerSchema>;

export type UnifiedVariable = typeof unifiedVariables.$inferSelect;
export type InsertUnifiedVariable = z.infer<typeof insertUnifiedVariableSchema>;