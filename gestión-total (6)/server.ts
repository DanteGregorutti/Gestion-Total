import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Lazy initialization of Gemini client
  const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
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
    const ai = getGenAI();
    if (!ai) {
      return res.status(400).json({ 
        error: "El asistente IA no está configurado correctamente. Por favor, verifica que la clave GEMINI_API_KEY esté presente en AI Studio." 
      });
    }

    const { prompt, systemInstruction } = req.body;
    // Prioritize gemini-3.6-flash (recommended by Google API, ultra-fast 1.5s latency)
    // with fallbacks for maximum resilience
    const modelsToTry = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction || "Eres un asistente experto para Gestión Total y PulseStore.",
          }
        });

        const text = response.text || "No se obtuvo respuesta del modelo.";
        return res.json({ text });
      } catch (error: any) {
        console.warn(`Model ${model} failed, trying fallback if available:`, error?.message || error);
        lastError = error;
        // Continue to fallback model
      }
    }

    console.error("All Gemini models failed:", lastError);
    res.status(500).json({ 
      error: lastError?.message || "Lo siento, hubo un error al procesar tu solicitud con la IA. Por favor, intenta de nuevo más tarde." 
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
