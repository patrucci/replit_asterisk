import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSockets para o Neon Serverless
neonConfig.webSocketConstructor = ws;

async function main() {
  console.log("Iniciando a criação direta da tabela agents...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log("Conectado ao banco de dados. Executando query para criar tabela agents...");

  try {
    // Verificar se o enum já existe
    const checkEnumResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'agent_status'
      );
    `);
    
    // Se o enum não existir, crie-o
    if (!checkEnumResult.rows[0].exists) {
      console.log("Criando enum agent_status...");
      await pool.query(`
        CREATE TYPE agent_status AS ENUM ('available', 'unavailable', 'busy', 'paused', 'offline');
      `);
      console.log("Enum agent_status criado com sucesso!");
    } else {
      console.log("Enum agent_status já existe.");
    }

    // Verificar se a tabela agent_groups existe
    const checkAgentGroupsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'agent_groups'
      );
    `);
    
    // Se a tabela agent_groups não existir, crie-a
    if (!checkAgentGroupsResult.rows[0].exists) {
      console.log("Criando tabela agent_groups...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.agent_groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          user_id INTEGER NOT NULL,
          organization_id INTEGER NOT NULL
        );
      `);
      console.log("Tabela agent_groups criada com sucesso!");
    } else {
      console.log("Tabela agent_groups já existe.");
    }

    // Criar tabela de agentes
    console.log("Criando tabela agents...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.agents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        extension TEXT NOT NULL,
        email TEXT,
        status TEXT NOT NULL DEFAULT 'offline',
        group_id INTEGER REFERENCES agent_groups(id),
        skills TEXT[],
        max_concurrent_calls INTEGER DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id INTEGER NOT NULL,
        organization_id INTEGER NOT NULL
      );
    `);
    
    console.log("Tabela agents criada com sucesso!");
  } catch (error) {
    console.error("Erro ao criar tabelas:", error);
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error("Erro durante a execução do script:", e);
  process.exit(1);
});