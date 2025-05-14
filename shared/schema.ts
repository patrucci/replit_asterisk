import { pgTable, text, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tabela de organizações (tenants)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  plan: text("plan").default("basic"), // "basic", "standard", "professional"
  maxUsers: integer("max_users").default(5),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("active"), // "active", "suspended", "inactive"
  settings: text("settings"), // JSON com configurações específicas da organização
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#4f46e5"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").default("user"), // "admin", "supervisor", "user"
  email: text("email"),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    // Garantir que username seja único dentro de uma organização
    unqUsername: unique().on(table.username, table.organizationId),
  };
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  area: text("area").notNull(),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  status: text("status").default("active"),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull(),
  notes: text("notes"),
  status: text("status").default("scheduled"),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").default("pending"), // "paid", "pending", "overdue"
  paymentDate: timestamp("payment_date"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isFromClient: boolean("is_from_client").default(false),
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  timestamp: timestamp("timestamp").defaultNow(),
  duration: integer("duration"),
  notes: text("notes"),
  type: text("type").default("outbound"), // "inbound", "outbound"
});

// Tabela de configurações do Asterisk por organização
export const asteriskSettings = pgTable("asterisk_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id).unique(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(5038),
  username: text("username").notNull(),
  password: text("password").notNull(),
  sipDomain: text("sip_domain"),
  wsUri: text("ws_uri"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para configurações de APIs externas
export const apiSettings = pgTable("api_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id).unique(),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  useOpenAI: boolean("use_openai").default(true),
  useAnthropic: boolean("use_anthropic").default(false),
  openaiModel: text("openai_model").default("gpt-4o"),
  anthropicModel: text("anthropic_model").default("claude-3-7-sonnet-20250219"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de filas de atendimento
export const queues = pgTable("queues", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  strategy: text("strategy").default("ringall"), // "ringall", "leastrecent", "fewestcalls", "random", "rrmemory", "linear", "wrandom"
  timeout: integer("timeout").default(20),
  wrapupTime: integer("wrapup_time").default(5),
  maxWaitTime: integer("max_wait_time").default(300),
  weight: integer("weight").default(0),
  serviceLevelTarget: integer("service_level_target").default(60), // em segundos
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Export Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;
export type ApiSettings = typeof apiSettings.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;
