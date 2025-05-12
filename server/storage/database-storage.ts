import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { IStorage } from "./storage-interface";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "../db";
import {
  users,
  clients,
  appointments,
  payments,
  messages,
  calls,
  organizations,
  asteriskSettings,
  queues,
  type InsertUser,
  type User,
  type InsertClient,
  type Client,
  type InsertAppointment,
  type Appointment,
  type InsertPayment,
  type Payment,
  type InsertMessage,
  type Message,
  type InsertCall,
  type Call
} from "@shared/schema";

// Inicializar o armazenamento da sessão usando PostgreSQL
const PostgresSessionStore = connectPg(session);

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
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    return user;
  }

  async getUserByUsername(username: string, organizationId?: number): Promise<User | undefined> {
    // Se fornecido organizationId, pesquisa usuário específico para essa organização
    if (organizationId) {
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.username, username),
          eq(users.organizationId, organizationId)
        ));
      
      return user;
    } else {
      // Se não fornecido organizationId, pesquisa qualquer usuário com esse username
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      
      return user;
    }
  }

  async createUser(data: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(data)
      .returning();
    
    return user;
  }

  async updateUser(id: number, data: Partial<any>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a organizações (tenants)
  // ##################################################################
  
  async getOrganization(id: number) {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    
    return organization;
  }

  async getOrganizationBySubdomain(subdomain: string) {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain));
    
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
      .insert(organizations)
      .values(data)
      .returning();
    
    return organization;
  }

  async updateOrganization(id: number, data: any) {
    const [organization] = await db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    
    return organization;
  }

  // ##################################################################
  // # Métodos relacionados a clientes
  // ##################################################################
  
  async getClients(userId: number, organizationId: number): Promise<Client[]> {
    const results = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.organizationId, organizationId),
        eq(clients.userId, userId)
      ));
    
    return results;
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    
    return client;
  }

  async createClient(data: any): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(data)
      .returning();
    
    return client;
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(data)
      .where(eq(clients.id, id))
      .returning();
    
    return client;
  }

  async deleteClient(id: number): Promise<boolean> {
    await db.delete(clients).where(eq(clients.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a compromissos
  // ##################################################################
  
  async getAppointments(userId: number, organizationId: number): Promise<Appointment[]> {
    const results = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.organizationId, organizationId),
        eq(appointments.userId, userId)
      ));
    
    return results;
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));
    
    return appointment;
  }

  async createAppointment(data: any): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values(data)
      .returning();
    
    return appointment;
  }

  async updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [appointment] = await db
      .update(appointments)
      .set(data)
      .where(eq(appointments.id, id))
      .returning();
    
    return appointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    await db.delete(appointments).where(eq(appointments.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a pagamentos
  // ##################################################################
  
  async getPayments(userId: number, organizationId: number): Promise<Payment[]> {
    const results = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.organizationId, organizationId),
        eq(payments.userId, userId)
      ));
    
    return results;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id));
    
    return payment;
  }

  async createPayment(data: any): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(data)
      .returning();
    
    return payment;
  }

  async updatePayment(id: number, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    
    return payment;
  }

  async deletePayment(id: number): Promise<boolean> {
    await db.delete(payments).where(eq(payments.id, id));
    return true;
  }

  // ##################################################################
  // # Métodos relacionados a mensagens
  // ##################################################################
  
  async getMessages(clientId: number): Promise<Message[]> {
    const results = await db
      .select()
      .from(messages)
      .where(eq(messages.clientId, clientId))
      .orderBy(messages.timestamp);
    
    return results;
  }

  async createMessage(data: any): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(data)
      .returning();
    
    return message;
  }

  // ##################################################################
  // # Métodos relacionados a chamadas
  // ##################################################################
  
  async getCalls(clientId: number): Promise<Call[]> {
    const results = await db
      .select()
      .from(calls)
      .where(eq(calls.clientId, clientId))
      .orderBy(calls.timestamp);
    
    return results;
  }

  async createCall(data: any): Promise<Call> {
    const [call] = await db
      .insert(calls)
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
      .from(asteriskSettings)
      .where(eq(asteriskSettings.organizationId, organizationId));
    
    return settings;
  }

  async updateAsteriskSettings(organizationId: number, data: any) {
    // Verificar se já existem configurações para esta organização
    const existingSettings = await this.getAsteriskSettings(organizationId);
    
    if (existingSettings) {
      // Atualizar configurações existentes
      const [settings] = await db
        .update(asteriskSettings)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(asteriskSettings.organizationId, organizationId))
        .returning();
      
      return settings;
    } else {
      // Criar novas configurações
      const [settings] = await db
        .insert(asteriskSettings)
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
      .from(queues)
      .where(eq(queues.organizationId, organizationId));
    
    return results;
  }

  async getQueue(id: number) {
    const [queue] = await db
      .select()
      .from(queues)
      .where(eq(queues.id, id));
    
    return queue;
  }

  async createQueue(data: any) {
    const [queue] = await db
      .insert(queues)
      .values(data)
      .returning();
    
    return queue;
  }

  async updateQueue(id: number, data: any) {
    const [queue] = await db
      .update(queues)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(queues.id, id))
      .returning();
    
    return queue;
  }

  async deleteQueue(id: number): Promise<boolean> {
    await db.delete(queues).where(eq(queues.id, id));
    return true;
  }
}