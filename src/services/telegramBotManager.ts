/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { inventoryService } from './inventoryService';
import { Product, ProductVariant } from '../types';

export interface TelegramBotStatus {
  isActive: boolean;
  botUsername: string;
  botName: string;
  lastSync?: string;
  processedCount: number;
  lastMessage?: string;
}

const DEFAULT_TOKEN = '8655329307:AAEEnvrWo4lrG4i6myrIDhtlUqTgpxroSKc';
const STORAGE_KEY = 'gestion_total_telegram_token';
const LAST_UPDATE_KEY = 'gestion_total_telegram_last_update_id';
const PROCESSED_UPDATES_KEY = 'gestion_total_telegram_processed_updates';

export interface MatchedProductInfo {
  product: Product;
  variant?: ProductVariant;
  detectedSize?: string;
  confidence: number;
}

export interface ParsedQtyPrice {
  cantidad: number;
  unitPrice?: number;
  totalAmount: number;
  isUnitPriceExplicit: boolean;
}

/**
 * Calculates string similarity using Levenshtein distance (0 to 1).
 */
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

/**
 * Normalizes text: lowercase, removes accents, strips special characters, single spaces.
 */
export function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects dimensions/sizes in text like "11cm", "11 cm", "talle 11", "talle xl", "t 42".
 */
