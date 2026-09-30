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
      const { error } = await supabase.from('sales').insert(formattedSales);
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
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) {
        console.warn('Supabase quotes warning (using cache):', error.message);
        return filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
      }

      const validRows = filterOutDeletedQuotes(data || []);
      const quotes = validRows.map((q: any) => {
        let shipping = Number(q.costoEnvio || q.costo_envio || 0);
        if (!shipping && q.condiciones) {
          try {
            const parsed = typeof q.condiciones === 'string' ? JSON.parse(q.condiciones) : q.condiciones;
            if (parsed && typeof parsed.costoEnvio === 'number') {
              shipping = parsed.costoEnvio;
            }
          } catch (e) {}
        }
        return {
          ...q,
          items: q.items || [],
          subtotal: Number(q.subtotal) || 0,
          total: Number(q.total) || 0,
          descuento: Number(q.descuento) || 0,
          costoEnvio: shipping
        };
      }) as Quote[];

      setLocal('quotes', quotes);
      return quotes;
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
      fecha: now,
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

    // Cache locally
    const cached = filterOutDeletedQuotes(getLocal<Quote[]>('quotes', []));
    setLocal('quotes', [newQuote, ...cached.filter(q => q.id !== id && q.numero !== numero)]);

    // Persist to Supabase
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
        fecha: now,
        validezDias: newQuote.validezDias,
        validezFecha: newQuote.validezFecha || null,
        estado: newQuote.estado,
        notas: newQuote.notas || null,
        condiciones: newQuote.condiciones || (costoEnvio > 0 ? JSON.stringify({ costoEnvio }) : null),
        createdBy: newQuote.createdBy
      };

      if (costoEnvio > 0) {
        payload.costoEnvio = costoEnvio;
      }

      let { error } = await supabase.from('quotes').insert([payload]);

      // Graceful fallback if costoEnvio column does not exist on Supabase SQL yet
      if (error && (error.message?.includes('costoEnvio') || error.message?.includes('column'))) {
        delete payload.costoEnvio;
        payload.condiciones = JSON.stringify({ costoEnvio, originalCondiciones: newQuote.condiciones || null });
        const retry = await supabase.from('quotes').insert([payload]);
        error = retry.error;
      }

      if (error) {
        console.warn('Supabase quote insert error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase quote insert network exception:', e);
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
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) console.warn('Supabase deleteQuote id error:', error.message);
      }
      if (numero) {
        const { error } = await supabase.from('quotes').delete().eq('numero', numero);
        if (error) console.warn('Supabase deleteQuote numero error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase deleteQuote error:', e);
    }
  },

  updateQuote: async (id: string, updates: Partial<Quote>): Promise<void> => {
    const cached = getLocal<Quote[]>('quotes', []);
    setLocal('quotes', cached.map(q => q.id === id ? { ...q, ...updates } : q));

    try {
      await supabase.from('quotes').update(updates).eq('id', id);
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
  getClients: async (): Promise<Client[]> => {
    try {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) return getLocal<Client[]>('clients', []);
      setLocal('clients', data || []);
      return data || [];
    } catch {
      return getLocal<Client[]>('clients', []);
    }
  },

  addClient: async (client: Omit<Client, 'id' | 'createdAt' | 'createdBy'>): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    const item: Client = { ...client, id, createdAt: now, createdBy: 'admin' };

    const cached = getLocal<Client[]>('clients', []);
    setLocal('clients', [item, ...cached]);

    try {
      await supabase.from('clients').insert([item]);
    } catch (e) {
      console.warn(e);
    }
    return id;
  },

  updateClient: async (id: string, client: Partial<Client>): Promise<void> => {
    const cached = getLocal<Client[]>('clients', []);
    setLocal('clients', cached.map(c => c.id === id ? { ...c, ...client } : c));
    try {
      await supabase.from('clients').update(client).eq('id', id);
    } catch (e) {
      console.warn(e);
    }
  },

  deleteClient: async (id: string): Promise<void> => {
    const cached = getLocal<Client[]>('clients', []);
    setLocal('clients', cached.filter(c => c.id !== id));
    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch (e) {
      console.warn(e);
    }
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
      setLocal('finances', data || []);
      return data || [];
    } catch {
      return getLocal<FinanceTransaction[]>('finances', []);
    }
  },

  addFinance: async (transaction: Omit<FinanceTransaction, 'id' | 'createdAt' | 'createdBy'>): Promise<string> => {
    const id = generateId();
    const now = new Date().toISOString();
    const item: FinanceTransaction = { ...transaction, id, createdAt: now, createdBy: 'admin' };

    const cached = getLocal<FinanceTransaction[]>('finances', []);
    setLocal('finances', [item, ...cached]);

    try {
      await supabase.from('finances').insert([item]);
    } catch (e) {
      console.warn(e);
    }
    return id;
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
  }): Promise<{ productsMigrated: number; quotesMigrated: number; warehousesMigrated: number; salesMigrated: number }> => {
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

    return { productsMigrated, quotesMigrated, warehousesMigrated, salesMigrated };
  }
};
