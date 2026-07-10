import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import healthRouter from "./health";
import { instagramRouter } from "../../instagram";
import { configureEvolutionWebhook, whatsappRouter } from "../../whatsapp";
import { authRouter } from "../../auth";
import axios from "axios";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Health check endpoint
  app.use(healthRouter);

  // Rotas do Bot (Instagram e WhatsApp)
  app.use('/api', instagramRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/auth', authRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    configureEvolutionWebhook()
      .then(() => console.log("✅ Webhook da Evolution configurado na inicialização"))
      .catch((error: any) => console.error("❌ Falha ao configurar webhook da Evolution:", error.response?.data || error.message));

    // PING AUTOMÁTICO: Evita que a Evolution API "durma" no Render gratuito
    // Faz uma requisição silenciosa a cada 10 minutos (600.000 ms)
    const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://minha-api-whatsapp-gof4.onrender.com';
    setInterval(() => {
      axios.get(EVOLUTION_URL).catch(() => {});
    }, 10 * 60 * 1000);
  });
}

startServer().catch(console.error);
