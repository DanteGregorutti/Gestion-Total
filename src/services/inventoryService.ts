/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from '../firebase';
import { supabase } from '../supabase';
import { supabaseService } from './supabaseService';
import { 
  markQuoteAsDeleted, 
  unmarkQuoteDeleted, 
  isQuoteDeleted, 
  filterOutDeletedQuotes, 
  scrubQuoteFromLocalStorage 
} from '../utils/quoteTombstones';
import { 
  Product, 
  Movement, 
  Sale, 
  Purchase, 
  Warehouse, 
  Client, 
  Supplier, 
  Notification, 
  Goal, 
  UserProfile, 
  Combo, 
  ComboItem, 
  FinanceTransaction, 
  CashAudit, 
  Quote, 
  QuoteItem 
} from '../types';

const getLocal = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const setLocal = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// Firestore is permanently disabled to prevent quota exhaustion and app lockups.
// The app runs on Supabase (PostgreSQL) + LocalStorage with real-time sync.
export const USE_FIRESTORE = false;
export const isFirestoreQuotaExhausted = true;
export function markFirestoreQuotaExhausted() {}
export function isFirestoreAvailable(): boolean {
  return false;
}
export function checkFirestoreQuotaExhausted(_error: unknown): boolean {
  return true;
}

export async function safeFirestoreWrite<T>(_op: () => Promise<T>, _timeoutMs = 1500): Promise<T | null> {
  return null;
}

export async function safeFirestoreRead<T>(_op: () => Promise<T>, _timeoutMs = 2000): Promise<T | null> {
  return null;
}

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    return !error;
  } catch {
    return true; // LocalStorage fallback is always operational
  }
}

/**
 * Calculates the next sequential product code (e.g. ART-0001 -> ART-0002)
 */
