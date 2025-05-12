import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSockets para o Neon Serverless
neonConfig.webSocketConstructor = ws;

// Verificar se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve ser definida");
}

async function main() {
  console.log("Iniciando migração do banco de dados...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  
  console.log("Conectado ao banco de dados. Executando migração...");

  // Executar migrações (criará as tabelas definidas no schema)
  await migrate(db, { migrationsFolder: 'drizzle' });
  
  console.log("Migração concluída com sucesso!");
  
  await pool.end();
}

main().catch(e => {
  console.error("Erro durante a migração do banco de dados:", e);
  process.exit(1);
});