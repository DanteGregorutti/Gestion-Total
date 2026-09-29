import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  // Parse body safely
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Formato de solicitud JSON inválido.' });
    }
  }

  const clientKey = req.headers['x-gemini-key'] || body?.apiKey;
  const apiKey = clientKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ 
      error: 'La clave GEMINI_API_KEY no está configurada. Puedes ingresarla directamente en la pestaña "Configuración -> Inteligencia Artificial" de la app, o agregarla en tu panel de Vercel (Settings -> Environment Variables) y realizar un Redeploy.' 
    });
  }

  const { prompt, systemInstruction, model: preferredModel, temperature } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'El campo "prompt" es requerido.' });
  }

  // Lightweight health check / ping
  if (prompt === '__ping__') {
    const elapsed = Date.now() - startTime;
    return res.status(200).json({ 
      ok: true, 
      text: 'PONG', 
      source: 'vercel_serverless',
      latencyMs: elapsed 
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-vercel',
      }
    }
  });

  // Ordered models: if user specified a preference, put it first
  const validModels = [
    preferredModel,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ].filter(Boolean) as string[];

  // Deduplicate while preserving priority
  const modelsToTry = Array.from(new Set(validModels));
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || "Eres un asistente experto en negocios para Gestión Total y PulseStore.",
          temperature: typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.3,
        }
      });

      const text = response.text || "No se obtuvo respuesta del modelo.";
      const elapsed = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${elapsed}ms`);
      return res.status(200).json({ 
        text, 
        modelUsed: model,
        latencyMs: elapsed,
        source: 'vercel_serverless'
      });
    } catch (error: any) {
      console.warn(`[Vercel API] Model ${model} failed, attempting next:`, error?.message || error);
      lastError = error;
      
      // If it's an invalid API key, don't waste time trying other models
      const errMsg = error?.message || '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
        return res.status(401).json({
          error: 'La clave GEMINI_API_KEY no es válida o ha expirado. Verifica tu API Key de Google AI Studio en Configuración.'
        });
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.error("[Vercel API] All Gemini models failed:", lastError);
  return res.status(500).json({ 
    error: lastError?.message || "Error al procesar la solicitud con la IA en Vercel. Por favor verifica tu clave y conexión.",
    latencyMs: elapsed
  });
}