export function getNextProductCode(products: Array<{ codigo?: string }>, prefix: string = 'ART'): string {
  const cleanPrefix = (prefix || 'ART').trim().toUpperCase();
  const regex = new RegExp(`^${cleanPrefix}[-_]?(\\d+)$`, 'i');
  let maxNum = 0;

  if (Array.isArray(products)) {
    for (const p of products) {
      if (!p?.codigo) continue;
      const match = p.codigo.trim().match(regex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${cleanPrefix}-${String(nextNum).padStart(4, '0')}`;
}

export function isNameInCode(code?: string): boolean {
  if (!code) return false;
  const c = code.trim();
  if (/^ART[-_]?\d+$/i.test(c)) return false;
  if (/\s+/.test(c)) return true;
  if (!/\d/.test(c) && c.length >= 3) return true;
  return false;
}

export const inventoryService = {
  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    try {
      const sbProducts = await supabaseService.getProducts();
      if (sbProducts && sbProducts.length > 0) {
        return sbProducts;
      }
    } catch (e) {
      console.warn('Supabase getProducts fallback error:', e);
    }
    return getLocal<Product[]>('products', []);
  },

  getProductsPaginated: async (pageSize: number = 20, _lastVisible: any = null) => {
    const all = await inventoryService.getProducts();
    const products = all.slice(0, pageSize);
    return {
      products,
      lastVisible: null
    };
  },

  getProductsCount: async () => {
    const all = await inventoryService.getProducts();
    return all.length;
  },

  getLowStockProducts: async (threshold: number = 5) => {
    const all = await inventoryService.getProducts();
    return all.filter(p => p.cantidad <= threshold).slice(0, 100);
  },

  getRecentMovements: async (days: number = 7) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const all = await inventoryService.getMovements();
    return all.filter(m => {
      const date = (m.fecha as any)?.toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
      return date >= since;
    });
  },

  subscribeToProducts: (callback: (products: Product[]) => void) => {
    return supabaseService.subscribeToProducts(callback);
  },

  addProduct: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    return await supabaseService.addProduct(product);
  },

  updateProduct: async (id: string, product: Partial<Product>) => {
    await supabaseService.updateProduct(id, product);
  },

  syncProductImageAcrossVariants: async (codigo: string, imagenUrl: string, excludeId?: string) => {
    if (!codigo?.trim() || !imagenUrl) return;
    const cleanCode = codigo.trim().toLowerCase();
    try {
      const allCached = await supabaseService.getProducts().catch(() => []);
      const siblingsSb = allCached.filter(p => p.codigo?.trim().toLowerCase() === cleanCode && p.id !== excludeId && p.imagenUrl !== imagenUrl);
      for (const sib of siblingsSb) {
        await supabaseService.updateProduct(sib.id, { imagenUrl }).catch(() => {});
      }
    } catch (error) {
      console.warn('Error syncing product image across variants:', error);
    }
  },

  syncProductAcrossVariants: async (productIds: string[], updates: Partial<Product>) => {
    if (!productIds || productIds.length === 0) return;
    try {
      for (const id of productIds) {
        await supabaseService.updateProduct(id, updates).catch(() => {});
      }
    } catch (error) {
      console.warn('Error syncing product across variants:', error);
    }
  },

  deleteProduct: async (id: string) => {
    await supabaseService.deleteProduct(id);
  },

  deleteProductsBatch: async (ids: string[]) => {
    await supabaseService.deleteProductsBatch(ids);
  },

  updateProductsBatch: async (updates: Array<{ id: string; data: Partial<Product> }>) => {
    if (!updates || updates.length === 0) return;
    for (const item of updates) {
      try {
        await supabaseService.updateProduct(item.id, item.data);
      } catch (e) {
        console.warn('Supabase batch update error:', e);
      }
    }
  },

  reorganizeProductCodes: async (options?: { prefix?: string; startNumber?: number }) => {
    const prefix = (options?.prefix || 'ART').trim().toUpperCase();
    const startNumber = Math.max(1, options?.startNumber || 1);

    const products = await inventoryService.getProducts();
    if (!products || products.length === 0) {
      return { totalUpdated: 0, groupsCount: 0, details: [] };
    }

    const normalize = (str?: string) => {
      return (str || '')
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const getCleanName = (desc: string, code: string): string => {
      const d = (desc || '').trim();
      const c = (code || '').trim();

      const isGenericDesc = !d || 
        /^producto\s+/i.test(d) || 
        /^art[-_\s]/i.test(d) ||
        d.toLowerCase() === c.toLowerCase();

      let nameToUse = !isGenericDesc ? d : (c || d || 'Producto');
      if (/^producto\s+/i.test(nameToUse) && nameToUse.length > 9) {
        nameToUse = nameToUse.replace(/^producto\s+/i, '').trim();
      }

      if (nameToUse === nameToUse.toLowerCase() || (nameToUse === nameToUse.toUpperCase() && nameToUse.length > 3)) {
        nameToUse = nameToUse
          .split(' ')
          .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
          .join(' ');
      }
      return nameToUse;
    };

    interface LogicalGroup {
      cleanName: string;
      image: string;
      products: Product[];
      codes: Set<string>;
      earliestTime: number;
    }

    const groups: LogicalGroup[] = [];

    products.forEach(p => {
      const pCode = normalize(p.codigo);
      const pDesc = normalize(p.descripcion);

      let match = groups.find(g => {
        const gName = normalize(g.cleanName);
        if (pDesc && gName === pDesc) return true;
        if (pCode && g.codes.has(pCode)) return true;
        if (pCode && gName === pCode) return true;
        if (pDesc && g.codes.has(pDesc)) return true;
        return false;
      });

      const pTime = (p.createdAt as any)?.toDate 
        ? (p.createdAt as any).toDate().getTime() 
        : new Date((p.createdAt as any) || 0).getTime();

      if (!match) {
        const cleanName = getCleanName(p.descripcion, p.codigo);
        match = {
          cleanName,
          image: p.imagenUrl || '',
          products: [],
          codes: new Set(pCode ? [pCode] : []),
          earliestTime: isNaN(pTime) ? 0 : pTime
        };
        groups.push(match);
      } else {
        if (pCode) match.codes.add(pCode);
        if (!match.image && p.imagenUrl) match.image = p.imagenUrl;
        if (pTime && (match.earliestTime === 0 || pTime < match.earliestTime)) {
          match.earliestTime = pTime;
        }
        if ((!match.cleanName || match.cleanName.startsWith('Producto')) && p.descripcion) {
          match.cleanName = getCleanName(p.descripcion, p.codigo);
        }
      }

      match.products.push(p);
    });

    groups.sort((a, b) => {
      if (a.earliestTime && b.earliestTime && a.earliestTime !== b.earliestTime) {
        return a.earliestTime - b.earliestTime;
      }
      return a.cleanName.localeCompare(b.cleanName);
    });

    const updates: Array<{ id: string; data: Partial<Product> }> = [];
    const details: Array<{
      groupName: string;
      newCode: string;
      previousCodes: string[];
      variantsCount: number;
    }> = [];

    groups.forEach((group, index) => {
      const codeNumber = startNumber + index;
      const newCode = `${prefix}-${String(codeNumber).padStart(4, '0')}`;
      const previousCodes = Array.from(group.codes);

      details.push({
        groupName: group.cleanName,
        newCode,
        previousCodes,
        variantsCount: group.products.length
      });

      group.products.forEach(prod => {
        updates.push({
          id: prod.id,
          data: {
            codigo: newCode,
            descripcion: group.cleanName,
            ...(group.image && !prod.imagenUrl ? { imagenUrl: group.image } : {})
          }
        });
      });
    });

    await inventoryService.updateProductsBatch(updates);

    for (const group of groups) {
      if (group.image) {
        const newCode = details.find(d => d.groupName === group.cleanName)?.newCode;
        if (newCode) {
          inventoryService.syncProductImageAcrossVariants(newCode, group.image).catch(() => {});
        }
      }
    }

    return {
      totalUpdated: updates.length,
      groupsCount: groups.length,
      details
    };
  },

  bulkAddProducts: async (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>[], onProgress?: (count: number) => void) => {
    let processed = 0;
    const existingProducts = await inventoryService.getProducts();
    const productMap = new Map<string, Product>();
    existingProducts.forEach(p => {
      const key = `${p.codigo}_${p.almacenId}_${p.ubicacion || ''}_${p.procedencia}_${p.talle || ''}_${p.genero || ''}`;
      productMap.set(key, p);
    });

    for (const prod of products) {
      const talle = prod.talle || '';
      const genero = prod.genero || '';
      const ubicacion = prod.ubicacion || '';
      const key = `${prod.codigo}_${prod.almacenId}_${ubicacion}_${prod.procedencia}_${talle}_${genero}`;
      const existing = productMap.get(key);

      if (existing) {
        const newQty = existing.cantidad + prod.cantidad;
        await inventoryService.updateProduct(existing.id, { cantidad: newQty });
        productMap.set(key, { ...existing, cantidad: newQty });
      } else {
        const newId = await inventoryService.addProduct({
          ...prod,
          talle,
          genero,
          ubicacion
        });
        productMap.set(key, {
          id: newId,
          ...prod,
          talle,
          genero,
          ubicacion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);
      }

      processed++;
      if (onProgress && processed % 5 === 0) {
        onProgress(processed);
      }
    }
  },

  getProductsByCode: async (codigo: string): Promise<Product[]> => {
    if (!codigo) return [];
    const all = await inventoryService.getProducts();
    const clean = codigo.trim().toLowerCase();
    return all.filter(p => (p.codigo || '').trim().toLowerCase() === clean);
  },

  checkProductCodeExists: async (codigo: string, excludeId?: string): Promise<Product | null> => {
    if (!codigo) return null;
    const clean = codigo.trim().toLowerCase();
    const all = await inventoryService.getProducts();
    const matches = all.filter(p => (p.codigo || '').trim().toLowerCase() === clean);
    if (excludeId) {
      return matches.find(p => p.id !== excludeId) || null;
    }
    return matches.length > 0 ? matches[0] : null;
  },

  checkProductExists: async (
    codigo: string, 
    almacenId: string, 
    ubicacion: string, 
    procedencia: string, 
    talle?: string, 
    genero?: string
  ): Promise<Product | null> => {
    const all = await inventoryService.getProducts();
    const match = all.find(p => 
      (p.codigo || '').trim().toLowerCase() === (codigo || '').trim().toLowerCase() &&
      (p.almacenId || '') === (almacenId || '') &&
      (p.ubicacion || '') === (ubicacion || '') &&
      (p.procedencia || '') === (procedencia || '') &&
      (p.talle || '') === (talle || '') &&
      (p.genero || '') === (genero || '')
    );
    return match || null;
  },

  // --- WAREHOUSES ---
  getWarehouses: async () => {
    return await supabaseService.getWarehouses();
  },

  subscribeToWarehouses: (callback: (warehouses: Warehouse[]) => void) => {
    return supabaseService.subscribeToWarehouses(callback);
  },

  addWarehouse: async (warehouse: Omit<Warehouse, 'id' | 'createdAt' | 'createdBy'>) => {
    return await supabaseService.addWarehouse(warehouse);
  },

  updateWarehouse: async (id: string, warehouse: Partial<Warehouse>) => {
    try {
      await supabase.from('warehouses').update(warehouse).eq('id', id);
    } catch (e) {}
    const cached = getLocal<Warehouse[]>('warehouses', []);
    setLocal('warehouses', cached.map(w => w.id === id ? { ...w, ...warehouse } : w));
    window.dispatchEvent(new Event('warehouses_updated'));
  },

  deleteWarehouse: async (id: string) => {
    try {
      await supabase.from('warehouses').delete().eq('id', id);
    } catch (e) {}
    const cached = getLocal<Warehouse[]>('warehouses', []);
    setLocal('warehouses', cached.filter(w => w.id !== id));
    window.dispatchEvent(new Event('warehouses_updated'));
  },

  // --- CLIENTS ---
  getClients: async () => {
    return await supabaseService.getClients();
  },

  subscribeToClients: (callback: (clients: Client[]) => void) => {
    return supabaseService.subscribeToClients(callback);
  },

  addClient: async (client: Omit<Client, 'id' | 'createdAt' | 'createdBy'>) => {
    return await supabaseService.addClient(client);
  },

  updateClient: async (id: string, client: Partial<Client>) => {
    await supabaseService.updateClient(id, client);
  },

  deleteClient: async (id: string) => {
    await supabaseService.deleteClient(id);
  },

  // --- SUPPLIERS ---
  getSuppliers: async () => {
    return await supabaseService.getSuppliers();
  },

  subscribeToSuppliers: (callback: (suppliers: Supplier[]) => void) => {
    return supabaseService.subscribeToSuppliers(callback);
  },

  addSupplier: async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'createdBy'>) => {
    const id = generateId('sup');
    const item: Supplier = { ...supplier, id, createdAt: new Date().toISOString(), createdBy: 'admin' };
    const cached = getLocal<Supplier[]>('suppliers', []);
    setLocal('suppliers', [item, ...cached]);
    try {
      await supabase.from('suppliers').insert([item]);
    } catch (e) {}
    window.dispatchEvent(new Event('suppliers_updated'));
    return id;
  },

  updateSupplier: async (id: string, supplier: Partial<Supplier>) => {
    const cached = getLocal<Supplier[]>('suppliers', []);
    setLocal('suppliers', cached.map(s => s.id === id ? { ...s, ...supplier } : s));
    try {
      await supabase.from('suppliers').update(supplier).eq('id', id);
    } catch (e) {}
    window.dispatchEvent(new Event('suppliers_updated'));
  },

  deleteSupplier: async (id: string) => {
    const cached = getLocal<Supplier[]>('suppliers', []);
    setLocal('suppliers', cached.filter(s => s.id !== id));
    try {
      await supabase.from('suppliers').delete().eq('id', id);
    } catch (e) {}
    window.dispatchEvent(new Event('suppliers_updated'));
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (_maxResults: number = 50) => {
    return getLocal<Notification[]>('notifications', []);
  },

  getRecentNotifications: async (hours: number = 24, maxResults: number = 100) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const notifications = getLocal<Notification[]>('notifications', []);
    return notifications
      .filter(n => {
        const date = (n.fecha as any)?.toDate ? (n.fecha as any).toDate() : new Date(n.fecha as any || 0);
        return date >= since;
      })
      .slice(0, maxResults);
  },

  subscribeToNotifications: (callback: (notifications: Notification[]) => void) => {
    callback(getLocal<Notification[]>('notifications', []));
    const handler = () => {
      callback(getLocal<Notification[]>('notifications', []));
    };
    window.addEventListener('notifications_updated', handler);
    return () => {
      window.removeEventListener('notifications_updated', handler);
    };
  },

  addNotification: async (notification: Omit<Notification, 'id' | 'fecha' | 'userId' | 'leido'>, skipCheck: boolean = false) => {
    const cached = getLocal<Notification[]>('notifications', []);
    if (!skipCheck) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const exists = cached.some(n => 
        n.titulo === notification.titulo && 
        n.productId === notification.productId &&
        new Date(n.fecha || 0) >= yesterday
      );
      if (exists) return;
    }
    const newNotif: Notification = {
      ...notification,
      id: generateId('notif'),
      userId: auth.currentUser?.uid || 'admin',
      leido: false,
      fecha: new Date().toISOString()
    };
    setLocal('notifications', [newNotif, ...cached]);
    window.dispatchEvent(new Event('notifications_updated'));
  },

  markNotificationAsRead: async (id: string) => {
    const cached = getLocal<Notification[]>('notifications', []);
    setLocal('notifications', cached.map(n => n.id === id ? { ...n, leido: true } : n));
    window.dispatchEvent(new Event('notifications_updated'));
  },

  deleteNotification: async (id: string) => {
    const cached = getLocal<Notification[]>('notifications', []);
    setLocal('notifications', cached.filter(n => n.id !== id));
    window.dispatchEvent(new Event('notifications_updated'));
  },

  clearAllNotifications: async () => {
    setLocal('notifications', []);
    window.dispatchEvent(new Event('notifications_updated'));
  },

  // --- GOALS ---
  getGoals: async () => {
    return getLocal<Goal[]>('goals', []);
  },

  subscribeToGoals: (callback: (goals: Goal[]) => void) => {
    callback(getLocal<Goal[]>('goals', []));
    const handler = () => {
      callback(getLocal<Goal[]>('goals', []));
    };
    window.addEventListener('goals_updated', handler);
    return () => {
      window.removeEventListener('goals_updated', handler);
    };
  },

  addGoal: async (goal: Omit<Goal, 'id' | 'createdBy'>) => {
    const id = generateId('goal');
    const newGoal: Goal = {
      ...goal,
      id,
      createdBy: auth.currentUser?.uid || 'admin'
    };
    const cached = getLocal<Goal[]>('goals', []);
    setLocal('goals', [newGoal, ...cached]);
    window.dispatchEvent(new Event('goals_updated'));
    return id;
  },

  updateGoal: async (id: string, goal: Partial<Goal>) => {
    const cached = getLocal<Goal[]>('goals', []);
    setLocal('goals', cached.map(g => g.id === id ? { ...g, ...goal } : g));
    window.dispatchEvent(new Event('goals_updated'));
  },

  deleteGoal: async (id: string) => {
    const cached = getLocal<Goal[]>('goals', []);
    setLocal('goals', cached.filter(g => g.id !== id));
    window.dispatchEvent(new Event('goals_updated'));
  },

  // --- MOVEMENTS ---
  getMovements: async (_maxResults: number = 500) => {
    return await supabaseService.getMovements();
  },

  getMovementsByProduct: async (productId: string) => {
    const all = await supabaseService.getMovements();
    return all.filter(m => m.productId === productId).slice(0, 50);
  },

  subscribeToMovements: (callback: (movements: Movement[]) => void) => {
    return supabaseService.subscribeToMovements(callback);
  },

  subscribeToRecentMovements: (callback: (movements: Movement[]) => void, _days: number = 30) => {
    return supabaseService.subscribeToMovements(callback);
  },

  // --- SALES ---
  getSales: async (days: number = 30): Promise<Sale[]> => {
    const allSalesMap = new Map<string, Sale>();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Local storage
    try {
      const local = getLocal<Sale[]>('sales', []);
      if (Array.isArray(local)) {
        local.forEach(s => {
          if (s && s.id) {
            const d = new Date((s.fecha as any)?.toDate ? (s.fecha as any).toDate() : (s.fecha || 0));
            if (d >= since) allSalesMap.set(s.id, s);
          }
        });
      }
    } catch (e) {}

    // 2. Supabase
    try {
      const sbSales = await supabaseService.getSales(days);
      if (Array.isArray(sbSales) && sbSales.length > 0) {
        sbSales.forEach(s => {
          if (s && s.id) allSalesMap.set(s.id, s);
        });
      }
    } catch (e) {
      console.warn('Supabase getSales fallback:', e);
    }

    const mergedSales = Array.from(allSalesMap.values()).sort((a, b) => {
      const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
      const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
      return dateB.getTime() - dateA.getTime();
    });

    try {
      setLocal('sales', mergedSales);
    } catch (e) {}

    return mergedSales;
  },

  getSalesByClient: async (clientId: string) => {
    const all = await inventoryService.getSales(90);
    return all.filter(s => s.clientId === clientId).slice(0, 50);
  },

  subscribeToSales: (callback: (sales: Sale[]) => void, days: number = 30) => {
    return supabaseService.subscribeToSales(async () => {
      const fresh = await inventoryService.getSales(days);
      callback(fresh);
    });
  },

  registerSale: async (
    sales: (Omit<Sale, 'id' | 'fecha' | 'createdBy'> & Partial<Pick<Sale, 'id' | 'fecha' | 'createdBy'>>) | 
           (Omit<Sale, 'id' | 'fecha' | 'createdBy'> & Partial<Pick<Sale, 'id' | 'fecha' | 'createdBy'>>)[]
  ) => {
    const salesArray = Array.isArray(sales) ? sales : [sales];
    const nowIso = new Date().toISOString();

    const preparedSales = salesArray.map((s, idx) => {
      const id = s.id || generateId(`sale_${idx}`);
      const cantidad = Number(s.cantidad) || 1;
      const precio = Number(s.precio) || 0;
      const total = Number(s.total !== undefined ? s.total : cantidad * precio) || 0;

      return {
        ...s,
        id,
        cantidad,
        precio,
        total,
        fecha: (s as any).fecha || nowIso,
        costo: (s as any).costo || 0,
        createdBy: auth.currentUser?.uid || (s as any).createdBy || 'admin'
      } as Sale;
    });

    // 1. Cache immediately locally
    try {
      const existing = getLocal<Sale[]>('sales', []);
      setLocal('sales', [...preparedSales, ...existing.filter(e => !preparedSales.some(p => p.id === e.id))]);
    } catch (e) {}

    // 2. Persist to Supabase with inventory stock deduction and movement logging
    try {
      await supabaseService.registerSale(preparedSales);
    } catch (e) {
      console.warn('Supabase registerSale error:', e);
    }

    return preparedSales;
  },

  updateSale: async (id: string, data: Partial<Sale>) => {
    try {
      await supabaseService.updateSale(id, data);
    } catch (e) {
      console.warn('Supabase updateSale error:', e);
    }
    const cached = getLocal<Sale[]>('sales', []);
    setLocal('sales', cached.map(s => s.id === id ? { ...s, ...data } : s));
  },

  assignSalesToClient: async (saleIds: string[], client: { id: string; nombre: string }) => {
    if (!saleIds || saleIds.length === 0) return;
    try {
      await supabaseService.assignSalesToClient(saleIds, client);
    } catch (e) {
      console.warn('Supabase assignSalesToClient error:', e);
    }
  },

  registerComboSale: async (data: { 
    nombre: string, 
    items: ComboItem[], 
    total: number, 
    clientId?: string, 
    clientNombre?: string 
  }) => {
    const transactionId = generateId('tx');
    const finalTotal = Math.round(Number(data.total) || 0);

    const preparedSale: Sale = {
      id: transactionId,
      productId: 'combo',
      productNombre: data.nombre,
      variantId: '',
      variantNombre: '',
      cantidad: 1,
      precio: finalTotal,
      total: finalTotal,
      clientId: data.clientId || '',
      clientNombre: data.clientNombre || '',
      transactionId,
      isCombo: true,
      comboItems: data.items,
      fecha: new Date().toISOString(),
      costo: 0,
      createdBy: auth.currentUser?.uid || 'admin'
    };

    await inventoryService.registerSale(preparedSale);
  },

  deleteSale: async (id: string) => {
    try {
      const local = getLocal<Sale[]>('sales', []);
      setLocal('sales', local.filter(s => s.id !== id && (s as any).transactionId !== id));
    } catch (e) {}

    try {
      await supabaseService.deleteSale(id);
    } catch (e) {
      console.warn('Supabase deleteSale error:', e);
    }
  },

  bulkDeleteSales: async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      const idSet = new Set(ids);
      const local = getLocal<Sale[]>('sales', []);
      setLocal('sales', local.filter(s => !idSet.has(s.id) && !idSet.has((s as any).transactionId)));
    } catch (e) {}

    try {
      await supabaseService.bulkDeleteSales(ids);
    } catch (e) {
      console.warn('Supabase bulkDeleteSales error:', e);
    }
  },

  // --- PURCHASES ---
  getPurchases: async (days: number = 30): Promise<Purchase[]> => {
    const allMap = new Map<string, Purchase>();

    const cached = getLocal<Purchase[]>('purchases', []);
    if (Array.isArray(cached)) {
      cached.forEach(p => {
        if (p && p.id) allMap.set(p.id, p);
      });
    }

    try {
      const sbPurchases = await supabaseService.getPurchases();
      if (Array.isArray(sbPurchases)) {
        sbPurchases.forEach(p => {
          if (p && p.id) allMap.set(p.id, p);
        });
      }
    } catch (e) {
      console.warn('Supabase getPurchases fallback:', e);
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const purchases = Array.from(allMap.values())
      .filter(p => {
        const date = (p.fecha as any)?.toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any || 0);
        return date >= since;
      })
      .sort((a, b) => {
        const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
        const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
        return dateB.getTime() - dateA.getTime();
      });

    setLocal('purchases', purchases);
    return purchases;
  },

  getPurchasesBySupplier: async (proveedor: string) => {
    const all = await inventoryService.getPurchases(90);
    return all.filter(p => p.proveedor === proveedor).slice(0, 50);
  },

  subscribeToPurchases: (callback: (purchases: Purchase[]) => void) => {
    const initialCache = getLocal<Purchase[]>('purchases', []);
    if (initialCache && initialCache.length > 0) {
      callback(initialCache);
    }
    return supabaseService.subscribeToPurchases(async (fresh) => {
      if (Array.isArray(fresh)) {
        callback(fresh);
      }
    });
  },

  subscribeToRecentPurchases: (callback: (purchases: Purchase[]) => void, _days: number = 30) => {
    return inventoryService.subscribeToPurchases(callback);
  },

  registerPurchase: async (purchase: Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'> & { total?: number }) => {
    try {
      await supabaseService.registerPurchase({
        productId: purchase.productId,
        productNombre: purchase.productNombre,
        variantId: purchase.variantId,
        variantNombre: purchase.variantNombre,
        cantidad: purchase.cantidad,
        costo: purchase.costo,
        proveedor: purchase.proveedor
      });
    } catch (e) {
      console.warn('Supabase registerPurchase fallback:', e);
    }
  },

  registerBulkPurchase: async (purchases: (Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'> & { total?: number })[]) => {
    for (const purchase of purchases) {
      try {
        await inventoryService.registerPurchase(purchase);
      } catch (e) {
        console.warn('Error registering item in bulk purchase:', e);
      }
    }
  },

  deletePurchase: async (id: string) => {
    try {
      await supabaseService.deletePurchase(id);
    } catch (e) {
      console.warn('Supabase deletePurchase error:', e);
    }
  },

  // --- FINANCES & AUDITS ---
  getFinances: async (): Promise<FinanceTransaction[]> => {
    const allMap = new Map<string, FinanceTransaction>();

    const cached = getLocal<FinanceTransaction[]>('finances', []);
    if (Array.isArray(cached)) {
      cached.forEach(f => {
        if (f && f.id) allMap.set(f.id, f);
      });
    }

    try {
      const sbFinances = await supabaseService.getFinances();
      if (Array.isArray(sbFinances) && sbFinances.length > 0) {
        sbFinances.forEach(f => {
          if (f && f.id) allMap.set(f.id, f);
        });
      }
    } catch (e) {
      console.warn('Supabase getFinances fallback:', e);
    }

    const merged = Array.from(allMap.values()).sort((a, b) => {
      const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
      const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    setLocal('finances', merged);
    return merged;
  },

  subscribeToFinances: (callback: (transactions: FinanceTransaction[]) => void) => {
    const initialCache = getLocal<FinanceTransaction[]>('finances', []);
    if (initialCache && initialCache.length > 0) {
      callback(initialCache);
    }
    return supabaseService.subscribeToFinances((sbData) => {
      if (Array.isArray(sbData)) {
        callback(sbData);
      }
    });
  },

  addFinanceTransaction: async (transaction: Omit<FinanceTransaction, 'id' | 'createdAt' | 'createdBy'>) => {
    const id = generateId('fin');
    const nowIso = new Date().toISOString();
    const userId = auth.currentUser?.uid || 'admin';
    const item: FinanceTransaction = {
      ...transaction,
      id,
      monto: Number(transaction.monto) || 0,
      createdAt: nowIso,
      createdBy: userId
    };

    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', [item, ...cached.filter(f => f.id !== id)]);

    try {
      await supabaseService.addFinance(item);
    } catch (e) {
      console.warn('Supabase addFinance error:', e);
    }

    return id;
  },

  updateFinanceTransaction: async (id: string, transaction: Partial<FinanceTransaction>) => {
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.map(f => f.id === id ? { ...f, ...transaction } : f));

    try {
      await supabaseService.updateFinance(id, transaction);
    } catch (e) {}
  },

  deleteFinanceTransaction: async (id: string) => {
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.filter(f => f.id !== id));

    try {
      await supabaseService.deleteFinance(id);
    } catch (e) {}
  },

  bulkDeleteFinanceTransactions: async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids);
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.filter(f => !idsSet.has(f.id)));

    try {
      await supabaseService.bulkDeleteFinances(ids);
    } catch (e) {}
  },

  subscribeToCashAudits: (callback: (audits: CashAudit[]) => void) => {
    const cached = getLocal<CashAudit[]>('cash_audits', []);
    callback(cached);
    const handler = () => {
      callback(getLocal<CashAudit[]>('cash_audits', []));
    };
    window.addEventListener('cash_audits_updated', handler);
    return () => {
      window.removeEventListener('cash_audits_updated', handler);
    };
  },

  addCashAudit: async (audit: Omit<CashAudit, 'id' | 'createdAt' | 'createdBy'>) => {
    const id = generateId('audit');
    const nowIso = new Date().toISOString();
    const item: CashAudit = {
      ...audit,
      id,
      createdAt: nowIso,
      createdBy: auth.currentUser?.uid || 'admin'
    };

    const cached = getLocal<CashAudit[]>('cash_audits', []);
    setLocal('cash_audits', [item, ...cached]);
    window.dispatchEvent(new Event('cash_audits_updated'));
    return id;
  },

  deleteCashAudit: async (id: string) => {
    const cached = getLocal<CashAudit[]>('cash_audits', []);
    setLocal('cash_audits', cached.filter(a => a.id !== id));
    window.dispatchEvent(new Event('cash_audits_updated'));
  },

  // --- QUOTES / PRESUPUESTOS ---
  getQuotes: async (): Promise<Quote[]> => {
    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;
    const allQuotesMap = new Map<string, Quote>();
    
    const candidateKeys = [cacheKey, 'cached_quotes_user_offline', 'cached_quotes_default', 'quotes'];
    for (const key of candidateKeys) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach(q => {
              if (q && q.id && !isQuoteDeleted(q.id, q.numero)) {
                allQuotesMap.set(q.id, q);
              }
            });
          }
        }
      } catch (e) {}
    }

    try {
      const sbQuotes = await supabaseService.getQuotes();
      if (Array.isArray(sbQuotes) && sbQuotes.length > 0) {
        sbQuotes.forEach(q => {
          if (q && q.id) {
            const isAccepted = q.estado === 'aceptada';
            if (isAccepted) {
              unmarkQuoteDeleted(q.id, q.numero);
            }
            if (isAccepted || !isQuoteDeleted(q.id, q.numero)) {
              allQuotesMap.set(q.id, q);
            } else {
              supabaseService.deleteQuote(q.id, q.numero).catch(() => {});
            }
          }
        });
      }
    } catch (e) {
      console.warn('Supabase getQuotes fallback:', e);
    }

    const rawList = Array.from(allQuotesMap.values());
    const validQuotes = filterOutDeletedQuotes(rawList);

    const dedupedMap = new Map<string, Quote>();
    for (const q of validQuotes) {
      if (!q) continue;
      const numKey = (q.numero?.trim() || '').toLowerCase();
      const idKey = (q.id?.trim() || '').toLowerCase();
      const primaryKey = numKey || idKey;
      if (!primaryKey) continue;

      if (!dedupedMap.has(primaryKey)) {
        dedupedMap.set(primaryKey, { ...q });
      } else {
        const existing = dedupedMap.get(primaryKey)!;
        if (q.estado === 'aceptada' || existing.estado === 'aceptada') {
          existing.estado = 'aceptada';
          if (q.saleId || (q as any).sale_id) {
            existing.saleId = q.saleId || (q as any).sale_id;
          }
        }
        if (existing.id?.startsWith('local_') && !q.id?.startsWith('local_')) {
          existing.id = q.id;
        }
        if (!existing.clientNombre && q.clientNombre) existing.clientNombre = q.clientNombre;
        if ((!existing.items || existing.items.length === 0) && q.items?.length) existing.items = q.items;
      }
    }

    const merged = Array.from(dedupedMap.values()).sort((a, b) => {
      const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
      const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
      return dateB.getTime() - dateA.getTime();
    });

    try {
      localStorage.setItem(cacheKey, JSON.stringify(merged));
      localStorage.setItem('cached_quotes_default', JSON.stringify(merged));
      setLocal('quotes', merged);
    } catch (e) {}

    return merged;
  },

  subscribeToQuotes: (callback: (quotes: Quote[]) => void) => {
    let isUnsubscribed = false;

    const emitCurrent = async () => {
      if (isUnsubscribed) return;
      try {
        const quotes = await inventoryService.getQuotes();
        if (!isUnsubscribed) callback(filterOutDeletedQuotes(quotes));
      } catch (e) {}
    };

    emitCurrent();

    const unsubSupabase = supabaseService.subscribeToQuotes(() => {
      if (!isUnsubscribed) emitCurrent();
    });

    return () => {
      isUnsubscribed = true;
      if (unsubSupabase) unsubSupabase();
    };
  },

  createQuote: async (quoteData: Omit<Quote, 'id' | 'fecha' | 'createdBy' | 'numero'> & { numero?: string }) => {
    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;
    
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const numero = quoteData.numero || `COT-${randomSuffix}`;
    const now = new Date();
    const validezFecha = new Date(now.getTime() + (quoteData.validezDias || 7) * 24 * 60 * 60 * 1000).toISOString();
    const quoteId = generateId('cot');

    const newQuote: Quote = {
      ...quoteData,
      id: quoteId,
      numero,
      validezFecha,
      estado: quoteData.estado || 'pendiente',
      fecha: new Date().toISOString(),
      createdBy: userId
    };

    const saveToCaches = (quote: Quote) => {
      const keys = [cacheKey, 'cached_quotes_user_offline', 'cached_quotes_default', 'quotes', 'sb_cache_quotes'];
      for (const k of keys) {
        try {
          const cached = localStorage.getItem(k);
          const list: Quote[] = cached ? JSON.parse(cached) : [];
          const updated = [quote, ...list.filter(q => q.id !== quote.id && q.numero !== quote.numero)];
          localStorage.setItem(k, JSON.stringify(updated));
        } catch (e) {}
      }
    };

    try {
      await supabaseService.createQuote(newQuote);
    } catch (e) {
      console.warn('Supabase createQuote fallback:', e);
    }

    unmarkQuoteDeleted(quoteId, numero);
    saveToCaches(newQuote);
    return newQuote;
  },

  updateQuote: async (id: string, updates: Partial<Quote>, numero?: string) => {
    let resolvedNumero = numero;
    if (!resolvedNumero) {
      try {
        const cached = localStorage.getItem('quotes');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const found = list.find((q: any) => q && (q.id === id || q.numero === id));
            if (found?.numero) resolvedNumero = found.numero;
          }
        }
      } catch (e) {}
    }

    try {
      if ('updateQuote' in supabaseService) {
        await (supabaseService as any).updateQuote(id, updates, resolvedNumero);
      }
    } catch (e) {}

    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;

    const keys = [cacheKey, 'cached_quotes_user_offline', 'cached_quotes_default', 'quotes', 'sb_cache_quotes'];
    for (const k of keys) {
      try {
        const cached = localStorage.getItem(k);
        if (cached) {
          const list: Quote[] = JSON.parse(cached);
          const updatedList = list.map(q => {
            const matches = q.id === id || 
                            (resolvedNumero && q.numero === resolvedNumero) ||
                            (id && q.numero === id);
            return matches ? { ...q, ...updates } : q;
          });
          localStorage.setItem(k, JSON.stringify(updatedList));
        }
      } catch (e) {}
    }

    try {
      if (id) {
        await supabase.from('quotes').update(updates).eq('id', id);
      }
      if (resolvedNumero) {
        await supabase.from('quotes').update(updates).eq('numero', resolvedNumero);
      }
    } catch (e) {
      console.warn('Direct Supabase quote update warning:', e);
    }
  },

  deleteQuote: async (id: string, numero?: string) => {
    let resolvedNumero = numero;
    if (!resolvedNumero) {
      try {
        const cached = localStorage.getItem('quotes');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const found = list.find((q: any) => q && (q.id === id || q.numero === id));
            if (found?.numero) resolvedNumero = found.numero;
          }
        }
      } catch (e) {}
    }

    markQuoteAsDeleted(id, resolvedNumero);
    scrubQuoteFromLocalStorage(id, resolvedNumero);

    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;
    const keys = [cacheKey, 'cached_quotes_user_offline', 'cached_quotes_default', 'quotes', 'sb_cache_quotes'];
    for (const k of keys) {
      try {
        const cached = localStorage.getItem(k);
        if (cached) {
          const list: Quote[] = JSON.parse(cached);
          if (Array.isArray(list)) {
            const filtered = list.filter(q => q && q.id !== id && (!resolvedNumero || q.numero !== resolvedNumero));
            localStorage.setItem(k, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    }

    try {
      await supabaseService.deleteQuote(id, resolvedNumero);
    } catch (e) {
      console.warn('Supabase deleteQuote fallback:', e);
    }

    try {
      if (id) {
        await supabase.from('quotes').delete().eq('id', id);
        await supabase.from('quotes').delete().eq('numero', id);
      }
      if (resolvedNumero) {
        await supabase.from('quotes').delete().eq('numero', resolvedNumero);
        await supabase.from('quotes').delete().eq('id', resolvedNumero);
      }
    } catch (e) {
      console.warn('Direct Supabase delete warning:', e);
    }
  },

  convertQuoteToSale: async (quote: Quote): Promise<Sale[]> => {
    let items = quote.items || [];
    if (items.length === 0) {
      items = [{
        productId: 'custom_quote_item',
        productNombre: `Cotización ${quote.numero || ''} - ${quote.clientNombre || 'Cliente'}`,
        cantidad: 1,
        precio: Math.max(0, Number(quote.subtotal || (quote.total - (quote.costoEnvio || 0)))) || 0,
        total: Math.max(0, Number(quote.subtotal || (quote.total - (quote.costoEnvio || 0)))) || 0,
        variantId: '',
        variantNombre: ''
      }];
    }

    const baseTxId = generateId('tx');
    const nowIso = new Date().toISOString();
    const cachedProducts = getLocal<Product[]>('products', []);

    const salesToRegister = items.map((item, idx) => {
      const cantidad = Number(item.cantidad) || 1;
      const precio = Number(item.precio) || 0;
      const total = Number(item.total !== undefined ? item.total : (cantidad * precio)) || 0;

      let resolvedProductId = item.productId || 'manual_item';
      if (!resolvedProductId || resolvedProductId.startsWith('manual_') || resolvedProductId.startsWith('custom_')) {
        const cleanName = (item.productNombre || '').toLowerCase().trim();
        const matched = cachedProducts.find(p => {
          const desc = (p.descripcion || '').toLowerCase().trim();
          const code = (p.codigo || '').toLowerCase().trim();
          return (desc && (desc === cleanName || cleanName.includes(desc))) ||
                 (code && (code === cleanName || cleanName.includes(code)));
        });
        if (matched) {
          resolvedProductId = matched.id;
        }
      }

      return {
        id: `${baseTxId}_${idx}`,
        transactionId: baseTxId,
        productId: resolvedProductId,
        productNombre: item.productNombre || 'Artículo de cotización',
        variantId: item.variantId || '',
        variantNombre: item.variantNombre || '',
        personalizacion: (item as any).personalizacion || '',
        cantidad,
        precio,
        total,
        clientId: quote.clientId || '',
        clientNombre: quote.clientNombre || 'Consumidor Final',
        fecha: nowIso,
        costo: 0,
        createdBy: auth.currentUser?.uid || quote.createdBy || 'admin'
      };
    });

    const registered = await inventoryService.registerSale(salesToRegister);

    unmarkQuoteDeleted(quote.id, quote.numero);
    try {
      await inventoryService.updateQuote(quote.id, { 
        estado: 'aceptada',
        saleId: baseTxId 
      }, quote.numero);
    } catch (e) {
      console.warn('Could not update quote state to aceptada:', e);
    }

    try {
      if (quote.id) {
        await supabase.from('quotes').update({ estado: 'aceptada', saleId: baseTxId }).eq('id', quote.id);
      }
      if (quote.numero) {
        await supabase.from('quotes').update({ estado: 'aceptada', saleId: baseTxId }).eq('numero', quote.numero);
      }
    } catch (e) {
      console.warn('Supabase quote state update warning:', e);
    }

    return (registered && registered.length > 0 ? registered : salesToRegister) as Sale[];
  },

  // --- USER PROFILE ---
  getUserProfile: async (): Promise<UserProfile | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    const key = `user_profile_${user.uid}`;
    const cached = getLocal<UserProfile | null>(key, null);
    if (cached) return cached;

    const defaultProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
      email: user.email || '',
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    setLocal(key, defaultProfile);
    return defaultProfile;
  },

  subscribeToUserProfile: (callback: (profile: UserProfile | null) => void) => {
    const user = auth.currentUser;
    if (!user) {
      callback(null);
      return () => {};
    }
    const key = `user_profile_${user.uid}`;
    callback(getLocal<UserProfile | null>(key, {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
      email: user.email || '',
      role: 'admin',
      createdAt: new Date().toISOString()
    }));

    const handler = () => {
      callback(getLocal<UserProfile | null>(key, null));
    };
    window.addEventListener('profile_updated', handler);
    return () => {
      window.removeEventListener('profile_updated', handler);
    };
  },

  updateUserProfile: async (profile: Partial<UserProfile>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const key = `user_profile_${user.uid}`;
    const existing = await inventoryService.getUserProfile();
    const updated = { ...existing, ...profile, uid: user.uid } as UserProfile;
    setLocal(key, updated);
    window.dispatchEvent(new Event('profile_updated'));
  },

  // --- COMBOS ---
  getCombos: async (): Promise<Combo[]> => {
    const user = auth.currentUser;
    const key = user ? `combos_${user.uid}` : 'combos_default';
    return getLocal<Combo[]>(key, []);
  },

  subscribeToCombos: (callback: (combos: Combo[]) => void) => {
    const user = auth.currentUser;
    const key = user ? `combos_${user.uid}` : 'combos_default';
    callback(getLocal<Combo[]>(key, []));

    const handler = () => {
      callback(getLocal<Combo[]>(key, []));
    };
    window.addEventListener('combos_updated', handler);
    return () => {
      window.removeEventListener('combos_updated', handler);
    };
  },

  addCombo: async (combo: Omit<Combo, 'id' | 'createdAt' | 'createdBy'>) => {
    const user = auth.currentUser;
    const key = user ? `combos_${user.uid}` : 'combos_default';
    const id = generateId('combo');
    const newCombo: Combo = {
      ...combo,
      id,
      createdBy: user?.uid || 'admin',
      createdAt: new Date().toISOString()
    };
    const cached = getLocal<Combo[]>(key, []);
    setLocal(key, [newCombo, ...cached]);
    window.dispatchEvent(new Event('combos_updated'));
    return id;
  },

  updateCombo: async (id: string, combo: Partial<Combo>) => {
    const user = auth.currentUser;
    const key = user ? `combos_${user.uid}` : 'combos_default';
    const cached = getLocal<Combo[]>(key, []);
    setLocal(key, cached.map(c => c.id === id ? { ...c, ...combo } : c));
    window.dispatchEvent(new Event('combos_updated'));
  },

  deleteCombo: async (id: string) => {
    const user = auth.currentUser;
    const key = user ? `combos_${user.uid}` : 'combos_default';
    const cached = getLocal<Combo[]>(key, []);
    setLocal(key, cached.filter(c => c.id !== id));
    window.dispatchEvent(new Event('combos_updated'));
  },

  // --- BACKUP & RESTORE ---
  createBackup: async () => {
    const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'goals', 'notifications', 'quotes', 'finances'];
    const backupData: Record<string, any[]> = {};

    for (const coll of collections) {
      backupData[coll] = getLocal<any[]>(coll, []);
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sistema_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  saveBackupToCloud: async () => {
    const user = auth.currentUser;
    const key = user ? `local_backups_${user.uid}` : 'local_backups_default';
    const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'goals', 'notifications', 'quotes', 'finances'];
    const backupData: Record<string, any[]> = {};

    for (const coll of collections) {
      backupData[coll] = getLocal<any[]>(coll, []);
    }

    const newBackup = {
      id: generateId('bck'),
      data: JSON.stringify(backupData),
      fecha: new Date().toISOString(),
      createdBy: user?.uid || 'admin',
      nombre: `Respaldo ${new Date().toLocaleString()}`
    };

    const cached = getLocal<any[]>(key, []);
    setLocal(key, [newBackup, ...cached].slice(0, 10));
    window.dispatchEvent(new Event('backups_updated'));
  },

  getCloudBackups: async (maxResults: number = 10) => {
    const user = auth.currentUser;
    const key = user ? `local_backups_${user.uid}` : 'local_backups_default';
    return getLocal<any[]>(key, []).slice(0, maxResults);
  },

  subscribeToCloudBackups: (callback: (backups: any[]) => void) => {
    const user = auth.currentUser;
    const key = user ? `local_backups_${user.uid}` : 'local_backups_default';
    callback(getLocal<any[]>(key, []).slice(0, 10));

    const handler = () => {
      callback(getLocal<any[]>(key, []).slice(0, 10));
    };
    window.addEventListener('backups_updated', handler);
    return () => {
      window.removeEventListener('backups_updated', handler);
    };
  },

  restoreFromCloud: async (backupId: string) => {
    const user = auth.currentUser;
    const key = user ? `local_backups_${user.uid}` : 'local_backups_default';
    const backups = getLocal<any[]>(key, []);
    const backup = backups.find(b => b.id === backupId);
    if (!backup) throw new Error('Respaldo no encontrado');

    const data = JSON.parse(backup.data);
    for (const [coll, docs] of Object.entries(data)) {
      if (Array.isArray(docs)) {
        setLocal(coll, docs);
      }
    }
    window.location.reload();
  },

  restoreBackup: async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    for (const [coll, docs] of Object.entries(data)) {
      if (Array.isArray(docs)) {
        setLocal(coll, docs);
      }
    }
    window.location.reload();
  },

  resetUserData: async () => {
    const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'notifications', 'goals', 'combos', 'quotes', 'finances', 'cash_audits'];
    for (const coll of collections) {
      setLocal(coll, []);
    }
  },

  // --- SYNC TO SUPABASE ---
  syncAllToSupabase: async () => {
    const products: Product[] = getLocal<Product[]>('products', []);
    const warehouses: Warehouse[] = getLocal<Warehouse[]>('warehouses', []);
    const quotes: Quote[] = filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
    const sales: Sale[] = getLocal<Sale[]>('sales', []);

    return await supabaseService.migrateDataToSupabase({
      products,
      warehouses,
      quotes,
      sales
    });
  }
};
