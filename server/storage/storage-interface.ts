import session from "express-session";
import {
  User,
  InsertUser,
  Client,
  InsertClient,
  Appointment,
  InsertAppointment,
  Payment,
  InsertPayment,
  Message,
  InsertMessage,
  Call,
  InsertCall
} from "@shared/schema";

export interface IStorage {
  // Armazenamento de sessão
  sessionStore: session.SessionStore;

  // Métodos relacionados a usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string, organizationId?: number): Promise<User | undefined>;
  createUser(data: InsertUser & { organizationId: number }): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
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
  getClients(userId: number, organizationId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(data: InsertClient & { organizationId: number }): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Métodos relacionados a compromissos
  getAppointments(userId: number, organizationId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment & { organizationId: number }): Promise<Appointment>;
  updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;

  // Métodos relacionados a pagamentos
  getPayments(userId: number, organizationId: number): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(data: InsertPayment & { organizationId: number }): Promise<Payment>;
  updatePayment(id: number, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;

  // Métodos relacionados a mensagens
  getMessages(clientId: number): Promise<Message[]>;
  createMessage(data: InsertMessage & { organizationId: number }): Promise<Message>;

  // Métodos relacionados a chamadas
  getCalls(clientId: number): Promise<Call[]>;
  createCall(data: InsertCall & { organizationId: number }): Promise<Call>;

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