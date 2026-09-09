import express from "express";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

  // AI API Route
  app.post("/api/ai/ask", async (req, res) => {
    if (!genAI) {
      return res.status(400).json({ 
        error: "El asistente IA no está configurado correctamente. Por favor, verifica que has añadido tu clave de API (GEMINI_API_KEY) en el panel de Secretos de AI Studio." 
      });
    }

    const { prompt, systemInstruction } = req.body;

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ text: response.text() });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: "Lo siento, hubo un error al procesar tu solicitud con la IA. Asegúrate de que la clave de API sea válida." });
    }
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
