import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "../shared/schema";
import * as queueSchema from "../shared/queue-schema";

// Configure WebSockets para o Neon Serverless
neonConfig.webSocketConstructor = ws;

// Verificar se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve ser definida");
}

async function main() {
  console.log("Iniciando a criação direta de tabelas do banco de dados...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { ...schema, ...queueSchema } });
  
  console.log("Conectado ao banco de dados. Executando queries para criar tabelas...");

  // Criar tabela de agentes diretamente via SQL
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
  
  console.log("Tabela de agentes criada com sucesso!");
  
  await pool.end();
}

main().catch(e => {
  console.error("Erro durante a criação de tabelas:", e);
  process.exit(1);
});