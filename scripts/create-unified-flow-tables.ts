import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/unified-flow-schema';
import { sql } from 'drizzle-orm';

// Configure WebSockets para o Neon Serverless
neonConfig.webSocketConstructor = ws;

// Verificar se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve ser definida");
}

async function main() {
  console.log("Iniciando criação das tabelas de fluxo unificado...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  
  console.log("Conectado ao banco de dados...");

  try {
    // Verificar se o enum 'unified_node_type' já existe
    const checkNodeTypeEnum = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'unified_node_type'
      );
    `);
    
    const nodeTypeEnumExists = checkNodeTypeEnum[0]?.exists || false;
    
    if (!nodeTypeEnumExists) {
      console.log("Criando enum 'unified_node_type'...");
      // Criar o enum unified_node_type 
      await db.execute(sql`
        CREATE TYPE unified_node_type AS ENUM (
          'message', 'input', 'condition', 'api_request', 'menu', 'wait', 'goto', 'media', 'end',
          'answer', 'hangup', 'dial', 'playback', 'record', 'queue', 'voicemail', 'tts',
          'webhook', 'typing', 'location', 'file', 'contact'
        );
      `);
      console.log("Enum 'unified_node_type' criado com sucesso!");
    } else {
      console.log("Enum 'unified_node_type' já existe.");
    }

    // Verificar se o enum 'unified_channel_type' já existe
    const checkChannelTypeEnum = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'unified_channel_type'
      );
    `);
    
    const channelTypeEnumExists = checkChannelTypeEnum[0]?.exists || false;
    
    if (!channelTypeEnumExists) {
      console.log("Criando enum 'unified_channel_type'...");
      // Criar o enum unified_channel_type
      await db.execute(sql`
        CREATE TYPE unified_channel_type AS ENUM (
          'all', 'voice', 'chat', 'whatsapp', 'telegram', 'facebook', 'instagram', 'linkedin', 
          'webchat', 'sms', 'asterisk', 'custom'
        );
      `);
      console.log("Enum 'unified_channel_type' criado com sucesso!");
    } else {
      console.log("Enum 'unified_channel_type' já existe.");
    }

    // Verificar se a tabela 'unified_flows' já existe
    const checkFlowsTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_flows'
      );
    `);
    
    const flowsTableExists = checkFlowsTable[0]?.exists || false;
    
    if (!flowsTableExists) {
      console.log("Criando tabela 'unified_flows'...");
      await db.execute(sql`
        CREATE TABLE "unified_flows" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
          "name" TEXT NOT NULL,
          "description" TEXT,
          "flow_type" TEXT NOT NULL DEFAULT 'standard',
          "active" BOOLEAN DEFAULT true,
          "is_default" BOOLEAN DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);
      console.log("Tabela 'unified_flows' criada com sucesso!");
    } else {
      console.log("Tabela 'unified_flows' já existe.");
    }

    // Verificar se a tabela 'unified_nodes' já existe
    const checkNodesTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_nodes'
      );
    `);
    
    const nodesTableExists = checkNodesTable[0]?.exists || false;
    
    if (!nodesTableExists) {
      console.log("Criando tabela 'unified_nodes'...");
      await db.execute(sql`
        CREATE TABLE "unified_nodes" (
          "id" SERIAL PRIMARY KEY,
          "flow_id" INTEGER NOT NULL REFERENCES "unified_flows"("id"),
          "node_type" unified_node_type NOT NULL,
          "name" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "position" JSONB NOT NULL,
          "supported_channels" JSONB,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);
      console.log("Tabela 'unified_nodes' criada com sucesso!");
    } else {
      console.log("Tabela 'unified_nodes' já existe.");
    }

    // Verificar se a tabela 'unified_edges' já existe
    const checkEdgesTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_edges'
      );
    `);
    
    const edgesTableExists = checkEdgesTable[0]?.exists || false;
    
    if (!edgesTableExists) {
      console.log("Criando tabela 'unified_edges'...");
      await db.execute(sql`
        CREATE TABLE "unified_edges" (
          "id" SERIAL PRIMARY KEY,
          "flow_id" INTEGER NOT NULL REFERENCES "unified_flows"("id"),
          "source_node_id" INTEGER NOT NULL REFERENCES "unified_nodes"("id"),
          "target_node_id" INTEGER NOT NULL REFERENCES "unified_nodes"("id"),
          "source_handle" TEXT,
          "target_handle" TEXT,
          "label" TEXT,
          "condition" JSONB,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);
      console.log("Tabela 'unified_edges' criada com sucesso!");
    } else {
      console.log("Tabela 'unified_edges' já existe.");
    }

    // Verificar se a tabela 'unified_triggers' já existe
    const checkTriggersTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_triggers'
      );
    `);
    
    const triggersTableExists = checkTriggersTable[0]?.exists || false;
    
    if (!triggersTableExists) {
      console.log("Criando tabela 'unified_triggers'...");
      await db.execute(sql`
        CREATE TABLE "unified_triggers" (
          "id" SERIAL PRIMARY KEY,
          "flow_id" INTEGER NOT NULL REFERENCES "unified_flows"("id"),
          "trigger_type" TEXT NOT NULL,
          "channel_type" unified_channel_type NOT NULL,
          "configuration" JSONB NOT NULL,
          "active" BOOLEAN DEFAULT true,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);
      console.log("Tabela 'unified_triggers' criada com sucesso!");
    } else {
      console.log("Tabela 'unified_triggers' já existe.");
    }

    // Verificar se a tabela 'unified_variables' já existe
    const checkVariablesTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_variables'
      );
    `);
    
    const variablesTableExists = checkVariablesTable[0]?.exists || false;
    
    if (!variablesTableExists) {
      console.log("Criando tabela 'unified_variables'...");
      await db.execute(sql`
        CREATE TABLE "unified_variables" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
          "name" TEXT NOT NULL,
          "default_value" TEXT,
          "description" TEXT,
          "scope" TEXT NOT NULL DEFAULT 'global',
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now()
        );
      `);
      console.log("Tabela 'unified_variables' criada com sucesso!");
    } else {
      console.log("Tabela 'unified_variables' já existe.");
    }

    console.log("Todas as tabelas de fluxo unificado foram criadas ou já existiam!");
  } catch (error) {
    console.error("Erro ao criar tabelas de fluxo unificado:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    console.log("Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Erro durante a execução do script:", error);
    process.exit(1);
  });