import { Express, Request, Response } from "express";
import { z } from "zod";
import { chatbotStorage } from "./storage/chatbot-storage";
import * as chatbotSchema from "@shared/chatbot-schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configuração do multer para upload de arquivos (imagens, vídeos, etc. para uso no chatbot)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/chatbot");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens e vídeos
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Apenas arquivos de imagem e vídeo são permitidos"));
  },
});

export function setupChatbotRoutes(app: Express, requireAuth: any) {
  // ----- Rotas para chatbots -----
  app.get("/api/chatbots", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbots = await chatbotStorage.getChatbots(req.user!.organizationId);
      res.json(chatbots);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar chatbots" });
    }
  });

  app.get("/api/chatbots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbot = await chatbotStorage.getChatbot(parseInt(req.params.id));
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      // Verifica se o chatbot pertence à organização do usuário
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      res.json(chatbot);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar chatbot" });
    }
  });

  app.post("/api/chatbots", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = chatbotSchema.insertChatbotSchema.safeParse({
        ...req.body,
        organizationId: req.user.organizationId,
      });

      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }

      const chatbot = await chatbotStorage.createChatbot(result.data);
      res.status(201).json(chatbot);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar chatbot" });
    }
  });

  app.put("/api/chatbots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const existingChatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!existingChatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (existingChatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      // Validar os dados de atualização
      const updateSchema = chatbotSchema.insertChatbotSchema.partial();
      const result = updateSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }

      // Garantir que não alterem o organizationId
      if (result.data.organizationId && result.data.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Não é permitido alterar a organização" });
      }
      
      const updatedChatbot = await chatbotStorage.updateChatbot(chatbotId, result.data);
      res.json(updatedChatbot);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar chatbot" });
    }
  });

  app.delete("/api/chatbots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const existingChatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!existingChatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (existingChatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const deleted = await chatbotStorage.deleteChatbot(chatbotId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Erro ao excluir chatbot" });
      }
    } catch (error: any) {
      console.error("Erro ao excluir chatbot:", error);
      res.status(500).json({ error: "Erro ao excluir chatbot", details: error.message });
    }
  });

  // ----- Rotas para canais -----
  app.get("/api/chatbots/:chatbotId/channels", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.chatbotId);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const chatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const channels = await chatbotStorage.getChannels(chatbotId);
      res.json(channels);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar canais" });
    }
  });

  app.get("/api/channels/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const channel = await chatbotStorage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }
      
      // Verifica se o canal pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(channel.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar canal" });
    }
  });

  app.post("/api/chatbots/:chatbotId/channels", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.chatbotId);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const chatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = chatbotSchema.insertChatbotChannelSchema.safeParse({
        ...req.body,
        chatbotId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const channel = await chatbotStorage.createChannel(result.data);
      res.status(201).json(channel);
    } catch (error: any) {
      console.error("Erro ao criar canal:", error);
      res.status(500).json({ error: "Erro ao criar canal", details: error.message });
    }
  });

  app.put("/api/channels/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const channel = await chatbotStorage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }
      
      // Verifica se o canal pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(channel.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const updateSchema = chatbotSchema.insertChatbotChannelSchema.omit({ chatbotId: true }).partial();
      const result = updateSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const updatedChannel = await chatbotStorage.updateChannel(channelId, result.data);
      res.json(updatedChannel);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar canal" });
    }
  });

  app.delete("/api/channels/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const channel = await chatbotStorage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }
      
      // Verifica se o canal pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(channel.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const deleted = await chatbotStorage.deleteChannel(channelId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Erro ao excluir canal" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir canal" });
    }
  });

  // ----- Rotas para fluxos -----
  app.get("/api/chatbots/:chatbotId/flows", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.chatbotId);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const chatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const flows = await chatbotStorage.getFlows(chatbotId);
      res.json(flows);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar fluxos" });
    }
  });

  app.get("/api/flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      res.json(flow);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar fluxo" });
    }
  });

  app.post("/api/chatbots/:chatbotId/flows", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.chatbotId);
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const chatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = chatbotSchema.insertChatbotFlowSchema.safeParse({
        ...req.body,
        chatbotId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const flow = await chatbotStorage.createFlow(result.data);
      res.status(201).json(flow);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar fluxo" });
    }
  });

  app.put("/api/flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const updateSchema = chatbotSchema.insertChatbotFlowSchema.omit({ chatbotId: true }).partial();
      const result = updateSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const updatedFlow = await chatbotStorage.updateFlow(flowId, result.data);
      res.json(updatedFlow);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar fluxo" });
    }
  });

  app.delete("/api/flows/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.id);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const deleted = await chatbotStorage.deleteFlow(flowId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Erro ao excluir fluxo" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir fluxo" });
    }
  });

  // ----- Rotas para nós e arestas (editor de fluxo) -----
  app.get("/api/flows/:flowId/nodes", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const nodes = await chatbotStorage.getNodes(flowId);
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar nós" });
    }
  });

  app.get("/api/flows/:flowId/edges", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const edges = await chatbotStorage.getEdges(flowId);
      res.json(edges);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar arestas" });
    }
  });

  app.post("/api/flows/:flowId/nodes", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = chatbotSchema.insertChatbotNodeSchema.safeParse({
        ...req.body,
        flowId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const node = await chatbotStorage.createNode(result.data);
      res.status(201).json(node);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar nó" });
    }
  });

  app.post("/api/flows/:flowId/edges", requireAuth, async (req: Request, res: Response) => {
    try {
      const flowId = parseInt(req.params.flowId);
      const flow = await chatbotStorage.getFlow(flowId);
      
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      // Verifica se o fluxo pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const result = chatbotSchema.insertChatbotEdgeSchema.safeParse({
        ...req.body,
        flowId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const edge = await chatbotStorage.createEdge(result.data);
      res.status(201).json(edge);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar aresta" });
    }
  });

  app.put("/api/nodes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = parseInt(req.params.id);
      const node = await chatbotStorage.getNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ error: "Nó não encontrado" });
      }
      
      // Verifica se o nó pertence a um fluxo de um chatbot da organização do usuário
      const flow = await chatbotStorage.getFlow(node.flowId);
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const updateSchema = chatbotSchema.insertChatbotNodeSchema.omit({ flowId: true }).partial();
      const result = updateSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const updatedNode = await chatbotStorage.updateNode(nodeId, result.data);
      res.json(updatedNode);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar nó" });
    }
  });

  app.put("/api/edges/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const edgeId = parseInt(req.params.id);
      const edge = await chatbotStorage.getEdge(edgeId);
      
      if (!edge) {
        return res.status(404).json({ error: "Aresta não encontrada" });
      }
      
      // Verifica se a aresta pertence a um fluxo de um chatbot da organização do usuário
      const flow = await chatbotStorage.getFlow(edge.flowId);
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const updateSchema = chatbotSchema.insertChatbotEdgeSchema
        .omit({ 
          flowId: true, 
          sourceNodeId: true, 
          targetNodeId: true 
        })
        .partial();
        
      const result = updateSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos", details: result.error.format() });
      }
      
      const updatedEdge = await chatbotStorage.updateEdge(edgeId, result.data);
      res.json(updatedEdge);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar aresta" });
    }
  });

  app.delete("/api/nodes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const nodeId = parseInt(req.params.id);
      const node = await chatbotStorage.getNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ error: "Nó não encontrado" });
      }
      
      // Verifica se o nó pertence a um fluxo de um chatbot da organização do usuário
      const flow = await chatbotStorage.getFlow(node.flowId);
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const deleted = await chatbotStorage.deleteNode(nodeId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Erro ao excluir nó" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir nó" });
    }
  });

  app.delete("/api/edges/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const edgeId = parseInt(req.params.id);
      const edge = await chatbotStorage.getEdge(edgeId);
      
      if (!edge) {
        return res.status(404).json({ error: "Aresta não encontrada" });
      }
      
      // Verifica se a aresta pertence a um fluxo de um chatbot da organização do usuário
      const flow = await chatbotStorage.getFlow(edge.flowId);
      if (!flow) {
        return res.status(404).json({ error: "Fluxo não encontrado" });
      }
      
      const chatbot = await chatbotStorage.getChatbot(flow.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const deleted = await chatbotStorage.deleteEdge(edgeId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Erro ao excluir aresta" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir aresta" });
    }
  });

  // ----- Rotas para upload de mídias para o chatbot -----
  app.post(
    "/api/chatbot/upload",
    requireAuth,
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Nenhum arquivo enviado" });
        }
        
        const fileUrl = `/uploads/chatbot/${req.file.filename}`;
        res.status(201).json({ url: fileUrl });
      } catch (error) {
        res.status(500).json({ error: "Erro ao fazer upload do arquivo" });
      }
    }
  );

  // ----- Rotas para conversas e mensagens -----
  app.get("/api/chatbots/:chatbotId/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const chatbotId = parseInt(req.params.chatbotId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      // Verifica se o chatbot existe e pertence à organização do usuário
      const chatbot = await chatbotStorage.getChatbot(chatbotId);
      if (!chatbot) {
        return res.status(404).json({ error: "Chatbot não encontrado" });
      }
      
      if (chatbot.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const conversations = await chatbotStorage.getConversations(chatbotId, limit, offset);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar conversas" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await chatbotStorage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }
      
      // Verifica se a conversa pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(conversation.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      const messages = await chatbotStorage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  });

  // ----- Rotas do webhook para canais externos (WhatsApp, etc) -----
  app.post("/api/chatbot/webhook/:channelId", async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const channel = await chatbotStorage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }
      
      // Aqui seria implementada a lógica para processar mensagens recebidas
      // e acionar o fluxo correspondente do chatbot
      
      // Por enquanto, apenas retorna sucesso
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao processar webhook" });
    }
  });

  // ----- Rota para obter código de embedding para websites -----
  app.get("/api/chatbot/embed/:channelId", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const channel = await chatbotStorage.getChannel(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }
      
      // Verifica se o canal pertence a um chatbot da organização do usuário
      const chatbot = await chatbotStorage.getChatbot(channel.chatbotId);
      if (chatbot?.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      // Garante que o canal é do tipo webchat
      if (channel.channelType !== "webchat") {
        return res.status(400).json({ error: "Canal não é do tipo webchat" });
      }
      
      // Gera o código de embedding para o canal
      const embedCode = `<script src="https://${req.get('host')}/chatbot-widget.js" id="proconnect-chatbot" data-channel-id="${channelId}"></script>`;
      
      res.json({ embedCode });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar código de embedding" });
    }
  });
  
  // ----- Arquivo estático para o widget de chatbot -----
  app.get("/chatbot-widget.js", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(path.join(__dirname, "../client/dist/chatbot-widget.js"));
  });
  
  app.get("/chatbot-widget.css", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/css");
    res.sendFile(path.join(__dirname, "../client/dist/chatbot-widget.css"));
  });
}