export function extractSizeInfo(text: string): { size: string; rawMatch: string } | null {
  const lower = text.toLowerCase();

  // 1. Dimensions like 11cm, 11 cm, 11.5cm, 11mm, 2m, 5pulgadas
  const dimMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(cm|mm|m|pulgadas?|pulg)\b/i);
  if (dimMatch) {
    return {
      size: `${dimMatch[1].replace(',', '.')}${dimMatch[2].toLowerCase()}`,
      rawMatch: dimMatch[0]
    };
  }

  // 2. Patterns like "talle 11", "talle 11cm", "talle xl", "t 42", "nro 42", "n° 40"
  const talleMatch = lower.match(/\b(?:talle|t|nro|n°|numero|número)\s*[:#]?\s*([a-z0-9]+(?:\s*(?:cm|mm))?)\b/i);
  if (talleMatch) {
    const rawVal = talleMatch[1].trim();
    return {
      size: rawVal.replace(/\s+/g, '').toLowerCase(),
      rawMatch: talleMatch[0]
    };
  }

  // 3. Clothing letters: s, m, l, xl, xxl, xxxl, xs, xxs (bounded by words)
  const letterMatch = lower.match(/\b(xxxl|xxl|xl|xs|xxs|s|m|l)\b/i);
  if (letterMatch) {
    return {
      size: letterMatch[1].toUpperCase(),
      rawMatch: letterMatch[0]
    };
  }

  return null;
}

/**
 * Sanitizes strings for Telegram Markdown V1 to prevent broken markup.
 */
export function safeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[*_`\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Gets a clean, user-friendly display name for any product.
 * Checks descripcion, nombre, name, articulo, and codigo with fallback.
 */
export function getProductDisplayName(p: any): string {
  if (!p) return 'Artículo sin nombre';
  const desc = (p.descripcion || '').trim();
  const nom = (p.nombre || p.name || p.articulo || p.producto || p.productNombre || '').trim();
  const cod = (p.codigo || '').trim();

  if (desc && cod && desc.toLowerCase() !== cod.toLowerCase()) {
    return `${desc} (${cod})`;
  }
  return desc || nom || cod || 'Artículo';
}

/**
 * Gets base product name without SKU/code suffix for search and grouping.
 */
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

/**
 * Groups raw database products by model/article.
 * Combines sibling rows with different talles into a single grouped article.
 */
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

    // Collect variants or individual talle
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
        const vName = (v.nombre || '').trim();
        if (!vName) return;
        const existing = group.talles.find(t => t.nombre.toLowerCase() === vName.toLowerCase());
        const vQty = Number(v.cantidad) || 0;
        if (existing) {
          existing.cantidad += vQty;
        } else {
          group.talles.push({
            nombre: vName,
            cantidad: vQty,
            precio: v.precio ? Number(v.precio) : undefined
          });
        }
      });
    } else if (p.talle && p.talle.trim()) {
      const talleName = p.talle.trim();
      const existing = group.talles.find(t => t.nombre.toLowerCase() === talleName.toLowerCase());
      if (existing) {
        existing.cantidad += qty;
      } else {
        group.talles.push({
          nombre: talleName,
          cantidad: qty,
          precio: price > 0 ? price : undefined
        });
      }
    }
  });

  return Array.from(groupsMap.values());
}

/**
 * Extracts Spanish root/stem to match singular/plural and masculine/feminine forms
 * e.g. "medias" == "media", "negras" == "negro", "lisas" == "liso", "antideslizantes" == "antideslizante"
 */
export function toSpanishStem(w: string): string {
  let s = (w || '').toLowerCase().trim();
  if (s.endsWith('es') && s.length > 4) {
    if (['l', 'r', 'n', 'd', 'z'].includes(s[s.length - 3])) {
      s = s.slice(0, -2);
    } else {
      s = s.slice(0, -1);
    }
  } else if (s.endsWith('s') && s.length > 3) {
    s = s.slice(0, -1);
  }
  if ((s.endsWith('a') || s.endsWith('o')) && s.length > 3) {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * Matches variant inside a product based on size, color, or raw text with Spanish inflection support
 */
export function findMatchingVariant(product: Product, sizeInfo: { size: string } | null, fullText: string): ProductVariant | undefined {
  if (!product.variants || product.variants.length === 0) return undefined;

  const targetSize = sizeInfo ? normalizeSearchText(sizeInfo.size).replace(/\s+/g, '') : null;
  const normText = normalizeSearchText(fullText);
  const textWords = normText.split(' ').filter(w => w.length >= 2);
  const textStems = textWords.map(toSpanishStem);

  // 1. Direct match with target size
  if (targetSize) {
    for (const v of product.variants) {
      const vNorm = normalizeSearchText(v.nombre).replace(/\s+/g, '');
      if (vNorm === targetSize) return v;

      // Extract numbers only (e.g. variant "11" matches "11cm")
      const vDigits = vNorm.replace(/[^0-9]/g, '');
      const tDigits = targetSize.replace(/[^0-9]/g, '');
      if (vDigits && tDigits && vDigits === tDigits) return v;
    }
  }

  // 2. Exact substring match in text
  for (const v of product.variants) {
    const vNorm = normalizeSearchText(v.nombre);
    if (vNorm && normText.includes(vNorm)) {
      return v;
    }
    const vClean = vNorm.replace(/\s+/g, '');
    if (vClean && normText.replace(/\s+/g, '').includes(vClean)) {
      return v;
    }
  }

  // 3. Token and Spanish-stem matching (handles "negro" vs "negra", "liso" vs "lisa", "Lisa - Negra")
  let bestVariant: ProductVariant | undefined;
  let maxVariantScore = 0;

  for (const v of product.variants) {
    const vNorm = normalizeSearchText(v.nombre);
    const vWords = vNorm.split(' ').filter(w => w.length >= 2);
    if (vWords.length === 0) continue;
    const vStems = vWords.map(toSpanishStem);

    let matchedStems = 0;
    for (const vStem of vStems) {
      if (textStems.includes(vStem) || textWords.some(tw => tw.startsWith(vStem) || vStem.startsWith(tw))) {
        matchedStems++;
      }
    }

    const matchRatio = matchedStems / vStems.length;
    if (matchRatio >= 0.5 && matchedStems > 0) {
      const vScore = matchedStems * 10 + (matchRatio === 1 ? 15 : 0);
      if (vScore > maxVariantScore) {
        maxVariantScore = vScore;
        bestVariant = v;
      }
    }
  }

  return bestVariant;
}

/**
 * Smart product & variant matcher: handles fuzzy matching, keyword roots, sizes, talles, etc.
 * Not strictly literal: recognizes misspellings, partial words, and reordered words.
 */
export function findBestProductMatch(userText: string, products: Product[]): MatchedProductInfo | null {
  if (!products || products.length === 0) return null;

  const sizeInfo = extractSizeInfo(userText);
  const normUserText = normalizeSearchText(userText);

  const stopWords = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'para', 'con', 'en', 'a', 'por', 'y', 'o', 'al', 'lo', 'que', 'me', 'mi', 'se',
    'venta', 'vender', 'vendi', 'vendí', 'vendo', 'salida', 'salio', 'salió',
    'sacar', 'saque', 'saqué', 'saca', 'descontar', 'desconte', 'desconté', 'descuenta',
    'remover', 'removi', 'removí', 'remueve', 'restar', 'reste', 'resté', 'resta',
    'baja', 'bajar', 'usar', 'uso', 'use', 'usé', 'entregar',
    'compra', 'comprar', 'compre', 'compré', 'stock', 'agregar', 'sumar', 'entrada',
    'articulos', 'art', 'unid', 'unidad', 'unidades', 'pares', 'c/u', 'cu', 'cada',
    'precio', 'costo', 'total', 'pesos', 'efectivo', 'transferencia', 'transfer', 'mp'
  ]);

  let textWithoutSize = userText;
  if (sizeInfo) {
    textWithoutSize = textWithoutSize.replace(new RegExp(sizeInfo.rawMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }
  const normQuery = normalizeSearchText(textWithoutSize);
  const queryTokens = normQuery
    .split(' ')
    .filter(w => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  let bestMatch: MatchedProductInfo | null = null;
  let highestScore = 0;

  for (const prod of products) {
    let score = 0;
    const prodBase = getProductBaseName(prod);
    const prodDescNorm = normalizeSearchText(prod.descripcion || '');
    const prodCodeNorm = normalizeSearchText(prod.codigo || '');
    const prodBaseNorm = normalizeSearchText(prodBase);
    const prodTalleNorm = normalizeSearchText(prod.talle || '');
    const combinedSearchText = `${prodDescNorm} ${prodCodeNorm} ${prodBaseNorm}`.trim();
    const prodTokens = Array.from(new Set(combinedSearchText.split(' ').filter(w => w.length >= 2 && !stopWords.has(w))));
    const prodStems = prodTokens.map(toSpanishStem);

    // 1. Exact code match
    if (prodCodeNorm && normUserText.includes(prodCodeNorm)) {
      score += 130;
    }

    // 2. Substring match with full product description or base name
    if ((prodDescNorm && normUserText.includes(prodDescNorm)) || (prodBaseNorm && normUserText.includes(prodBaseNorm))) {
      score += 110;
    } else if (normQuery.length > 3 && (prodDescNorm.includes(normQuery) || prodBaseNorm.includes(normQuery))) {
      score += 75;
    }

    // 3. Flexible Token overlap with product description (order-independent, stem-aware & fuzzy)
    let matchedTokenCount = 0;
    for (const qToken of queryTokens) {
      const qStem = toSpanishStem(qToken);
      if (prodTokens.includes(qToken)) {
        score += 35;
        matchedTokenCount++;
      } else if (combinedSearchText.includes(qToken)) {
        score += 25;
        matchedTokenCount++;
      } else if (prodStems.includes(qStem)) {
        score += 25;
        matchedTokenCount++;
      } else {
        // Stem match (first 4 letters) or fuzzy similarity
        const stem = qToken.length >= 4 ? qToken.substring(0, 4) : qToken;
        const stemMatch = prodTokens.some(pt => pt.startsWith(stem));
        if (stemMatch) {
          score += 20;
          matchedTokenCount++;
        } else {
          // Check Levenshtein fuzzy match
          const bestSim = Math.max(0, ...prodTokens.map(pt => levenshteinSimilarity(qToken, pt)));
          if (bestSim >= 0.72) {
            score += Math.round(25 * bestSim);
            matchedTokenCount++;
          }
        }
      }
    }

    if (queryTokens.length > 0 && matchedTokenCount === queryTokens.length) {
      score += 30; // bonus for matching all tokens!
    } else if (queryTokens.length > 0 && matchedTokenCount >= Math.ceil(queryTokens.length / 2)) {
      score += 15;
    }

    // 4. Variant / Size match
    const matchedVariant = findMatchingVariant(prod, sizeInfo, userText);
    if (matchedVariant) {
      score += 55;
    }

    // Direct product.talle match
    if (sizeInfo && prodTalleNorm) {
      const cleanTalle = prodTalleNorm.replace(/\s+/g, '');
      const cleanSize = sizeInfo.size.replace(/\s+/g, '').toLowerCase();
      if (cleanTalle === cleanSize || cleanTalle.includes(cleanSize) || cleanSize.includes(cleanTalle)) {
        score += 45;
      }
    } else if (prodTalleNorm) {
      const talleStem = toSpanishStem(prodTalleNorm);
      if (queryTokens.some(qt => toSpanishStem(qt) === talleStem)) {
        score += 35;
      }
    }

    // Minimum confidence threshold of 15 makes it very forgiving and non-literal
    if (score > highestScore && score >= 15) {
      highestScore = score;
      bestMatch = {
        product: prod,
        variant: matchedVariant,
        detectedSize: sizeInfo?.size,
        confidence: score
      };
    }
  }

  return bestMatch;
}

/**
 * Extracts quantity and price without confounding sizes like 11 in "11cm".
 * Explicitly recognizes "$" as monetary price, handles "$3500", and guarantees NO division by zero or Infinity.
 */
export function parseQuantityAndPrice(text: string, sizeInfo?: { rawMatch: string } | null): ParsedQtyPrice {
  let masked = text;
  if (sizeInfo) {
    masked = masked.replace(new RegExp(sizeInfo.rawMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }

  let explicitUnitPrice: number | undefined;
  let explicitQuantity: number | undefined;
  let explicitTotalAmount: number | undefined;
  let isUnitPriceExplicit = false;

  // 1. Explicit quantity patterns FIRST (e.g. "Venta 1", "Venta 2", "10 unid", "x 5")
  // Running this before unit price avoids matching the trailing "a" of "Venta" with a quantity number!
  const qtyPatterns = [
    /(?:vendi|vendí|venta|vender|sacar|saqué|saque|saca|descontar|desconté|desconte|remover|restar|compre|compré|compra|stock|entrada|salida|cant|cantidad)\s+(\d+)\b/i,
    /(\d+)\s*(?:unid|unidades|u\b|articulos?|art|pares?|paquetes?|cajas?)/i,
    /\bx\s*(\d+)\b/i,
    /\b(\d+)\s*x\b/i
  ];

  for (const pat of qtyPatterns) {
    const match = masked.match(pat);
    if (match) {
      const val = parseInt(match[1], 10);
      if (isFinite(val) && val > 0) {
        explicitQuantity = val;
        masked = masked.replace(match[0], ' ');
        break;
      }
    }
  }

  // 2. Explicit dollar sign patterns: "$3500", "$ 3500", "$3.500", "$3,500"
  // Whenever "$" is present, the following number is strictly interpreted as the PRICE/AMOUNT.
  const dollarMatch = masked.match(/\$\s*(\d+(?:[.,]\d+)?)/i);
  if (dollarMatch) {
    const rawVal = dollarMatch[1].replace(/\./g, '').replace(',', '.');
    const val = parseFloat(rawVal);
    if (isFinite(val) && val > 0) {
      const isPerUnit = /(?:c\/u|cu|cada|unidad)/i.test(masked);
      if (isPerUnit) {
        explicitUnitPrice = val;
        isUnitPriceExplicit = true;
      } else {
        explicitTotalAmount = val;
      }
      masked = masked.replace(dollarMatch[0], ' ');
    }
  }

  // 3. Explicit unit price patterns: "a 1500", "1500 c/u", "costo 1500", "precio 1500"
  // Note: uses word boundaries and only triggers if total amount was not already explicitly specified with "$"
  if (explicitUnitPrice === undefined) {
    const unitPatterns = [
      /(\d+(?:[.,]\d+)?)\s*(?:c\/u|cu|cada\s*un[ao]|por\s*unidad)/i,
      /(?:costo|precio|valen?)\s*[:$]?\s*(\d+(?:[.,]\d+)?)/i,
      /\ba\s+[:$]?\s*(\d+(?:[.,]\d+)?)/i
    ];

    for (const pat of unitPatterns) {
      const match = masked.match(pat);
      if (match) {
        const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
        if (isFinite(val) && val > 0) {
          if (explicitTotalAmount === undefined) {
            explicitUnitPrice = val;
            isUnitPriceExplicit = true;
          }
          masked = masked.replace(match[0], ' ');
          break;
        }
      }
    }
  }

  // 4. Extract remaining numbers
  const numberMatches = masked.match(/\d+([.,]\d+)?/g);
  const remainingNumbers = numberMatches 
    ? numberMatches
        .map(n => parseFloat(n.replace(/\./g, '').replace(',', '.')))
        .filter(n => isFinite(n) && n > 0)
    : [];

  let cantidad = explicitQuantity || 1;
  let totalAmount = explicitTotalAmount || 0;

  if (explicitUnitPrice !== undefined) {
    if (!explicitQuantity && remainingNumbers.length > 0) {
      const candidates = remainingNumbers.filter(n => n <= 100);
      cantidad = candidates.length > 0 ? Math.min(...candidates) : 1;
    }
    cantidad = Math.max(1, cantidad);
    totalAmount = Math.round(explicitUnitPrice * cantidad);
  } else if (explicitTotalAmount !== undefined) {
    if (!explicitQuantity && remainingNumbers.length > 0) {
      const candidates = remainingNumbers.filter(n => n <= 100);
      cantidad = candidates.length > 0 ? Math.min(...candidates) : 1;
    }
    cantidad = Math.max(1, cantidad);
  } else {
    // Neither "$" nor explicit unit price
    if (remainingNumbers.length === 1) {
      if (remainingNumbers[0] > 100) {
        totalAmount = remainingNumbers[0];
        cantidad = explicitQuantity || 1;
      } else {
        cantidad = explicitQuantity || remainingNumbers[0];
        totalAmount = 0;
      }
    } else if (remainingNumbers.length >= 2) {
      if (remainingNumbers[0] <= 100 && remainingNumbers[1] > 100) {
        cantidad = explicitQuantity || remainingNumbers[0];
        totalAmount = remainingNumbers[1];
      } else if (remainingNumbers[0] > 100 && remainingNumbers[1] <= 100) {
        totalAmount = remainingNumbers[0];
        cantidad = explicitQuantity || remainingNumbers[1];
      } else {
        totalAmount = Math.max(...remainingNumbers);
        cantidad = explicitQuantity || Math.min(...remainingNumbers);
      }
    }
  }

  // Absolute safety check: ensure non-zero, finite integers
  cantidad = Math.max(1, isFinite(cantidad) && cantidad > 0 ? Math.round(cantidad) : 1);
  totalAmount = isFinite(totalAmount) && totalAmount > 0 ? Math.round(totalAmount) : 0;

  let unitPrice = explicitUnitPrice;
  if (unitPrice === undefined && totalAmount > 0 && cantidad > 0) {
    unitPrice = Math.round(totalAmount / cantidad);
  }

  if (unitPrice !== undefined && (!isFinite(unitPrice) || isNaN(unitPrice))) {
    unitPrice = undefined;
  }

  return {
    cantidad,
    unitPrice,
    totalAmount,
    isUnitPriceExplicit
  };
}

class TelegramBotManager {
  private token: string = DEFAULT_TOKEN;
  private isPolling: boolean = false;
  private isStarting: boolean = false;
  private isFetching: boolean = false;
  private pollInterval: any = null;
  private heartbeatInterval: any = null;
  private lastUpdateId: number = 0;
  private processedCount: number = 0;
  private lastMessage: string = '';
  private botInfo: { id?: number; username?: string; first_name?: string } = {};
  private listeners: ((status: TelegramBotStatus) => void)[] = [];
  private processedUpdateIds: Set<number> = new Set();
  private processedMessageKeys: Set<string> = new Set();
  private sessionStartTime: number = Date.now();
  private tabId: string = Math.random().toString(36).substring(2, 9);
  private static LEADER_TAB_KEY = 'gestion_total_telegram_leader_tab';
  private static LEADER_HEARTBEAT_KEY = 'gestion_total_telegram_leader_heartbeat';
  private static PROCESSED_MESSAGES_KEY = 'gestion_total_telegram_processed_messages';

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.token = saved;
    }

    const savedLastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
    if (savedLastUpdate) {
      this.lastUpdateId = parseInt(savedLastUpdate, 10) || 0;
    }

    this.loadProcessedKeys();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LAST_UPDATE_KEY && e.newValue) {
          const val = parseInt(e.newValue, 10);
          if (!isNaN(val) && val > this.lastUpdateId) {
            this.lastUpdateId = val;
          }
        }
        if (e.key === PROCESSED_UPDATES_KEY || e.key === TelegramBotManager.PROCESSED_MESSAGES_KEY) {
          this.loadProcessedKeys();
        }
      });

      window.addEventListener('beforeunload', () => {
        if (localStorage.getItem(TelegramBotManager.LEADER_TAB_KEY) === this.tabId) {
          localStorage.removeItem(TelegramBotManager.LEADER_TAB_KEY);
          localStorage.removeItem(TelegramBotManager.LEADER_HEARTBEAT_KEY);
        }
      });
    }
  }

  /**
   * Cross-tab leader election: Ensures only ONE browser tab polls Telegram at any time
   */
  private isTabLeader(): boolean {
    if (typeof window === 'undefined') return true;
    const now = Date.now();
    const currentLeader = localStorage.getItem(TelegramBotManager.LEADER_TAB_KEY);
    const lastHeartbeat = parseInt(localStorage.getItem(TelegramBotManager.LEADER_HEARTBEAT_KEY) || '0', 10);

    // If no leader or last heartbeat is stale (>12s), take over leadership
    if (!currentLeader || currentLeader === this.tabId || (now - lastHeartbeat > 12000)) {
      localStorage.setItem(TelegramBotManager.LEADER_TAB_KEY, this.tabId);
      localStorage.setItem(TelegramBotManager.LEADER_HEARTBEAT_KEY, String(now));
      return true;
    }

    return false;
  }

  private loadProcessedKeys() {
    try {
      const rawUpdates = localStorage.getItem(PROCESSED_UPDATES_KEY);
      if (rawUpdates) {
        const parsed = JSON.parse(rawUpdates);
        if (Array.isArray(parsed)) {
          this.processedUpdateIds = new Set(parsed.slice(-500));
        }
      }
      const rawMsgs = localStorage.getItem(TelegramBotManager.PROCESSED_MESSAGES_KEY);
      if (rawMsgs) {
        const parsed = JSON.parse(rawMsgs);
        if (Array.isArray(parsed)) {
          this.processedMessageKeys = new Set(parsed.slice(-500));
        }
      }
    } catch (e) {
      if (!this.processedUpdateIds) this.processedUpdateIds = new Set();
      if (!this.processedMessageKeys) this.processedMessageKeys = new Set();
    }
  }

  private saveProcessedKeys() {
    try {
      const updateList = Array.from(this.processedUpdateIds).slice(-500);
      localStorage.setItem(PROCESSED_UPDATES_KEY, JSON.stringify(updateList));
      const msgList = Array.from(this.processedMessageKeys).slice(-500);
      localStorage.setItem(TelegramBotManager.PROCESSED_MESSAGES_KEY, JSON.stringify(msgList));
    } catch (e) {}
  }

  public getToken(): string {
    return this.token;
  }

  public setToken(newToken: string) {
    this.token = newToken.trim();
    localStorage.setItem(STORAGE_KEY, this.token);
    this.restart();
  }

  public subscribe(listener: (status: TelegramBotStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(l => l(status));
  }

  public getStatus(): TelegramBotStatus {
    return {
      isActive: this.isPolling,
      botUsername: this.botInfo.username || 'GestionTotalBot',
      botName: this.botInfo.first_name || 'Bot de Ventas',
      processedCount: this.processedCount,
      lastMessage: this.lastMessage,
      lastSync: new Date().toLocaleTimeString()
    };
  }

  public async start() {
    if (this.isPolling || this.isStarting) return;
    if (!this.token) return;

    this.isStarting = true;
    this.sessionStartTime = Date.now();

    try {
      // 1. Verify Bot Info
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        this.botInfo = data.result;

        // Register Telegram commands for autocomplete menu
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
      } else {
        console.warn('Telegram token invalid:', data);
        return;
      }

      // 2. Clear any conflicting Webhooks and drop old pending retry storms
      try {
        await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook?drop_pending_updates=false`);
      } catch (err) {
        // ignore network error
      }

      // 3. If lastUpdateId is 0 (first run on this browser), flush pending historical backlog
      if (this.lastUpdateId === 0) {
        try {
          const flushRes = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=-1&limit=1`);
          const flushData = await flushRes.json();
          if (flushData.ok && Array.isArray(flushData.result) && flushData.result.length > 0) {
            const latestId = flushData.result[0].update_id;
            this.lastUpdateId = latestId;
            localStorage.setItem(LAST_UPDATE_KEY, String(latestId));
            // Acknowledge this ID so Telegram drops past queue
            await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${latestId + 1}&limit=1`);
          }
        } catch (err) {
          console.warn('Initial Telegram backlog flush:', err);
        }
      }

      this.isPolling = true;
      this.notify();

      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Heartbeat every 2.5 seconds to maintain leadership without interruption
      this.heartbeatInterval = setInterval(() => {
        if (this.isPolling && localStorage.getItem(TelegramBotManager.LEADER_TAB_KEY) === this.tabId) {
          localStorage.setItem(TelegramBotManager.LEADER_HEARTBEAT_KEY, String(Date.now()));
        }
      }, 2500);

      // Start Polling loop every 3 seconds safely
      this.pollInterval = setInterval(() => {
        this.pollUpdates();
      }, 3000);

      // Run once immediately
      this.pollUpdates();
    } catch (e) {
      console.error('Error starting telegram bot:', e);
    } finally {
      this.isStarting = false;
    }
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.isPolling = false;
    this.isStarting = false;
    this.isFetching = false;
    this.notify();
  }

  public restart() {
    this.stop();
    this.start();
  }

  /**
   * Clears old queues and sets offset to latest update
   */
  public async flushQueue() {
    try {
      // 1. Delete any webhook and drop pending retries
      try {
        await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook?drop_pending_updates=true`);
      } catch (e) {}

      // 2. Query latest update offset and confirm immediately
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=-1&limit=1`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        const latestId = data.result[0].update_id;
        this.lastUpdateId = latestId;
        localStorage.setItem(LAST_UPDATE_KEY, String(latestId));
        await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${latestId + 1}&limit=1`);
      }
      this.processedUpdateIds.clear();
      this.processedMessageKeys.clear();
      this.saveProcessedKeys();
      this.notify();
    } catch (e) {
      console.error('Error flushing queue:', e);
    }
  }

  private async sendMessage(chatId: number, text: string) {
    if (!text) return;

    // Telegram message length limit is 4096. Use 3800 for safe chunking if long list
    const MAX_LENGTH = 3800;
    if (text.length > MAX_LENGTH) {
      const chunks: string[] = [];
      let currentChunk = '';

      const paragraphs = text.split('\n\n');
      for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length > MAX_LENGTH) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          if (para.length > MAX_LENGTH) {
            const lines = para.split('\n');
            for (const line of lines) {
              if ((currentChunk + '\n' + line).length > MAX_LENGTH) {
                if (currentChunk.trim()) chunks.push(currentChunk.trim());
                currentChunk = line;
              } else {
                currentChunk = currentChunk ? currentChunk + '\n' + line : line;
              }
            }
          } else {
            currentChunk = para;
          }
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      for (const chunk of chunks) {
        await this.sendSingleMessage(chatId, chunk);
        await new Promise(r => setTimeout(r, 120));
      }
      return;
    }

    await this.sendSingleMessage(chatId, text);
  }

  private async sendSingleMessage(chatId: number, text: string) {
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
      console.error('Failed to send Telegram message:', e);
    }
  }

  private async pollUpdates() {
    // 1. Only the leader tab polls Telegram! Other open tabs standby.
    if (!this.isTabLeader()) return;

    // 2. Single-flight lock: prevent parallel polling executions in this tab
    if (!this.isPolling || !this.token || this.isFetching) return;
    this.isFetching = true;

    // Always keep in sync with localStorage across all tabs
    const savedLastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
    if (savedLastUpdate) {
      const parsed = parseInt(savedLastUpdate, 10);
      if (!isNaN(parsed) && parsed > this.lastUpdateId) {
        this.lastUpdateId = parsed;
      }
    }
    this.loadProcessedKeys();

    try {
      const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&limit=10&timeout=2`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        // Immediately record highest update_id to advance Telegram offset and prevent duplicate re-deliveries
        const maxUpdateId = Math.max(...data.result.map((u: any) => u.update_id));
        if (maxUpdateId >= this.lastUpdateId) {
          this.lastUpdateId = maxUpdateId;
          localStorage.setItem(LAST_UPDATE_KEY, String(this.lastUpdateId));
        }

        // Send IMMEDIATE acknowledgment to Telegram so it confirms receipt and cancels retry timeouts
        fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${maxUpdateId + 1}&limit=1`).catch(() => {});

        for (const update of data.result) {
          const updateId = update.update_id;

          // Deduplication check #1: update_id already processed
          if (this.processedUpdateIds.has(updateId)) {
            continue;
          }
          this.processedUpdateIds.add(updateId);
          this.saveProcessedKeys();

          if (update.message && update.message.text) {
            // Deduplication check #2: message_id in chat
            const msgId = update.message.message_id;
            const chatId = update.message.chat?.id;
            const msgKey = `${chatId}_${msgId}`;

            if (this.processedMessageKeys.has(msgKey)) {
              continue;
            }
            this.processedMessageKeys.add(msgKey);
            this.saveProcessedKeys();

            // Deduplication check #3: Atomic cross-tab lock in localStorage
            const lockKey = `tg_proc_lock_${chatId}_${msgId}`;
            const lastLocked = localStorage.getItem(lockKey);
            if (lastLocked && (Date.now() - parseInt(lastLocked, 10) < 60000)) {
              continue;
            }
            localStorage.setItem(lockKey, String(Date.now()));

            // Deduplication check #4: Ignore messages sent more than 3 minutes ago
            const msgTimeSec = update.message.date || 0;
            const nowSec = Math.floor(Date.now() / 1000);
            if (msgTimeSec > 0 && (nowSec - msgTimeSec > 180)) {
              console.log('Skipping old message date:', update.message.text);
              continue;
            }

            // Process message safely
            await this.handleIncomingMessage(update.message, updateId);
          }
        }
      }
    } catch (err) {
      // Network hiccup or temporary timeout; safely ignore and resume next interval
    } finally {
      this.isFetching = false;
    }
  }

  private async handleIncomingMessage(msg: { message_id?: number; chat: { id: number }; text: string; from?: { first_name?: string } }, updateId?: number) {
    const chatId = msg.chat.id;
    const msgId = msg.message_id;
    const rawText = (msg.text || '').trim();
    const lower = rawText.toLowerCase();
    const sender = msg.from?.first_name || 'Compañero';

    this.lastMessage = rawText;
    this.notify();

    // 1. Templates: /plantilla, plantilla, /formato, formato
    if (rawText === '/plantilla' || lower === 'plantilla' || lower === 'plantillas' || rawText === '/formato' || lower === 'formato' || lower === 'plantilla venta') {
      await this.handlePlantillas(chatId);
      return;
    }

    // 2. Help, Start, or Commands Menu
    if (
      rawText === '/help' || rawText === '/ayuda' || rawText === '/comandos' || rawText === '/start' ||
      rawText === '/menu' || lower === 'help' || lower === 'ayuda' || lower === 'comandos' ||
      lower === 'comandos del bot' || lower === 'que comandos tenes' || lower === 'que comandos hay' ||
      lower === 'menu' || lower === 'opciones'
    ) {
      await this.handleHelpCommand(chatId, sender);
      return;
    }

    // 3. Medias Stock & Quantity Query (/medias, "que stock me queda de las medias", etc.)
    if (
      rawText === '/medias' || rawText === '/stock_medias' || lower === 'medias' ||
      lower === 'stock medias' || lower === 'stock de medias' || lower === 'stock media' ||
      lower === 'cuantas medias quedan' || lower === 'cuantas medias hay' ||
      lower.includes('stock de las medias') || lower.includes('stock de medias') ||
      lower.includes('quedan de las medias') || lower.includes('quedan medias') ||
      lower.includes('hay medias') || lower.includes('stock y cantidad') ||
      (lower.includes('media') && (lower.includes('quedan') || lower.includes('stock') || lower.includes('cuantas') || lower.includes('cantidad')))
    ) {
      // If user specifically asked about the price of medias:
      if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('cuestan') || lower.includes('salen') || lower.includes('a cuanto')) {
        await this.handlePricesQuery(chatId, 'medias');
      } else {
        await this.handleMediasStockQuery(chatId);
      }
      return;
    }

    // 4. Low stock & out-of-stock alerts (/bajo_stock, /alertas, /agotados)
    if (
      rawText === '/bajo_stock' || rawText === '/alertas' || rawText === '/agotados' || rawText === '/stock_bajo' ||
      rawText === '/bajostock' || lower === 'bajo stock' || lower === 'stock bajo' || lower === 'alertas' ||
      lower === 'agotados' || lower.includes('poco stock') || lower.includes('que falta') ||
      lower.includes('por agotar') || lower.includes('se esta terminando') || lower.includes('se estan terminando')
    ) {
      await this.handleLowStockQuery(chatId);
      return;
    }

    // 5. Today summary (/hoy, /resumen_hoy, "cuanto vendi hoy")
    if (
      rawText === '/hoy' || rawText === '/resumen_hoy' || rawText === '/dia' || rawText === '/ventas_hoy' ||
      rawText === '/resumen' || lower === 'hoy' || lower === 'resumen hoy' || lower === 'resumen de hoy' ||
      lower.includes('cuanto vendi hoy') || lower.includes('ventas de hoy') || lower.includes('ventas hoy') ||
      lower.includes('como va el dia') || lower.includes('balance de hoy')
    ) {
      await this.handleTodaySummaryQuery(chatId);
      return;
    }

    // 6. Prices query (/precios, /precios medias, /precios [producto])
    if (
      rawText.startsWith('/precios') || rawText.startsWith('/precio') ||
      lower === 'precios' || lower === 'lista de precios' || lower === 'precio' ||
      lower.startsWith('precios ') || lower.startsWith('precio ') ||
      lower.includes('lista de precio') || lower.includes('que me diga los precios') ||
      lower.includes('dime los precios') || lower.includes('decime los precios')
    ) {
      let queryArg = '';
      if (rawText.startsWith('/precios ') || rawText.startsWith('/precio ')) {
        queryArg = rawText.split(/\s+(.+)/)[1] || '';
      } else if (lower.startsWith('precios ') || lower.startsWith('precio ')) {
        queryArg = lower.split(/\s+(.+)/)[1] || '';
      }
      await this.handlePricesQuery(chatId, queryArg);
      return;
    }

    // 7. Product Search & Info (/buscar [algo], /info [algo])
    if (
      rawText.startsWith('/buscar') || rawText.startsWith('/info') || lower.startsWith('buscar ') || lower.startsWith('info ')
    ) {
      const queryArg = rawText.replace(/^\/(?:buscar|info)\s*/i, '').replace(/^(?:buscar|info)\s*/i, '').trim();
      await this.handleSearchProductQuery(chatId, queryArg);
      return;
    }

    // 8. General Stock or Specific Product Stock (/stock, /stock [producto], inventario)
    if (
      rawText.startsWith('/stock') || lower === 'stock' || lower === 'productos' ||
      lower === 'inventario' || lower === 'ver stock' || lower.startsWith('stock ') || lower.startsWith('ver ')
    ) {
      let queryArg = '';
      if (rawText.startsWith('/stock ') || lower.startsWith('stock ')) {
        queryArg = (rawText.startsWith('/stock ') ? rawText : lower).substring(6).trim();
      }
      // If user typed "stock" with purchase details like "Stock 10 medias a $1500", let purchase handler take it below
      const hasPurchaseIndicators = /\d+/.test(queryArg) && (queryArg.includes(' a $') || queryArg.includes(' a ') || queryArg.includes('$') || queryArg.includes('c/u'));
      
      if (!hasPurchaseIndicators) {
        if (queryArg) {
          if (queryArg.toLowerCase().includes('media')) {
            await this.handleMediasStockQuery(chatId);
          } else {
            await this.handleProductStockQuery(chatId, queryArg);
          }
        } else {
          await this.handleGeneralStockQuery(chatId);
        }
        return;
      }
    }

    // 9. Saldo / Balance / Caja
    if (
      lower === 'saldo' || lower === 'dinero' || lower === 'caja' ||
      rawText === '/saldo' || rawText === '/caja' || rawText === '/balance' || lower === 'balance'
    ) {
      await this.handleSaldoQuery(chatId);
      return;
    }

    // 10. Query recent sales
    if (lower === 'ventas' || rawText === '/ventas' || lower === 'ultimas ventas') {
      await this.handleVentasQuery(chatId);
      return;
    }

    // 11. Query recent expenses
    if (lower === 'gastos' || rawText === '/gastos' || lower === 'ultimos gastos') {
      await this.handleGastosQuery(chatId);
      return;
    }

    // 12. Interactive Action Guides (/vender, /comprar, /gasto, /ingreso)
    if (rawText === '/vender' || lower === 'como vender' || lower === 'como anoto una venta') {
      await this.handleVenderGuide(chatId);
      return;
    }
    if (rawText === '/comprar' || lower === 'como comprar' || lower === 'como cargo stock') {
      await this.handleComprarGuide(chatId);
      return;
    }
    if (rawText === '/gasto' || lower === 'como anotar gasto' || lower === 'como anoto un gasto') {
      await this.handleGastoGuide(chatId);
      return;
    }
    if (rawText === '/ingreso' || lower === 'como anotar ingreso' || lower === 'como anoto ingreso') {
      await this.handleIngresoGuide(chatId);
      return;
    }

    // 7. Stock removal or sale action
    const isStockRemoval = lower.startsWith('sacar') || 
                           lower.startsWith('saque') || 
                           lower.startsWith('saqué') || 
                           lower.startsWith('saca') || 
                           lower.startsWith('descontar') || 
                           lower.startsWith('desconte') || 
                           lower.startsWith('desconté') || 
                           lower.startsWith('descuenta') || 
                           lower.startsWith('remover') || 
                           lower.startsWith('restar') || 
                           lower.startsWith('resté') || 
                           lower.startsWith('reste') || 
                           lower.startsWith('bajar') || 
                           lower.startsWith('baja') || 
                           lower.includes('sacar stock') || 
                           lower.includes('baja stock') ||
                           lower.includes('remover stock') ||
                           lower.includes('descontar stock');

    // 8. Is it a purchase / stock addition?
    const isPurchaseOrStock = lower.startsWith('compra') || 
                             lower.startsWith('compré') || 
                             lower.startsWith('compre') || 
                             lower.startsWith('stock') || 
                             lower.startsWith('entrada') || 
                             lower.startsWith('agregar stock') || 
                             lower.startsWith('sumar stock') || 
                             lower.startsWith('cargar stock') ||
                             lower.includes('ingreso mercaderia') ||
                             lower.includes('ingreso mercadería') ||
                             lower.includes('ingreso stock') ||
                             lower.includes('entrada stock');

    if (isPurchaseOrStock && !isStockRemoval) {
      await this.handlePurchaseRecord(chatId, rawText);
      this.processedCount++;
      this.notify();
      return;
    }

    // 9. Is it an expense? (gasto, gaste, pague, etc.)
    const isExpense = lower.startsWith('gasto') || 
                      lower.startsWith('gasté') || 
                      lower.startsWith('pagué') || 
                      lower.startsWith('pague') || 
                      lower.includes('gasto:');

    // 10. Is it adding direct money / salary? (ingreso, cobro, etc.)
    const isIncome = lower.startsWith('ingreso') || 
                     lower.startsWith('cobré') || 
                     lower.startsWith('cobre') || 
                     lower.startsWith('sueldo') || 
                     lower.startsWith('plata') || 
                     lower.startsWith('fondo');

    if (isExpense || isIncome) {
      await this.handleFinanceRecord(chatId, rawText, isIncome ? 'ingreso' : 'egreso');
      this.processedCount++;
      this.notify();
      return;
    }

    // 11. Check if it's a sale, stock removal, or mentions numbers/sizes/products
    const hasSaleKeyword = lower.includes('venta') || 
                           lower.includes('vendi') || 
                           lower.includes('vendí') || 
                           lower.includes('vendo') || 
                           lower.includes('salida') ||
                           isStockRemoval;

    const hasNumbers = /\d+/.test(rawText);

    if (hasSaleKeyword || hasNumbers || lower.includes('cm') || lower.includes('talle')) {
      await this.handleSaleRecord(chatId, rawText, msgId, updateId);
      this.processedCount++;
      this.notify();
      return;
    }

    // Friendly greeting / fallback with quick commands
    await this.sendMessage(
      chatId,
      `👋 ¡Hola ${sender}! Podés usar cualquiera de estos comandos rápidos:\n\n` +
      `🧦 /medias — Stock y cantidad exacta de medias\n` +
      `💲 /precios — Lista de precios al público\n` +
      `📦 /stock — Ver inventario general (o \`/stock [producto]\`)\n` +
      `⚠️ /bajo_stock — Alertas de productos por agotarse\n` +
      `📅 /hoy — Resumen de ventas y dinero del día\n` +
      `💰 /saldo — Balance y caja del último mes\n` +
      `📋 /plantilla — Plantillas para ventas o compras\n` +
      `❓ /help — Ver todos los comandos y ejemplos completos\n\n` +
      `💡 _También podés decirme:_ "cuántas medias quedan", "precios", o "Venta 1 media negra $3500".`
    );
  }

  // --- BOT COMMAND HANDLERS ---

  private async handleHelpCommand(chatId: number, sender: string) {
    const helpMsg =
`🤖 *CENTRO DE COMANDOS — ASISTENTE TOTAL*
_Hola ${sender}! Podés tocar cualquier comando en azul para usarlo:_

📦 *STOCK E INVENTARIO:*
• /stock — Resumen general de stock y unidades
• /medias — Stock completo y cantidad de medias 🧦
• /stock [producto] — Stock específico (ej: \`/stock vendas\`, \`/stock remeras\`)
• /bajo_stock — Alerta de productos agotados o críticos (<= 5 unid) ⚠️
• /buscar [texto] — Ficha técnica de un producto (ej: \`/buscar media antideslizante\`) 🔍

💲 *PRECIOS Y CATÁLOGO:*
• /precios — Lista completa de precios de venta
• /precios medias — Precios específicos de medias (o de cualquier producto)

💰 *FINANZAS Y CAJA:*
• /saldo o /caja — Balance neto, ventas y gastos del último mes
• /hoy — Resumen de ventas facturadas y gastos del día de hoy 📅
• /ventas — Ver las últimas 5 ventas registradas
• /gastos — Ver los últimos 5 gastos anotados

⚡ *PLANTILLAS Y REGISTRO RÁPIDO:*
• /plantilla — Plantillas listas para copiar y pegar en 1 toque
• /vender — Ejemplos para registrar una venta o salida de stock
• /comprar — Ejemplos para registrar compra o reposición de stock
• /gasto — Ejemplos para anotar un gasto o pago
• /ingreso — Ejemplos para anotar un cobro o sueldo

💬 *LENGUAJE NATURAL:*
_¡También podés hablarme normalmente sin barra!_
• "¿Cuántas medias me quedan?"
• "¿A cuánto están las medias?"
• "¿Cuánto vendí hoy?"
• "¿Qué productos tienen poco stock?"
• "Vendí 2 remeras talle L a $24000"`;

    await this.sendMessage(chatId, helpMsg);
  }

  private async handleMediasStockQuery(chatId: number) {
    try {
      const products = await inventoryService.getProducts();

      const mediaProducts = products.filter(p => {
        const baseName = normalizeSearchText(getProductBaseName(p));
        const desc = normalizeSearchText(p.descripcion || '');
        const cod = normalizeSearchText(p.codigo || '');
        const cat = normalizeSearchText((p as any).categoria || '');
        return baseName.includes('media') || baseName.includes('soquete') || desc.includes('media') || desc.includes('soquete') || cod.includes('med') || cat.includes('media');
      });

      if (mediaProducts.length === 0) {
        await this.sendMessage(
          chatId,
          `🧦 *STOCK DE MEDIAS*\n\n` +
          `No se encontraron modelos de medias registrados en tu inventario.\n\n` +
          `💡 *Para agregar stock de medias podés enviar:*\n` +
          `\`Stock 10 medias antideslizantes a $1500\`\n` +
          `O crearlas desde la sección Inventario en la app web.`
        );
        return;
      }

      const totalMediasUnits = mediaProducts.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0);
      const groupedMedias = groupInventoryProducts(mediaProducts);

      let msg = `🧦 *STOCK COMPLETO DE MEDIAS*\n`;
      msg += `📦 Modelos encontrados: *${groupedMedias.length}* | Total disponible: *${totalMediasUnits} pares/unid.*\n\n`;

      groupedMedias.forEach((g, index) => {
        const isDepleted = g.totalCantidad <= 0;
        const isLow = g.totalCantidad > 0 && g.totalCantidad <= 3;
        const statusEmoji = isDepleted ? '🚨' : isLow ? '⚠️' : '🧦';
        const statusTag = isDepleted ? ' _(AGOTADO)_' : isLow ? ' _(STOCK BAJO)_' : '';
        const priceStr = g.precioMin === g.precioMax
          ? `$${g.precioMin.toLocaleString('es-AR')}`
          : `$${g.precioMin.toLocaleString('es-AR')} - $${g.precioMax.toLocaleString('es-AR')}`;

        msg += `${statusEmoji} *${index + 1}. ${safeMarkdown(g.name)}*\n`;
        if (g.codigo) msg += `   • Código: \`${safeMarkdown(g.codigo)}\`\n`;
        msg += `   • Precio: *${priceStr}*\n`;
        msg += `   • Stock total: *${g.totalCantidad} unidades*${statusTag}\n`;

        if (g.talles.length > 0) {
          msg += `   • *Talles / Modelos:*\n`;
          g.talles.forEach(t => {
            const vIcon = t.cantidad <= 0 ? '❌' : t.cantidad <= 2 ? '⚠️' : '▫️';
            msg += `     ${vIcon} ${safeMarkdown(t.nombre)}: *${t.cantidad} unid.*${t.precio && t.precio !== g.precioMin ? ` ($${t.precio.toLocaleString('es-AR')})` : ''}\n`;
          });
        }
        if (g.ubicacion) {
          msg += `   • Ubicación: ${safeMarkdown(g.ubicacion)}\n`;
        }
        msg += `\n`;
      });

      msg += `━━━━━━━━━━━━━━━\n`;
      msg += `📊 *TOTAL DISPONIBLE:* *${totalMediasUnits} pares/unidades* de medias en inventario.\n\n`;
      msg += `💡 _Para registrar una venta de medias:_\n\`Venta 1 media negra $3500\``;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleMediasStockQuery:', e);
      await this.sendMessage(chatId, '❌ Ocurrió un error al consultar el stock de medias.');
    }
  }

  private async handleGeneralStockQuery(chatId: number) {
    try {
      const products = await inventoryService.getProducts();
      if (products.length === 0) {
        await this.sendMessage(chatId, `📋 *Tu inventario no tiene productos cargados aún.*`);
        return;
      }

      const totalStock = products.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
      const grouped = groupInventoryProducts(products);

      // Prioritize showing items: depleted first, then low stock, then alphabetical
      const sorted = [...grouped].sort((a, b) => {
        const aScore = a.totalCantidad <= 0 ? 0 : a.totalCantidad <= a.minStock ? 1 : 2;
        const bScore = b.totalCantidad <= 0 ? 0 : b.totalCantidad <= b.minStock ? 1 : 2;
        if (aScore !== bScore) return aScore - bScore;
        return a.baseName.localeCompare(b.baseName);
      });

      const fullList = sorted.map((g, idx) => {
        const isDepleted = g.totalCantidad <= 0;
        const isLow = g.totalCantidad > 0 && g.totalCantidad <= g.minStock;
        const alertEmoji = isDepleted ? '🚨 ' : isLow ? '⚠️ ' : '🔹 ';

        const priceStr = g.precioMin === g.precioMax
          ? `$${g.precioMin.toLocaleString('es-AR')}`
          : `$${g.precioMin.toLocaleString('es-AR')} - $${g.precioMax.toLocaleString('es-AR')}`;

        const safeName = safeMarkdown(g.name);
        let itemStr = `${alertEmoji}*${idx + 1}. ${safeName}* [Total: *${g.totalCantidad} unid.*] — ${priceStr}`;

        if (g.talles.length > 0) {
          const tallesStr = g.talles.map(t => `${safeMarkdown(t.nombre)}: ${t.cantidad}`).join(' | ');
          itemStr += `\n   ↳ _Talles:_ ${tallesStr}`;
        }
        return itemStr;
      }).join('\n\n');

      let msg = `📋 *INVENTARIO GENERAL COMPLETO*\n`;
      msg += `📦 *${grouped.length}* artículos registrados | *${totalStock}* unidades en total:\n\n`;
      msg += `${fullList}\n`;

      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `💡 *Consultas específicas:*\n`;
      msg += `• \`/stock [producto]\` — Ver stock de un artículo puntual (ej: \`/stock remera\`)\n`;
      msg += `• /medias — Ver stock y cantidad de medias\n`;
      msg += `• /bajo_stock — Ver alertas de reposición crítica`;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleGeneralStockQuery:', e);
      await this.sendMessage(chatId, `❌ Error al consultar el stock general.`);
    }
  }

  private async handleProductStockQuery(chatId: number, queryTerm: string) {
    try {
      const term = queryTerm.trim();
      if (!term) {
        await this.handleGeneralStockQuery(chatId);
        return;
      }

      const normQuery = normalizeSearchText(term);
      if (normQuery === 'media' || normQuery === 'medias' || normQuery.includes('media')) {
        await this.handleMediasStockQuery(chatId);
        return;
      }

      const products = await inventoryService.getProducts();
      if (products.length === 0) {
        await this.sendMessage(chatId, '📋 No hay productos cargados en el inventario.');
        return;
      }

      const queryTokens = normQuery.split(' ').filter(w => w.length >= 2);
      let matched = products.filter(p => {
        const descNorm = normalizeSearchText(p.descripcion || '');
        const codeNorm = normalizeSearchText(p.codigo || '');
        const baseNorm = normalizeSearchText(getProductBaseName(p));
        const talleNorm = normalizeSearchText(p.talle || '');
        if (descNorm.includes(normQuery) || codeNorm.includes(normQuery) || baseNorm.includes(normQuery)) return true;
        return queryTokens.length > 0 && queryTokens.every(t => descNorm.includes(t) || codeNorm.includes(t) || baseNorm.includes(t) || talleNorm.includes(t));
      });

      if (matched.length === 0) {
        const fuzzy = findBestProductMatch(term, products);
        if (fuzzy && fuzzy.confidence > 45) {
          matched = [fuzzy.product];
        }
      }

      if (matched.length === 0) {
        await this.sendMessage(
          chatId,
          `🔍 No encontré ningún producto que coincida con "*${safeMarkdown(term)}*".\n\n💡 Probá con /stock para ver la lista completa o /medias para ver medias.`
        );
        return;
      }

      const groupedMatched = groupInventoryProducts(matched);
      const totalUnits = groupedMatched.reduce((acc, g) => acc + g.totalCantidad, 0);

      let msg = `📦 *STOCK COMPLETO DE "${safeMarkdown(term).toUpperCase()}":*\n\n`;

      groupedMatched.forEach((g, idx) => {
        const isDepleted = g.totalCantidad <= 0;
        const isLow = g.totalCantidad > 0 && g.totalCantidad <= g.minStock;
        const statusEmoji = isDepleted ? '🚨' : isLow ? '⚠️' : '🔹';
        const priceStr = g.precioMin === g.precioMax
          ? `$${g.precioMin.toLocaleString('es-AR')}`
          : `$${g.precioMin.toLocaleString('es-AR')} - $${g.precioMax.toLocaleString('es-AR')}`;

        msg += `${statusEmoji} *${idx + 1}. ${safeMarkdown(g.name)}*\n`;
        if (g.codigo) msg += `   • Código: \`${safeMarkdown(g.codigo)}\`\n`;
        msg += `   • Precio: *${priceStr}*\n`;
        msg += `   • Stock total: *${g.totalCantidad} unid.*${isDepleted ? ' _(AGOTADO)_' : isLow ? ' _(POCO STOCK)_' : ''}\n`;

        if (g.talles.length > 0) {
          msg += `   • *Talles / Variantes:*\n`;
          g.talles.forEach(t => {
            const vIcon = t.cantidad <= 0 ? '❌' : t.cantidad <= 2 ? '⚠️' : '▫️';
            msg += `     ${vIcon} ${safeMarkdown(t.nombre)}: *${t.cantidad} unid.*${t.precio && t.precio !== g.precioMin ? ` ($${t.precio.toLocaleString('es-AR')})` : ''}\n`;
          });
        }
        if (g.ubicacion) {
          msg += `   • Ubicación: ${safeMarkdown(g.ubicacion)}\n`;
        }
        msg += `\n`;
      });

      msg += `━━━━━━━━━━━━━━━\n`;
      msg += `📊 *Total disponible:* *${totalUnits} unidades* en ${groupedMatched.length} artículo(s).\n\n`;
      msg += `💡 _Para registrar una venta:_\n\`Venta 1 ${safeMarkdown(groupedMatched[0].baseName).toLowerCase()} $${groupedMatched[0].precioMin}\``;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleProductStockQuery:', e);
      await this.sendMessage(chatId, '❌ Error al buscar stock del producto.');
    }
  }

  private async handlePricesQuery(chatId: number, filterTerm?: string) {
    try {
      const products = await inventoryService.getProducts();
      if (products.length === 0) {
        await this.sendMessage(chatId, `📋 *No tenés productos cargados para consultar precios.*`);
        return;
      }

      const grouped = groupInventoryProducts(products);

      if (filterTerm && filterTerm.trim()) {
        const term = filterTerm.trim();
        const normTerm = normalizeSearchText(term);
        const isMedias = normTerm.includes('media') || normTerm.includes('soquete');

        const filtered = grouped.filter(g => {
          const nameNorm = normalizeSearchText(g.name);
          const baseNorm = normalizeSearchText(g.baseName);
          const codNorm = normalizeSearchText(g.codigo || '');
          if (isMedias) {
            return nameNorm.includes('media') || nameNorm.includes('soquete') || codNorm.includes('med');
          }
          return nameNorm.includes(normTerm) || baseNorm.includes(normTerm) || codNorm.includes(normTerm);
        });

        if (filtered.length === 0) {
          await this.sendMessage(
            chatId,
            `🔍 No encontré precios para "*${safeMarkdown(term)}*".\nEscribí /precios para ver la lista completa.`
          );
          return;
        }

        let msg = `💲 *PRECIOS DE "${safeMarkdown(term).toUpperCase()}":*\n\n`;
        filtered.forEach((g, idx) => {
          const priceStr = g.precioMin === g.precioMax
            ? `$${g.precioMin.toLocaleString('es-AR')}`
            : `$${g.precioMin.toLocaleString('es-AR')} - $${g.precioMax.toLocaleString('es-AR')}`;

          msg += `${idx + 1}. *${safeMarkdown(g.name)}*\n`;
          if (g.codigo) msg += `   • Código: \`${safeMarkdown(g.codigo)}\`\n`;
          msg += `   • 💵 Precio Venta: *${priceStr}*\n`;
          if (g.costoMax > 0) {
            const margin = Math.round(((g.precioMin - g.costoMax) / g.costoMax) * 100);
            msg += `   • 🏷️ Costo: $${g.costoMax.toLocaleString('es-AR')}${margin > 0 ? ` (+${margin}% ganancia)` : ''}\n`;
          }
          msg += `   • 📦 Stock disponible: *${g.totalCantidad} unid.*\n`;
          if (g.talles.length > 0) {
            const tallesInfo = g.talles.map(t => {
              const tPrice = t.precio && t.precio !== g.precioMin ? ` ($${t.precio.toLocaleString('es-AR')})` : '';
              return `${safeMarkdown(t.nombre)}${tPrice}: ${t.cantidad} unid.`;
            }).join(', ');
            msg += `   • 📏 Talles: ${tallesInfo}\n`;
          }
          msg += `\n`;
        });

        msg += `💡 _Para vender: \`Venta 1 ${safeMarkdown(filtered[0].baseName).toLowerCase()} $${filtered[0].precioMin}\`_`;
        await this.sendMessage(chatId, msg);
        return;
      }

      // General price list - sorted alphabetically by name
      const sorted = [...grouped].sort((a, b) => a.baseName.localeCompare(b.baseName));
      const fullList = sorted.map(g => {
        const safeName = safeMarkdown(g.name);
        const priceStr = g.precioMin === g.precioMax
          ? `$${g.precioMin.toLocaleString('es-AR')}`
          : `$${g.precioMin.toLocaleString('es-AR')} - $${g.precioMax.toLocaleString('es-AR')}`;

        let sizesPart = '';
        if (g.talles.length > 0) {
          sizesPart = ` _(Talles: ${g.talles.map(t => safeMarkdown(t.nombre)).join(', ')})_`;
        }
        return `• *${safeName}*: *${priceStr}*${sizesPart}`;
      }).join('\n');

      let msg = `💲 *LISTA DE PRECIOS COMPLETA AL PÚBLICO*\n\n${fullList}\n`;
      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `💡 *Consultas específicas:*\n`;
      msg += `• \`/precios [producto]\` — Buscar precio puntual (ej: \`/precios buzo\`)\n`;
      msg += `• \`/precios medias\` — Ver precios de medias`;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handlePricesQuery:', e);
      await this.sendMessage(chatId, `❌ Error al consultar la lista de precios.`);
    }
  }

  private async handleLowStockQuery(chatId: number) {
    try {
      const products = await inventoryService.getProducts();
      if (products.length === 0) {
        await this.sendMessage(chatId, '📋 No hay productos cargados en el inventario.');
        return;
      }

      const grouped = groupInventoryProducts(products);

      const outOfStock: GroupedProductInfo[] = [];
      const lowStock: { group: GroupedProductInfo; variantInfo?: string }[] = [];

      grouped.forEach(g => {
        const minThreshold = g.minStock > 0 ? g.minStock : 5;
        if (g.totalCantidad <= 0) {
          outOfStock.push(g);
        } else if (g.totalCantidad <= minThreshold) {
          lowStock.push({ group: g });
        } else if (g.talles.length > 0) {
          const depletedTalles = g.talles.filter(t => t.cantidad <= 2);
          if (depletedTalles.length > 0) {
            lowStock.push({
              group: g,
              variantInfo: depletedTalles.map(t => `${safeMarkdown(t.nombre)} (${t.cantidad} unid)`).join(', ')
            });
          }
        }
      });

      if (outOfStock.length === 0 && lowStock.length === 0) {
        await this.sendMessage(
          chatId,
          `✅ *¡TODO EN ORDEN!*\n\nNo tenés productos con stock crítico ni agotados en este momento.\nTodos tus artículos superan el nivel mínimo de stock.`
        );
        return;
      }

      let msg = `⚠️ *ALERTAS DE STOCK Y REPOSICIÓN*\n\n`;

      if (outOfStock.length > 0) {
        msg += `🚨 *AGOTADOS (${outOfStock.length} artículos - 0 UNIDADES):*\n`;
        outOfStock.forEach(g => {
          msg += `• *${safeMarkdown(g.name)}*${g.codigo ? ` \`[${safeMarkdown(g.codigo)}]\`` : ''}\n`;
        });
        msg += `\n`;
      }

      if (lowStock.length > 0) {
        msg += `⚠️ *STOCK BAJO (${lowStock.length} artículos):*\n`;
        lowStock.forEach(({ group, variantInfo }) => {
          if (variantInfo) {
            msg += `• *${safeMarkdown(group.name)}*: Talles críticos: ${variantInfo}\n`;
          } else {
            const tallesInfo = group.talles.length > 0 ? ` [${group.talles.map(t => `${safeMarkdown(t.nombre)}: ${t.cantidad}`).join(', ')}]` : '';
            msg += `• *${safeMarkdown(group.name)}*: Quedan solo *${group.totalCantidad} unid.*${tallesInfo}\n`;
          }
        });
        msg += `\n`;
      }

      msg += `━━━━━━━━━━━━━━━\n`;
      msg += `💡 *Para cargar reposición escribí:*\n\`Stock 10 [producto] a $[costo]\``;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleLowStockQuery:', e);
      await this.sendMessage(chatId, '❌ Error al consultar las alertas de stock.');
    }
  }

  private async handleTodaySummaryQuery(chatId: number) {
    try {
      const sales = await inventoryService.getSales(7);
      const finances = await inventoryService.getFinances();

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayDisplay = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      const isToday = (dateVal: any) => {
        if (!dateVal) return false;
        const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
        if (isNaN(d.getTime())) return false;
        const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return str === todayStr;
      };

      const todaySales = sales.filter(s => isToday(s.fecha));
      const todayFinances = finances.filter(f => isToday(f.fecha || (f as any).createdAt));

      const totalVentasHoy = todaySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const todayExpenses = todayFinances.filter(f => f.tipo === 'egreso');
      const todayIncomes = todayFinances.filter(f => f.tipo === 'ingreso');

      const totalGastosHoy = todayExpenses.reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const totalOtrosIngresosHoy = todayIncomes.reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const balanceHoy = (totalVentasHoy + totalOtrosIngresosHoy) - totalGastosHoy;

      let msg = `📅 *RESUMEN DEL DÍA DE HOY (${todayDisplay})*\n\n`;

      if (todaySales.length === 0) {
        msg += `🛒 *Ventas hoy:* Sin ventas registradas aún ($0)\n\n`;
      } else {
        msg += `🛒 *Ventas hoy (${todaySales.length}):* *$${totalVentasHoy.toLocaleString('es-AR')}*\n`;
        todaySales.forEach(s => {
          msg += `   • ${s.productNombre} (x${s.cantidad}): $${Number(s.total || 0).toLocaleString('es-AR')}\n`;
        });
        msg += `\n`;
      }

      if (todayExpenses.length > 0) {
        msg += `🔴 *Gastos hoy (${todayExpenses.length}):* -$${totalGastosHoy.toLocaleString('es-AR')}\n`;
        todayExpenses.forEach(e => {
          msg += `   • ${e.concepto}: $${Number(e.monto || 0).toLocaleString('es-AR')}\n`;
        });
        msg += `\n`;
      }

      if (todayIncomes.length > 0) {
        msg += `🟢 *Otros Ingresos hoy:* +$${totalOtrosIngresosHoy.toLocaleString('es-AR')}\n\n`;
      }

      msg += `━━━━━━━━━━━━━━━\n`;
      const balanceEmoji = balanceHoy >= 0 ? '🟢' : '🔴';
      const balanceSign = balanceHoy >= 0 ? '+' : '';
      msg += `💰 *Balance Neto de Hoy:* ${balanceEmoji} *${balanceSign}$${balanceHoy.toLocaleString('es-AR')}*\n\n`;
      msg += `💡 _Para ver el balance global del mes enviá: /saldo_`;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleTodaySummaryQuery:', e);
      await this.sendMessage(chatId, '❌ No se pudo calcular el resumen del día en este momento.');
    }
  }

  private async handleSearchProductQuery(chatId: number, query: string) {
    try {
      const term = query.trim();
      if (!term) {
        await this.sendMessage(chatId, '🔍 Por favor indicá qué producto buscar. Ejemplo:\n`/buscar media antideslizante` o `/buscar MED-01`');
        return;
      }

      const products = await inventoryService.getProducts();
      const match = findBestProductMatch(term, products);
      if (!match || match.confidence < 40) {
        await this.sendMessage(chatId, `🔍 No se encontró ningún producto similar a "*${term}*".`);
        return;
      }

      const p = match.product;
      const prodName = getProductDisplayName(p);
      const prodBase = getProductBaseName(p);
      let msg = `🔍 *FICHA DE PRODUCTO*\n\n`;
      msg += `🏷️ *Nombre:* *${safeMarkdown(prodName)}*\n`;
      if (p.codigo) msg += `🔢 *Código:* \`${safeMarkdown(p.codigo)}\`\n`;
      msg += `💰 *Precio de Venta:* *$${p.precio.toLocaleString('es-AR')}*\n`;
      if (p.costo) msg += `📦 *Costo de Compra:* $${p.costo.toLocaleString('es-AR')}\n`;
      msg += `📊 *Stock Disponible:* *${p.cantidad} unidades*\n`;
      if (p.talle) msg += `📏 *Talle:* ${safeMarkdown(p.talle)}\n`;
      if (p.estado) msg += `✨ *Estado:* ${p.estado}\n`;
      if (p.procedencia) msg += `🌍 *Procedencia:* ${p.procedencia}\n`;
      if (p.ubicacion) msg += `📍 *Ubicación:* ${safeMarkdown(p.ubicacion)}\n`;

      if (p.variants && p.variants.length > 0) {
        msg += `\n🧩 *Variantes y Talles (${p.variants.length}):*\n`;
        p.variants.forEach(v => {
          msg += `   ▫️ ${safeMarkdown(v.nombre)}: *${v.cantidad} unid.*${v.precio ? ` ($${v.precio})` : ''}\n`;
        });
      }

      msg += `\n━━━━━━━━━━━━━━━\n`;
      msg += `💡 *Acciones rápidas:*\n`;
      msg += `• Descontar venta: \`Venta 1 ${safeMarkdown(prodBase).toLowerCase()} $${p.precio}\`\n`;
      msg += `• Cargar stock: \`Stock 5 ${safeMarkdown(prodBase).toLowerCase()} a $${p.costo || p.precio}\``;

      await this.sendMessage(chatId, msg);
    } catch (e) {
      console.error('Error in handleSearchProductQuery:', e);
      await this.sendMessage(chatId, '❌ Error al buscar el producto.');
    }
  }

  private async handleSaldoQuery(chatId: number) {
    try {
      const sales = await inventoryService.getSales(30);
      const finances = await inventoryService.getFinances();
      const totalVentas = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalIngresos = finances.filter(f => f.tipo === 'ingreso').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const totalGastos = finances.filter(f => f.tipo === 'egreso').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
      const balanceNeto = (totalVentas + totalIngresos) - totalGastos;

      await this.sendMessage(
        chatId,
        `💵 *RESUMEN DE FINANZAS (ÚLTIMOS 30 DÍAS)*\n\n` +
        `• 🟢 *Ventas:* $${totalVentas.toLocaleString('es-AR')}\n` +
        `• 🟢 *Otros Ingresos:* $${totalIngresos.toLocaleString('es-AR')}\n` +
        `• 🔴 *Gastos:* $${totalGastos.toLocaleString('es-AR')}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 *Balance Neto estimado:* *$${balanceNeto.toLocaleString('es-AR')}*\n\n` +
        `💡 _Para ver el detalle de hoy enviá: /hoy_`
      );
    } catch (e) {
      console.error('Error in handleSaldoQuery:', e);
      await this.sendMessage(chatId, `❌ No pude consultar el saldo en este momento.`);
    }
  }

  private async handleVentasQuery(chatId: number) {
    try {
      const sales = await inventoryService.getSales(5);
      if (sales.length === 0) {
        await this.sendMessage(chatId, `📦 No hay ventas registradas recientemente.`);
      } else {
        const list = sales.map((s, i) => `${i + 1}. *${s.productNombre}* (x${s.cantidad}): *$${s.total.toLocaleString('es-AR')}*`).join('\n');
        await this.sendMessage(
          chatId,
          `🛍️ *ÚLTIMAS 5 VENTAS:*\n\n${list}\n\n` +
          `💡 _Para anotar una venta:_ \`Venta 1 [producto] $[monto]\``
        );
      }
    } catch (e) {
      console.error('Error in handleVentasQuery:', e);
      await this.sendMessage(chatId, `❌ Error al consultar ventas.`);
    }
  }

  private async handleGastosQuery(chatId: number) {
    try {
      const finances = await inventoryService.getFinances();
      const expenses = finances.filter(f => f.tipo === 'egreso').slice(0, 5);
      if (expenses.length === 0) {
        await this.sendMessage(chatId, `💸 No hay gastos registrados recientemente.`);
      } else {
        const list = expenses.map((e, i) => `${i + 1}. *${e.concepto}*: *$${e.monto.toLocaleString('es-AR')}* (${e.metodo})`).join('\n');
        await this.sendMessage(
          chatId,
          `🔴 *ÚLTIMOS 5 GASTOS:*\n\n${list}\n\n` +
          `💡 _Para anotar un gasto:_ \`Gasto $4500 nafta\``
        );
      }
    } catch (e) {
      console.error('Error in handleGastosQuery:', e);
      await this.sendMessage(chatId, `❌ Error al consultar gastos.`);
    }
  }

  private async handlePlantillas(chatId: number) {
    const templateMsg =
`📋 *PLANTILLAS PARA COPIAR Y AUTOCOMPLETAR*
_(Tocá el texto en gris para copiarlo en Telegram)_

🛒 *Venta (Descuenta stock y suma el dinero):*
\`Venta [CANTIDAD] [PRODUCTO] [TALLE_O_COLOR] $[TOTAL]\`

*Ejemplo listo para enviar:*
\`Venta 1 media antideslizante lisa negra $3500\`
\`Venta 2 remeras talle M $24000\`

━━━━━━━━━━━━━━━
📥 *Ingreso de Stock (Compra / Reposición):*
\`Stock [CANTIDAD] [PRODUCTO] [TALLE_O_COLOR] a $[COSTO]\`

*Ejemplo:*
\`Stock 10 medias antideslizantes negras a $1500\`

━━━━━━━━━━━━━━━
💸 *Anotar un Gasto:*
\`Gasto $[MONTO] [CONCEPTO]\`

*Ejemplo:*
\`Gasto $4500 nafta\`

━━━━━━━━━━━━━━━
💰 *Registrar otro Ingreso:*
\`Ingreso $[MONTO] [CONCEPTO]\`

*Ejemplo:*
\`Ingreso $15000 arreglo\``;

    await this.sendMessage(chatId, templateMsg);
  }

  private async handleVenderGuide(chatId: number) {
    const msg =
`🛒 *CÓMO REGISTRAR UNA VENTA O SALIDA DE STOCK*
_Descuenta unidades del inventario y asienta la venta y el dinero recaudado._

📋 *Estructura:*
\`Venta [CANTIDAD] [PRODUCTO] [TALLE_O_COLOR] $[PRECIO]\`

👉 *Ejemplos para copiar y usar:*
\`Venta 1 media antideslizante lisa negra $3500\`
\`Venta 2 vendas para tobillo 11cm $7000\`
\`Vendí 1 remera deportiva talle L $12000 efectivo\`
\`Sacar 1 venda de 11cm $3500\``;

    await this.sendMessage(chatId, msg);
  }

  private async handleComprarGuide(chatId: number) {
    const msg =
`📥 *CÓMO REGISTRAR COMPRA O INGRESO DE STOCK*
_Suma unidades al inventario y registra el gasto de la compra._

📋 *Estructura:*
\`Stock [CANTIDAD] [PRODUCTO] [TALLE_O_COLOR] a $[COSTO]\`

👉 *Ejemplos para copiar y usar:*
\`Stock 10 medias antideslizantes negras a $1500\`
\`Compré 5 remeras talle M a $4000 c/u\`
\`Entrada 20 vendas de 11cm a $1200\``;

    await this.sendMessage(chatId, msg);
  }

  private async handleGastoGuide(chatId: number) {
    const msg =
`💸 *CÓMO ANOTAR UN GASTO O SALIDA DE DINERO*
_Registra egresos de caja para controlar tus números exactos._

📋 *Estructura:*
\`Gasto $[MONTO] [CONCEPTO]\`

👉 *Ejemplos para copiar y usar:*
\`Gasto $4500 nafta\`
\`Pagué luz $14000\`
\`Gasto $8000 embalaje y bolsas\`
\`Pagué alquiler $85000 transferencia\``;

    await this.sendMessage(chatId, msg);
  }

  private async handleIngresoGuide(chatId: number) {
    const msg =
`💰 *CÓMO ANOTAR OTRO INGRESO O COBRO*
_Registra entradas de dinero ajenas a ventas de productos._

📋 *Estructura:*
\`Ingreso $[MONTO] [CONCEPTO]\`

👉 *Ejemplos para copiar y usar:*
\`Ingreso $45000 sueldo\`
\`Cobré $15000 changa o servicio\`
\`Ingreso $20000 cobro deuda pendiente\``;

    await this.sendMessage(chatId, msg);
  }

  // Handle direct Expense or Income
  private async handleFinanceRecord(chatId: number, text: string, tipo: 'ingreso' | 'egreso') {
    try {
      // Find amount: Prioritize explicit $ amount first!
      let amount = 0;
      const dollarMatch = text.match(/\$\s*(\d+(?:[.,]\d+)?)/);
      if (dollarMatch) {
        const parsed = parseFloat(dollarMatch[1].replace(/\./g, '').replace(',', '.'));
        if (isFinite(parsed) && parsed > 0) {
          amount = parsed;
        }
      }

      if (!amount || amount <= 0) {
        const numbers = text.match(/\d+([.,]\d+)?/g);
        if (numbers && numbers.length > 0) {
          const parsed = numbers
            .map(n => parseFloat(n.replace(/\./g, '').replace(',', '.')))
            .filter(n => isFinite(n) && n > 0);
          if (parsed.length > 0) {
            amount = Math.max(...parsed);
          }
        }
      }

      if (!amount || !isFinite(amount) || amount <= 0) {
        await this.sendMessage(chatId, `⚠️ No encontré el monto en tu mensaje.\nEjemplo: \`${tipo === 'ingreso' ? 'Cobré $25000 de changa' : 'Gasto $4500 en nafta'}\``);
        return;
      }

      // Clean concept
      let cleanConcept = text
        .replace(/gasto|gasté|compré|compre|pagué|pague|ingreso|cobré|cobre|sueldo|fondo|plata|\$|\d+([.,]\d+)?/gi, '')
        .replace(/\b(en|de|por|para|un|una|el|la|los|las|efectivo|transferencia|transfer)\b/gi, '')
        .trim();

      if (!cleanConcept) {
        cleanConcept = tipo === 'ingreso' ? 'Ingreso registrado por Telegram' : 'Gasto registrado por Telegram';
      }

      // Determine method
      let metodo: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro' = 'efectivo';
      const lower = text.toLowerCase();
      if (lower.includes('transfer') || lower.includes('mp') || lower.includes('mercado') || lower.includes('banco')) {
        metodo = 'transferencia';
      } else if (lower.includes('tarjeta') || lower.includes('credito') || lower.includes('debito')) {
        metodo = 'tarjeta';
      }

      // Save to Firebase finances
      await inventoryService.addFinanceTransaction({
        tipo,
        categoria: tipo === 'ingreso' ? 'sueldo_cobro' : 'otro',
        concepto: cleanConcept,
        monto: Math.round(amount),
        metodo,
        fecha: new Date().toISOString().split('T')[0],
        notas: `Anotado vía Telegram: "${text}"`
      });

      const icon = tipo === 'ingreso' ? '🟢' : '🔴';
      const label = tipo === 'ingreso' ? 'Ingreso de Dinero' : 'Gasto Anotado';
      await this.sendMessage(
        chatId,
        `✅ *${icon} ${label} Exitoso*\n\n` +
        `• *Detalle:* ${cleanConcept}\n` +
        `• *Monto:* $${Math.round(amount).toLocaleString('es-AR')}\n` +
        `• *Método:* ${metodo}\n\n` +
        `_Ya está reflejado en tu saldo de la aplicación web._`
      );
    } catch (err: any) {
      console.error('Error saving finance via telegram:', err);
      await this.sendMessage(chatId, `❌ Ocurrió un error al guardar: ${err.message || 'Intenta de nuevo'}`);
    }
  }

  // Handle Purchase / Adding Stock
  private async handlePurchaseRecord(chatId: number, text: string) {
    try {
      const products = await inventoryService.getProducts();
      const sizeInfo = extractSizeInfo(text);
      const matchResult = findBestProductMatch(text, products);
      const { cantidad, unitPrice, totalAmount } = parseQuantityAndPrice(text, sizeInfo);

      // If no product found in inventory
      if (!matchResult) {
        // If it's a generic expense (comida, nafta, etc.)
        const lower = text.toLowerCase();
        if (lower.includes('comida') || lower.includes('nafta') || lower.includes('combustible') || lower.includes('almuerzo') || lower.includes('factura') || lower.includes('luz')) {
          await this.handleFinanceRecord(chatId, text, 'egreso');
          return;
        }

        await this.sendMessage(
          chatId,
          `⚠️ *No encontré ese producto en tu inventario para sumarle stock.*\n\n` +
          `• Verificá el nombre o asegurate de haberlo creado primero en el catálogo de la app.\n` +
          `• *Ejemplos para ingresar stock:*\n` +
          `  \`Compré 10 vendas de 11cm a $1500 c/u\`\n` +
          `  \`Stock 5 remeras talle M a $3500\`\n` +
          `  \`Entrada 20 filtros a $2000\``
        );
        return;
      }

      const { product, variant, detectedSize } = matchResult;
      const prodName = getProductDisplayName(product);
      const prodBase = getProductBaseName(product);

      // Determine unit cost
      let costPerUnit = unitPrice;
      if (!costPerUnit || costPerUnit <= 0 || !isFinite(costPerUnit)) {
        if (totalAmount > 0 && cantidad > 0 && isFinite(totalAmount / cantidad)) {
          costPerUnit = Math.round(totalAmount / cantidad);
        } else {
          costPerUnit = variant?.costo || product.costo || 0;
        }
      }

      if (!costPerUnit || costPerUnit <= 0 || !isFinite(costPerUnit)) {
        await this.sendMessage(
          chatId,
          `⚠️ *Por favor indicá el precio de costo unitario para la compra de "${safeMarkdown(prodName)}".*\n\n` +
          `Ejemplo: \`Compré ${cantidad} ${safeMarkdown(prodBase)} ${variant ? variant.nombre : ''} a $1500 c/u\``
        );
        return;
      }

      const totalSpent = Math.round(costPerUnit * cantidad);

      // Register purchase in inventory
      await inventoryService.registerPurchase({
        productId: product.id,
        productNombre: prodName,
        variantId: variant?.id,
        variantNombre: variant?.nombre,
        cantidad: cantidad,
        costo: costPerUnit,
        proveedor: 'Compra vía Telegram'
      });

      const newTotalStock = product.cantidad + cantidad;
      const newVariantStock = variant ? (variant.cantidad || 0) + cantidad : undefined;

      const variantDetail = variant 
        ? `\n🏷️ *Talle / Variante:* ${variant.nombre}` 
        : (detectedSize ? `\n🏷️ *Talle:* ${detectedSize}` : '');

      const variantStockDetail = newVariantStock !== undefined 
        ? ` (Talle ${variant?.nombre}: ${newVariantStock} unid.)` 
        : '';

      await this.sendMessage(
        chatId,
        `📥 *¡Stock y Compra Registrados!* ✨\n\n` +
        `📦 *Producto:* ${safeMarkdown(prodName)}${variantDetail}\n` +
        `➕ *Cantidad ingresada:* +${cantidad} unid.\n` +
        `💲 *Costo por unidad:* $${costPerUnit.toLocaleString('es-AR')}\n` +
        `💰 *Total Invertido:* $${totalSpent.toLocaleString('es-AR')}\n` +
        `📈 *Stock actual:* ${newTotalStock} unid.${variantStockDetail}\n\n` +
        `_Se sumó a tus Compras y se reflejó automáticamente en 'Dinero & Gastos'._`
      );
    } catch (err: any) {
      console.error('Error saving purchase via telegram:', err);
      await this.sendMessage(chatId, `❌ Error al registrar compra: ${err.message || 'Intenta de nuevo'}`);
    }
  }

  // Handle Product Sale / Stock Removal
  private async handleSaleRecord(chatId: number, text: string, msgId?: number, updateId?: number) {
    try {
      const telegramTxId = `tg_${chatId}_${msgId || updateId || Date.now()}`;
      const saleDoneKey = `tg_sale_done_${telegramTxId}`;
      if (localStorage.getItem(saleDoneKey)) {
        console.warn('[TelegramBot] Duplicate sale prevented for:', telegramTxId);
        return;
      }

      const products = await inventoryService.getProducts();
      const sizeInfo = extractSizeInfo(text);
      const matchResult = findBestProductMatch(text, products);
      const { cantidad, unitPrice: parsedUnitPrice, totalAmount: parsedTotal } = parseQuantityAndPrice(text, sizeInfo);

      if (matchResult) {
        const { product, variant, detectedSize } = matchResult;
        const prodName = getProductDisplayName(product);
        const prodBase = getProductBaseName(product);

        // If product has variants, but user did NOT specify which variant/size
        if (product.hasVariants && product.variants && product.variants.length > 0 && !variant) {
          const variantsList = product.variants
            .map(v => `• *${v.nombre}* (Stock: ${v.cantidad})`)
            .join('\n');

          await this.sendMessage(
            chatId,
            `⚠️ *El producto "${safeMarkdown(prodName)}" tiene varios talles/variantes:*\n\n${variantsList}\n\n` +
            `👉 *Por favor indicá el talle para descontar el stock correcto:*\n` +
            `Ejemplo: \`Venta ${cantidad} ${safeMarkdown(prodBase)} ${product.variants[0].nombre} ${parsedTotal ? `$${parsedTotal}` : `$${product.precio}`}\``
          );
          return;
        }

        // Determine price safely without Infinity
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

        if (finalTotal === 0 && (!finalPrice || finalPrice === 0)) {
          await this.sendMessage(
            chatId,
            `⚠️ No encontré el precio para *${safeMarkdown(prodName)}*.\n` +
            `Por favor especificá el precio. Ej: \`Sacar ${cantidad} ${safeMarkdown(prodBase)} ${variant ? variant.nombre : ''} $3500\``
          );
          return;
        }

        // Mark sale as done immediately to prevent race conditions
        localStorage.setItem(saleDoneKey, String(Date.now()));

        // Register sale in Firestore & Supabase (discounts inventory stock)
        await inventoryService.registerSale({
          productId: product.id,
          productNombre: prodName,
          variantId: variant?.id,
          variantNombre: variant?.nombre,
          cantidad: cantidad,
          precio: finalPrice,
          total: finalTotal,
          transactionId: telegramTxId
        });

        const newStock = Math.max(0, product.cantidad - cantidad);
        const newVariantStock = variant ? Math.max(0, (variant.cantidad || 0) - cantidad) : undefined;

        const variantDetail = variant 
          ? `\n🏷️ *Talle / Variante:* ${variant.nombre}` 
          : (detectedSize ? `\n🏷️ *Talle:* ${detectedSize}` : '');

        const variantStockDetail = newVariantStock !== undefined 
          ? ` (Talle ${variant?.nombre}: ${newVariantStock} unid.)` 
          : '';

        const isRemovalAction = /(?:sacar|saque|saqué|saca|descontar|desconte|desconté|remover|restar|resté|baja)/i.test(text);
        const actionTitle = isRemovalAction ? '📦 *¡Stock Descontado del Inventario!* 📉' : '🎉 *¡Venta Registrada Exitosamente!* 🚀';
        const actionQtyLabel = isRemovalAction ? '📉 *Cantidad retirada:*' : '🔢 *Cantidad vendida:*';

        await this.sendMessage(
          chatId,
          `${actionTitle}\n\n` +
          `📦 *Producto:* ${safeMarkdown(prodName)}${variantDetail}\n` +
          `${actionQtyLabel} -${cantidad} unid.\n` +
          `💵 *Precio:* $${finalPrice.toLocaleString('es-AR')} c/u (Total: *$${finalTotal.toLocaleString('es-AR')}*)\n` +
          `📊 *Stock restante:* ${newStock} unid.${variantStockDetail}\n\n` +
          `_El stock y el saldo se actualizaron automáticamente en tu app web._`
        );
        return;
      }

      // If no product found in catalog, fallback to custom finance sale
      let totalAmount = parsedTotal;
      if ((!totalAmount || totalAmount === 0 || !isFinite(totalAmount)) && parsedUnitPrice) {
        totalAmount = Math.round(parsedUnitPrice * cantidad);
      }

      if (!totalAmount || totalAmount === 0 || !isFinite(totalAmount)) {
        await this.sendMessage(
          chatId,
          `⚠️ No pude detectar el producto ni el precio.\n\n` +
          `*Ejemplos claros que entiendo:* \n` +
          `• \`Sacar 1 venda de 11cm $3500\`\n` +
          `• \`Venta 2 vendas tobillo 11cm $7000\`\n` +
          `• \`Vendí 2 remeras talle L $24000\``
        );
        return;
      }

      const productNombre = text
        .replace(/venta|vendí|vendi|sacar|saqué|saque|descontar|\$|\d+([.,]\d+)?/gi, '')
        .replace(/\b(un|una|a|por|de|en|efectivo|transfer|mp|tarjeta)\b/gi, '')
        .trim() || 'Venta Rápida';

      // Mark fallback sale as done
      localStorage.setItem(saleDoneKey, String(Date.now()));

      await inventoryService.addFinanceTransaction({
        tipo: 'ingreso',
        categoria: 'venta_extra',
        concepto: `Venta: ${productNombre} (x${cantidad})`,
        monto: totalAmount,
        metodo: text.toLowerCase().includes('transfer') ? 'transferencia' : 'efectivo',
        fecha: new Date().toISOString().split('T')[0],
        notas: `Registrado vía Telegram: "${text}"`
      });

      await this.sendMessage(
        chatId,
        `✅ *Venta Registrada (Ingreso de Dinero)*\n\n` +
        `• *Concepto:* ${productNombre} (x${cantidad})\n` +
        `• *Total Cobrado:* $${totalAmount.toLocaleString('es-AR')}\n\n` +
        `💡 _Nota: Como no encontramos "${productNombre}" en tu catálogo, registramos el ingreso en Finanzas. Si querés que descuente stock físico de un producto, asegurate de que coincida con el nombre o talle del catálogo._`
      );
    } catch (err: any) {
      console.error('Error saving sale via telegram:', err);
      await this.sendMessage(chatId, `❌ Error al registrar venta: ${err.message || 'Intenta de nuevo'}`);
    }
  }
}

export const telegramBot = new TelegramBotManager();
