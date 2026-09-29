/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 24/7 Server-side Telegram Bot Service
 * Runs in the background of Node.js / Express server, answering Telegram messages
 * even when no browser tabs are open!
 */

import { supabaseService } from '../services/supabaseService.js';
import { supabase } from '../supabase.js';
import { Product, ProductVariant } from '../types';

const DEFAULT_TOKEN = '8655329307:AAEEnvrWo4lrG4i6myrIDhtlUqTgpxroSKc';

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const m = a.length;
  const n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 1 : Math.max(0, 1 - d[m][n] / maxLen);
}

export function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSizeInfo(text: string): { size: string; rawMatch: string } | null {
  const lower = text.toLowerCase();
  const dimMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(cm|mm|m|pulgadas?|pulg)\b/i);
  if (dimMatch) {
    return {
      size: `${dimMatch[1].replace(',', '.')}${dimMatch[2].toLowerCase()}`,
      rawMatch: dimMatch[0]
    };
  }

  const talleMatch = lower.match(/\b(?:talle|t|nro|n°|numero|número)\s*[:#]?\s*([a-z0-9]+(?:\s*(?:cm|mm))?)\b/i);
  if (talleMatch) {
    const rawVal = talleMatch[1].trim();
    return {
      size: rawVal.replace(/\s+/g, '').toLowerCase(),
      rawMatch: talleMatch[0]
    };
  }

  const letterMatch = lower.match(/\b(xxxl|xxl|xl|xs|xxs|s|m|l)\b/i);
  if (letterMatch) {
    return {
      size: letterMatch[1].toUpperCase(),
      rawMatch: letterMatch[0]
    };
  }

  return null;
}

export function safeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[*_`\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getProductDisplayName(p: any): string {
  if (!p) return 'Artículo';
  const desc = (p.descripcion || '').trim();
  const nom = (p.nombre || p.name || p.articulo || p.producto || p.productNombre || '').trim();
  const cod = (p.codigo || '').trim();
  if (desc && cod && desc.toLowerCase() !== cod.toLowerCase()) {
    return `${desc} (${cod})`;
  }
  return desc || nom || cod || 'Artículo';
}

export function getProductBaseName(p: any): string {
  if (!p) return 'Artículo';
  const desc = (p.descripcion || '').trim();
  const nom = (p.nombre || p.name || p.articulo || p.producto || p.productNombre || '').trim();
  const cod = (p.codigo || '').trim();
  return desc || nom || cod || 'Artículo';
}

export interface GroupedProductInfo {
  key: string;
  name: string;
  baseName: string;
  codigo: string;
  procedencia?: string;
  totalCantidad: number;
  precioMin: number;
  precioMax: number;
  costoMin: number;
  costoMax: number;
  minStock: number;
  ubicacion?: string;
  talles: { nombre: string; cantidad: number; precio?: number }[];
  originalProducts: Product[];
}

export function groupInventoryProducts(products: Product[]): GroupedProductInfo[] {
  const groupsMap = new Map<string, GroupedProductInfo>();

  products.forEach(p => {
    const baseName = getProductBaseName(p);
    const cod = (p.codigo || '').trim();
    const proc = (p.procedencia || '').trim();

    const normBase = normalizeSearchText(baseName);
    const normCod = normalizeSearchText(cod);
    const keyPart = (normBase && normCod && normBase !== normCod)
      ? `${normBase}_${normCod}`
      : (normBase || normCod || 'art');
    const groupKey = `${keyPart}_${proc}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        key: groupKey,
        name: getProductDisplayName(p),
        baseName: baseName,
        codigo: cod,
        procedencia: proc,
        totalCantidad: 0,
        precioMin: Number(p.precio) || 0,
        precioMax: Number(p.precio) || 0,
        costoMin: Number(p.costo) || 0,
        costoMax: Number(p.costo) || 0,
        minStock: Number(p.minStock) || 5,
        ubicacion: p.ubicacion,
        talles: [],
        originalProducts: []
      });
    }

    const group = groupsMap.get(groupKey)!;
    const qty = Number(p.cantidad) || 0;
    group.totalCantidad += qty;
    group.originalProducts.push(p);

    const price = Number(p.precio) || 0;
    if (price > 0) {
      group.precioMin = group.precioMin === 0 ? price : Math.min(group.precioMin, price);
      group.precioMax = Math.max(group.precioMax, price);
    }

    const cost = Number(p.costo) || 0;
    if (cost > 0) {
      group.costoMin = group.costoMin === 0 ? cost : Math.min(group.costoMin, cost);
      group.costoMax = Math.max(group.costoMax, cost);
    }

    if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
      p.variants.forEach(v => {
        const existingVariant = group.talles.find(t => t.nombre.toLowerCase() === v.nombre.toLowerCase());
        if (existingVariant) {
          existingVariant.cantidad += Number(v.cantidad) || 0;
        } else {
          group.talles.push({
            nombre: v.nombre,
            cantidad: Number(v.cantidad) || 0,
            precio: v.precio ? Number(v.precio) : undefined
          });
        }
      });
    } else if (p.talle && p.talle.trim() && p.talle.toLowerCase() !== 'u' && p.talle.toLowerCase() !== 'unico' && p.talle.toLowerCase() !== 'único') {
      const existingTalle = group.talles.find(t => t.nombre.toLowerCase() === p.talle?.toLowerCase());
      if (existingTalle) {
        existingTalle.cantidad += qty;
      } else {
        group.talles.push({
          nombre: p.talle,
          cantidad: qty,
          precio: price
        });
      }
    }
  });

  return Array.from(groupsMap.values());
}

