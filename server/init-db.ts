import { db, pool } from './storage/index';
import { organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function initializeDatabase() {
  try {
    console.log('Verificando se existe a organização padrão...');
    
    // Verificar se já existe uma organização padrão
    const [defaultOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, 'default'));
    
    let organizationId: number;
    
    // Se não existir, criar
    if (!defaultOrg) {
      console.log('Criando organização padrão...');
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: 'ProConnect Demo',
          subdomain: 'default',
          plan: 'professional',
          maxUsers: 10,
          contactEmail: 'admin@proconnect.demo',
          status: 'active',
          primaryColor: '#4f46e5'
        })
        .returning();
      
      organizationId = newOrg.id;
      console.log(`Organização padrão criada com ID ${organizationId}`);
    } else {
      organizationId = defaultOrg.id;
      console.log(`Organização padrão já existe com ID ${organizationId}`);
    }
    
    // Verificar se existe um usuário admin
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'));
    
    // Se não existir, criar
    if (!adminUser) {
      console.log('Criando usuário admin...');
      const [newUser] = await db
        .insert(users)
        .values({
          username: 'admin',
          password: await hashPassword('admin'),
          name: 'Administrador',
          role: 'admin',
          email: 'admin@proconnect.demo',
          organizationId,
          isActive: true,
          lastLogin: new Date()
        })
        .returning();
      
      console.log(`Usuário admin criado com ID ${newUser.id}`);
    } else {
      console.log(`Usuário admin já existe com ID ${adminUser.id}`);
    }

    console.log('Inicialização do banco de dados concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  }
}

// Em ESM não temos o equivalente a require.main === module
// A função será executada quando importada em index.ts