import { 
  users, type User, type InsertUser,
  clients, type Client, type InsertClient,
  appointments, type Appointment, type InsertAppointment,
  payments, type Payment, type InsertPayment,
  messages, type Message, type InsertMessage,
  calls, type Call, type InsertCall,
  organizations
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./storage/index";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";

const MemoryStore = createMemoryStore(session);

// Interface for storage operations
import { AgentGroup, Agent, Queue, QueueAgent, QueueCall, AgentPause, QueueSla, 
  QueueAnnouncement, QueueDashboard, DashboardWidget, InsertAgentGroup, InsertAgent, 
  InsertQueue, InsertQueueAgent, InsertQueueCall, InsertAgentPause, InsertQueueSla, 
  InsertQueueAnnouncement, InsertQueueDashboard, InsertDashboardWidget } from "@shared/queue-schema";

export interface IStorage {
  // Session store
  sessionStore: session.SessionStore;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Client operations
  getClients(userId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Appointment operations
  getAppointments(userId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // Payment operations
  getPayments(userId: number): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;
  
  // Message operations
  getMessages(clientId: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Call operations
  getCalls(clientId: number): Promise<Call[]>;
  getCall(id: number): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  
  // Queue operations - Agent Groups
  getAgentGroups(userId: number): Promise<AgentGroup[]>;
  getAgentGroup(id: number): Promise<AgentGroup | undefined>;
  createAgentGroup(group: InsertAgentGroup): Promise<AgentGroup>;
  updateAgentGroup(id: number, group: Partial<InsertAgentGroup>): Promise<AgentGroup | undefined>;
  deleteAgentGroup(id: number): Promise<boolean>;
  
  // Queue operations - Agents
  getAgents(userId: number): Promise<Agent[]>;
  getAgentsByGroup(groupId: number): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;
  
  // Queue operations - Queues
  getQueues(userId: number): Promise<Queue[]>;
  getQueue(id: number): Promise<Queue | undefined>;
  createQueue(queue: InsertQueue): Promise<Queue>;
  updateQueue(id: number, queue: Partial<InsertQueue>): Promise<Queue | undefined>;
  deleteQueue(id: number): Promise<boolean>;
  
  // Queue operations - Queue-Agent mappings
  getQueueAgents(queueId: number): Promise<QueueAgent[]>;
  getAgentQueues(agentId: number): Promise<QueueAgent[]>;
  createQueueAgent(queueAgent: InsertQueueAgent): Promise<QueueAgent>;
  updateQueueAgent(id: number, queueAgent: Partial<InsertQueueAgent>): Promise<QueueAgent | undefined>;
  deleteQueueAgent(id: number): Promise<boolean>;
  
  // Queue operations - Queue Calls
  getQueueCalls(queueId: number): Promise<QueueCall[]>;
  getAgentCalls(agentId: number): Promise<QueueCall[]>;
  getQueueCall(id: number): Promise<QueueCall | undefined>;
  createQueueCall(call: InsertQueueCall): Promise<QueueCall>;
  updateQueueCall(id: number, call: Partial<InsertQueueCall>): Promise<QueueCall | undefined>;
  
  // Queue operations - Agent Pauses
  getAgentPauses(agentId: number): Promise<AgentPause[]>;
  createAgentPause(pause: InsertAgentPause): Promise<AgentPause>;
  updateAgentPause(id: number, pause: Partial<InsertAgentPause>): Promise<AgentPause | undefined>;
  
  // Queue operations - SLAs
  getQueueSlas(queueId: number): Promise<QueueSla[]>;
  createQueueSla(sla: InsertQueueSla): Promise<QueueSla>;
  updateQueueSla(id: number, sla: Partial<InsertQueueSla>): Promise<QueueSla | undefined>;
  deleteQueueSla(id: number): Promise<boolean>;
  
  // Queue operations - Announcements
  getQueueAnnouncements(queueId: number): Promise<QueueAnnouncement[]>;
  createQueueAnnouncement(announcement: InsertQueueAnnouncement): Promise<QueueAnnouncement>;
  updateQueueAnnouncement(id: number, announcement: Partial<InsertQueueAnnouncement>): Promise<QueueAnnouncement | undefined>;
  deleteQueueAnnouncement(id: number): Promise<boolean>;
  
  // Queue operations - Dashboards
  getQueueDashboards(userId: number): Promise<QueueDashboard[]>;
  getQueueDashboard(id: number): Promise<QueueDashboard | undefined>;
  createQueueDashboard(dashboard: InsertQueueDashboard): Promise<QueueDashboard>;
  updateQueueDashboard(id: number, dashboard: Partial<InsertQueueDashboard>): Promise<QueueDashboard | undefined>;
  deleteQueueDashboard(id: number): Promise<boolean>;
  
  // Queue operations - Dashboard Widgets
  getDashboardWidgets(dashboardId: number): Promise<DashboardWidget[]>;
  createDashboardWidget(widget: InsertDashboardWidget): Promise<DashboardWidget>;
  updateDashboardWidget(id: number, widget: Partial<InsertDashboardWidget>): Promise<DashboardWidget | undefined>;
  deleteDashboardWidget(id: number): Promise<boolean>;
}

export class DbStorage implements IStorage {
  
  sessionStore: session.SessionStore;

  constructor() {
    // Importar pool e configurar o session store
    const Pool = require('connect-pg-simple');
    const PostgresSessionStore = Pool(session);
    
    this.sessionStore = new PostgresSessionStore({
      createTableIfMissing: true,
      pool, // Já está importado a partir do arquivo de storage/index.ts
    });
  }

  // User methods - com suporte a multitenancy
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string, organizationId?: number): Promise<User | undefined> {
    let query = db.select().from(users).where(eq(users.username, username));
    if (organizationId) {
      query = query.where(eq(users.organizationId, organizationId));
    }
    const [user] = await query;
    return user;
  }

  async createUser(userData: InsertUser & { organizationId: number }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Client methods - com suporte a multitenancy
  async getClients(userId: number, organizationId: number): Promise<Client[]> {
    const result = await db.select()
      .from(clients)
      .where(and(
        eq(clients.userId, userId),
        eq(clients.organizationId, organizationId)
      ));
    return result;
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(clientData: InsertClient & { organizationId: number }): Promise<Client> {
    const [client] = await db.insert(clients).values(clientData).returning();
    return client;
  }

  async updateClient(id: number, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients)
      .set(clientUpdate)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return !!result;
  }

  // Appointment methods - com suporte a multitenancy
  async getAppointments(userId: number, organizationId: number): Promise<Appointment[]> {
    const result = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.userId, userId),
        eq(appointments.organizationId, organizationId)
      ));
    return result;
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async createAppointment(appointmentData: InsertAppointment & { organizationId: number }): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(appointmentData).returning();
    return appointment;
  }

  async updateAppointment(id: number, appointmentUpdate: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [appointment] = await db.update(appointments)
      .set(appointmentUpdate)
      .where(eq(appointments.id, id))
      .returning();
    return appointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id));
    return !!result;
  }

  // Payment methods - com suporte a multitenancy
  async getPayments(userId: number, organizationId: number): Promise<Payment[]> {
    const result = await db.select()
      .from(payments)
      .where(and(
        eq(payments.userId, userId),
        eq(payments.organizationId, organizationId)
      ));
    return result;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(paymentData: InsertPayment & { organizationId: number }): Promise<Payment> {
    const [payment] = await db.insert(payments).values(paymentData).returning();
    return payment;
  }

  async updatePayment(id: number, paymentUpdate: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments)
      .set(paymentUpdate)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id));
    return !!result;
  }

  // Message methods - com suporte a multitenancy
  async getMessages(clientId: number): Promise<Message[]> {
    const result = await db.select()
      .from(messages)
      .where(eq(messages.clientId, clientId));
    return result;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async createMessage(messageData: InsertMessage & { organizationId: number }): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    return message;
  }

  // Call methods - com suporte a multitenancy
  async getCalls(clientId: number): Promise<Call[]> {
    const result = await db.select()
      .from(calls)
      .where(eq(calls.clientId, clientId));
    return result;
  }

  async getCall(id: number): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call;
  }

  async createCall(callData: InsertCall & { organizationId: number }): Promise<Call> {
    const [call] = await db.insert(calls).values(callData).returning();
    return call;
  }
  
  // Organizations
  async getOrganization(id: number) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }
  
  async getOrganizationBySubdomain(subdomain: string) {
    const [org] = await db.select().from(organizations).where(eq(organizations.subdomain, subdomain));
    return org;
  }
  
  async createOrganization(data: { 
    name: string; 
    subdomain: string;
    plan?: string;
    maxUsers?: number;
    contactEmail?: string;
    contactPhone?: string;
  }) {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }
  
  async updateOrganization(id: number, data: any) {
    const [org] = await db.update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return org;
  }
}

export const storage = new DbStorage();
