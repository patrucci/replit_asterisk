import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "proconnect-crm-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Extrair dados do usuário e organização
      const { 
        username, password, name, role, email,
        organization
      } = req.body;
      
      // Verificar se já existe um usuário com o mesmo nome e subdomínio
      const subdomain = req.body.subdomain || 'default';
      let organizationId = 1; // ID padrão para organização (demo)
      
      // Se foi fornecido um subdomínio, verificar se a organização já existe
      if (subdomain && subdomain !== 'default') {
        const existingOrg = await storage.getOrganizationBySubdomain(subdomain);
        
        if (existingOrg) {
          // Se a organização já existe, usar seu ID
          organizationId = existingOrg.id;
          
          // Verificar se o usuário já existe nesta organização
          const existingUser = await storage.getUserByUsername(username, organizationId);
          if (existingUser) {
            return res.status(400).json({ message: "Username already exists in this organization" });
          }
        } else if (organization) {
          // Criar uma nova organização
          const newOrg = await storage.createOrganization({
            name: organization,
            subdomain: subdomain,
            contactEmail: email
          });
          
          organizationId = newOrg.id;
        }
      } else {
        // Verificar se o usuário já existe na organização padrão
        const existingUser = await storage.getUserByUsername(username, organizationId);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      // Criar o usuário com a organização associada
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        name,
        role: role || 'user',
        email,
        organizationId,
        isActive: true,
        lastLogin: new Date()
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
