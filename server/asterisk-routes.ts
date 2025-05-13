import type { Express, Request, Response } from "express";
import { asteriskAMIManager } from "./asterisk-ami";
import { db } from "./db";
import { asteriskSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import dns from "dns";
import { promisify } from "util";

// Desativar modo de simulação para usar conexão real com Asterisk
const SIMULATION_MODE = false; // false = usar conexão real, true = usar simulação

export function setupAsteriskRoutes(app: Express, requireAuth: any) {
  // Definir modo de simulação do manager
  asteriskAMIManager.simulationMode = SIMULATION_MODE;
  console.log(`Asterisk Manager modo de simulação: ${SIMULATION_MODE ? 'ATIVADO' : 'DESATIVADO'}`);
  
  // Rota para testar portas específicas em um servidor
  app.post("/api/asterisk/test-ports", requireAuth, async (req, res) => {
    try {
      const { host, ports } = req.body;
      
      if (!host || !ports || !Array.isArray(ports) || ports.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Host e lista de portas são obrigatórios"
        });
      }
      
      console.log(`Testando portas em ${host}: ${ports.join(', ')}...`);
      
      // Array para armazenar portas abertas
      const openPorts: number[] = [];
      
      // Testar cada porta individualmente
      // Para o teste de portas personalizadas, usaremos direto o testTCPConnection
      // mas com timeout reduzido
      
      for (const port of ports) {
        console.log(`Testando porta ${port} em ${host}...`);
        
        try {
          // Usar o método existente, mas adicionar argumento para timeout reduzido
          const result = await asteriskAMIManager.testTCPConnection(host, port, 3000); // 3 segundos
          
          if (result.success) {
            openPorts.push(port);
          }
        } catch (err) {
          console.error(`Erro ao testar porta ${port}:`, err);
          // Continuar mesmo se uma porta falhar
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Teste de portas concluído. ${openPorts.length} porta(s) aberta(s) encontrada(s).`,
        openPorts
      });
    } catch (error) {
      console.error("Erro ao testar portas:", error);
      return res.status(500).json({
        success: false,
        message: "Erro interno ao testar portas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
      
      // Usar a porta padrão 5038 se não for especificada
      const portNumber = port ? Number(port) : 5038;
      
      // Estrutura para armazenar os resultados do diagnóstico
      const diagnosticResults = {
        host: {
          name: host,
          ip: null,
          resolved: false,
          resolveError: null
        },
        connection: {
          tcp: false,
          tcpError: null,
          ami: false,
          amiError: null,
        },
        ports: {
          tested: [portNumber],
          open: [],
          closed: [],
          timeout: []
        },
        firewall: {
          detected: false,
          type: null
        },
        recommendations: []
      };
      
      // 1. Verificar resolução de DNS
      try {
        console.log(`Verificando resolução DNS para ${host}...`);
        const dns = require('dns');
        const util = require('util');
        const lookup = util.promisify(dns.lookup);
        
        const { address } = await lookup(host);
        diagnosticResults.host.ip = address;
        diagnosticResults.host.resolved = true;
        console.log(`DNS resolvido: ${host} -> ${address}`);
      } catch (err: any) {
        console.error(`Erro de resolução DNS: ${err.message}`);
        diagnosticResults.host.resolveError = err.message;
        diagnosticResults.recommendations.push(
          "Verifique se o nome de domínio está correto e acessível da sua rede"
        );
      }
      
      // 2. Testar conexão TCP
      if (diagnosticResults.host.resolved) {
        try {
          console.log(`Testando conexão TCP para ${host}:${portNumber}...`);
          // Usar timeout menor para este teste específico (2 segundos)
          const tcpResult = await asteriskAMIManager.testTCPConnection(host, portNumber, 2000);
          
          diagnosticResults.connection.tcp = tcpResult.success;
          if (!tcpResult.success) {
            diagnosticResults.connection.tcpError = tcpResult.message;
            diagnosticResults.ports.closed.push(portNumber);
            
            if (tcpResult.message?.includes('ECONNREFUSED')) {
              diagnosticResults.firewall.detected = true;
              diagnosticResults.firewall.type = "ECONNREFUSED";
              diagnosticResults.recommendations.push(
                "O servidor está ativamente recusando conexões. Verifique se o serviço Asterisk está rodando e configurado para aceitar conexões na porta especificada."
              );
              diagnosticResults.recommendations.push(
                "Verifique se o firewall do servidor está permitindo conexões na porta " + portNumber
              );
            } else if (tcpResult.message?.includes('ETIMEDOUT')) {
              diagnosticResults.firewall.detected = true;
              diagnosticResults.firewall.type = "ETIMEDOUT";
              diagnosticResults.ports.timeout.push(portNumber);
              diagnosticResults.recommendations.push(
                "Timeout na conexão. Isto geralmente indica que um firewall está silenciosamente bloqueando o tráfego para esta porta."
              );
            }
          } else {
            diagnosticResults.ports.open.push(portNumber);
          }
        } catch (err: any) {
          diagnosticResults.connection.tcpError = err.message;
        }
      }
      
      // 3. Testar portas alternativas comuns do Asterisk
      const alternativePorts = [5039, 5060, 8088, 8089];
      
      for (const altPort of alternativePorts) {
        console.log(`Testando porta alternativa ${altPort}...`);
        try {
          // Usar timeout ainda menor para portas alternativas (1.5 segundos)
          const result = await asteriskAMIManager.testTCPConnection(host, altPort, 1500);
          diagnosticResults.ports.tested.push(altPort);
          
          if (result.success) {
            diagnosticResults.ports.open.push(altPort);
            
            if (altPort === 8088 || altPort === 8089) {
              diagnosticResults.recommendations.push(
                `A porta ${altPort} está aberta, que é comumente usada para Asterisk HTTP/WebSocket. Considere usar esta porta para conexão WebSocket.`
              );
            }
          } else {
            if (result.message?.includes('ETIMEDOUT')) {
              diagnosticResults.ports.timeout.push(altPort);
            } else {
              diagnosticResults.ports.closed.push(altPort);
            }
          }
        } catch (error: any) {
          console.error(`Erro ao testar porta ${altPort}:`, error);
          // Continuar com o próximo teste mesmo com erro
        }
      }
      
      // 4. Gerar recomendações finais
      if (diagnosticResults.ports.open.length === 0) {
        diagnosticResults.recommendations.push(
          "Nenhuma porta comum do Asterisk está acessível. Verifique a configuração de rede e firewall entre este servidor e o servidor Asterisk."
        );
      }
      
      if (diagnosticResults.connection.tcp) {
        diagnosticResults.recommendations.push(
          "A conexão TCP está funcionando. Se o problema persiste, verifique as credenciais AMI (usuário/senha) e as configurações no Asterisk."
        );
      }
      
      // Diagnóstico específico para softphone via WebSocket
      diagnosticResults.recommendations.push(
        "Para o softphone, verifique se o serviço Asterisk WebSocket está rodando (normalmente nas portas 8088 ou 8089)."
      );
      
      // Execute também o diagnóstico original para dados adicionais
      const additionalDiagnostics = await asteriskAMIManager.runConnectionDiagnostics(host, portNumber);
      
      return res.json({
        success: true,
        diagnosticResults,
        additionalDiagnostics
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
      
      // Se estiver em modo de simulação, retornar sucesso simulado
      if (SIMULATION_MODE) {
        console.log(`[SIMULAÇÃO] Simulando conexão bem-sucedida ao Asterisk AMI: ${host}:${port}`);
        
        // Salvar as configurações de simulação no banco de dados
        try {
          // Verificar se já existe configuração para essa organização
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
                // Não definimos simulation: true pois a coluna pode não existir
                updatedAt: new Date()
              })
              .where(eq(asteriskSettings.organizationId, organizationId));
          } else {
            // Criar novas configurações
            await db.insert(asteriskSettings)
              .values({
                organizationId,
                host,
                port: parseInt(port),
                username,
                password,
                enabled: true,
                // Não definimos simulation: true pois a coluna pode não existir
                createdAt: new Date(),
                updatedAt: new Date()
              });
          }
        } catch (dbError) {
          console.error('Erro ao salvar configurações de simulação:', dbError);
        }
        
        return res.status(200).json({
          success: true,
          message: `[SIMULAÇÃO] Conexão simulada ao Asterisk AMI estabelecida com sucesso`,
          simulation: true
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