export function stemSpanishWord(w: string): string {
  let s = normalizeSearchText(w);
  if (s.endsWith('es') && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith('s') && s.length > 3) s = s.slice(0, -1);
  if (s.endsWith('e') && s.length > 4) s = s.slice(0, -1);
  return s;
}

export function findBestProductMatch(
  text: string, 
  products: Product[]
): { product: Product; variant?: ProductVariant; detectedSize?: string; confidence: number } | null {
  if (!products || products.length === 0) return null;

  const normalizedInput = normalizeSearchText(text);
  const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 1);
  const sizeInfo = extractSizeInfo(text);

  let bestMatch: Product | null = null;
  let bestVariant: ProductVariant | undefined = undefined;
  let highestScore = 0;

  for (const product of products) {
    const prodDesc = normalizeSearchText(product.descripcion || '');
    const prodCode = normalizeSearchText(product.codigo || '');
    const prodName = normalizeSearchText(getProductDisplayName(product));
    const prodBase = normalizeSearchText(getProductBaseName(product));

    let score = 0;

    if (prodCode && normalizedInput.includes(prodCode)) {
      score += 90;
    }
    if (prodDesc && normalizedInput.includes(prodDesc)) {
      score += 80;
    }
    if (prodBase && normalizedInput.includes(prodBase)) {
      score += 70;
    }

    const prodWords = normalizeSearchText(prodDesc + ' ' + prodBase + ' ' + prodCode)
      .split(/\s+/)
      .filter(w => w.length > 2);

    for (const word of inputWords) {
      if (['venta', 'vendi', 'vendí', 'vender', 'precio', 'stock', 'sacar', 'cuanto', 'quedan', 'compra', 'compré'].includes(word)) {
        continue;
      }
      const stemW = stemSpanishWord(word);
      for (const pWord of prodWords) {
        const stemP = stemSpanishWord(pWord);
        if (word === pWord || stemW === stemP || (word.length > 3 && (pWord.includes(word) || word.includes(pWord)))) {
          score += 60;
        }
      }
    }

    const sim = Math.max(
      levenshteinSimilarity(normalizedInput, prodDesc),
      levenshteinSimilarity(normalizedInput, prodBase)
    );
    score += sim * 30;

    let matchedVariant: ProductVariant | undefined = undefined;
    if (sizeInfo) {
      const normSize = normalizeSearchText(sizeInfo.size);
      if (product.hasVariants && Array.isArray(product.variants)) {
        for (const v of product.variants) {
          const vNorm = normalizeSearchText(v.nombre);
          if (vNorm === normSize || vNorm.includes(normSize) || normSize.includes(vNorm)) {
            matchedVariant = v;
            score += 25;
            break;
          }
        }
      } else if (product.talle) {
        const prodTalleNorm = normalizeSearchText(product.talle);
        if (prodTalleNorm === normSize || prodTalleNorm.includes(normSize) || normSize.includes(prodTalleNorm)) {
          score += 25;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = product;
      bestVariant = matchedVariant;
    }
  }

  if (bestMatch && highestScore >= 35) {
    return {
      product: bestMatch,
      variant: bestVariant,
      detectedSize: sizeInfo?.size,
      confidence: highestScore
    };
  }

  return null;
}

export function parseQuantityAndPrice(text: string, sizeInfo: any) {
  let cleaned = text;
  if (sizeInfo?.rawMatch) {
    cleaned = cleaned.replace(sizeInfo.rawMatch, ' ');
  }

  let totalAmount = 0;
  let unitPrice = 0;
  let cantidad = 1;

  // Search explicit dollar pattern: $20000, $ 20.000, 20000$
  const dollarMatch = cleaned.match(/\$\s*(\d+(?:[.,]\d+)?)/) || cleaned.match(/(\d+(?:[.,]\d+)?)\s*\$/);
  if (dollarMatch) {
    totalAmount = parseFloat(dollarMatch[1].replace(/\./g, '').replace(',', '.'));
    cleaned = cleaned.replace(dollarMatch[0], ' ');
  }

  // Unit price pattern like "a 3500 c/u" or "a $3500" (with \b word boundary so 'Venta' or 'canillera' doesn't match 'a')
  const unitMatch = cleaned.match(/\b(?:a|por|c\/u|cada\s*uno)\s*\$?\s*(\d+(?:[.,]\d+)?)/i);
  if (unitMatch) {
    unitPrice = parseFloat(unitMatch[1].replace(/\./g, '').replace(',', '.'));
    cleaned = cleaned.replace(unitMatch[0], ' ');
  }

  // Quantity patterns like "5 unid", "5 medias", "venta 5 ..."
  const qtyMatch = cleaned.match(/\b(?:venta|vendi|vendí|sacar|saque|compre|compré|stock|entrada)?\s*(\d+)\s*(?:unid|unidades|pares|par|u\b)?/i);
  if (qtyMatch && parseInt(qtyMatch[1], 10) > 0) {
    const foundNum = parseInt(qtyMatch[1], 10);
    if (foundNum !== totalAmount && foundNum !== unitPrice && foundNum < 1000) {
      cantidad = foundNum;
    }
  }

  // Check remaining standalone numbers
  const remainingNumbers = cleaned.match(/\b\d+\b/g);
  if (remainingNumbers) {
    for (const numStr of remainingNumbers) {
      const n = parseInt(numStr, 10);
      if (n > 0 && n <= 100 && cantidad === 1 && n !== totalAmount && n !== unitPrice) {
        cantidad = n;
      } else if (n > 500 && totalAmount === 0 && unitPrice === 0) {
        totalAmount = n;
      }
    }
  }

  return { cantidad, unitPrice, totalAmount };
}

class BackendTelegramBot {
  private token: string = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TOKEN;
  private isPolling: boolean = false;
  private isFetching: boolean = false;
  private pollTimeout: any = null;
  private lastUpdateId: number = 0;
  private processedUpdates: Set<number> = new Set();
  private processedMessages: Set<string> = new Set();
  private botInfo: any = null;

  public async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('[BackendTelegramBot] Starting 24/7 Server Telegram Bot...');

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        this.botInfo = data.result;
        console.log(`[BackendTelegramBot] ✅ Bot online as @${data.result.username} (${data.result.first_name})`);
      } else {
        console.error('[BackendTelegramBot] Invalid Telegram token:', data);
        this.isPolling = false;
        return;
      }

      // Delete any webhook to allow clean long-polling
      await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook?drop_pending_updates=false`).catch(() => {});

      // Register autocomplete commands
      fetch(`https://api.telegram.org/bot${this.token}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'help', description: 'Ver todos los comandos y ayuda' },
            { command: 'medias', description: 'Stock completo y cantidad de medias' },
            { command: 'stock', description: 'Ver inventario (o /stock [producto])' },
            { command: 'precios', description: 'Lista de precios al público' },
            { command: 'bajo_stock', description: 'Alertas de poco stock y agotados' },
            { command: 'hoy', description: 'Resumen de ventas y dinero de hoy' },
            { command: 'saldo', description: 'Balance de caja y ganancias' },
            { command: 'ventas', description: 'Últimas 5 ventas registradas' },
            { command: 'gastos', description: 'Últimos 5 gastos anotados' },
            { command: 'plantilla', description: 'Plantillas para copiar y pegar' }
          ]
        })
      }).catch(() => {});

      this.schedulePoll(100);
    } catch (e) {
      console.error('[BackendTelegramBot] Error initializing bot:', e);
      this.isPolling = false;
    }
  }

  public stop() {
    this.isPolling = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
  }

  private schedulePoll(delayMs: number = 500) {
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
    if (!this.isPolling) return;
    this.pollTimeout = setTimeout(() => {
      this.pollUpdates();
    }, delayMs);
  }

  private async sendChatAction(chatId: number, action: string = 'typing') {
    try {
      await fetch(`https://api.telegram.org/bot${this.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (e) {}
  }

  private async sendMessage(chatId: number, text: string) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      const data = await res.json();
      if (!data.ok) {
        // Fallback without parse_mode if Markdown parsing failed
        await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text.replace(/[*_`]/g, '')
          })
        });
      }
    } catch (e) {
      console.error('[BackendTelegramBot] Failed to send message:', e);
    }
  }

  private async pollUpdates() {
    if (!this.isPolling || this.isFetching) return;
    this.isFetching = true;

    let hasMessages = false;
    try {
      const offsetParam = this.lastUpdateId > 0 ? this.lastUpdateId + 1 : 0;
      const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offsetParam}&limit=10&timeout=2`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        hasMessages = true;
        for (const update of data.result) {
          const updateId = update.update_id;
          if (updateId >= this.lastUpdateId) {
            this.lastUpdateId = updateId;
          }

          if (this.processedUpdates.has(updateId)) continue;
          this.processedUpdates.add(updateId);

          if (update.message && update.message.text) {
            const msgId = update.message.message_id;
            const chatId = update.message.chat?.id;
            const msgKey = `${chatId}_${msgId}`;
            if (this.processedMessages.has(msgKey)) continue;
            this.processedMessages.add(msgKey);

            await this.handleMessage(update.message);
          }
        }
      }
    } catch (e) {
      // transient network error, retry next loop
    } finally {
      this.isFetching = false;
      if (this.isPolling) {
        this.schedulePoll(hasMessages ? 50 : 600);
      }
    }
  }

  public async handleWebhookUpdate(update: any) {
    if (update && update.message && update.message.text) {
      const msgId = update.message.message_id;
      const chatId = update.message.chat?.id;
      const msgKey = `${chatId}_${msgId}`;
      if (this.processedMessages.has(msgKey)) return;
      this.processedMessages.add(msgKey);
      await this.handleMessage(update.message);
    }
  }

  private async handleMessage(msg: any) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const lower = text.toLowerCase();
    const sender = msg.from?.first_name || 'Compañero';

    console.log(`[BackendTelegramBot] Incoming message from ${sender} (${chatId}): "${text}"`);

    // Immediate typing indicator
    this.sendChatAction(chatId, 'typing').catch(() => {});

    // 1. Templates: /plantilla
    if (rawMatch(lower, ['/plantilla', 'plantilla', 'plantillas', '/formato', 'formato'])) {
      await this.handlePlantillas(chatId);
      return;
    }

    // 2. Help: /help, /start, /ayuda
    if (rawMatch(lower, ['/help', '/ayuda', '/comandos', '/start', '/menu', 'help', 'ayuda', 'comandos', 'menu'])) {
      await this.handleHelp(chatId, sender);
      return;
    }

    // 3. Medias stock query
    if (
      lower.includes('media') || lower.includes('soquete') || lower === '/medias' || lower === 'medias'
    ) {
      if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('cuestan') || lower.includes('salen')) {
        await this.handlePrices(chatId, 'medias');
        return;
      }
      if (lower.startsWith('venta') || lower.startsWith('vendi') || lower.startsWith('vendí') || lower.startsWith('sacar') || lower.startsWith('stock ') || lower.startsWith('compre')) {
        // let sale / purchase flow handle it below
      } else {
        await this.handleMediasStock(chatId);
        return;
      }
    }

    // 4. Low stock: /bajo_stock
    if (rawMatch(lower, ['/bajo_stock', '/alertas', '/agotados', 'bajo stock', 'stock bajo', 'alertas', 'agotados'])) {
      await this.handleLowStock(chatId);
      return;
    }

    // 5. Today summary: /hoy
    if (rawMatch(lower, ['/hoy', '/resumen_hoy', '/dia', '/ventas_hoy', '/resumen', 'hoy', 'resumen hoy', 'ventas de hoy', 'ventas hoy'])) {
      await this.handleTodaySummary(chatId);
      return;
    }

    // 6. Prices query: /precios
    if (lower.startsWith('/precios') || lower.startsWith('/precio') || lower === 'precios' || lower.startsWith('precios ')) {
      const term = lower.replace(/^\/precios?\s*/, '').replace(/^precios?\s*/, '').trim();
      await this.handlePrices(chatId, term);
      return;
    }

    // 7. General Stock: /stock
    if (lower.startsWith('/stock') || lower === 'stock' || lower === 'inventario' || lower === 'productos') {
      const term = lower.replace(/^\/stock\s*/, '').replace(/^stock\s*/, '').trim();
      if (term && !term.includes('$')) {
        await this.handleProductStock(chatId, term);
      } else {
        await this.handleGeneralStock(chatId);
      }
      return;
    }

    // 8. Balance / Saldo
    if (rawMatch(lower, ['/saldo', '/caja', '/balance', 'saldo', 'caja', 'balance', 'dinero'])) {
      await this.handleSaldo(chatId);
      return;
    }

    // 9. Finance expenses & incomes: Gasto 4500 nafta, Cobré 15000 sueldo
    const isExpense = lower.startsWith('gasto') || lower.startsWith('gasté') || lower.startsWith('pagué') || lower.startsWith('pague');
    const isIncome = lower.startsWith('ingreso') || lower.startsWith('cobré') || lower.startsWith('cobre') || lower.startsWith('sueldo');
    if (isExpense || isIncome) {
      await this.handleFinance(chatId, text, isIncome ? 'ingreso' : 'egreso');
      return;
    }

    // 10. Purchase: Stock 10 medias $1500, Compré 5...
    const isPurchase = lower.startsWith('compra') || lower.startsWith('compré') || lower.startsWith('compre') || lower.startsWith('entrada');
    if (isPurchase) {
      await this.handlePurchase(chatId, text);
      return;
    }

    // 11. Sales & Stock deductions: Venta 1 canillera $7000, Venta 5 media negra $20000, etc.
    const isSale = lower.startsWith('venta') || lower.startsWith('vendi') || lower.startsWith('vendí') || lower.startsWith('sacar') || lower.startsWith('saque') || lower.startsWith('descontar');
    const hasNumbers = /\d+/.test(text);

    if (isSale || hasNumbers || lower.includes('talle') || lower.includes('canillera') || lower.includes('media')) {
      await this.handleSale(chatId, text, msg.message_id);
      return;
    }

    // Fallback welcome message
    await this.sendMessage(
      chatId,
      `👋 ¡Hola ${sender}! Podés usar cualquiera de estos comandos rápidos:\n\n` +
      `🧦 /medias — Stock y cantidad de medias\n` +
      `💲 /precios — Lista de precios\n` +
      `📦 /stock — Ver inventario general (o \`/stock [producto]\`)\n` +
      `⚠️ /bajo_stock — Alertas de reposición\n` +
      `📅 /hoy — Resumen del día de hoy\n` +
      `💰 /saldo — Balance y caja\n` +
      `📋 /plantilla — Plantillas rápidas\n` +
      `❓ /help — Ayuda y comandos completos\n\n` +
      `💡 _Para registrar una venta escribí:_ \`Venta 1 canillera $7000\` o \`Venta 5 media antideslizante lisa negra $20000\``
    );
  }

  // --- ACTIONS ---

  private async handleSale(chatId: number, text: string, msgId?: number) {
    try {
      const products = await supabaseService.getProducts();
      const sizeInfo = extractSizeInfo(text);
      const matchResult = findBestProductMatch(text, products);
      const { cantidad, unitPrice: parsedUnitPrice, totalAmount: parsedTotal } = parseQuantityAndPrice(text, sizeInfo);

      if (!matchResult) {
        // Fallback: If no matching product found, register as finance income
        let total = parsedTotal;
        if (!total && parsedUnitPrice) total = parsedUnitPrice * cantidad;
        if (total > 0) {
          await supabaseService.addFinance({
            tipo: 'ingreso',
            categoria: 'ventas',
            concepto: `Venta: ${text}`,
            monto: total,
            metodo: 'efectivo',
            fecha: new Date().toISOString().split('T')[0],
            notas: `Venta registrada vía Telegram`
          });
          await this.sendMessage(
            chatId,
            `✅ *Venta registrada en Finanzas*\n\n` +
            `• *Concepto:* ${safeMarkdown(text)}\n` +
            `• *Total:* $${total.toLocaleString('es-AR')}\n\n` +
            `_No coincidió con ningún producto del inventario, por lo que se anotó en tus Ingresos de dinero._`
          );
          return;
        }

        await this.sendMessage(
          chatId,
          `⚠️ No encontré ese producto en tu inventario.\n` +
          `Escribí /stock para ver tus productos o indicá el precio. Ej: \`Venta 1 canillera $7000\``
        );
        return;
      }

      const { product, variant, detectedSize } = matchResult;
      const prodName = getProductDisplayName(product);

      // Determine price
      let finalPrice = parsedUnitPrice;
      let finalTotal = parsedTotal;

      if (!finalTotal || finalTotal === 0 || !isFinite(finalTotal)) {
        finalPrice = variant?.precio || product.precio || 0;
        finalTotal = Math.round(finalPrice * cantidad);
      } else if (!finalPrice || !isFinite(finalPrice) || finalPrice <= 0) {
        finalPrice = isFinite(finalTotal / cantidad) && cantidad > 0 
          ? Math.round(finalTotal / cantidad) 
          : (variant?.precio || product.precio || 0);
      }

      finalPrice = Math.max(0, isFinite(finalPrice) ? Math.round(finalPrice) : (variant?.precio || product.precio || 0));
      finalTotal = Math.max(0, isFinite(finalTotal) ? Math.round(finalTotal) : Math.round(finalPrice * cantidad));

      const newStock = Math.max(0, (product.cantidad || 0) - cantidad);
      const newVariantStock = variant ? Math.max(0, (variant.cantidad || 0) - cantidad) : undefined;

      const variantDetail = variant 
        ? `\n🏷️ *Talle / Variante:* ${variant.nombre}` 
        : (detectedSize ? `\n🏷️ *Talle:* ${detectedSize}` : '');

      const isRemoval = /(?:sacar|saque|saqué|saca|descontar|remover|restar|baja)/i.test(text);
      const actionTitle = isRemoval ? '📦 *¡Stock Descontado del Inventario!* 📉' : '🎉 *¡Venta Registrada Exitosamente!* 🚀';
      const actionQty = isRemoval ? '📉 *Cantidad retirada:*' : '🔢 *Cantidad vendida:*';

      // Send Telegram confirmation immediately
      const replyPromise = this.sendMessage(
        chatId,
        `${actionTitle}\n\n` +
        `📦 *Producto:* ${safeMarkdown(prodName)}${variantDetail}\n` +
        `${actionQty} -${cantidad} unid.\n` +
        `💵 *Precio:* $${finalPrice.toLocaleString('es-AR')} c/u (Total: *$${finalTotal.toLocaleString('es-AR')}*)\n` +
        `📊 *Stock restante:* ${newStock} unid.\n\n` +
        `_El stock y el saldo se actualizaron automáticamente en tu app web._`
      );

      // Persist sale and stock update to Supabase
      const savePromise = supabaseService.registerSale([{
        productId: product.id,
        productNombre: prodName,
        variantId: variant?.id,
        variantNombre: variant?.nombre,
        cantidad: cantidad,
        precio: finalPrice,
        total: finalTotal,
        transactionId: `tg_${chatId}_${msgId || Date.now()}`
      }]).catch(err => console.error('[BackendTelegramBot] Error saving sale to Supabase:', err));

      await Promise.all([replyPromise, savePromise]);
      console.log(`[BackendTelegramBot] Sale registered: ${cantidad}x ${prodName} for $${finalTotal}`);
    } catch (e: any) {
      console.error('[BackendTelegramBot] Error handling sale:', e);
      await this.sendMessage(chatId, `❌ Error al procesar venta: ${e?.message || 'Intenta de nuevo'}`);
    }
  }

  private async handleFinance(chatId: number, text: string, tipo: 'ingreso' | 'egreso') {
    try {
      let amount = 0;
      const dollarMatch = text.match(/\$\s*(\d+(?:[.,]\d+)?)/);
      if (dollarMatch) {
        amount = parseFloat(dollarMatch[1].replace(/\./g, '').replace(',', '.'));
      }
      if (!amount || amount <= 0) {
        const numbers = text.match(/\d+([.,]\d+)?/g);
        if (numbers && numbers.length > 0) {
          const parsed = numbers.map(n => parseFloat(n.replace(/\./g, '').replace(',', '.'))).filter(n => isFinite(n) && n > 0);
          if (parsed.length > 0) amount = Math.max(...parsed);
        }
      }

      if (!amount || amount <= 0) {
        await this.sendMessage(chatId, `⚠️ No encontré el monto en tu mensaje.\nEjemplo: \`${tipo === 'ingreso' ? 'Cobré $25000' : 'Gasto $4500 en nafta'}\``);
        return;
      }

      let cleanConcept = text
        .replace(/gasto|gasté|compré|compre|pagué|pague|ingreso|cobré|cobre|sueldo|fondo|plata|\$|\d+([.,]\d+)?/gi, '')
        .replace(/\b(en|de|por|para|un|una|el|la|los|las|efectivo|transferencia|transfer)\b/gi, '')
        .trim();
      if (!cleanConcept) cleanConcept = tipo === 'ingreso' ? 'Ingreso vía Telegram' : 'Gasto vía Telegram';

      const icon = tipo === 'ingreso' ? '🟢' : '🔴';
      const label = tipo === 'ingreso' ? 'Ingreso de Dinero' : 'Gasto Anotado';

      const replyPromise = this.sendMessage(
        chatId,
        `✅ *${icon} ${label} Exitoso*\n\n` +
        `• *Detalle:* ${cleanConcept}\n` +
        `• *Monto:* $${Math.round(amount).toLocaleString('es-AR')}\n\n` +
        `_Ya está reflejado en tu saldo de la aplicación web._`
      );

      const savePromise = supabaseService.addFinance({
        tipo,
        categoria: tipo === 'ingreso' ? 'sueldo_cobro' : 'otro',
        concepto: cleanConcept,
        monto: Math.round(amount),
        metodo: 'efectivo',
        fecha: new Date().toISOString().split('T')[0],
        notas: `Anotado vía Telegram: "${text}"`
      }).catch(err => console.error('[BackendTelegramBot] Error saving finance:', err));

      await Promise.all([replyPromise, savePromise]);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al guardar finanza: ${e?.message}`);
    }
  }

  private async handlePurchase(chatId: number, text: string) {
    try {
      const products = await supabaseService.getProducts();
      const sizeInfo = extractSizeInfo(text);
      const matchResult = findBestProductMatch(text, products);
      const { cantidad, unitPrice, totalAmount } = parseQuantityAndPrice(text, sizeInfo);

      if (!matchResult) {
        await this.sendMessage(
          chatId,
          `⚠️ No encontré ese producto en tu inventario para sumarle stock.\n` +
          `Ejemplo: \`Compré 10 canilleras a $1500 c/u\``
        );
        return;
      }

      const { product, variant } = matchResult;
      const prodName = getProductDisplayName(product);

      let costPerUnit = unitPrice;
      if (!costPerUnit || costPerUnit <= 0) {
        if (totalAmount > 0 && cantidad > 0) costPerUnit = Math.round(totalAmount / cantidad);
        else costPerUnit = variant?.costo || product.costo || 0;
      }
      if (!costPerUnit || costPerUnit <= 0) {
        await this.sendMessage(chatId, `⚠️ Por favor indicá el precio de costo unitario para "${safeMarkdown(prodName)}".\nEjemplo: \`Compré ${cantidad} ${prodName} a $1500 c/u\``);
        return;
      }

      const totalSpent = Math.round(costPerUnit * cantidad);
      const newTotalStock = (product.cantidad || 0) + cantidad;

      const replyPromise = this.sendMessage(
        chatId,
        `📥 *¡Stock y Compra Registrados!* ✨\n\n` +
        `📦 *Producto:* ${safeMarkdown(prodName)}\n` +
        `➕ *Cantidad ingresada:* +${cantidad} unid.\n` +
        `💲 *Costo unitario:* $${costPerUnit.toLocaleString('es-AR')}\n` +
        `💰 *Total Invertido:* $${totalSpent.toLocaleString('es-AR')}\n` +
        `📈 *Stock actual:* ${newTotalStock} unid.\n\n` +
        `_Se sumó a tus Compras y se reflejó automáticamente en 'Dinero & Gastos'._`
      );

      const savePromise = supabaseService.registerPurchase({
        productId: product.id,
        productNombre: prodName,
        variantId: variant?.id,
        variantNombre: variant?.nombre,
        cantidad: cantidad,
        costo: costPerUnit,
        proveedor: 'Compra vía Telegram'
      }).catch(err => console.error('[BackendTelegramBot] Error saving purchase:', err));

      await Promise.all([replyPromise, savePromise]);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al registrar compra: ${e?.message}`);
    }
  }

  private async handleMediasStock(chatId: number) {
    try {
      const products = await supabaseService.getProducts();
      const mediaProducts = products.filter(p => {
        const base = normalizeSearchText(getProductBaseName(p));
        const desc = normalizeSearchText(p.descripcion || '');
        const cod = normalizeSearchText(p.codigo || '');
        return base.includes('media') || base.includes('soquete') || desc.includes('media') || desc.includes('soquete') || cod.includes('med');
      });

      if (mediaProducts.length === 0) {
        await this.sendMessage(chatId, `🧦 No tenés medias registradas en tu catálogo aún.`);
        return;
      }

      const total = mediaProducts.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
      const grouped = groupInventoryProducts(mediaProducts);

      let msg = `🧦 *STOCK COMPLETO DE MEDIAS*\n`;
      msg += `📦 *${grouped.length}* modelos | Total disponible: *${total} pares/unid.*\n\n`;

      grouped.forEach((g, idx) => {
        const isDepleted = g.totalCantidad <= 0;
        const emoji = isDepleted ? '🚨' : '🧦';
        msg += `${emoji} *${idx + 1}. ${safeMarkdown(g.name)}*\n`;
        msg += `   • Precio: $${g.precioMin.toLocaleString('es-AR')}\n`;
        msg += `   • Stock: *${g.totalCantidad} unid.*${isDepleted ? ' _(AGOTADO)_' : ''}\n\n`;
      });

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al consultar medias.`);
    }
  }

  private async handleGeneralStock(chatId: number) {
    try {
      const products = await supabaseService.getProducts();
      if (products.length === 0) {
        await this.sendMessage(chatId, `📋 No tenés productos cargados en el inventario.`);
        return;
      }

      const totalStock = products.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
      const grouped = groupInventoryProducts(products);

      let msg = `📋 *INVENTARIO GENERAL*\n`;
      msg += `📦 *${grouped.length}* artículos | *${totalStock}* unidades en total:\n\n`;

      grouped.slice(0, 15).forEach((g, idx) => {
        const alertEmoji = g.totalCantidad <= 0 ? '🚨 ' : g.totalCantidad <= g.minStock ? '⚠️ ' : '🔹 ';
        msg += `${alertEmoji}*${idx + 1}. ${safeMarkdown(g.name)}* — *${g.totalCantidad} unid.* ($${g.precioMin.toLocaleString('es-AR')})\n`;
      });

      if (grouped.length > 15) {
        msg += `\n_...y ${grouped.length - 15} artículos más. Escribí /stock [nombre] para buscar uno puntual._\n`;
      }

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al consultar inventario.`);
    }
  }

  private async handleProductStock(chatId: number, queryTerm: string) {
    try {
      const products = await supabaseService.getProducts();
      const normQuery = normalizeSearchText(queryTerm);
      const match = findBestProductMatch(queryTerm, products);

      if (!match) {
        await this.sendMessage(chatId, `🔍 No encontré ningún producto que coincida con "*${safeMarkdown(queryTerm)}*".`);
        return;
      }

      const p = match.product;
      let msg = `📦 *STOCK DE "${safeMarkdown(getProductDisplayName(p)).toUpperCase()}"*\n\n`;
      msg += `• Código: \`${safeMarkdown(p.codigo || 'S/C')}\`\n`;
      msg += `• Precio: *$${p.precio.toLocaleString('es-AR')}*\n`;
      msg += `• Stock disponible: *${p.cantidad} unidades*\n\n`;
      msg += `💡 _Para vender:_ \`Venta 1 ${safeMarkdown(getProductBaseName(p)).toLowerCase()} $${p.precio}\``;

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al buscar producto.`);
    }
  }

  private async handlePrices(chatId: number, filterTerm?: string) {
    try {
      const products = await supabaseService.getProducts();
      const grouped = groupInventoryProducts(products);

      let filtered = grouped;
      if (filterTerm && filterTerm.trim()) {
        const norm = normalizeSearchText(filterTerm);
        filtered = grouped.filter(g => normalizeSearchText(g.name).includes(norm) || normalizeSearchText(g.codigo).includes(norm));
      }

      if (filtered.length === 0) {
        await this.sendMessage(chatId, `🔍 No encontré precios para "*${safeMarkdown(filterTerm || '')}*".`);
        return;
      }

      let msg = `💲 *LISTA DE PRECIOS:*\n\n`;
      filtered.slice(0, 20).forEach((g, idx) => {
        msg += `${idx + 1}. *${safeMarkdown(g.name)}*: *$${g.precioMin.toLocaleString('es-AR')}*\n`;
      });

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al consultar precios.`);
    }
  }

  private async handleLowStock(chatId: number) {
    try {
      const products = await supabaseService.getProducts();
      const lowStock = products.filter(p => (Number(p.cantidad) || 0) <= (Number(p.minStock) || 5));

      if (lowStock.length === 0) {
        await this.sendMessage(chatId, `✅ *¡Todo en orden!*\nTodos tus productos superan el nivel mínimo de stock.`);
        return;
      }

      let msg = `⚠️ *ALERTAS DE STOCK BAJO (${lowStock.length}):*\n\n`;
      lowStock.forEach(p => {
        const isDepleted = (Number(p.cantidad) || 0) <= 0;
        const icon = isDepleted ? '🚨 AGOTADO' : '⚠️ POCO STOCK';
        msg += `• *${safeMarkdown(getProductDisplayName(p))}*: *${p.cantidad} unid.* (${icon})\n`;
      });

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al consultar stock bajo.`);
    }
  }

  private async handleTodaySummary(chatId: number) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: sales } = await supabase.from('sales').select('*').gte('fecha', today);
      const { data: finances } = await supabase.from('finances').select('*').gte('fecha', today);

      const salesList = sales || [];
      const financesList = finances || [];

      const totalVentas = salesList.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalGastos = financesList.filter(f => f.tipo === 'egreso').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const balance = totalVentas - totalGastos;

      let msg = `📅 *RESUMEN DEL DÍA DE HOY*\n\n`;
      msg += `🛒 *Ventas hoy (${salesList.length}):* *$${totalVentas.toLocaleString('es-AR')}*\n`;
      msg += `🔴 *Gastos hoy (${financesList.length}):* -$${totalGastos.toLocaleString('es-AR')}\n`;
      msg += `━━━━━━━━━━━━━━━\n`;
      msg += `💰 *Balance Neto:* *${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')}*\n`;

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al calcular resumen del día.`);
    }
  }

  private async handleSaldo(chatId: number) {
    try {
      const { data: sales } = await supabase.from('sales').select('total');
      const { data: finances } = await supabase.from('finances').select('tipo, monto');

      const totalVentas = (sales || []).reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalGastos = (finances || []).filter(f => f.tipo === 'egreso').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const balance = totalVentas - totalGastos;

      let msg = `💰 *ESTADO DE CAJA Y SALDO*\n\n`;
      msg += `📈 *Ingresos Totales (Ventas):* $${totalVentas.toLocaleString('es-AR')}\n`;
      msg += `📉 *Egresos / Gastos Totales:* -$${totalGastos.toLocaleString('es-AR')}\n`;
      msg += `━━━━━━━━━━━━━━━\n`;
      msg += `💵 *Saldo Neto Actual:* *${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')}*\n`;

      await this.sendMessage(chatId, msg);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error al consultar saldo.`);
    }
  }

  private async handleHelp(chatId: number, sender: string) {
    const msg =
`🤖 *CENTRO DE COMANDOS — ASISTENTE TOTAL*
_Hola ${sender}! Podés usar cualquiera de estos comandos:_

📦 *STOCK E INVENTARIO:*
• /stock — Resumen general de stock
• /medias — Stock completo de medias 🧦
• /stock [producto] — Stock específico (ej: \`/stock canilleras\`)
• /bajo_stock — Alertas de agotados o poco stock ⚠️

💲 *PRECIOS:*
• /precios — Lista de precios
• /precios [producto] — Precio puntual

💰 *FINANZAS Y CAJA:*
• /saldo — Balance total de caja y ganancias
• /hoy — Ventas y gastos de hoy 📅

📋 *REGISTRO EN 1 LÍNEA:*
• Vender: \`Venta 1 canillera $7000\`
• Comprar: \`Compré 10 medias a $1500 c/u\`
• Gasto: \`Gasto 4500 nafta\`
• Ingreso: \`Cobré $15000 sueldo\``;

    await this.sendMessage(chatId, msg);
  }

  private async handlePlantillas(chatId: number) {
    const msg =
`📋 *PLANTILLAS RÁPIDAS PARA COPIAR:*

🛒 *Para registrar venta:*
\`Venta 1 canillera $7000\`
\`Venta 5 media antideslizante lisa negra $20000\`

📥 *Para ingresar mercadería:*
\`Compré 10 medias a $1500 c/u\`
\`Stock 5 canilleras a $4000\`

💸 *Para anotar un gasto:*
\`Gasto 4500 nafta\`
\`Gasto 12000 comida\`

💵 *Para anotar ingreso:*
\`Cobré $35000 sueldo\``;

    await this.sendMessage(chatId, msg);
  }
}

function rawMatch(input: string, targets: string[]): boolean {
  return targets.some(t => input === t);
}

export const backendTelegramBot = new BackendTelegramBot();
