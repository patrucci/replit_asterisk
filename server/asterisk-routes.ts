import type { Express, Request, Response } from "express";
import { asteriskAMIManager } from "./asterisk-ami";

// Ativar modo de simulação diretamente no código
// Isso é necessário apenas para desenvolvimento enquanto a conexão real com Asterisk não estiver disponível
const SIMULATION_MODE = true; // Defina como false para usar conexão real

export function setupAsteriskRoutes(app: Express, requireAuth: any) {
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
      const isConfigured = false; // TODO: Verificar se há configurações salvas no banco de dados
      
      return res.json({
        connected,
        configured: isConfigured
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
        return res.status(tcpResult.success ? 200 : 400).json(tcpResult);
      } else {
        // Testar a conexão AMI completa
        const result = await asteriskAMIManager.testConnection(host, port, username, password);
        
        if (result.success) {
          return res.json({ 
            success: true, 
            message: "Teste de conexão com o Asterisk AMI bem-sucedido" 
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            message: result.message || "Não foi possível estabelecer conexão com o Asterisk AMI" 
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
        // TODO: Salvar configurações no banco de dados
        
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
  
  // Rota para testar configurações de asterisk existentes
  app.get("/api/asterisk/config", requireAuth, async (req, res) => {
    try {
      // TODO: Implementar busca de configurações salvas no banco de dados
      return res.status(200).json({
        configured: false,
        message: "Nenhuma configuração encontrada"
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