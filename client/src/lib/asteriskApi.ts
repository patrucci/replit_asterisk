import { apiRequest } from "./queryClient";

// Interface para controle de configurações do Asterisk
export interface AsteriskConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

// Interface para resultados de teste
export interface TestResult {
  success: boolean;
  message?: string;
  details?: string;
}

// Função para testar conexão básica TCP (somente conectividade de rede)
export async function testTcpConnection(host: string, port: number): Promise<TestResult> {
  try {
    const response = await apiRequest("POST", "/api/asterisk/test-connection", {
      host,
      port,
      testTcpOnly: true,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: errorData.message || "Falha no teste TCP",
        details: errorData.details,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Teste TCP bem-sucedido",
      details: "A porta TCP está acessível e respondendo",
    };
  } catch (error) {
    console.error("Erro ao executar teste TCP:", error);
    return {
      success: false,
      message: "Erro ao executar teste TCP",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// Função para testar a conexão AMI completa (autenticação)
export async function testAmiConnection(config: AsteriskConfig): Promise<TestResult> {
  try {
    const response = await apiRequest("POST", "/api/asterisk/test-connection", {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      testTcpOnly: false,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: errorData.message || "Falha no teste AMI",
        details: errorData.details,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Teste AMI bem-sucedido",
      details: "A conexão AMI foi estabelecida com sucesso",
    };
  } catch (error) {
    console.error("Erro ao testar conexão AMI:", error);
    return {
      success: false,
      message: "Erro ao executar teste AMI",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// Função para estabelecer conexão com o servidor Asterisk
export async function connectAsterisk(config: AsteriskConfig): Promise<TestResult> {
  try {
    const response = await apiRequest("POST", "/api/asterisk/connect", {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: errorData.message || "Falha ao conectar com o Asterisk",
        details: errorData.details,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Conexão bem-sucedida",
      details: data.details || "Conexão com o Asterisk estabelecida com sucesso",
    };
  } catch (error) {
    console.error("Erro ao conectar com o Asterisk:", error);
    return {
      success: false,
      message: "Erro ao executar conexão",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// Função para desconectar do servidor Asterisk
export async function disconnectAsterisk(): Promise<TestResult> {
  try {
    const response = await apiRequest("POST", "/api/asterisk/disconnect", {});

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: errorData.message || "Falha ao desconectar do Asterisk",
        details: errorData.details,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Desconexão bem-sucedida",
      details: "Desconectado do servidor Asterisk com sucesso",
    };
  } catch (error) {
    console.error("Erro ao desconectar do Asterisk:", error);
    return {
      success: false,
      message: "Erro ao desconectar",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// Função para verificar o status da conexão
export async function getAsteriskStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
}> {
  try {
    const response = await fetch("/api/asterisk/status");
    if (!response.ok) {
      throw new Error("Falha ao buscar status");
    }
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar status do Asterisk:", error);
    return {
      connected: false,
      configured: false,
    };
  }
}