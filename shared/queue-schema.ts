import { pgTable, serial, text, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums para status de agentes, filas e chamadas
export const agentStatusEnum = pgEnum('agent_status', ['available', 'unavailable', 'busy', 'paused', 'offline']);
export const queuePriorityEnum = pgEnum('queue_priority', ['low', 'normal', 'high', 'emergency']);
export const callStatusEnum = pgEnum('call_status', ['in_queue', 'in_progress', 'completed', 'abandoned', 'transferred']);

// Tabela de grupos de agentes
export const agentGroups = pgTable("agent_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
});

// Tabela de agentes
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  extension: text("extension").notNull(),
  email: text("email"),
  status: agentStatusEnum("status").default("offline").notNull(),
  groupId: integer("group_id").references(() => agentGroups.id),
  skills: text("skills").array(),
  maxConcurrentCalls: integer("max_concurrent_calls").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
});

// Tabela de filas
export const queues = pgTable("queues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  strategy: text("strategy").default("ringall").notNull(), // ringall, leastrecent, fewestcalls, random, etc.
  timeout: integer("timeout").default(60).notNull(), // tempo em segundos
  maxWaitTime: integer("max_wait_time").default(300),
  musicOnHold: text("music_on_hold").default("default"),
  announcement: text("announcement"),
  wrapUpTime: integer("wrap_up_time").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
});

// Tabela de mapeamento de agente para fila (muitos para muitos)
export const queueAgents = pgTable("queue_agents", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => queues.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  priority: integer("priority").default(1), // prioridade do agente na fila
  penalty: integer("penalty").default(0), // penalidade (valor maior = menor prioridade)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de chamadas (histórico e métricas)
export const queueCalls = pgTable("queue_calls", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => queues.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  callerId: text("caller_id").notNull(),
  callerName: text("caller_name"),
  waitTime: integer("wait_time"), // tempo de espera em segundos
  talkTime: integer("talk_time"), // tempo de conversação em segundos
  holdTime: integer("hold_time"), // tempo em espera em segundos
  status: callStatusEnum("status").default("in_queue"),
  recordingPath: text("recording_path"),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
  completedAt: timestamp("completed_at"),
  userId: integer("user_id").notNull(),
});

// Tabela de pausas de agentes (para histórico e métricas)
export const agentPauses = pgTable("agent_pauses", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  reason: text("reason"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  userId: integer("user_id").notNull(),
});

// Tabela de SLAs (Service Level Agreements)
export const queueSlas = pgTable("queue_slas", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => queues.id).notNull(),
  name: text("name").notNull(),
  targetAnswerTime: integer("target_answer_time").notNull(), // tempo em segundos
  targetPercentage: integer("target_percentage").default(80), // percentual alvo (ex: 80%)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
});

// Tabela de anúncios de fila
export const queueAnnouncements = pgTable("queue_announcements", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => queues.id).notNull(),
  message: text("message").notNull(),
  frequency: integer("frequency").default(60), // frequência em segundos
  maxRepeat: integer("max_repeat").default(0), // 0 = ilimitado
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
});

// Tabela de dashboards personalizados
export const queueDashboards = pgTable("queue_dashboards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  layout: text("layout"), // formato JSON com o layout
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").notNull(),
});

// Tabela de widgets de dashboard
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id").references(() => queueDashboards.id).notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // chart, gauge, table, etc.
  dataSource: text("data_source").notNull(),
  config: text("config"), // configuração em JSON
  position: integer("position").default(0),
  size: text("size").default("medium"), // small, medium, large
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas para inserção (com validação)
export const insertAgentGroupSchema = createInsertSchema(agentGroups).pick({
  name: true,
  description: true,
  userId: true,
});

export const insertAgentSchema = createInsertSchema(agents).pick({
  name: true,
  extension: true,
  email: true,
  status: true,
  groupId: true,
  skills: true,
  maxConcurrentCalls: true,
  userId: true,
  organizationId: true,
});

export const insertQueueSchema = createInsertSchema(queues).pick({
  name: true,
  description: true,
  strategy: true,
  timeout: true,
  maxWaitTime: true,
  musicOnHold: true,
  announcement: true,
  wrapUpTime: true,
  userId: true,
  organizationId: true,
});

export const insertQueueAgentSchema = createInsertSchema(queueAgents).pick({
  queueId: true,
  agentId: true,
  priority: true,
  penalty: true,
});

export const insertQueueCallSchema = createInsertSchema(queueCalls).pick({
  queueId: true,
  agentId: true,
  callerId: true,
  callerName: true,
  waitTime: true,
  talkTime: true,
  holdTime: true,
  status: true,
  recordingPath: true,
  enteredAt: true,
  answeredAt: true,
  completedAt: true,
  userId: true,
});

export const insertAgentPauseSchema = createInsertSchema(agentPauses).pick({
  agentId: true,
  reason: true,
  startTime: true,
  endTime: true,
  userId: true,
});

export const insertQueueSlaSchema = createInsertSchema(queueSlas).pick({
  queueId: true,
  name: true,
  targetAnswerTime: true,
  targetPercentage: true,
  userId: true,
});

export const insertQueueAnnouncementSchema = createInsertSchema(queueAnnouncements).pick({
  queueId: true,
  message: true,
  frequency: true,
  maxRepeat: true,
  active: true,
  userId: true,
});

export const insertQueueDashboardSchema = createInsertSchema(queueDashboards).pick({
  name: true,
  description: true,
  layout: true,
  isDefault: true,
  userId: true,
});

export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets).pick({
  dashboardId: true,
  title: true,
  type: true,
  dataSource: true,
  config: true,
  position: true,
  size: true,
});

// Tipos para uso na aplicação
export type AgentGroup = typeof agentGroups.$inferSelect;
export type InsertAgentGroup = z.infer<typeof insertAgentGroupSchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Queue = typeof queues.$inferSelect;
export type InsertQueue = z.infer<typeof insertQueueSchema>;

export type QueueAgent = typeof queueAgents.$inferSelect;
export type InsertQueueAgent = z.infer<typeof insertQueueAgentSchema>;

export type QueueCall = typeof queueCalls.$inferSelect;
export type InsertQueueCall = z.infer<typeof insertQueueCallSchema>;

export type AgentPause = typeof agentPauses.$inferSelect;
export type InsertAgentPause = z.infer<typeof insertAgentPauseSchema>;

export type QueueSla = typeof queueSlas.$inferSelect;
export type InsertQueueSla = z.infer<typeof insertQueueSlaSchema>;

export type QueueAnnouncement = typeof queueAnnouncements.$inferSelect;
export type InsertQueueAnnouncement = z.infer<typeof insertQueueAnnouncementSchema>;

export type QueueDashboard = typeof queueDashboards.$inferSelect;
export type InsertQueueDashboard = z.infer<typeof insertQueueDashboardSchema>;

export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;