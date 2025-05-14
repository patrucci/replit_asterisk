import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '../shared/chatbot-schema';

// Configuração para WebSocket do Neon
neonConfig.webSocketConstructor = ws as any;

// Função principal
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não encontrada no ambiente");
  }

  console.log("Conectando ao banco de dados...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    console.log("Criando enums...");
    // Criando os enums antes das tabelas
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
          CREATE TYPE channel_type AS ENUM ('whatsapp', 'telegram', 'webchat', 'sms', 'api');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'node_type') THEN
          CREATE TYPE node_type AS ENUM ('message', 'input', 'condition', 'api_request', 'menu', 'wait', 'goto', 'media', 'end');
        END IF;
      END $$;
    `);

    console.log("Criando tabela chatbots...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbots (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        name TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Criando tabela chatbot_channels...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_channels (
        id SERIAL PRIMARY KEY,
        chatbot_id INTEGER NOT NULL REFERENCES chatbots(id),
        channel_type channel_type NOT NULL,
        name TEXT NOT NULL,
        credentials JSONB NOT NULL,
        webhook_url TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Criando tabela chatbot_flows...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_flows (
        id SERIAL PRIMARY KEY,
        chatbot_id INTEGER NOT NULL REFERENCES chatbots(id),
        name TEXT NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Criando tabela chatbot_nodes...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_nodes (
        id SERIAL PRIMARY KEY,
        flow_id INTEGER NOT NULL REFERENCES chatbot_flows(id),
        node_type node_type NOT NULL,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        position JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Criando tabela chatbot_edges...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_edges (
        id SERIAL PRIMARY KEY,
        flow_id INTEGER NOT NULL REFERENCES chatbot_flows(id),
        source_node_id INTEGER NOT NULL REFERENCES chatbot_nodes(id),
        target_node_id INTEGER NOT NULL REFERENCES chatbot_nodes(id),
        source_handle TEXT,
        target_handle TEXT,
        label TEXT,
        condition JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Criando tabela chatbot_conversations...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_conversations (
        id SERIAL PRIMARY KEY,
        chatbot_id INTEGER NOT NULL REFERENCES chatbots(id),
        channel_id INTEGER NOT NULL REFERENCES chatbot_channels(id),
        external_user_id TEXT NOT NULL,
        user_data JSONB,
        current_node_id INTEGER REFERENCES chatbot_nodes(id),
        status TEXT DEFAULT 'active',
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP
      );
    `);

    console.log("Criando tabela chatbot_messages...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chatbot_conversations(id),
        node_id INTEGER REFERENCES chatbot_nodes(id),
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Tabelas do chatbot criadas com sucesso!");
  } catch (error) {
    console.error("Erro ao criar tabelas:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    console.log("Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erro durante a execução do script:", err);
    process.exit(1);
  });