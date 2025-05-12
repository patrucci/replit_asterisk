import { pgTable, text, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  area: text("area").notNull(),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id),
  status: text("status").default("active"),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
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
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isFromClient: boolean("is_from_client").default(false),
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow(),
  duration: integer("duration"),
  notes: text("notes"),
  type: text("type").default("outbound"), // "inbound", "outbound"
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  email: true,
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  email: true,
  phone: true,
  area: true,
  notes: true,
  userId: true,
  status: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  title: true,
  clientId: true,
  userId: true,
  startTime: true,
  endTime: true,
  type: true,
  notes: true,
  status: true,
});

export const insertPaymentSchema = createInsertSchema(payments).pick({
  clientId: true,
  userId: true,
  amount: true,
  description: true,
  dueDate: true,
  status: true,
  paymentDate: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  clientId: true,
  userId: true,
  content: true,
  timestamp: true,
  isFromClient: true,
});

export const insertCallSchema = createInsertSchema(calls).pick({
  clientId: true,
  userId: true,
  timestamp: true,
  duration: true,
  notes: true,
  type: true,
});

// Export Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
