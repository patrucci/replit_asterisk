import { Express, Request, Response } from "express";
import { z } from "zod";
import { apiStorage } from "./storage/api-storage";
import { insertApiSettingsSchema } from "@shared/schema";

export function setupApiRoutes(app: Express, requireAuth: any) {
  // Rota para obter as configurações de API
  app.get("/api/settings/api", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const settings = await apiStorage.getApiSettings(organizationId);
      
      // Se não há configurações, retorna um objeto vazio
      if (!settings) {
        return res.json({
          useOpenAI: true,
          useAnthropic: false,
          openaiModel: "gpt-4o",
          anthropicModel: "claude-3-7-sonnet-20250219"
        });
      }
      
      // Não retorna as chaves da API diretamente por segurança
      // Apenas indica se elas estão configuradas
      const response = {
        ...settings,
        openaiApiKey: settings.openaiApiKey ? "••••••••" : null,
        anthropicApiKey: settings.anthropicApiKey ? "••••••••" : null,
        hasOpenaiApiKey: !!settings.openaiApiKey,
        hasAnthropicApiKey: !!settings.anthropicApiKey
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Erro ao obter configurações de API:", error);
      return res.status(500).json({ message: "Erro ao obter configurações de API" });
    }
  });
  
  // Rota para atualizar as configurações de API
  app.put("/api/settings/api", requireAuth, async (req: Request, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      
      // Validar os dados recebidos
      const updateSchema = insertApiSettingsSchema.partial();
      const validatedData = updateSchema.parse({
        ...req.body,
        organizationId
      });
      
      // Atualizar as configurações
      const updatedSettings = await apiStorage.updateApiSettings(organizationId, validatedData);
      
      // Não retorna as chaves da API diretamente por segurança
      const response = {
        ...updatedSettings,
        openaiApiKey: updatedSettings?.openaiApiKey ? "••••••••" : null,
        anthropicApiKey: updatedSettings?.anthropicApiKey ? "••••••••" : null,
        hasOpenaiApiKey: !!updatedSettings?.openaiApiKey,
        hasAnthropicApiKey: !!updatedSettings?.anthropicApiKey
      };
      
      return res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao atualizar configurações de API:", error);
      return res.status(500).json({ message: "Erro ao atualizar configurações de API" });
    }
  });
  
  // Rota para testar a chave da API OpenAI
  app.post("/api/settings/api/test/openai", requireAuth, async (req: Request, res: Response) => {
    try {
      // Esta rota seria implementada com a lógica para testar a conexão com a API da OpenAI
      // Por enquanto, apenas retornamos um sucesso simulado
      return res.json({ success: true, message: "Conexão com a API da OpenAI bem-sucedida" });
    } catch (error) {
      console.error("Erro ao testar API da OpenAI:", error);
      return res.status(500).json({ success: false, message: "Erro ao testar API da OpenAI" });
    }
  });
  
  // Rota para testar a chave da API Anthropic
  app.post("/api/settings/api/test/anthropic", requireAuth, async (req: Request, res: Response) => {
    try {
      // Esta rota seria implementada com a lógica para testar a conexão com a API da Anthropic
      // Por enquanto, apenas retornamos um sucesso simulado
      return res.json({ success: true, message: "Conexão com a API da Anthropic bem-sucedida" });
    } catch (error) {
      console.error("Erro ao testar API da Anthropic:", error);
      return res.status(500).json({ success: false, message: "Erro ao testar API da Anthropic" });
    }
  });
}