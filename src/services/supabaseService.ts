/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabase';
import {
  Product,
  Warehouse,
  Movement,
  Sale,
  Purchase,
  Client,
  Supplier,
  Notification,
  Goal,
  FinanceTransaction,
  CashAudit,
  Quote
} from '../types';
import { 
  markQuoteAsDeleted, 
  unmarkQuoteDeleted, 
  isQuoteDeleted, 
  filterOutDeletedQuotes, 
  scrubQuoteFromLocalStorage 
} from '../utils/quoteTombstones';

// Helper for unique ID generation
const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

// Safe local storage cache helper
const getLocal = <T>(key: string, defaultVal: T): T => {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`sb_cache_${key}`);
      return raw ? JSON.parse(raw) : defaultVal;
    }
    return defaultVal;
  } catch {
    return defaultVal;
  }
};

const setLocal = <T>(key: string, val: T): void => {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(`sb_cache_${key}`, JSON.stringify(val));
    }
  } catch (e) {
    // ignore in server context
  }
};

export const supabaseService = {
  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        console.warn('Supabase getProducts warning (fallback to local):', error.message);
        return getLocal<Product[]>('products', []);
      }

      const products = (data || []).map((row: any) => ({
        ...row,
        id: String(row.id),
        cantidad: Number(row.cantidad) || 0,
        precio: Number(row.precio) || 0,
        costo: Number(row.costo) || 0,
        minStock: Number(row.minStock) || 0,
        variants: row.variants || []
      })) as Product[];

      setLocal('products', products);
      return products;
    } catch (e) {
      console.warn('Network error in getProducts:', e);
      return getLocal<Product[]>('products', []);
    }
  },

  addProduct: async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    
    // Get current auth user ID if available
    const { data: authData } = await supabase.auth.getUser();
    const createdBy = authData?.user?.id || 'admin';

    const newProduct: Product = {
      ...productData,
      id,
      createdBy,
      createdAt: now,
      updatedAt: now,
      cantidad: Number(productData.cantidad) || 0,
      precio: Number(productData.precio) || 0,
      costo: Number(productData.costo) || 0,
      minStock: Number(productData.minStock) || 0,
      variants: productData.variants || []
    };

    // Update local cache immediately
    const cached = getLocal<Product[]>('products', []);
    setLocal('products', [newProduct, ...cached]);

    // Persist to Supabase
    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          id: newProduct.id,
          codigo: newProduct.codigo || '',
          descripcion: newProduct.descripcion || '',
          procedencia: newProduct.procedencia || 'Genérico',
          estado: newProduct.estado || 'Nuevo',
          cantidad: newProduct.cantidad,
          precio: newProduct.precio,
          costo: newProduct.costo,
          minStock: newProduct.minStock,
          ubicacion: newProduct.ubicacion || '',
          almacenId: newProduct.almacenId || '',
          talle: newProduct.talle || '',
          genero: newProduct.genero || '',
          imagenUrl: newProduct.imagenUrl || '',
          variants: newProduct.variants || [],
          hasVariants: newProduct.hasVariants || false,
          createdBy: newProduct.createdBy,
          createdAt: now,
          updatedAt: now
        }]);

      if (error) {
        console.warn('Supabase insert product warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase insert product error:', e);
    }

    return id;
  },

  updateProduct: async (id: string, partial: Partial<Product>): Promise<void> => {
    const now = new Date().toISOString();
    
    // Update local cache immediately
    const cached = getLocal<Product[]>('products', []);
    const updated = cached.map(p => p.id === id ? { ...p, ...partial, updatedAt: now } : p);
    setLocal('products', updated);

    // Persist to Supabase
    try {
      const payload: any = { ...partial, updatedAt: now };
      delete payload.id;
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.warn('Supabase update product warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase update product error:', e);
    }
  },

  deleteProduct: async (id: string): Promise<void> => {
    // Update local cache
    const cached = getLocal<Product[]>('products', []);
    setLocal('products', cached.filter(p => p.id !== id));

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Supabase delete product warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase delete product error:', e);
    }
  },

  deleteProductsBatch: async (ids: string[]): Promise<void> => {
    const idSet = new Set(ids);
    const cached = getLocal<Product[]>('products', []);
    setLocal('products', cached.filter(p => !idSet.has(p.id)));

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', ids);

      if (error) {
        console.warn('Supabase batch delete warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase batch delete error:', e);
    }
  },

  // --- WAREHOUSES ---
  getWarehouses: async (): Promise<Warehouse[]> => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        return getLocal<Warehouse[]>('warehouses', [
          { id: 'principal', nombre: 'Almacén Principal', createdBy: 'admin', createdAt: new Date().toISOString() }
        ]);
      }

      const rows = data || [];
      if (rows.length === 0) {
        return getLocal<Warehouse[]>('warehouses', [
          { id: 'principal', nombre: 'Almacén Principal', createdBy: 'admin', createdAt: new Date().toISOString() }
        ]);
      }

      setLocal('warehouses', rows);
      return rows;
    } catch {
      return getLocal<Warehouse[]>('warehouses', []);
    }
  },

  addWarehouse: async (w: Omit<Warehouse, 'id' | 'createdAt' | 'createdBy'>): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    const item: Warehouse = { ...w, id, createdAt: now, createdBy: 'admin' };

    const cached = getLocal<Warehouse[]>('warehouses', []);
    setLocal('warehouses', [...cached, item]);

    try {
      await supabase.from('warehouses').insert([item]);
    } catch (e) {
      console.warn(e);
    }
    return id;
  },

  // --- SALES ---
  getSales: async (limitCount?: number): Promise<Sale[]> => {
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .order('fecha', { ascending: false });

      if (limitCount && limitCount > 0) {
        query = query.limit(limitCount);
      }

      const { data, error } = await query;

      if (error) {
        return getLocal<Sale[]>('sales', []);
      }

      const sales = (data || []).map((row: any) => ({
        ...row,
        cantidad: Number(row.cantidad) || 1,
        precio: Number(row.precio) || 0,
        total: Number(row.total) || 0,
        costo: Number(row.costo) || 0
      })) as Sale[];

      setLocal('sales', sales);
      return sales;
    } catch {
      return getLocal<Sale[]>('sales', []);
    }
  },

  registerSale: async (saleOrSales: any): Promise<void> => {
    const list = Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales];
    const now = new Date().toISOString();

    const formattedSales = list.map(s => ({
      id: s.id || generateId(),
      productId: s.productId || '',
      productNombre: s.productNombre || '',
      variantId: s.variantId || '',
      variantNombre: s.variantNombre || '',
      personalizacion: s.personalizacion || '',
      cantidad: Number(s.cantidad) || 1,
      precio: Number(s.precio) || 0,
      total: Number(s.total) || 0,
      clientId: s.clientId || '',
      clientNombre: s.clientNombre || '',
      transactionId: s.transactionId || generateId(),
      fecha: s.fecha || now,
      createdBy: s.createdBy || 'admin',
      isCombo: Boolean(s.isCombo),
      comboItems: s.comboItems || null,
      costo: Number(s.costo) || 0
    }));

    // Cache locally immediately so the UI sees it instantly
    const cached = getLocal<Sale[]>('sales', []);
    setLocal('sales', [...formattedSales, ...cached]);

    // Deduct stock in local cache and Supabase products (consolidating all lines per product)
    try {
      const cachedProducts = getLocal<Product[]>('products', []);

      // Group deductions by productId to ensure multiple lines for the same product accumulate
      const deductionsByProduct = new Map<string, {
        totalQuantity: number;
        variantDeductions: Record<string, number>;
      }>();

      for (const sale of formattedSales) {
        if (!sale.productId || sale.productId.startsWith('manual_') || sale.productId.startsWith('custom_') || sale.productId === 'quote_item') {
          continue;
        }
        const existing = deductionsByProduct.get(sale.productId) || {
          totalQuantity: 0,
          variantDeductions: {}
        };
        existing.totalQuantity += sale.cantidad;
        if (sale.variantId) {
          existing.variantDeductions[sale.variantId] = (existing.variantDeductions[sale.variantId] || 0) + sale.cantidad;
        }
        deductionsByProduct.set(sale.productId, existing);
      }

      let productsList = cachedProducts;
      if (!productsList || productsList.length === 0) {
        const { data: dbProds } = await supabase.from('products').select('*');
        if (dbProds && dbProds.length > 0) {
          productsList = dbProds;
        }
      }

      for (const [productId, deduction] of deductionsByProduct.entries()) {
        let prod = productsList.find(p => p.id === productId);
        if (!prod) {
          const { data: singleProd } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
          if (singleProd) prod = singleProd;
        }

        if (prod) {
          const newTotal = Math.max(0, (prod.cantidad || 0) - deduction.totalQuantity);
          let newVariants = prod.variants;
          if (prod.variants?.length) {
            newVariants = prod.variants.map(v => {
              const varDeduct = deduction.variantDeductions[v.id] || 0;
              return varDeduct > 0 ? { ...v, cantidad: Math.max(0, (v.cantidad || 0) - varDeduct) } : v;
            });
          }
          await supabaseService.updateProduct(productId, {
            cantidad: newTotal,
            variants: newVariants
          });
          prod.cantidad = newTotal;
          prod.variants = newVariants;
        }
      }

      // Persist updated product cache so UI reflects the deduction immediately
      setLocal('products', cachedProducts);
      setLocal('sb_cache_products', cachedProducts);
    } catch (e) {
      console.warn('Error updating product stock after sale:', e);
    }

    // Persist to Supabase
    try {
      const dbSales = formattedSales.map(s => {
        const { personalizacion, ...rest } = s as any;
        return rest;
      });
      const { error } = await supabase.from('sales').insert(dbSales);
      if (error) {
        console.warn('Supabase sale insert warning:', error);
      }
    } catch (e) {
      console.warn('Supabase sale insert warning:', e);
    }
  },

  updateSale: async (id: string, data: Partial<Sale>): Promise<void> => {
    // 1. Update local cache
    const cached = getLocal<Sale[]>('sales', []);
    const updated = cached.map(s => s.id === id ? { ...s, ...data } : s);
    setLocal('sales', updated);

    // 2. Persist to Supabase table
    try {
      await supabase.from('sales').update(data).eq('id', id);
    } catch (e) {
      console.warn('Supabase updateSale error:', e);
    }
  },

  assignSalesToClient: async (saleIds: string[], client: { id: string; nombre: string }): Promise<void> => {
    if (!saleIds.length) return;
    const saleIdsSet = new Set(saleIds);
    const cached = getLocal<Sale[]>('sales', []);
    const updated = cached.map(s => saleIdsSet.has(s.id) ? { ...s, clientId: client.id, clientNombre: client.nombre } : s);
    setLocal('sales', updated);

    try {
      await supabase.from('sales').update({
        clientId: client.id,
        clientNombre: client.nombre
      }).in('id', saleIds);
    } catch (e) {
      console.warn('Supabase assignSalesToClient error:', e);
    }
  },

  deleteSale: async (id: string): Promise<void> => {
    // 1. Remove from local cache immediately
    const cached = getLocal<Sale[]>('sales', []);
    const saleToDelete = cached.find(s => s.id === id || (s as any).transactionId === id);
    setLocal('sales', cached.filter(s => s.id !== id && (s as any).transactionId !== id));

    // 2. Restore stock in local cache and supabase
    if (saleToDelete) {
      try {
        if (saleToDelete.isCombo && saleToDelete.comboItems) {
          for (const item of saleToDelete.comboItems) {
            const cachedProducts = getLocal<Product[]>('products', []);
            const prod = cachedProducts.find(p => p.id === item.productId);
            if (prod) {
              const newQty = (prod.cantidad || 0) + item.cantidad;
              await supabaseService.updateProduct(item.productId, { cantidad: newQty });
            }
          }
        } else if (saleToDelete.productId && saleToDelete.productId !== 'combo') {
          const cachedProducts = getLocal<Product[]>('products', []);
          const prod = cachedProducts.find(p => p.id === saleToDelete.productId);
          if (prod) {
            const newQty = (prod.cantidad || 0) + saleToDelete.cantidad;
            let newVariants = prod.variants;
            if (saleToDelete.variantId && prod.variants?.length) {
              newVariants = prod.variants.map(v => 
                v.id === saleToDelete.variantId ? { ...v, cantidad: (v.cantidad || 0) + saleToDelete.cantidad } : v
              );
            }
            await supabaseService.updateProduct(saleToDelete.productId, {
              cantidad: newQty,
              variants: newVariants
            });
          }
        }
      } catch (e) {
        console.warn('Error restoring stock on supabase deleteSale:', e);
      }
    }

    // 3. Delete from Supabase table by ID or transactionId
    try {
      await supabase.from('sales').delete().or(`id.eq.${id},transactionId.eq.${id}`);
    } catch (e) {
      console.warn('Supabase deleteSale error:', e);
    }
  },

  bulkDeleteSales: async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const cached = getLocal<Sale[]>('sales', []);
    setLocal('sales', cached.filter(s => !idSet.has(s.id) && !idSet.has((s as any).transactionId)));

    for (const id of ids) {
      await supabaseService.deleteSale(id);
    }
  },

  // --- PURCHASES ---
  registerPurchase: async (purchaseData: {
    productId: string;
    productNombre: string;
    variantId?: string;
    variantNombre?: string;
    cantidad: number;
    costo: number;
    proveedor?: string;
    notas?: string;
  }): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    const total = (Number(purchaseData.costo) || 0) * (Number(purchaseData.cantidad) || 1);
    const purchaseItem: Purchase = {
      id,
      productId: purchaseData.productId,
      productNombre: purchaseData.productNombre,
      variantId: purchaseData.variantId,
      variantNombre: purchaseData.variantNombre,
      cantidad: purchaseData.cantidad,
      costo: purchaseData.costo,
      total,
      proveedor: purchaseData.proveedor || 'General',
      fecha: now.split('T')[0],
      createdBy: 'admin'
    };

    const cached = getLocal<Purchase[]>('purchases', []);
    setLocal('purchases', [purchaseItem, ...cached]);

    try {
      await supabase.from('purchases').insert([purchaseItem]);
    } catch (e) {
      console.warn('Supabase registerPurchase error:', e);
    }

    try {
      const cachedProducts = getLocal<Product[]>('products', []);
      const prod = cachedProducts.find(p => p.id === purchaseData.productId);
      if (prod) {
        const newQty = (prod.cantidad || 0) + purchaseData.cantidad;
        let newVariants = prod.variants;
        if (purchaseData.variantId && prod.variants?.length) {
          newVariants = prod.variants.map(v =>
            v.id === purchaseData.variantId ? { ...v, cantidad: (v.cantidad || 0) + purchaseData.cantidad } : v
          );
        }
        await supabaseService.updateProduct(purchaseData.productId, {
          cantidad: newQty,
          variants: newVariants
        });
      }
    } catch (e) {
      console.warn('Error updating product stock in registerPurchase:', e);
    }

    return id;
  },

  getPurchases: async (limitCount?: number): Promise<Purchase[]> => {
    try {
      let query = supabase
        .from('purchases')
        .select('*')
        .order('fecha', { ascending: false });

      if (limitCount && limitCount > 0) {
        query = query.limit(limitCount);
      }

      const { data, error } = await query;

      if (error) {
        return getLocal<Purchase[]>('purchases', []);
      }

      const purchases = (data || []).map((row: any) => ({
        ...row,
        cantidad: Number(row.cantidad) || 1,
        costo: Number(row.costo) || 0,
        total: Number(row.total) || 0
      })) as Purchase[];

      setLocal('purchases', purchases);
      return purchases;
    } catch {
      return getLocal<Purchase[]>('purchases', []);
    }
  },

  deletePurchase: async (id: string): Promise<void> => {
    // 1. Remove from local cache
    const cached = getLocal<Purchase[]>('purchases', []);
    const purchaseToDelete = cached.find(p => p.id === id);
    setLocal('purchases', cached.filter(p => p.id !== id));

    // 2. Reduce stock in local cache and supabase
    if (purchaseToDelete && purchaseToDelete.productId) {
      try {
        const cachedProducts = getLocal<Product[]>('products', []);
        const prod = cachedProducts.find(p => p.id === purchaseToDelete.productId);
        if (prod) {
          const newQty = Math.max(0, (prod.cantidad || 0) - purchaseToDelete.cantidad);
          let newVariants = prod.variants;
          if (purchaseToDelete.variantId && prod.variants?.length) {
            newVariants = prod.variants.map(v => 
              v.id === purchaseToDelete.variantId ? { ...v, cantidad: Math.max(0, (v.cantidad || 0) - purchaseToDelete.cantidad) } : v
            );
          }
          await supabaseService.updateProduct(purchaseToDelete.productId, {
            cantidad: newQty,
            variants: newVariants
          });
        }
      } catch (e) {
        console.warn('Error adjusting stock on supabase deletePurchase:', e);
      }
    }

    // 3. Delete from Supabase table
    try {
      await supabase.from('purchases').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase deletePurchase error:', e);
    }
  },

  // --- QUOTES / PRESUPUESTOS ---
  getQuotes: async (): Promise<Quote[]> => {
    try {
      let localQuotes = filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
      if (!localQuotes || localQuotes.length === 0) {
        try {
          const altKeys = ['cached_quotes_user_offline', 'cached_quotes_default', 'cached_quotes_anon', 'sb_cache_quotes'];
          for (const k of altKeys) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                localQuotes = filterOutDeletedQuotes(parsed);
                break;
              }
            }
          }
        } catch (e) {}
      }

      const dedupedQuotesMap = new Map<string, Quote>();

      // 1. Seed with local cache first to ensure offline/recent quotes are never wiped out
      for (const lq of localQuotes) {
        if (!lq || lq.id?.startsWith('_app_') || (lq.estado as string) === 'sistema' || lq.clientNombre === 'SYS_CLIENTS') continue;
        const key = (lq.numero?.trim() || lq.id?.trim() || '').toLowerCase();
        if (key) dedupedQuotesMap.set(key, { ...lq });
      }

      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) {
        console.warn('Supabase quotes warning (using cache):', error.message);
        return Array.from(dedupedQuotesMap.values());
      }

      // 2. Merge remote quotes from Supabase
      const validRows = filterOutDeletedQuotes(data || []);
      for (const row of validRows) {
        if (!row || row.id?.startsWith('_app_') || (row.estado as string) === 'sistema' || row.clientNombre === 'SYS_CLIENTS') continue;
        let shipping = Number(row.costoEnvio || row.costo_envio || 0);
        if (!shipping && row.condiciones) {
          try {
            const parsed = typeof row.condiciones === 'string' ? JSON.parse(row.condiciones) : row.condiciones;
            if (parsed && typeof parsed.costoEnvio === 'number') {
              shipping = parsed.costoEnvio;
            }
          } catch (e) {}
        }
        const q: Quote = {
          ...row,
          items: Array.isArray(row.items) ? row.items : [],
          subtotal: Number(row.subtotal) || 0,
          total: Number(row.total) || 0,
          descuento: Number(row.descuento) || 0,
          costoEnvio: shipping
        };

        const key = (q.numero?.trim() || q.id?.trim() || '').toLowerCase();
        if (!key) continue;

        if (!dedupedQuotesMap.has(key)) {
          dedupedQuotesMap.set(key, q);
        } else {
          const existing = dedupedQuotesMap.get(key)!;
          // CRITICAL: If either copy is accepted, it stays accepted forever
          if (q.estado === 'aceptada' || existing.estado === 'aceptada') {
            existing.estado = 'aceptada';
            if (q.saleId || (q as any).sale_id) existing.saleId = q.saleId || (q as any).sale_id;
          }
          if (existing.id?.startsWith('local_') && !q.id?.startsWith('local_')) {
            existing.id = q.id;
          }
          if ((!existing.items || existing.items.length === 0) && q.items?.length) {
            existing.items = q.items;
          }
        }
      }

      const dedupedList = Array.from(dedupedQuotesMap.values()).sort((a, b) => {
        const dateA = new Date(a.fecha || 0).getTime();
        const dateB = new Date(b.fecha || 0).getTime();
        return dateB - dateA;
      });

      setLocal('quotes', dedupedList);

      // 3. Auto-heal: if any local quote wasn't in Supabase yet, upsert it
      const remoteIds = new Set((validRows || []).map((r: any) => (r.id || '').toLowerCase()));
      const remoteNums = new Set((validRows || []).map((r: any) => (r.numero || '').toLowerCase()));
      for (const item of dedupedList) {
        if (!remoteIds.has(item.id.toLowerCase()) && (!item.numero || !remoteNums.has(item.numero.toLowerCase()))) {
          supabaseService.createQuote(item).catch(() => {});
        }
      }

      return dedupedList;
    } catch {
      return filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
    }
  },

  createQuote: async (quoteData: any): Promise<Quote> => {
    const id = quoteData.id || generateId();
    const now = new Date().toISOString();
    const count = (getLocal<Quote[]>('quotes', []).length + 1).toString().padStart(4, '0');
    const numero = quoteData.numero || `COT-${count}`;
    const costoEnvio = Number(quoteData.costoEnvio) || 0;

    unmarkQuoteDeleted(id, numero);

    const newQuote: Quote = {
      ...quoteData,
      id,
      numero,
      fecha: quoteData.fecha || now,
      subtotal: Number(quoteData.subtotal || quoteData.total || 0),
      total: Number(quoteData.total || 0),
      descuento: Number(quoteData.descuento || 0),
      costoEnvio,
      validezDias: Number(quoteData.validezDias || 7),
      estado: quoteData.estado || 'pendiente',
      items: quoteData.items || [],
      clientNombre: quoteData.clientNombre || 'Consumidor Final',
      createdBy: quoteData.createdBy || 'admin'
    };

    // Cache locally immediately across all arrays
    const cached = filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
    setLocal('quotes', [newQuote, ...cached.filter(q => q.id !== id && q.numero !== numero)]);

    // Persist to Supabase with upsert to prevent duplicates or constraint failures
    try {
      const payload: any = {
        id: newQuote.id,
        numero: newQuote.numero,
        clientId: newQuote.clientId || null,
        clientNombre: newQuote.clientNombre,
        clientTelefono: newQuote.clientTelefono || null,
        clientEmail: newQuote.clientEmail || null,
        items: newQuote.items,
        subtotal: newQuote.subtotal,
        descuento: newQuote.descuento,
        total: newQuote.total,
        fecha: newQuote.fecha,
        validezDias: newQuote.validezDias,
        validezFecha: newQuote.validezFecha || null,
        estado: newQuote.estado,
        notas: newQuote.notas || null,
        condiciones: newQuote.condiciones || (costoEnvio > 0 ? JSON.stringify({ costoEnvio }) : null),
        createdBy: newQuote.createdBy,
        saleId: newQuote.saleId || null
      };

      const { error } = await supabase.from('quotes').upsert([payload], { onConflict: 'id' });
      if (error) {
        console.warn('Supabase quote upsert warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase quote upsert network exception:', e);
    }

    return newQuote;
  },

  deleteQuote: async (id: string, numero?: string): Promise<void> => {
    // 1. Mark in tombstones & scrub from local caches
    markQuoteAsDeleted(id, numero);
    scrubQuoteFromLocalStorage(id, numero);

    const cached = getLocal<Quote[]>('quotes', []);
    setLocal('quotes', cached.filter(q => q.id !== id && (!numero || q.numero !== numero)));

    try {
      if (id) {
        await supabase.from('quotes').delete().eq('id', id);
        await supabase.from('quotes').delete().eq('numero', id);
      }
      if (numero) {
        await supabase.from('quotes').delete().eq('numero', numero);
        await supabase.from('quotes').delete().eq('id', numero);
      }
    } catch (e) {
      console.warn('Supabase deleteQuote error:', e);
    }
  },

  updateQuote: async (id: string, updates: Partial<Quote>, numero?: string): Promise<void> => {
    if (updates.estado === 'aceptada' || (updates.estado as any) === 'aprobado') {
      unmarkQuoteDeleted(id, numero);
    }
    const cached = getLocal<Quote[]>('quotes', []);
    setLocal('quotes', cached.map(q => (q.id === id || (numero && q.numero === numero)) ? { ...q, ...updates } : q));

    try {
      if (id) {
        await supabase.from('quotes').update(updates).eq('id', id);
      }
      if (numero) {
        await supabase.from('quotes').update(updates).eq('numero', numero);
      }
    } catch (e) {
      console.warn('Supabase updateQuote error:', e);
    }
  },

  subscribeToQuotes: (onData: (quotes: Quote[]) => void): (() => void) => {
    supabaseService.getQuotes().then(onData);

    const channelName = 'sb_rt_quotes_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, async () => {
        const fresh = await supabaseService.getQuotes();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToSales: (onData: (sales: Sale[]) => void): (() => void) => {
    supabaseService.getSales(30).then(onData);

    const channelName = 'sb_rt_sales_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async () => {
        const fresh = await supabaseService.getSales(30);
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // --- CLIENTS ---
  syncClientsToCloud: async (clients: Client[]): Promise<void> => {
    if (!Array.isArray(clients)) return;
    try {
      await supabase.from('quotes').upsert([{
        id: '_app_clients_registry',
        numero: 'SYS-CLIENTS-REGISTRY',
        clientNombre: 'SYS_CLIENTS',
        items: clients,
        total: clients.length,
        estado: 'sistema',
        fecha: new Date().toISOString()
      }]);
    } catch (e) {
      console.warn('Sync clients to cloud warning:', e);
    }
  },

  getClients: async (): Promise<Client[]> => {
    const clientsMap = new Map<string, Client>();

    // 1. Initial local cache
    const cached = getLocal<Client[]>('clients', []);
    if (Array.isArray(cached)) {
      cached.forEach(c => {
        if (c && (c.id || c.nombre)) {
          clientsMap.set((c.nombre || c.id).trim().toLowerCase(), c);
        }
      });
    }

    // 2. Try Supabase dedicated table if it exists
    try {
      const { data, error } = await supabase.from('clients').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach(c => {
          if (c && (c.id || c.nombre)) {
            clientsMap.set((c.nombre || c.id).trim().toLowerCase(), c);
          }
        });
      }
    } catch (e) {}

    // 3. Fallback: Cloud registry in Supabase (_app_clients_registry)
    try {
      const { data: reg, error: regErr } = await supabase
        .from('quotes')
        .select('items')
        .eq('id', '_app_clients_registry')
        .single();
      if (!regErr && reg && Array.isArray(reg.items)) {
        reg.items.forEach((c: Client) => {
          if (c && (c.id || c.nombre)) {
            const key = (c.nombre || c.id).trim().toLowerCase();
            const existing = clientsMap.get(key);
            if (!existing) {
              clientsMap.set(key, c);
            } else {
              clientsMap.set(key, { ...c, ...existing });
            }
          }
        });
      }
    } catch (e) {}

    // 4. Auto-discover known clients from Supabase quotes and sales
    try {
      const { data: quotes } = await supabase.from('quotes').select('id, clientId, clientNombre, clientTelefono, clientEmail, fecha');
      (quotes || []).forEach(q => {
        if (!q.clientNombre || q.id === '_app_clients_registry' || q.clientNombre === 'SYS_CLIENTS') return;
        const name = q.clientNombre.trim();
        if (!name || name.toLowerCase() === 'consumidor final' || name.toLowerCase() === 'system_sync') return;
        const key = name.toLowerCase();
        const existing = clientsMap.get(key);
        if (!existing) {
          clientsMap.set(key, {
            id: q.clientId || ('cli_' + Math.random().toString(36).substring(2, 9)),
            nombre: name,
            telefono: q.clientTelefono || '',
            email: q.clientEmail || '',
            direccion: '',
            createdAt: q.fecha || new Date().toISOString(),
            createdBy: 'admin'
          });
        } else {
          if (!existing.telefono && q.clientTelefono) existing.telefono = q.clientTelefono;
          if (!existing.email && q.clientEmail) existing.email = q.clientEmail;
          if ((!existing.id || existing.id.startsWith('cli_')) && q.clientId) existing.id = q.clientId;
        }
      });
    } catch (e) {}

    try {
      const { data: sales } = await supabase.from('sales').select('clientId, clientNombre, fecha');
      (sales || []).forEach(s => {
        if (!s.clientNombre) return;
        const name = s.clientNombre.trim();
        if (!name || name.toLowerCase() === 'consumidor final') return;
        const key = name.toLowerCase();
        if (!clientsMap.has(key)) {
          clientsMap.set(key, {
            id: s.clientId || ('cli_' + Math.random().toString(36).substring(2, 9)),
            nombre: name,
            telefono: '',
            email: '',
            direccion: '',
            createdAt: s.fecha || new Date().toISOString(),
            createdBy: 'admin'
          });
        }
      });
    } catch (e) {}

    const list = Array.from(clientsMap.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    setLocal('clients', list);

    // Keep cloud registry up to date
    if (list.length > 0) {
      supabaseService.syncClientsToCloud(list).catch(() => {});
    }

    return list;
  },

  addClient: async (client: Omit<Client, 'id' | 'createdAt' | 'createdBy'>): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    const item: Client = { ...client, id, createdAt: now, createdBy: 'admin' };

    const cached = getLocal<Client[]>('clients', []);
    const updated = [item, ...cached.filter(c => c.id !== id && c.nombre.toLowerCase() !== item.nombre.toLowerCase())];
    setLocal('clients', updated);
    window.dispatchEvent(new Event('clients_updated'));

    try {
      await supabase.from('clients').insert([item]);
    } catch (e) {}

    supabaseService.syncClientsToCloud(updated).catch(() => {});

    return id;
  },

  updateClient: async (id: string, client: Partial<Client>): Promise<void> => {
    const cached = getLocal<Client[]>('clients', []);
    const updated = cached.map(c => c.id === id ? { ...c, ...client } : c);
    setLocal('clients', updated);
    window.dispatchEvent(new Event('clients_updated'));

    try {
      await supabase.from('clients').update(client).eq('id', id);
    } catch (e) {}

    supabaseService.syncClientsToCloud(updated).catch(() => {});
  },

  deleteClient: async (id: string): Promise<void> => {
    const cached = getLocal<Client[]>('clients', []);
    const updated = cached.filter(c => c.id !== id);
    setLocal('clients', updated);
    window.dispatchEvent(new Event('clients_updated'));

    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch (e) {}

    supabaseService.syncClientsToCloud(updated).catch(() => {});
  },

  importClientsFromVercel: async (rawInput: any): Promise<{ added: number; total: number }> => {
    let clientsToImport: any[] = [];
    if (typeof rawInput === 'string') {
      try {
        const parsed = JSON.parse(rawInput);
        clientsToImport = Array.isArray(parsed) ? parsed : (parsed.clients || []);
      } catch (e) {
        throw new Error('El formato no es un JSON válido.');
      }
    } else if (Array.isArray(rawInput)) {
      clientsToImport = rawInput;
    } else if (rawInput && Array.isArray(rawInput.clients)) {
      clientsToImport = rawInput.clients;
    }

    if (!Array.isArray(clientsToImport) || clientsToImport.length === 0) {
      throw new Error('No se detectaron clientes en los datos provistos.');
    }

    const currentClients = getLocal<Client[]>('clients', []);
    const map = new Map<string, Client>();
    currentClients.forEach(c => {
      if (c && (c.id || c.nombre)) {
        map.set((c.nombre || c.id).trim().toLowerCase(), c);
      }
    });

    let addedCount = 0;
    clientsToImport.forEach(item => {
      if (!item || !item.nombre) return;
      const key = item.nombre.trim().toLowerCase();
      if (!map.has(key)) {
        const newClient: Client = {
          id: item.id || ('cli_' + Math.random().toString(36).substring(2, 9)),
          nombre: item.nombre.trim(),
          telefono: item.telefono || '',
          email: item.email || '',
          direccion: item.direccion || '',
          createdAt: item.createdAt || new Date().toISOString(),
          createdBy: item.createdBy || 'admin'
        };
        map.set(key, newClient);
        addedCount++;
      } else {
        const curr = map.get(key)!;
        if (!curr.telefono && item.telefono) curr.telefono = item.telefono;
        if (!curr.email && item.email) curr.email = item.email;
        if (!curr.direccion && item.direccion) curr.direccion = item.direccion;
      }
    });

    const mergedList = Array.from(map.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    setLocal('clients', mergedList);
    window.dispatchEvent(new Event('clients_updated'));

    await supabaseService.syncClientsToCloud(mergedList);

    return { added: addedCount, total: mergedList.length };
  },

  // --- SUPPLIERS ---
  getSuppliers: async (): Promise<Supplier[]> => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (error) return getLocal<Supplier[]>('suppliers', []);
      setLocal('suppliers', data || []);
      return data || [];
    } catch {
      return getLocal<Supplier[]>('suppliers', []);
    }
  },

  // --- FINANCES ---
  getFinances: async (): Promise<FinanceTransaction[]> => {
    try {
      const { data, error } = await supabase.from('finances').select('*').order('fecha', { ascending: false });
      if (error) return getLocal<FinanceTransaction[]>('finances', []);
      const formatted = (data || []).map((row: any) => ({
        ...row,
        monto: Number(row.monto) || 0
      })) as FinanceTransaction[];
      setLocal('finances', formatted);
      return formatted;
    } catch {
      return getLocal<FinanceTransaction[]>('finances', []);
    }
  },

  addFinance: async (transaction: Omit<FinanceTransaction, 'id' | 'createdAt' | 'createdBy'> & { id?: string }): Promise<string> => {
    const id = transaction.id || generateId();
    const now = new Date().toISOString();
    const item: FinanceTransaction = {
      ...transaction,
      id,
      monto: Number(transaction.monto) || 0,
      createdAt: now,
      createdBy: 'admin'
    };

    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', [item, ...cached.filter(f => f.id !== id)]);

    try {
      const { error } = await supabase.from('finances').insert([item]);
      if (error) console.warn('Supabase addFinance warning:', error.message);
    } catch (e) {
      console.warn('Supabase addFinance network exception:', e);
    }
    return id;
  },

  updateFinance: async (id: string, updates: Partial<FinanceTransaction>): Promise<void> => {
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.map(f => f.id === id ? { ...f, ...updates } : f));

    try {
      const { error } = await supabase.from('finances').update(updates).eq('id', id);
      if (error) console.warn('Supabase updateFinance warning:', error.message);
    } catch (e) {
      console.warn('Supabase updateFinance network exception:', e);
    }
  },

  deleteFinance: async (id: string): Promise<void> => {
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.filter(f => f.id !== id));

    try {
      const { error } = await supabase.from('finances').delete().eq('id', id);
      if (error) console.warn('Supabase deleteFinance warning:', error.message);
    } catch (e) {
      console.warn('Supabase deleteFinance network exception:', e);
    }
  },

  bulkDeleteFinances: async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids);
    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', cached.filter(f => !idsSet.has(f.id)));

    try {
      const { error } = await supabase.from('finances').delete().in('id', ids);
      if (error) console.warn('Supabase bulkDeleteFinances warning:', error.message);
    } catch (e) {
      console.warn('Supabase bulkDeleteFinances network exception:', e);
    }
  },

  subscribeToFinances: (onData: (finances: FinanceTransaction[]) => void): (() => void) => {
    supabaseService.getFinances().then(onData);

    const channelName = 'sb_rt_finances_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, async () => {
        const fresh = await supabaseService.getFinances();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToPurchases: (onData: (purchases: Purchase[]) => void): (() => void) => {
    supabaseService.getPurchases().then(onData);

    const channelName = 'sb_rt_purchases_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, async () => {
        const fresh = await supabaseService.getPurchases();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToProducts: (onData: (products: Product[]) => void): (() => void) => {
    supabaseService.getProducts().then(onData);

    const channelName = 'sb_rt_products_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const fresh = await supabaseService.getProducts();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToClients: (onData: (clients: Client[]) => void): (() => void) => {
    supabaseService.getClients().then(onData);

    const channelName = 'sb_rt_clients_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, async () => {
        const fresh = await supabaseService.getClients();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToSuppliers: (onData: (suppliers: Supplier[]) => void): (() => void) => {
    supabaseService.getSuppliers().then(onData);

    const channelName = 'sb_rt_suppliers_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, async () => {
        const fresh = await supabaseService.getSuppliers();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToWarehouses: (onData: (warehouses: Warehouse[]) => void): (() => void) => {
    supabaseService.getWarehouses().then(onData);

    const channelName = 'sb_rt_warehouses_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, async () => {
        const fresh = await supabaseService.getWarehouses();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToMovements: (onData: (movements: Movement[]) => void): (() => void) => {
    supabaseService.getMovements().then(onData);

    const channelName = 'sb_rt_movements_' + Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, async () => {
        const fresh = await supabaseService.getMovements();
        onData(fresh);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // --- MOVEMENTS ---
  getMovements: async (): Promise<Movement[]> => {
    try {
      const { data, error } = await supabase.from('movements').select('*').order('fecha', { ascending: false });
      if (error) return getLocal<Movement[]>('movements', []);
      setLocal('movements', data || []);
      return data || [];
    } catch {
      return getLocal<Movement[]>('movements', []);
    }
  },

  // --- MIGRATION / SYNC ALL DATA TO SUPABASE ---
  migrateDataToSupabase: async (data: {
    products?: Product[];
    quotes?: Quote[];
    warehouses?: Warehouse[];
    sales?: Sale[];
    clients?: Client[];
  }): Promise<{ productsMigrated: number; quotesMigrated: number; warehousesMigrated: number; salesMigrated: number; clientsMigrated?: number }> => {
    let productsMigrated = 0;
    let quotesMigrated = 0;
    let warehousesMigrated = 0;
    let salesMigrated = 0;

    // 1. Products
    if (data.products && data.products.length > 0) {
      const sanitizedProducts = data.products.map(p => ({
        id: String(p.id),
        codigo: p.codigo || '',
        procedencia: p.procedencia || 'Genérico',
        estado: p.estado || 'Nuevo',
        cantidad: Number(p.cantidad) || 0,
        descripcion: p.descripcion || '',
        ubicacion: p.ubicacion || '',
        almacenId: p.almacenId || '',
        precio: Number(p.precio) || 0,
        costo: Number(p.costo) || 0,
        minStock: Number(p.minStock) || 0,
        talle: p.talle || '',
        genero: p.genero || '',
        imagenUrl: p.imagenUrl || '',
        variants: Array.isArray(p.variants) ? p.variants : [],
        hasVariants: Boolean(p.hasVariants),
        createdBy: p.createdBy || 'admin',
        createdAt: (p.createdAt as any)?.toDate ? (p.createdAt as any).toDate().toISOString() : (p.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString()
      }));

      for (let i = 0; i < sanitizedProducts.length; i += 50) {
        const chunk = sanitizedProducts.slice(i, i + 50);
        const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
        if (!error) {
          productsMigrated += chunk.length;
        } else {
          console.warn('Error migrating products chunk to Supabase:', error);
        }
      }
      setLocal('products', sanitizedProducts);
    }

    // 2. Warehouses
    if (data.warehouses && data.warehouses.length > 0) {
      const sanitizedWarehouses = data.warehouses.map(w => ({
        id: String(w.id),
        nombre: w.nombre || '',
        descripcion: w.descripcion || '',
        ubicacion: w.ubicacion || '',
        createdBy: w.createdBy || 'admin',
        createdAt: (w.createdAt as any)?.toDate ? (w.createdAt as any).toDate().toISOString() : (w.createdAt || new Date().toISOString())
      }));

      const { error } = await supabase.from('warehouses').upsert(sanitizedWarehouses, { onConflict: 'id' });
      if (!error) warehousesMigrated = sanitizedWarehouses.length;
      setLocal('warehouses', sanitizedWarehouses);
    }

    // 3. Quotes
    if (data.quotes && data.quotes.length > 0) {
      const sanitizedQuotes = data.quotes.map(q => ({
        id: String(q.id),
        numero: q.numero || '',
        clientId: q.clientId || '',
        clientNombre: q.clientNombre || '',
        clientTelefono: q.clientTelefono || '',
        clientEmail: q.clientEmail || '',
        items: q.items || [],
        subtotal: Number(q.subtotal) || 0,
        descuento: Number(q.descuento) || 0,
        total: Number(q.total) || 0,
        fecha: (q.fecha as any)?.toDate ? (q.fecha as any).toDate().toISOString() : (q.fecha || new Date().toISOString()),
        validezDias: Number(q.validezDias) || 7,
        validezFecha: q.validezFecha || '',
        estado: q.estado || 'pendiente',
        notas: q.notas || '',
        condiciones: q.condiciones || '',
        createdBy: q.createdBy || 'admin',
        saleId: q.saleId || null
      }));

      for (let i = 0; i < sanitizedQuotes.length; i += 50) {
        const chunk = sanitizedQuotes.slice(i, i + 50);
        const { error } = await supabase.from('quotes').upsert(chunk, { onConflict: 'id' });
        if (!error) quotesMigrated += chunk.length;
      }
      setLocal('quotes', sanitizedQuotes);
    }

    // 4. Sales
    if (data.sales && data.sales.length > 0) {
      const sanitizedSales = data.sales.map(s => ({
        id: String(s.id),
        productId: s.productId || '',
        productNombre: s.productNombre || '',
        variantId: s.variantId || '',
        variantNombre: s.variantNombre || '',
        cantidad: Number(s.cantidad) || 1,
        precio: Number(s.precio) || 0,
        total: Number(s.total) || 0,
        clientId: s.clientId || '',
        clientNombre: s.clientNombre || '',
        transactionId: s.transactionId || '',
        fecha: (s.fecha as any)?.toDate ? (s.fecha as any).toDate().toISOString() : (s.fecha || new Date().toISOString()),
        createdBy: s.createdBy || 'admin',
        isCombo: Boolean(s.isCombo),
        comboItems: s.comboItems || null,
        costo: Number(s.costo) || 0
      }));

      for (let i = 0; i < sanitizedSales.length; i += 50) {
        const chunk = sanitizedSales.slice(i, i + 50);
        const { error } = await supabase.from('sales').upsert(chunk, { onConflict: 'id' });
        if (!error) salesMigrated += chunk.length;
      }
      setLocal('sales', sanitizedSales);
    }

    // 5. Clients
    let clientsMigrated = 0;
    if (data.clients && data.clients.length > 0) {
      try {
        await supabaseService.syncClientsToCloud(data.clients);
        clientsMigrated = data.clients.length;
      } catch (e) {}
    }

    return { productsMigrated, quotesMigrated, warehousesMigrated, salesMigrated, clientsMigrated };
  }
};
