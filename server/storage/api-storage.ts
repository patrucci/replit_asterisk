import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

export interface IApiStorage {
  getApiSettings(organizationId: number): Promise<schema.ApiSettings | undefined>;
  createApiSettings(data: schema.InsertApiSettings): Promise<schema.ApiSettings>;
  updateApiSettings(organizationId: number, data: Partial<schema.InsertApiSettings>): Promise<schema.ApiSettings | undefined>;
}

export class ApiStorage implements IApiStorage {
  async getApiSettings(organizationId: number): Promise<schema.ApiSettings | undefined> {
    const [settings] = await db
      .select()
      .from(schema.apiSettings)
      .where(eq(schema.apiSettings.organizationId, organizationId));
    
    return settings;
  }

  async createApiSettings(data: schema.InsertApiSettings): Promise<schema.ApiSettings> {
    const [settings] = await db
      .insert(schema.apiSettings)
      .values(data)
      .returning();
    
    return settings;
  }

  async updateApiSettings(organizationId: number, data: Partial<schema.InsertApiSettings>): Promise<schema.ApiSettings | undefined> {
    // Verificar se já existem configurações para esta organização
    const existingSettings = await this.getApiSettings(organizationId);
    
    if (existingSettings) {
      // Se existir, atualizar
      const [updated] = await db
        .update(schema.apiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.apiSettings.organizationId, organizationId))
        .returning();
      
      return updated;
    } else {
      // Se não existir, criar
      const [settings] = await db
        .insert(schema.apiSettings)
        .values({ ...data, organizationId })
        .returning();
      
      return settings;
    }
  }
}

export const apiStorage = new ApiStorage();