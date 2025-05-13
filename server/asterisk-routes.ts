import type { Express, Request, Response } from "express";
import { asteriskAMIManager } from "./asterisk-ami";
import { db } from "./db";
import { asteriskSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import dns from "dns";
import { promisify } from "util";

// Desativar modo de simulação para usar conexão real com Asterisk
// Somente use o modo de simulação em situações onde não há servidor Asterisk disponível
const SIMULATION_MODE = false; // false = usar conexão real, true = usar simulação

export function setupAsteriskRoutes(app: Express, requireAuth: any) {
  // Rota para testar a conexão TCP com o servidor Asterisk
  app.post("/api/asterisk/test-connection", requireAuth, async (req, res) => {
    try {
      const { host, port } = req.body;
      
      if (!host || !port) {
        return res.status(400).json({
          success: false,
          message: "Host e porta são obrigatórios"
        });
      }
      
      console.log(`Testando conexão TCP com ${host}:${port}...`);
      
      // Usar o método de teste de conexão TCP do AMI Manager
      const result = await asteriskAMIManager.testTCPConnection(host, Number(port));
      
      return res.json(result);
    } catch (error: any) {
      console.error("Erro ao testar conexão TCP:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar conexão: ${error.message}`,
        error: error.stack
      });
    }
  });
  
  // Rota para executar diagnóstico detalhado de conexão
  app.post("/api/asterisk/diagnose", requireAuth, async (req, res) => {
    try {
      const { host, port } = req.body;
      
      if (!host) {
        return res.status(400).json({
          success: false,
          message: "Host é obrigatório"
        });
      }
      
      console.log(`Executando diagnóstico de conexão para ${host}...`);
      
      // Usar o método de diagnóstico do AMI Manager
      // Usar a porta padrão 5038 se não for especificada
      const portNumber = port ? Number(port) : 5038;
      const diagnosticInfo = await asteriskAMIManager.runConnectionDiagnostics(host, portNumber);
      
      return res.json({
        success: true,
        diagnosticInfo
      });
    } catch (error: any) {
      console.error("Erro ao executar diagnóstico:", error);
      return res.status(500).json({
        success: false,
        message: `Erro ao executar diagnóstico: ${error.message}`,
        error: error.stack
      });
    }
  });
  
  // Rota para realizar consulta DNS e encontrar endereços IP alternativos
  app.post("/api/asterisk/dns-lookup", requireAuth, async (req, res) => {
    try {
      const { hostname } = req.body;
      
      if (!hostname) {
        return res.status(400).json({
          success: false,
          message: "Nome do host é obrigatório"
        });
      }
      
      console.log(`Realizando DNS lookup para ${hostname}...`);
      
      // Promisificar os métodos DNS para usar async/await
      const lookup = promisify(dns.lookup);
      const resolve4 = promisify(dns.resolve4);
      const resolve6 = promisify(dns.resolve6);
      const resolveMx = promisify(dns.resolveMx);
      
      // Resultados
      const results: any = {
        hostname,
        ipv4Addresses: [],
        ipv6Addresses: [],
        mxRecords: [],
        defaultAddress: null
      };
      
      // Obter o endereço padrão (IPv4 ou IPv6)
      try {
        const defaultAddress = await lookup(hostname);
        results.defaultAddress = defaultAddress;
        console.log(`Endereço padrão: ${defaultAddress.address} (${defaultAddress.family})`);
      } catch (err: any) {
        console.error(`Erro ao resolver endereço padrão: ${err.message}`);
      }
      
      // Obter todos os endereços IPv4
      try {
        const ipv4 = await resolve4(hostname);
        results.ipv4Addresses = ipv4;
        console.log(`Endereços IPv4: ${ipv4.join(', ')}`);
      } catch (err: any) {
        console.error(`Erro ao resolver IPv4: ${err.message}`);
      }
      
      // Obter todos os endereços IPv6
      try {
        const ipv6 = await resolve6(hostname);
        results.ipv6Addresses = ipv6;
        console.log(`Endereços IPv6: ${ipv6.join(', ')}`);
      } catch (err: any) {
        console.error(`Erro ao resolver IPv6: ${err.message}`);
      }
      
      // Obter registros MX
      try {
        const mx = await resolveMx(hostname);
        results.mxRecords = mx;
        console.log(`Registros MX: ${mx.map(r => r.exchange).join(', ')}`);
      } catch (err: any) {
        console.error(`Erro ao resolver MX: ${err.message}`);
      }
      
      return res.json({
        success: true,
        results
      });
    } catch (error: any) {
      console.error(`Erro ao realizar DNS lookup: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: `Erro ao realizar DNS lookup: ${error.message}`
      });
    }
  });
  
  // Rota para verificar o status da conexão Asterisk
  app.get("/api/asterisk/status", requireAuth, async (req, res) => {
    try {
      // Se estiver em modo de simulação, considerar como conectado
      if (SIMULATION_MODE) {
        console.log('[SIMULAÇÃO] Retornando status simulado para Asterisk');
        return res.json({
          connected: true,
          configured: true,
          simulation: true
        });
      }

      const connected = asteriskAMIManager.isConnected();
      
      // Verificar se há configurações salvas no banco de dados
      let isConfigured = false;
      let configDetails = {};
      
      try {
        // Buscar a organização do usuário
        const organizationId = req.user!.organizationId;
        
        if (organizationId) {
          const [settings] = await db.select()
            .from(asteriskSettings)
            .where(eq(asteriskSettings.organizationId, organizationId));
          
          if (settings) {
            isConfigured = true;
            configDetails = {
              host: settings.host,
              port: settings.port,
              username: settings.username,
              enabled: settings.enabled
            };
          }
        }
      } catch (dbError) {
        console.error('Erro ao verificar configurações no banco de dados:', dbError);
        // Não falhar toda a requisição por causa do erro no banco
      }
      
      return res.json({
        connected,
        configured: isConfigured,
        ...configDetails
      });
    } catch (error) {
      console.error('Erro ao verificar status do Asterisk:', error);
      return res.status(500).json({ 
        connected: false,
        configured: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para teste de conexão Asterisk
  app.post("/api/asterisk/test-connection", requireAuth, async (req, res) => {
    try {
      const { host, port, username, password, testTcpOnly } = req.body;
      
      // Se estiver em modo de simulação, retornar sucesso simulado
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Retornando teste de conexão simulado para Asterisk ${testTcpOnly ? 'TCP' : 'AMI'}`);
        return res.status(200).json({
          success: true,
          message: `[SIMULAÇÃO] Teste de conexão ${testTcpOnly ? 'TCP' : 'AMI'} simulado com sucesso`,
          type: testTcpOnly ? 'tcp' : 'ami',
          simulation: true,
          details: 'Conexão simulada ativada através da variável de ambiente ASTERISK_SIMULATION_MODE'
        });
      }
      
      // Validar os dados
      if (!host || !port) {
        return res.status(400).json({ 
          success: false,
          message: "Host e porta são obrigatórios" 
        });
      }
      
      // Se for teste TCP apenas, não precisamos de username/password
      if (!testTcpOnly && (!username || !password)) {
        return res.status(400).json({
          success: false,
          message: "Para teste completo AMI, usuário e senha são obrigatórios"
        });
      }
      
      console.log(`Tentando testar conexão com Asterisk ${testTcpOnly ? 'TCP' : 'AMI'}: ${host}:${port}${!testTcpOnly ? ` (usuário: ${username})` : ''}`);
      
      if (testTcpOnly) {
        // Testar apenas a conexão TCP
        const tcpResult = await asteriskAMIManager.testTCPConnection(host, port);
        
        // Incluir informações de diagnóstico na resposta
        const responseData = {
          success: tcpResult.success,
          message: tcpResult.message || "",
          diagnosticInfo: tcpResult.diagnosticInfo || "",
          type: "tcp"
        };
        
        return res.status(tcpResult.success ? 200 : 400).json(responseData);
      } else {
        // Testar a conexão AMI completa
        const result = await asteriskAMIManager.testConnection(host, port, username, password);
        
        if (result.success) {
          return res.json({ 
            success: true, 
            message: "Teste de conexão com o Asterisk AMI bem-sucedido",
            type: "ami"
          });
        } else {
          // Se a conexão AMI falhar, tente executar o diagnóstico TCP para obter mais informações
          const tcpDiagnostic = await asteriskAMIManager.testTCPConnection(host, port);
          
          return res.status(400).json({ 
            success: false, 
            message: result.message || "Não foi possível estabelecer conexão com o Asterisk AMI",
            diagnosticInfo: tcpDiagnostic.diagnosticInfo || "",
            type: "ami"
          });
        }
      }
    } catch (error) {
      console.error('Erro ao testar conexão com Asterisk:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao testar conexão com o Asterisk",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para estabelecer conexão com o Asterisk AMI
  app.post("/api/asterisk/connect", requireAuth, async (req, res) => {
    try {
      const { host, port, username, password } = req.body;
      
      // Validar os dados
      if (!host || !port || !username || !password) {
        return res.status(400).json({ 
          success: false,
          message: "Todos os campos são obrigatórios" 
        });
      }
      
      // Verificar a organização do usuário
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Usuário não pertence a uma organização"
        });
      }
      
      console.log(`Tentando conectar ao AMI: ${host}:${port} com usuário ${username}...`);
      
      // Primeiro testar a conexão
      const testResult = await asteriskAMIManager.testConnection(host, parseInt(port), username, password);
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: testResult.message || "Não foi possível conectar ao servidor Asterisk",
          details: "Teste de conexão falhou. Verifique os detalhes e tente novamente."
        });
      }
      
      // Se o teste for bem sucedido, tentar estabelecer a conexão permanente
      const connected = await asteriskAMIManager.connect(host, parseInt(port), username, password);
      
      if (connected) {
        // Salvar as configurações no banco de dados
        // Primeiro verificar se já existe configuração para essa organização
        const [existingSettings] = await db.select()
          .from(asteriskSettings)
          .where(eq(asteriskSettings.organizationId, organizationId));
        
        if (existingSettings) {
          // Atualizar configurações existentes
          await db.update(asteriskSettings)
            .set({
              host,
              port: parseInt(port),
              username,
              password,
              enabled: true,
              updatedAt: new Date()
            })
            .where(eq(asteriskSettings.id, existingSettings.id));
        } else {
          // Inserir novas configurações
          await db.insert(asteriskSettings)
            .values({
              organizationId,
              host,
              port: parseInt(port),
              username,
              password,
              enabled: true
            });
        }
        
        return res.json({
          success: true,
          message: "Conexão com o Asterisk AMI estabelecida com sucesso",
          host,
          port,
          username
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Não foi possível estabelecer conexão permanente com o Asterisk AMI",
          details: "A conexão foi testada com sucesso, mas falhou ao estabelecer uma conexão permanente."
        });
      }
    } catch (error) {
      console.error('Erro ao conectar com Asterisk:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao conectar com o Asterisk",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para buscar configurações do Asterisk
  app.get("/api/asterisk/config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Buscar a organização do usuário
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Usuário não pertence a uma organização"
        });
      }
      
      // Buscar as configurações no banco de dados
      const [settings] = await db.select()
        .from(asteriskSettings)
        .where(eq(asteriskSettings.organizationId, organizationId));
      
      if (!settings) {
        return res.status(200).json({
          configured: false,
          message: "Nenhuma configuração encontrada"
        });
      }
      
      // Retornar configurações, mas nunca a senha
      return res.status(200).json({
        configured: true,
        id: settings.id,
        host: settings.host,
        port: settings.port,
        username: settings.username,
        sipDomain: settings.sipDomain,
        wsUri: settings.wsUri,
        enabled: settings.enabled,
        createdAt: settings.createdAt,
        message: "Configurações encontradas"
      });
    } catch (error) {
      console.error('Erro ao buscar configurações do Asterisk:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao buscar configurações do Asterisk",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Adicionar rota para desconectar
  app.post("/api/asterisk/disconnect", requireAuth, async (req, res) => {
    try {
      if (!asteriskAMIManager.isConnected()) {
        return res.status(400).json({
          success: false,
          message: "Não há conexão ativa com o Asterisk AMI"
        });
      }
      
      asteriskAMIManager.close();
      
      return res.json({
        success: true,
        message: "Desconectado do Asterisk AMI com sucesso"
      });
    } catch (error) {
      console.error('Erro ao desconectar do Asterisk AMI:', error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao desconectar do Asterisk AMI",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}