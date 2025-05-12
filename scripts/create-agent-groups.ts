import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSockets para o Neon Serverless
neonConfig.webSocketConstructor = ws;

async function main() {
  console.log("Iniciando a criação do grupo de agentes...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Confirmar que a tabela agent_groups existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'agent_groups'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log("A tabela agent_groups não existe. Execute o script create-agents-table.ts primeiro.");
      return;
    }
    
    // Verificar se já existe um grupo com ID 1
    const checkGroup = await pool.query(`
      SELECT EXISTS (
        SELECT FROM agent_groups 
        WHERE id = 1
      );
    `);
    
    if (checkGroup.rows[0].exists) {
      console.log("Grupo de agentes com ID 1 já existe.");
    } else {
      // Inserir um grupo de agentes padrão
      await pool.query(`
        INSERT INTO agent_groups (id, name, description, user_id, organization_id) 
        VALUES (1, 'Grupo Padrão', 'Grupo padrão de agentes', 4, 1);
      `);
      console.log("Grupo de agentes padrão criado com sucesso!");
    }
    
    // Listar todos os grupos de agentes
    const groups = await pool.query(`SELECT * FROM agent_groups`);
    console.log("Grupos de agentes existentes:", groups.rows);
    
  } catch (error) {
    console.error("Erro ao criar grupo de agentes:", error);
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error("Erro durante a execução do script:", e);
  process.exit(1);
});