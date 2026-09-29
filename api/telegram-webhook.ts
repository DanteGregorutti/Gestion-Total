/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vercel Serverless Function: 24/7 Telegram Webhook Handler
 * Telegram sends incoming messages here in real time.
 * Works 24/7 even when the web app is completely closed or device is off!
 */

import { backendTelegramBot } from '../src/server/backendTelegramBot.js';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check for Telegram or browsers
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'Gestión Total — Telegram 24/7 Webhook',
      description: 'Receives Telegram updates 24/7 and updates Supabase inventory directly without needing the web app open.',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST for Telegram updates.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  try {
    if (body) {
      await backendTelegramBot.handleWebhookUpdate(body);
    }
    // Always return 200 OK to Telegram so Telegram knows the message was delivered
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error);
    // Still return 200 so Telegram does not enter an infinite retry storm
    return res.status(200).json({ ok: true, handledWithError: error?.message });
  }
}
