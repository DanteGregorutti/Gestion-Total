import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { backendTelegramBot } from './src/server/backendTelegramBot.js';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Telegram 24/7 Bot endpoints
  app.get("/api/telegram/status", (req, res) => {
    res.json({
      status: "online",
      mode: "24/7 Backend Node.js Service",
      timestamp: new Date().toISOString()
    });
  });

  app.all(["/api/telegram/webhook", "/api/telegram-webhook"], async (req, res) => {
    if (req.method === 'GET') {
      return res.json({
        status: "online",
        service: "Gestión Total — Telegram 24/7 Webhook",
        timestamp: new Date().toISOString()
      });
    }
    try {
      await backendTelegramBot.handleWebhookUpdate(req.body);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[BackendTelegramBot Webhook Error]:", e);
      res.json({ ok: true, error: e?.message });
    }
  });

  // Start 24/7 Telegram Bot listener on the backend server
  backendTelegramBot.start().catch(err => {
    console.warn("[BackendTelegramBot] Could not start server bot:", err);
  });

  // Lazy initialization of Gemini client
  const getGenAI = (customKey?: string) => {
    const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // AI API Route with resilient fallback
  app.post("/api/ai/ask", async (req, res) => {
    const startTime = Date.now();
    const clientKey = req.headers['x-gemini-key'] as string || req.body?.apiKey;
    const ai = getGenAI(clientKey);

    if (!ai) {
      return res.status(400).json({ 
        error: "El asistente IA no está configurado. Por favor ingresa tu API Key en Configuración -> Inteligencia Artificial o define GEMINI_API_KEY." 
      });
    }

    const { prompt, systemInstruction, model: preferredModel, temperature } = req.body;

    if (prompt === '__ping__') {
      return res.json({
        ok: true,
        text: 'PONG',
        source: 'local_server',
        latencyMs: Date.now() - startTime
      });
    }

    const validModels = [
      preferredModel,
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ].filter(Boolean) as string[];

    const modelsToTry = Array.from(new Set(validModels));
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction || "Eres un asistente experto para Gestión Total y PulseStore.",
            temperature: typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.3,
          }
        });

        const text = response.text || "No se obtuvo respuesta del modelo.";
        const elapsed = Date.now() - startTime;
        return res.json({ 
          text, 
          modelUsed: model, 
          latencyMs: elapsed,
          source: 'local_server'
        });
      } catch (error: any) {
        console.warn(`Model ${model} failed, trying fallback if available:`, error?.message || error);
        lastError = error;
      }
    }

    console.error("All Gemini models failed:", lastError);
    res.status(500).json({ 
      error: lastError?.message || "Lo siento, hubo un error al procesar tu solicitud con la IA. Por favor, intenta de nuevo más tarde.",
      latencyMs: Date.now() - startTime
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical error starting server:", err);
  process.exit(1);
});
