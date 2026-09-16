import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: "ok", 
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
}
