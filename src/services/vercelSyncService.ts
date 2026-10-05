/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Client, 
  Product, 
  Sale, 
  Quote, 
  Purchase, 
  Movement, 
  Warehouse, 
  WorkOrder, 
  RepairQuote, 
  FinanceTransaction 
} from '../types';
import { supabaseService } from './supabaseService';
import { inventoryService } from './inventoryService';
import { workOrderService } from './workOrderService';
import { unmarkQuoteDeleted, unmarkRepairQuoteDeleted } from '../utils/quoteTombstones';
import { auth } from '../firebase';

export interface VercelSyncSummary {
  clientsAdded: number;
  totalClients: number;
  salesAdded: number;
  totalSales: number;
  quotesAdded: number;
  totalQuotes: number;
  ordersAdded: number;
  totalOrders: number;
  repairQuotesAdded: number;
  totalRepairQuotes: number;
  productsAdded: number;
  totalProducts: number;
  purchasesAdded: number;
  totalPurchases: number;
}

const safeParseJson = (str: any): any => {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const getLocal = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const setLocal = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving to localStorage key "${key}":`, e);
  }
};

export const vercelSyncService = {
  /**
   * 1-liner JavaScript command to run in Vercel's console (F12) to copy everything
   */
  getVercelExportCommand: () => {
    return `copy(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => !k.startsWith('firebase:')).map(k => [k, localStorage.getItem(k)]))))`;
  },

  /**
   * 1-liner JavaScript command to run in Vercel's console to update Vercel with all current data
   */
  getExportToVercelSnippet: () => {
    try {
      const payload: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !k.startsWith('firebase:')) {
          payload[k] = localStorage.getItem(k) || '';
        }
      }
      const json = JSON.stringify(payload);
      return `const d = ${json}; Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v)); alert('¡Sincronización completa en Vercel!'); location.reload();`;
    } catch {
      return '';
    }
  },

  /**
   * Import and sync ALL data from Vercel: Clients, Quotes, Sales, Orders, Products, Purchases, etc.
   */
  importTotalVercelData: async (rawInput: any): Promise<VercelSyncSummary> => {
    let parsedData: Record<string, any> = {};

    if (typeof rawInput === 'string') {
      try {
        parsedData = JSON.parse(rawInput.trim());
      } catch (e) {
        throw new Error('El formato ingresado no es un JSON válido.');
      }
    } else if (rawInput && typeof rawInput === 'object') {
      parsedData = rawInput;
    }

    if (Array.isArray(parsedData)) {
      parsedData = { clients: parsedData };
    }

    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error('No se detectaron datos válidos para sincronizar.');
    }

    // Determine if parsedData is localStorage dump (values are serialized strings or arrays)
    // or standard backup { clients: [...], sales: [...] }
    const extractList = (possibleKeys: string[]): any[] => {
      for (const k of possibleKeys) {
        if (parsedData[k] !== undefined) {
          const val = parsedData[k];
          if (Array.isArray(val)) return val;
          const parsed = safeParseJson(val);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      return [];
    };

    // 1. CLIENTS SYNC
    let clientsAdded = 0;
    const incomingClients = extractList(['clients']);
    const existingClients = getLocal<Client[]>('clients', []);
    const clientsMap = new Map<string, Client>();
    existingClients.forEach(c => {
      if (c && (c.id || c.nombre)) {
        clientsMap.set((c.nombre || c.id).trim().toLowerCase(), c);
      }
    });

    incomingClients.forEach(item => {
      if (!item || !item.nombre) return;
      const key = item.nombre.trim().toLowerCase();
      if (!clientsMap.has(key)) {
        const newClient: Client = {
          id: item.id || ('cli_' + Math.random().toString(36).substring(2, 9)),
          nombre: item.nombre.trim(),
          telefono: item.telefono || '',
          email: item.email || '',
          direccion: item.direccion || '',
          createdAt: item.createdAt || new Date().toISOString(),
          createdBy: item.createdBy || 'admin'
        };
        clientsMap.set(key, newClient);
        clientsAdded++;
      } else {
        const curr = clientsMap.get(key)!;
        if (!curr.telefono && item.telefono) curr.telefono = item.telefono;
        if (!curr.email && item.email) curr.email = item.email;
        if (!curr.direccion && item.direccion) curr.direccion = item.direccion;
      }
    });

    const mergedClients = Array.from(clientsMap.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    setLocal('clients', mergedClients);
    window.dispatchEvent(new Event('clients_updated'));
    await supabaseService.syncClientsToCloud(mergedClients);

    // 2. SALES QUOTES / PRESUPUESTOS
    let quotesAdded = 0;
    // Scan all possible quote keys in the incoming payload
    const incomingQuotes: Quote[] = [];
    Object.keys(parsedData).forEach(k => {
      if (k === 'quotes' || k.startsWith('cached_quotes_') || k === 'sb_cache_quotes') {
        const list = extractList([k]);
        list.forEach(q => {
          if (q && (q.id || q.numero)) incomingQuotes.push(q);
        });
      }
    });

    const existingQuotes = await inventoryService.getQuotes();
    const quotesMap = new Map<string, Quote>();
    existingQuotes.forEach(q => {
      if (q && (q.id || q.numero)) {
        const key = (q.numero || q.id).trim().toLowerCase();
        quotesMap.set(key, q);
      }
    });

    incomingQuotes.forEach(q => {
      if (!q || (!q.id && !q.numero)) return;
      if (q.id?.startsWith('_app_') || (q.estado as string) === 'sistema' || q.clientNombre === 'SYS_CLIENTS') return;
      unmarkQuoteDeleted(q.id, q.numero);
      const key = (q.numero || q.id).trim().toLowerCase();
      if (!quotesMap.has(key)) {
        quotesMap.set(key, q);
        quotesAdded++;
      } else {
        const existing = quotesMap.get(key)!;
        if (q.estado === 'aceptada' || existing.estado === 'aceptada') {
          existing.estado = 'aceptada';
          if (q.saleId || (q as any).sale_id) existing.saleId = q.saleId || (q as any).sale_id;
        }
        quotesMap.set(key, { ...q, ...existing });
      }
    });

    const mergedQuotes = Array.from(quotesMap.values());
    setLocal('quotes', mergedQuotes);
    const userId = auth.currentUser?.uid || 'user_offline';
    setLocal(`cached_quotes_${userId}`, mergedQuotes);
    setLocal('cached_quotes_default', mergedQuotes);
    setLocal('cached_quotes_user_offline', mergedQuotes);
    window.dispatchEvent(new Event('quotes_updated'));

    // 3. TALLER REPAIR QUOTES & WORK ORDERS
    let ordersAdded = 0;
    let repairQuotesAdded = 0;
    const incomingOrders: WorkOrder[] = [];
    const incomingRepairQuotes: RepairQuote[] = [];

    Object.keys(parsedData).forEach(k => {
      if (k === 'orders' || k.startsWith('taller_work_orders_')) {
        extractList([k]).forEach(o => {
          if (o && (o.id || o.numero)) incomingOrders.push(o);
        });
      }
      if (k === 'taller_repair_quotes' || k.startsWith('taller_repair_quotes_') || k === 'repair_quotes') {
        extractList([k]).forEach(rq => {
          if (rq && (rq.id || rq.numero)) incomingRepairQuotes.push(rq);
        });
      }
    });

    // Merge Orders
    const existingOrders = await workOrderService.getWorkOrders();
    const ordersMap = new Map<string, WorkOrder>();
    existingOrders.forEach(o => {
      if (o && (o.id || o.numero)) ordersMap.set((o.numero || o.id).trim().toLowerCase(), o);
    });

    incomingOrders.forEach(o => {
      if (!o || (!o.id && !o.numero)) return;
      const key = (o.numero || o.id).trim().toLowerCase();
      if (!ordersMap.has(key)) {
        ordersMap.set(key, o);
        ordersAdded++;
      } else {
        const existing = ordersMap.get(key)!;
        ordersMap.set(key, { ...existing, ...o });
      }
    });

    const mergedOrders = Array.from(ordersMap.values());
    setLocal('orders', mergedOrders);
    setLocal(`taller_work_orders_${userId}`, mergedOrders);
    setLocal('taller_work_orders_default', mergedOrders);
    window.dispatchEvent(new Event('orders_updated'));

    // Merge Repair Quotes
    const existingRepairQuotes = await workOrderService.getRepairQuotes();
    const repairQuotesMap = new Map<string, RepairQuote>();
    existingRepairQuotes.forEach(rq => {
      if (rq && (rq.id || rq.numero)) repairQuotesMap.set((rq.numero || rq.id).trim().toLowerCase(), rq);
    });

    incomingRepairQuotes.forEach(rq => {
      if (!rq || (!rq.id && !rq.numero)) return;
      unmarkRepairQuoteDeleted(rq.id, rq.numero);
      const key = (rq.numero || rq.id).trim().toLowerCase();
      if (!repairQuotesMap.has(key)) {
        repairQuotesMap.set(key, rq);
        repairQuotesAdded++;
      } else {
        const existing = repairQuotesMap.get(key)!;
        if (rq.estado === 'aprobado' || existing.estado === 'aprobado') {
          existing.estado = 'aprobado';
          if (rq.workOrderId) existing.workOrderId = rq.workOrderId;
        }
        repairQuotesMap.set(key, { ...existing, ...rq });
      }
    });

    const mergedRepairQuotes = Array.from(repairQuotesMap.values());
    setLocal('taller_repair_quotes', mergedRepairQuotes);
    setLocal(`taller_repair_quotes_${userId}`, mergedRepairQuotes);
    setLocal('taller_repair_quotes_default', mergedRepairQuotes);
    window.dispatchEvent(new Event('repair_quotes_updated'));

    // 4. SALES
    let salesAdded = 0;
    const incomingSales = extractList(['sales']);
    const existingSales = getLocal<Sale[]>('sales', []);
    const salesMap = new Map<string, Sale>();
    existingSales.forEach(s => {
      if (s && s.id) salesMap.set(s.id, s);
    });

    incomingSales.forEach(s => {
      if (!s || !s.id) return;
      if (!salesMap.has(s.id)) {
        salesMap.set(s.id, s);
        salesAdded++;
      } else {
        salesMap.set(s.id, { ...salesMap.get(s.id)!, ...s });
      }
    });

    const mergedSales = Array.from(salesMap.values());
    setLocal('sales', mergedSales);
    window.dispatchEvent(new Event('sales_updated'));

    // 5. PRODUCTS
    let productsAdded = 0;
    const incomingProducts = extractList(['products']);
    const existingProducts = getLocal<Product[]>('products', []);
    const productsMap = new Map<string, Product>();
    existingProducts.forEach(p => {
      if (p && (p.id || p.codigo)) {
        productsMap.set((p.id || p.codigo || '').toLowerCase(), p);
      }
    });

    incomingProducts.forEach(p => {
      if (!p || (!p.id && !p.codigo)) return;
      const key = (p.id || p.codigo || '').toLowerCase();
      if (!productsMap.has(key)) {
        productsMap.set(key, p);
        productsAdded++;
      } else {
        productsMap.set(key, { ...productsMap.get(key)!, ...p });
      }
    });

    const mergedProducts = Array.from(productsMap.values());
    setLocal('products', mergedProducts);
    window.dispatchEvent(new Event('products_updated'));

    // 6. WAREHOUSES & PURCHASES & FINANCES & CASH
    const incomingWarehouses = extractList(['warehouses']);
    if (incomingWarehouses.length > 0) {
      const existingWarehouses = getLocal<Warehouse[]>('warehouses', []);
      const wMap = new Map<string, Warehouse>();
      existingWarehouses.forEach(w => wMap.set(w.id || w.nombre, w));
      incomingWarehouses.forEach(w => wMap.set(w.id || w.nombre, w));
      setLocal('warehouses', Array.from(wMap.values()));
      window.dispatchEvent(new Event('warehouses_updated'));
    }

    let purchasesAdded = 0;
    const incomingPurchases = extractList(['purchases']);
    if (incomingPurchases.length > 0) {
      const existingPurchases = getLocal<Purchase[]>('purchases', []);
      const pMap = new Map<string, Purchase>();
      existingPurchases.forEach(p => pMap.set(p.id, p));
      incomingPurchases.forEach(p => {
        if (!pMap.has(p.id)) {
          pMap.set(p.id, p);
          purchasesAdded++;
        }
      });
      setLocal('purchases', Array.from(pMap.values()));
      window.dispatchEvent(new Event('purchases_updated'));
    }

    const incomingFinances = extractList(['finances']);
    if (incomingFinances.length > 0) {
      const existingFinances = getLocal<FinanceTransaction[]>('finances', []);
      const fMap = new Map<string, FinanceTransaction>();
      existingFinances.forEach(f => fMap.set(f.id, f));
      incomingFinances.forEach(f => fMap.set(f.id, f));
      setLocal('finances', Array.from(fMap.values()));
      window.dispatchEvent(new Event('finances_updated'));
    }

    // Pass additional settings if present
    ['app_settings', 'company_branding', 'account_payments', 'cash_shifts', 'cash_audits', 'goals'].forEach(key => {
      if (parsedData[key] !== undefined) {
        const val = safeParseJson(parsedData[key]) || parsedData[key];
        setLocal(key, val);
      }
    });

    // 7. SYNC EVERYTHING INTO SUPABASE CLOUD
    try {
      await supabaseService.migrateDataToSupabase({
        products: mergedProducts,
        warehouses: getLocal<Warehouse[]>('warehouses', []),
        quotes: mergedQuotes,
        sales: mergedSales,
        clients: mergedClients
      });
    } catch (err) {
      console.warn('Supabase batch migration error during Vercel sync:', err);
    }

    return {
      clientsAdded,
      totalClients: mergedClients.length,
      salesAdded,
      totalSales: mergedSales.length,
      quotesAdded,
      totalQuotes: mergedQuotes.length,
      ordersAdded,
      totalOrders: mergedOrders.length,
      repairQuotesAdded,
      totalRepairQuotes: mergedRepairQuotes.length,
      productsAdded,
      totalProducts: mergedProducts.length,
      purchasesAdded,
      totalPurchases: getLocal<Purchase[]>('purchases', []).length
    };
  },

  /**
   * 1-click cloud sync: refresh everything directly from Supabase
   */
  resyncEverythingFromSupabase: async () => {
    const [clients, quotes, products, sales, warehouses, purchases, workOrders, repairQuotes] = await Promise.all([
      supabaseService.getClients(),
      supabaseService.getQuotes(),
      supabaseService.getProducts(),
      supabaseService.getSales(1000),
      supabaseService.getWarehouses(),
      supabaseService.getPurchases(365),
      workOrderService.getWorkOrders(),
      workOrderService.getRepairQuotes()
    ]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('products_updated'));
      window.dispatchEvent(new Event('clients_updated'));
      window.dispatchEvent(new Event('quotes_updated'));
      window.dispatchEvent(new Event('sales_updated'));
      window.dispatchEvent(new Event('warehouses_updated'));
      window.dispatchEvent(new Event('purchases_updated'));
      window.dispatchEvent(new CustomEvent('work_orders_changed', { detail: workOrders }));
      window.dispatchEvent(new CustomEvent('repair_quotes_changed', { detail: repairQuotes }));
    }

    return {
      clients: clients.length,
      quotes: quotes.length,
      products: products.length,
      sales: sales.length,
      warehouses: warehouses.length,
      purchases: purchases.length,
      workOrders: workOrders.length,
      repairQuotes: repairQuotes.length
    };
  }
};
