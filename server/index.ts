import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";
import { db } from "./db";
import { asteriskSettings } from "@shared/schema";
import { asteriskAMIManager } from "./asterisk-ami";
import { eq } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Inicializar o banco de dados
    await initializeDatabase();
    
    const server = await registerRoutes(app);
    
    // Tentar carregar as configurações do Asterisk e conectar automaticamente
    try {
      console.log("Verificando configurações do Asterisk no banco de dados...");
      // Buscar todas as configurações de Asterisk
      const configs = await db.select().from(asteriskSettings).where(eq(asteriskSettings.enabled, true));
      
      if (configs.length > 0) {
        // Para cada configuração, tentar conectar
        for (const config of configs) {
          console.log(`Tentando conectar ao Asterisk usando configuração para organização ${config.organizationId}...`);
          try {
            const connected = await asteriskAMIManager.connect(
              config.host,
              config.port,
              config.username,
              config.password
            );
            
            if (connected) {
              console.log(`Conexão estabelecida com sucesso para o servidor Asterisk ${config.host}:${config.port}`);
              break; // Se conectou com sucesso, sair do loop
            } else {
              console.log(`Falha ao conectar ao servidor Asterisk ${config.host}:${config.port}`);
            }
          } catch (connError) {
            console.error(`Erro ao tentar conectar ao Asterisk: ${connError instanceof Error ? connError.message : String(connError)}`);
          }
        }
      } else {
        console.log("Nenhuma configuração do Asterisk encontrada no banco de dados.");
      }
    } catch (error) {
      console.error("Erro ao carregar configurações do Asterisk:", error);
    }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
  } catch (error) {
    console.error('Erro fatal na inicialização do servidor:', error);
    process.exit(1);
  }
})();
