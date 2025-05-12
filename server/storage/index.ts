import session from "express-session";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import connectPg from "connect-pg-simple";
import * as schema from "@shared/schema";
import { 
  eq, 
  and 
} from "drizzle-orm";

// Configurar o WebSocket para Neon Serverless
neonConfig.webSocketConstructor = ws;

// Verificar se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Inicializar o pool de conexões do PostgreSQL
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Inicializar o cliente Drizzle com o schema
export const db = drizzle(pool, { schema });

// Inicializar o armazenamento da sessão usando PostgreSQL
const PostgresSessionStore = connectPg(session);

// Interface para operações de armazenamento
export interface IStorage {
  // Armazenamento de sessão
  sessionStore: session.Store;

  // Métodos relacionados a usuários
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string, organizationId?: number): Promise<schema.User | undefined>;
  createUser(data: schema.InsertUser & { organizationId: number }): Promise<schema.User>;
  updateUser(id: number, data: Partial<schema.InsertUser>): Promise<schema.User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Métodos relacionados a organizações (tenants)
  getOrganization(id: number): Promise<any>;
  getOrganizationBySubdomain(subdomain: string): Promise<any>;
  createOrganization(data: { 
    name: string; 
    subdomain: string;
    plan?: string;
    maxUsers?: number;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<any>;
  updateOrganization(id: number, data: any): Promise<any>;

  // Métodos relacionados a clientes
  getClients(userId: number, organizationId: number): Promise<schema.Client[]>;
  getClient(id: number): Promise<schema.Client | undefined>;
  createClient(data: schema.InsertClient & { organizationId: number }): Promise<schema.Client>;
  updateClient(id: number, data: Partial<schema.InsertClient>): Promise<schema.Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Métodos relacionados a compromissos
  getAppointments(userId: number, organizationId: number): Promise<schema.Appointment[]>;
  getAppointment(id: number): Promise<schema.Appointment | undefined>;
  createAppointment(data: schema.InsertAppointment & { organizationId: number }): Promise<schema.Appointment>;
  updateAppointment(id: number, data: Partial<schema.InsertAppointment>): Promise<schema.Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;

  // Métodos relacionados a pagamentos
  getPayments(userId: number, organizationId: number): Promise<schema.Payment[]>;
  getPayment(id: number): Promise<schema.Payment | undefined>;
  createPayment(data: schema.InsertPayment & { organizationId: number }): Promise<schema.Payment>;
  updatePayment(id: number, data: Partial<schema.InsertPayment>): Promise<schema.Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;

  // Métodos relacionados a mensagens
  getMessages(clientId: number): Promise<schema.Message[]>;
  createMessage(data: schema.InsertMessage & { organizationId: number }): Promise<schema.Message>;

  // Métodos relacionados a chamadas
  getCalls(clientId: number): Promise<schema.Call[]>;
  createCall(data: schema.InsertCall & { organizationId: number }): Promise<schema.Call>;

  // Métodos relacionados a configurações do Asterisk
  getAsteriskSettings(organizationId: number): Promise<any>;
  updateAsteriskSettings(organizationId: number, data: any): Promise<any>;

  // Métodos relacionados a filas de atendimento
  getQueues(organizationId: number): Promise<any[]>;
  getQueue(id: number): Promise<any | undefined>;
  createQueue(data: any): Promise<any>;
  updateQueue(id: number, data: any): Promise<any>;
  deleteQueue(id: number): Promise<boolean>;
}

// Implementação do armazenamento usando banco de dados
export class DatabaseStorage implements IStorage {
  // Instância do armazenamento de sessão
  sessionStore: session.Store;

  constructor() {
    // Inicializar o armazenamento de sessão com o pool de conexões do banco de dados
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // ##################################################################
  // # Métodos relacionados a usuários
  // ##################################################################
  
  async getUser(id: number): Promise<schema.User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    
    return user;
  }

  async getUserByUsername(username: string, organizationId?: number): Promise<schema.User | undefined> {
    // Se fornecido organizationId, pesquisa usuário específico para essa organização
    if (organizationId) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(and(
          eq(schema.users.username, username),
          eq(schema.users.organizationId, organizationId)
        ));
      
      return user;
    } else {
      // Se não fornecido organizationId, pesquisa qualquer usuário com esse username
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, username));
      
      return user;
    }
  }

  async createUser(data: any): Promise<schema.User> {
    const [user] = await db
      .insert(schema.users)
      .values(data)
      .returning();
    
    return user;
  }

  async updateUser(id: number, data: Partial<any>): Promise<schema.User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning();
    
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.users)
      .where(eq(schema.users.id, id));
    
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a organizações (tenants)
  // ##################################################################
  
  async getOrganization(id: number) {
    const [organization] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id));
    
    return organization;
  }

  async getOrganizationBySubdomain(subdomain: string) {
    const [organization] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.subdomain, subdomain));
    
    return organization;
  }

  async createOrganization(data: { 
    name: string; 
    subdomain: string;
    plan?: string;
    maxUsers?: number;
    contactEmail?: string;
    contactPhone?: string;
  }) {
    const [organization] = await db
      .insert(schema.organizations)
      .values(data)
      .returning();
    
    return organization;
  }

  async updateOrganization(id: number, data: any) {
    const [organization] = await db
      .update(schema.organizations)
      .set(data)
      .where(eq(schema.organizations.id, id))
      .returning();
    
    return organization;
  }

  // ##################################################################
  // # Métodos relacionados a clientes
  // ##################################################################
  
  async getClients(userId: number, organizationId: number): Promise<schema.Client[]> {
    const results = await db
      .select()
      .from(schema.clients)
      .where(and(
        eq(schema.clients.organizationId, organizationId),
        eq(schema.clients.userId, userId)
      ));
    
    return results;
  }

  async getClient(id: number): Promise<schema.Client | undefined> {
    const [client] = await db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, id));
    
    return client;
  }

  async createClient(data: any): Promise<schema.Client> {
    const [client] = await db
      .insert(schema.clients)
      .values(data)
      .returning();
    
    return client;
  }

  async updateClient(id: number, data: Partial<schema.InsertClient>): Promise<schema.Client | undefined> {
    const [client] = await db
      .update(schema.clients)
      .set(data)
      .where(eq(schema.clients.id, id))
      .returning();
    
    return client;
  }

  async deleteClient(id: number): Promise<boolean> {
    await db.delete(schema.clients).where(eq(schema.clients.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a compromissos
  // ##################################################################
  
  async getAppointments(userId: number, organizationId: number): Promise<schema.Appointment[]> {
    const results = await db
      .select()
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.organizationId, organizationId),
        eq(schema.appointments.userId, userId)
      ));
    
    return results;
  }

  async getAppointment(id: number): Promise<schema.Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id));
    
    return appointment;
  }

  async createAppointment(data: any): Promise<schema.Appointment> {
    const [appointment] = await db
      .insert(schema.appointments)
      .values(data)
      .returning();
    
    return appointment;
  }

  async updateAppointment(id: number, data: Partial<schema.InsertAppointment>): Promise<schema.Appointment | undefined> {
    const [appointment] = await db
      .update(schema.appointments)
      .set(data)
      .where(eq(schema.appointments.id, id))
      .returning();
    
    return appointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a pagamentos
  // ##################################################################
  
  async getPayments(userId: number, organizationId: number): Promise<schema.Payment[]> {
    const results = await db
      .select()
      .from(schema.payments)
      .where(and(
        eq(schema.payments.organizationId, organizationId),
        eq(schema.payments.userId, userId)
      ));
    
    return results;
  }

  async getPayment(id: number): Promise<schema.Payment | undefined> {
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, id));
    
    return payment;
  }

  async createPayment(data: any): Promise<schema.Payment> {
    const [payment] = await db
      .insert(schema.payments)
      .values(data)
      .returning();
    
    return payment;
  }

  async updatePayment(id: number, data: Partial<schema.InsertPayment>): Promise<schema.Payment | undefined> {
    const [payment] = await db
      .update(schema.payments)
      .set(data)
      .where(eq(schema.payments.id, id))
      .returning();
    
    return payment;
  }

  async deletePayment(id: number): Promise<boolean> {
    await db.delete(schema.payments).where(eq(schema.payments.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a mensagens
  // ##################################################################
  
  async getMessages(clientId: number): Promise<schema.Message[]> {
    const results = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.clientId, clientId))
      .orderBy(schema.messages.timestamp);
    
    return results;
  }

  async createMessage(data: any): Promise<schema.Message> {
    const [message] = await db
      .insert(schema.messages)
      .values(data)
      .returning();
    
    return message;
  }

  // ##################################################################
  // # Métodos relacionados a chamadas
  // ##################################################################
  
  async getCalls(clientId: number): Promise<schema.Call[]> {
    const results = await db
      .select()
      .from(schema.calls)
      .where(eq(schema.calls.clientId, clientId))
      .orderBy(schema.calls.timestamp);
    
    return results;
  }

  async createCall(data: any): Promise<schema.Call> {
    const [call] = await db
      .insert(schema.calls)
      .values(data)
      .returning();
    
    return call;
  }

  // ##################################################################
  // # Métodos relacionados a configurações do Asterisk
  // ##################################################################
  
  async getAsteriskSettings(organizationId: number) {
    const [settings] = await db
      .select()
      .from(schema.asteriskSettings)
      .where(eq(schema.asteriskSettings.organizationId, organizationId));
    
    return settings;
  }

  async updateAsteriskSettings(organizationId: number, data: any) {
    // Verificar se já existem configurações para esta organização
    const existingSettings = await this.getAsteriskSettings(organizationId);
    
    if (existingSettings) {
      // Atualizar configurações existentes
      const [settings] = await db
        .update(schema.asteriskSettings)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(schema.asteriskSettings.organizationId, organizationId))
        .returning();
      
      return settings;
    } else {
      // Criar novas configurações
      const [settings] = await db
        .insert(schema.asteriskSettings)
        .values({
          organizationId,
          ...data
        })
        .returning();
      
      return settings;
    }
  }

  // ##################################################################
  // # Métodos relacionados a filas de atendimento
  // ##################################################################
  
  async getQueues(organizationId: number) {
    const results = await db
      .select()
      .from(schema.queues)
      .where(eq(schema.queues.organizationId, organizationId));
    
    return results;
  }

  async getQueue(id: number) {
    const [queue] = await db
      .select()
      .from(schema.queues)
      .where(eq(schema.queues.id, id));
    
    return queue;
  }

  async createQueue(data: any) {
    const [queue] = await db
      .insert(schema.queues)
      .values(data)
      .returning();
    
    return queue;
  }

  async updateQueue(id: number, data: any) {
    const [queue] = await db
      .update(schema.queues)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.queues.id, id))
      .returning();
    
    return queue;
  }

  async deleteQueue(id: number): Promise<boolean> {
    await db.delete(schema.queues).where(eq(schema.queues.id, id));
    return true;
  }
}

// Exportar a instância do armazenamento
export const storage = new DatabaseStorage();