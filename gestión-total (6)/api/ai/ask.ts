import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ 
      error: 'La variable de entorno GEMINI_API_KEY no está configurada en Vercel. Ve a tu proyecto en Vercel -> Settings -> Environment Variables, añade GEMINI_API_KEY con tu API Key de Google AI Studio y luego haz un Redeploy.' 
    });
  }

  // Parse body if needed (Vercel normally auto-parses, but handle string just in case)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Formato de solicitud JSON inválido.' });
    }
  }

  const { prompt, systemInstruction } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'El campo "prompt" es requerido.' });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-vercel',
      }
    }
  });

  const modelsToTry = [
    "gemini-3.6-flash", 
    "gemini-3.8-flash", 
    "gemini-flash-latest", 
    "gemini-3.1-flash-lite"
  ];
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
      return res.status(200).json({ text });
    } catch (error: any) {
      console.warn(`[Vercel API] Model ${model} failed, attempting next model:`, error?.message || error);
      lastError = error;
    }
  }

  console.error("[Vercel API] All Gemini models failed:", lastError);
  return res.status(500).json({ 
    error: lastError?.message || "Lo siento, hubo un error al procesar tu solicitud con la IA en Vercel. Por favor, intenta de nuevo más tarde." 
  });
}
