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

// Helper for unique ID generation
const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

// Safe local storage cache helper
const getLocal = <T>(key: string, defaultVal: T): T => {
  try {
    const raw = localStorage.getItem(`sb_cache_${key}`);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const setLocal = <T>(key: string, val: T): void => {
  try {
    localStorage.setItem(`sb_cache_${key}`, JSON.stringify(val));
  } catch (e) {
    console.warn('Error saving to local cache:', e);
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

    // Deduct stock in local cache and Supabase products
    try {
      const cachedProducts = getLocal<Product[]>('products', []);
      for (const sale of formattedSales) {
        if (!sale.productId) continue;
        const prod = cachedProducts.find(p => p.id === sale.productId);
        if (prod) {
          const newTotal = Math.max(0, (prod.cantidad || 0) - sale.cantidad);
          let newVariants = prod.variants;
          if (sale.variantId && prod.variants?.length) {
            newVariants = prod.variants.map(v => 
              v.id === sale.variantId ? { ...v, cantidad: Math.max(0, (v.cantidad || 0) - sale.cantidad) } : v
            );
          }
          await supabaseService.updateProduct(sale.productId, {
            cantidad: newTotal,
            variants: newVariants
          });
        }
      }
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

  deleteSale: async (id: string): Promise<void> => {
    // 1. Remove from local cache
    const cached = getLocal<Sale[]>('sales', []);
    const saleToDelete = cached.find(s => s.id === id);
    setLocal('sales', cached.filter(s => s.id !== id));

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

    // 3. Delete from Supabase table
    try {
      await supabase.from('sales').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase deleteSale error:', e);
    }
  },

  // --- PURCHASES ---
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
        return getLocal<Quote[]>('quotes', []);
      }

      const quotes = (data || []).map((q: any) => ({
        ...q,
        items: q.items || [],
        subtotal: Number(q.subtotal) || 0,
        total: Number(q.total) || 0,
        descuento: Number(q.descuento) || 0
      })) as Quote[];

      setLocal('quotes', quotes);
      return quotes;
    } catch {
      return getLocal<Quote[]>('quotes', []);
    }
  },

  createQuote: async (quoteData: any): Promise<Quote> => {
    const id = generateId();
    const now = new Date().toISOString();
    const count = (getLocal<Quote[]>('quotes', []).length + 1).toString().padStart(4, '0');
    const numero = quoteData.numero || `COT-${count}`;

    const newQuote: Quote = {
      ...quoteData,
      id,
      numero,
      fecha: now,
      subtotal: Number(quoteData.subtotal || quoteData.total || 0),
      total: Number(quoteData.total || 0),
      descuento: Number(quoteData.descuento || 0),
      validezDias: Number(quoteData.validezDias || 7),
      estado: quoteData.estado || 'pendiente',
      items: quoteData.items || [],
      clientNombre: quoteData.clientNombre || 'Consumidor Final',
      createdBy: quoteData.createdBy || 'admin'
    };

    // Cache locally
    const cached = getLocal<Quote[]>('quotes', []);
    setLocal('quotes', [newQuote, ...cached.filter(q => q.id !== id)]);

    // Persist to Supabase
    try {
      const { error } = await supabase.from('quotes').insert([{
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
        condiciones: newQuote.condiciones || null,
        createdBy: newQuote.createdBy
      }]);

      if (error) {
        console.warn('Supabase quote insert error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase quote insert network exception:', e);
    }

    return newQuote;
  },

  deleteQuote: async (id: string): Promise<void> => {
    const cached = getLocal<Quote[]>('quotes', []);
    setLocal('quotes', cached.filter(q => q.id !== id));

    try {
      await supabase.from('quotes').delete().eq('id', id);
    } catch (e) {
      console.warn(e);
    }
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
