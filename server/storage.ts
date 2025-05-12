import { 
  users, type User, type InsertUser,
  clients, type Client, type InsertClient,
  appointments, type Appointment, type InsertAppointment,
  payments, type Payment, type InsertPayment,
  messages, type Message, type InsertMessage,
  calls, type Call, type InsertCall
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Interface for storage operations
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
}

export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private clientsMap: Map<number, Client>;
  private appointmentsMap: Map<number, Appointment>;
  private paymentsMap: Map<number, Payment>;
  private messagesMap: Map<number, Message>;
  private callsMap: Map<number, Call>;
  
  sessionStore: session.SessionStore;
  
  private userId: number;
  private clientId: number;
  private appointmentId: number;
  private paymentId: number;
  private messageId: number;
  private callId: number;

  constructor() {
    this.usersMap = new Map();
    this.clientsMap = new Map();
    this.appointmentsMap = new Map();
    this.paymentsMap = new Map();
    this.messagesMap = new Map();
    this.callsMap = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    this.userId = 1;
    this.clientId = 1;
    this.appointmentId = 1;
    this.paymentId = 1;
    this.messageId = 1;
    this.callId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.usersMap.set(id, user);
    return user;
  }

  // Client methods
  async getClients(userId: number): Promise<Client[]> {
    return Array.from(this.clientsMap.values()).filter(
      (client) => client.userId === userId
    );
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clientsMap.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.clientId++;
    const client: Client = { ...insertClient, id };
    this.clientsMap.set(id, client);
    return client;
  }

  async updateClient(id: number, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const existingClient = this.clientsMap.get(id);
    if (!existingClient) return undefined;
    
    const updatedClient = { ...existingClient, ...clientUpdate };
    this.clientsMap.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: number): Promise<boolean> {
    return this.clientsMap.delete(id);
  }

  // Appointment methods
  async getAppointments(userId: number): Promise<Appointment[]> {
    return Array.from(this.appointmentsMap.values()).filter(
      (appointment) => appointment.userId === userId
    );
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointmentsMap.get(id);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentId++;
    const appointment: Appointment = { ...insertAppointment, id };
    this.appointmentsMap.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: number, appointmentUpdate: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const existingAppointment = this.appointmentsMap.get(id);
    if (!existingAppointment) return undefined;
    
    const updatedAppointment = { ...existingAppointment, ...appointmentUpdate };
    this.appointmentsMap.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    return this.appointmentsMap.delete(id);
  }

  // Payment methods
  async getPayments(userId: number): Promise<Payment[]> {
    return Array.from(this.paymentsMap.values()).filter(
      (payment) => payment.userId === userId
    );
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    return this.paymentsMap.get(id);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = this.paymentId++;
    const payment: Payment = { ...insertPayment, id };
    this.paymentsMap.set(id, payment);
    return payment;
  }

  async updatePayment(id: number, paymentUpdate: Partial<InsertPayment>): Promise<Payment | undefined> {
    const existingPayment = this.paymentsMap.get(id);
    if (!existingPayment) return undefined;
    
    const updatedPayment = { ...existingPayment, ...paymentUpdate };
    this.paymentsMap.set(id, updatedPayment);
    return updatedPayment;
  }

  async deletePayment(id: number): Promise<boolean> {
    return this.paymentsMap.delete(id);
  }

  // Message methods
  async getMessages(clientId: number): Promise<Message[]> {
    return Array.from(this.messagesMap.values()).filter(
      (message) => message.clientId === clientId
    );
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messagesMap.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const message: Message = { ...insertMessage, id };
    this.messagesMap.set(id, message);
    return message;
  }

  // Call methods
  async getCalls(clientId: number): Promise<Call[]> {
    return Array.from(this.callsMap.values()).filter(
      (call) => call.clientId === clientId
    );
  }

  async getCall(id: number): Promise<Call | undefined> {
    return this.callsMap.get(id);
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = this.callId++;
    const call: Call = { ...insertCall, id };
    this.callsMap.set(id, call);
    return call;
  }
}

export const storage = new MemStorage();
