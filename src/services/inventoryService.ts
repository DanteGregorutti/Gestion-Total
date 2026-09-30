/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  serverTimestamp, 
  onSnapshot,
  writeBatch,
  limit,
  getDoc,
  getDocFromServer,
  startAfter,
  getCountFromServer,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { supabase } from '../supabase';
import { supabaseService } from './supabaseService';
import { 
  markQuoteAsDeleted, 
  unmarkQuoteDeleted, 
  isQuoteDeleted, 
  filterOutDeletedQuotes, 
  scrubQuoteFromLocalStorage 
} from '../utils/quoteTombstones';

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore fallback notification (handled seamlessly):', JSON.stringify(errInfo));
}

// Connection Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

const sanitizeData = (data: any) => {
  const sanitized: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

/**
 * Calculates the next sequential code in the sequence (e.g. ART-0001, ART-0002, ART-0003...)
 */
export function getNextProductCode(products: Array<{ codigo?: string }>, prefix: string = 'ART'): string {
  let maxNum = 0;
  const cleanPrefix = (prefix || 'ART').trim().toUpperCase();
  const regex = new RegExp(`^${cleanPrefix}[-_]?(\\d+)$`, 'i');

  if (Array.isArray(products)) {
    for (const p of products) {
      if (!p.codigo) continue;
      const trimmed = p.codigo.trim();
      const match = trimmed.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  // Fallback check: if maxNum is still 0, look for any ART- prefix
  if (cleanPrefix === 'ART' && maxNum === 0 && Array.isArray(products)) {
    for (const p of products) {
      if (!p.codigo) continue;
      const genericMatch = p.codigo.trim().match(/^ART[-_]?(\d+)/i);
      if (genericMatch) {
        const num = parseInt(genericMatch[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${cleanPrefix}-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Checks if a code looks like a name mistakenly typed in the code field
 * (e.g. contains spaces, multiple words, or letters without numeric code pattern)
 */
export function isNameInCode(code?: string): boolean {
  if (!code) return false;
  const c = code.trim();
  // Valid standard sequential code like ART-0001 or ART-1042
  if (/^ART[-_]?\d+$/i.test(c)) return false;
  // If it contains spaces, e.g. "short pollera", "remera oversize"
  if (/\s+/.test(c)) return true;
  // If it has letters, no digits, and length >= 3, e.g. "pollera", "remera"
  if (!/\d/.test(c) && c.length >= 3) return true;
  return false;
}

export const inventoryService = {
  // Products
  getProducts: async (): Promise<Product[]> => {
    // 1. Try Firestore if user is authenticated
    if (auth.currentUser) {
      const path = 'products';
      try {
        const q = query(
          collection(db, path),
          where('createdBy', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const list = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .sort((a, b) => {
              const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
              const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
              return dateB.getTime() - dateA.getTime();
            });
          return list;
        }
      } catch (error) {
        console.warn('Firestore getProducts error, falling back to Supabase:', error);
      }
    }

    // 2. Fallback to Supabase (works 24/7 in Node.js server & browser)
    try {
      const sbProducts = await supabaseService.getProducts();
      if (sbProducts && sbProducts.length > 0) {
        return sbProducts;
      }
    } catch (e) {
      console.warn('Supabase getProducts fallback error:', e);
    }

    // 3. Fallback to local cache
    return getLocal<Product[]>('products', []);
  },

  getProductsPaginated: async (pageSize: number = 20, lastVisible: any = null) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'products';
    try {
      // Note: Pagination with orderBy and where on different fields is hard without indexes.
      // We'll fallback to a simpler query and handle sorting/limit if possible, 
      // but for proper pagination with a user-specific filter, an index IS recommended.
      // For now, we'll strip the orderBy to avoid the crash.
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        limit(pageSize * 5) // Fetch more then slice to simulate a bit better if we had indexes
      );

      const snapshot = await getDocs(q);
      const products = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, pageSize);

      return {
        products,
        lastVisible: snapshot.docs[snapshot.docs.length - 1]
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return { products: [], lastVisible: null };
    }
  },

  getProductsCount: async () => {
    if (!auth.currentUser) return 0;
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return 0;
    }
  },

  getLowStockProducts: async (threshold: number = 5) => {
    if (!auth.currentUser) return [];
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter(p => p.cantidad <= threshold)
        .slice(0, 100);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getRecentMovements: async (days: number = 7) => {
    if (!auth.currentUser) return [];
    const path = 'movements';
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const movements = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Movement))
        .filter(m => {
          const date = (m.fecha as any)?.toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
          return date >= since;
        })
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any);
          return dateB.getTime() - dateA.getTime();
        });
      return movements;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToProducts: (callback: (products: Product[]) => void) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const path = 'products';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      callback(products);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  addProduct: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    // 1. Persist to Supabase
    let sbId = '';
    try {
      sbId = await supabaseService.addProduct(product);
    } catch (e) {
      console.warn('Supabase add product fallback:', e);
    }

    // 2. Also attempt Firestore in background without breaking if quota is reached
    const path = 'products';
    try {
      if (auth.currentUser) {
        const docData = sanitizeData({
          ...product,
          talle: product.talle || '',
          genero: product.genero || '',
          ubicacion: product.ubicacion || '',
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const docRef = await addDoc(collection(db, path), docData);
        return sbId || docRef.id;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return sbId || `prod_${Date.now()}`;
  },

  updateProduct: async (id: string, product: Partial<Product>) => {
    try {
      await supabaseService.updateProduct(id, product);
    } catch (e) {
      console.warn('Supabase updateProduct fallback:', e);
    }

    const path = `products/${id}`;
    try {
      if (auth.currentUser) {
        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, sanitizeData({
          ...product,
          updatedAt: serverTimestamp()
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  syncProductImageAcrossVariants: async (codigo: string, imagenUrl: string, excludeId?: string) => {
    if (!codigo?.trim() || !imagenUrl) return;
    const cleanCode = codigo.trim().toLowerCase();
    try {
      // 1. Synchronize in Supabase / Local Storage
      const allCached = await supabaseService.getProducts().catch(() => []);
      const siblingsSb = allCached.filter(p => p.codigo?.trim().toLowerCase() === cleanCode && p.id !== excludeId && p.imagenUrl !== imagenUrl);
      for (const sib of siblingsSb) {
        await supabaseService.updateProduct(sib.id, { imagenUrl }).catch(() => {});
      }

      // 2. Synchronize in Firestore
      if (auth.currentUser) {
        const path = 'products';
        const q = query(
          collection(db, path),
          where('createdBy', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const matches = snapshot.docs.filter(d => {
          const data = d.data();
          return data.codigo?.trim().toLowerCase() === cleanCode && d.id !== excludeId && data.imagenUrl !== imagenUrl;
        });

        for (const matchDoc of matches) {
          await updateDoc(doc(db, 'products', matchDoc.id), sanitizeData({
            imagenUrl,
            updatedAt: serverTimestamp()
          })).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Error syncing product image across variants:', error);
    }
  },

  syncProductAcrossVariants: async (productIds: string[], updates: Partial<Product>) => {
    if (!productIds || productIds.length === 0) return;
    try {
      const sanitized = sanitizeData({
        ...updates,
        updatedAt: serverTimestamp()
      });

      for (const id of productIds) {
        await supabaseService.updateProduct(id, updates).catch(() => {});
        if (auth.currentUser) {
          const productRef = doc(db, 'products', id);
          await updateDoc(productRef, sanitized).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Error syncing product across variants:', error);
    }
  },

  deleteProduct: async (id: string) => {
    try {
      await supabaseService.deleteProduct(id);
    } catch (e) {
      console.warn('Supabase deleteProduct fallback:', e);
    }

    const path = `products/${id}`;
    try {
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'products', id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  deleteProductsBatch: async (ids: string[]) => {
    try {
      await supabaseService.deleteProductsBatch(ids);
    } catch (e) {
      console.warn('Supabase deleteProductsBatch fallback:', e);
    }

    if (!auth.currentUser || !ids || ids.length === 0) return;
    const path = 'products/batch_delete';
    const CHUNK_SIZE = 450;
    try {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'products', id));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  updateProductsBatch: async (updates: Array<{ id: string; data: Partial<Product> }>) => {
    if (!updates || updates.length === 0) return;

    // 1. Update in Supabase & Local Cache
    for (const item of updates) {
      try {
        await supabaseService.updateProduct(item.id, item.data);
      } catch (e) {
        console.warn('Supabase batch update fallback:', e);
      }
    }

    // 2. Update in Firestore
    if (!auth.currentUser) return;
    const path = 'products/batch_update';
    const CHUNK_SIZE = 400;
    try {
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ id, data }) => {
          const ref = doc(db, 'products', id);
          batch.update(ref, sanitizeData({
            ...data,
            updatedAt: serverTimestamp()
          }));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
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

    // Sort stably: oldest first
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

    // Sync images to new codes
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
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'products/bulk';
    const CHUNK_SIZE = 500;
    let processed = 0;

    try {
      // 1. Fetch all existing products to check for duplicates efficiently
      const existingProducts = await inventoryService.getProducts();
      const productMap = new Map<string, Product>();
      existingProducts.forEach(p => {
        // Key by code, warehouse, location, origin, talle and gender
        const key = `${p.codigo}_${p.almacenId}_${p.ubicacion || ''}_${p.procedencia}_${p.talle || ''}_${p.genero || ''}`;
        productMap.set(key, p);
      });

      for (let i = 0; i < products.length; i += CHUNK_SIZE) {
        const chunk = products.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((product) => {
          // Ensure fields exist for uniqueness check
          const talle = product.talle || '';
          const genero = product.genero || '';
          const ubicacion = product.ubicacion || '';

          // Key by all attributes to distinguish sizes/genders
          const key = `${product.codigo}_${product.almacenId}_${ubicacion}_${product.procedencia}_${talle}_${genero}`;
          const existing = productMap.get(key);

          if (existing) {
            // Update existing product quantity
            const docRef = doc(db, 'products', existing.id);
            
            const updatedData = {
              cantidad: existing.cantidad + product.cantidad,
              updatedAt: serverTimestamp()
            };
            
            batch.update(docRef, sanitizeData(updatedData));
            
            // Update map for subsequent items in the same bulk upload
            productMap.set(key, { 
              ...existing, 
              cantidad: updatedData.cantidad
            });
          } else {
            // Create new product
            const docRef = doc(collection(db, 'products'));
            const newProductData = sanitizeData({
              ...product,
              talle,
              genero,
              ubicacion,
              createdBy: auth.currentUser!.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            batch.set(docRef, newProductData);
            
            // Add to map to handle duplicates within the same bulk upload
            const tempId = docRef.id;
            productMap.set(key, { 
              id: tempId, 
              ...newProductData, 
              createdAt: new Date().toISOString(), // Temp values for map
              updatedAt: new Date().toISOString() 
            } as any);
          }
        });

        await batch.commit();
        processed += chunk.length;
        if (onProgress) onProgress(processed);
      }
      return processed;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  getProductsByCode: async (codigo: string): Promise<Product[]> => {
    if (!auth.currentUser) return [];
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('codigo', '==', codigo)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  checkProductCodeExists: async (codigo: string, excludeId?: string): Promise<Product | null> => {
    if (!auth.currentUser) return null;
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('codigo', '==', codigo)
      );
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      if (excludeId) {
        const other = products.find(p => p.id !== excludeId);
        return other || null;
      }
      
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  checkProductExists: async (codigo: string, almacenId: string, ubicacion: string, procedencia: string, talle?: string, genero?: string): Promise<Product | null> => {
    if (!auth.currentUser) return null;
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('codigo', '==', codigo),
        where('almacenId', '==', almacenId),
        where('ubicacion', '==', ubicacion || ''),
        where('procedencia', '==', procedencia),
        where('talle', '==', talle || ''),
        where('genero', '==', genero || '')
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  // Warehouses
  getWarehouses: async () => {
    if (!auth.currentUser) return [];
    const path = 'warehouses';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Warehouse))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToWarehouses: (callback: (warehouses: Warehouse[]) => void) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const path = 'warehouses';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const warehouses = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Warehouse))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      callback(warehouses);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  addWarehouse: async (warehouse: Omit<Warehouse, 'id' | 'createdAt' | 'createdBy'>) => {
    let sbId = '';
    try {
      sbId = await supabaseService.addWarehouse(warehouse);
    } catch (e) {
      console.warn('Supabase addWarehouse fallback:', e);
    }

    if (!auth.currentUser) return sbId;
    const path = 'warehouses';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...warehouse,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      }));
      return sbId || docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return sbId || `wh_${Date.now()}`;
    }
  },

  updateWarehouse: async (id: string, warehouse: Partial<Warehouse>) => {
    const path = `warehouses/${id}`;
    try {
      await updateDoc(doc(db, 'warehouses', id), sanitizeData(warehouse));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Clients
  getClients: async () => {
    if (!auth.currentUser) return [];
    const path = 'clients';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Client))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToClients: (callback: (clients: Client[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'clients';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Client))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      callback(clients);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  addClient: async (client: Omit<Client, 'id' | 'createdAt' | 'createdBy'>) => {
    let sbId = '';
    try {
      sbId = await supabaseService.addClient(client);
    } catch (e) {
      console.warn(e);
    }

    if (!auth.currentUser) return sbId;
    const path = 'clients';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...client,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      }));
      return docRef.id || sbId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return sbId;
    }
  },

  updateClient: async (id: string, client: Partial<Client>) => {
    try {
      await supabaseService.updateClient(id, client);
    } catch (e) {
      console.warn(e);
    }

    const path = `clients/${id}`;
    try {
      await updateDoc(doc(db, 'clients', id), sanitizeData(client));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteClient: async (id: string) => {
    try {
      await supabaseService.deleteClient(id);
    } catch (e) {
      console.warn(e);
    }

    const path = `clients/${id}`;
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Suppliers
  getSuppliers: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'suppliers';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Supplier))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToSuppliers: (callback: (suppliers: Supplier[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'suppliers';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const suppliers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Supplier))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      callback(suppliers);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  addSupplier: async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'suppliers';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...supplier,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateSupplier: async (id: string, supplier: Partial<Supplier>) => {
    const path = `suppliers/${id}`;
    try {
      await updateDoc(doc(db, 'suppliers', id), sanitizeData(supplier));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteSupplier: async (id: string) => {
    const path = `suppliers/${id}`;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Notifications
  getNotifications: async (maxResults: number = 50) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'notifications';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, maxResults);
      return notifications;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToNotifications: (callback: (notifications: Notification[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'notifications';
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 50);
      callback(notifications);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  markNotificationAsRead: async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, 'notifications', id), { leido: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Goals
  getGoals: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'goals';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToGoals: (callback: (goals: Goal[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'goals';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      callback(goals);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  // Movements
  getMovements: async (maxResults: number = 500) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'movements';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Movement))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, maxResults);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getMovementsByProduct: async (productId: string) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'movements';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('productId', '==', productId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Movement))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 50);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToMovements: (callback: (movements: Movement[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'movements';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const movements = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Movement))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any);
          return dateB.getTime() - dateA.getTime();
        });
      callback(movements);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  subscribeToRecentMovements: (callback: (movements: Movement[]) => void, days: number = 30) => {
    if (!auth.currentUser) return () => {};
    const path = 'movements';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const movements = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Movement))
        .filter(m => {
          const date = (m.fecha as any)?.toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
          return date >= since;
        })
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any);
          return dateB.getTime() - dateA.getTime();
        });
      callback(movements);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  // Sales
  getSales: async (days: number = 30): Promise<Sale[]> => {
    const allSalesMap = new Map<string, Sale>();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Get cached local sales
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

    // 2. Fetch from Supabase (shared real-time across all devices)
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

    // 3. Fetch from Firestore if authenticated
    if (auth.currentUser) {
      const path = 'sales';
      try {
        const snapshot = await getDocs(collection(db, path));
        snapshot.docs.forEach(doc => {
          const data = { id: doc.id, ...doc.data() } as Sale;
          const d = (data.fecha as any)?.toDate ? (data.fecha as any).toDate() : new Date(data.fecha as any || 0);
          if (d >= since) {
            allSalesMap.set(doc.id, data);
          }
        });
      } catch (error) {
        try {
          const q = query(
            collection(db, path),
            where('createdBy', '==', auth.currentUser.uid)
          );
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() } as Sale;
            const d = (data.fecha as any)?.toDate ? (data.fecha as any).toDate() : new Date(data.fecha as any || 0);
            if (d >= since) {
              allSalesMap.set(doc.id, data);
            }
          });
        } catch (e2) {
          console.warn('Firestore getSales query fallback:', e2);
        }
      }
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
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'sales';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('clientId', '==', clientId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Sale))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 50);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToSales: (callback: (sales: Sale[]) => void, days: number = 30) => {
    let isUnsubscribed = false;
    let unsubFirestore: (() => void) | null = null;
    let unsubSupabase: (() => void) | null = null;

    const emitCurrent = async () => {
      if (isUnsubscribed) return;
      try {
        const sales = await inventoryService.getSales(days);
        if (!isUnsubscribed) callback(sales);
      } catch (e) {}
    };

    // 1. Deliver immediately
    emitCurrent();

    // 2. Real-time from Supabase (all devices instantly synced)
    try {
      unsubSupabase = supabaseService.subscribeToSales(() => {
        if (!isUnsubscribed) emitCurrent();
      });
    } catch (e) {
      console.warn('Supabase subscribeToSales error:', e);
    }

    // 3. Real-time from Firestore
    const setupFirestore = () => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (!auth.currentUser) return;

      const path = 'sales';
      try {
        unsubFirestore = onSnapshot(collection(db, path), () => {
          if (!isUnsubscribed) emitCurrent();
        }, () => {
          if (auth.currentUser && !isUnsubscribed) {
            try {
              const q = query(collection(db, path), where('createdBy', '==', auth.currentUser.uid));
              unsubFirestore = onSnapshot(q, () => {
                if (!isUnsubscribed) emitCurrent();
              }, () => {});
            } catch (e) {}
          }
        });
      } catch (err) {
        console.warn('Firestore subscribeToSales warning:', err);
      }
    };

    setupFirestore();

    const unsubAuth = onAuthStateChanged(auth, () => {
      if (!isUnsubscribed) {
        setupFirestore();
        emitCurrent();
      }
    });

    return () => {
      isUnsubscribed = true;
      if (unsubFirestore) unsubFirestore();
      if (unsubSupabase) unsubSupabase();
      unsubAuth();
    };
  },

  subscribeToRecentSales: (callback: (sales: Sale[]) => void, days: number = 30) => {
    return inventoryService.subscribeToSales(callback, days);
  },

  registerSale: async (saleOrSales: (Omit<Sale, 'id' | 'fecha' | 'createdBy' | 'total'> & { id?: string; transactionId?: string; total?: number }) | (Omit<Sale, 'id' | 'fecha' | 'createdBy' | 'total'> & { id?: string; transactionId?: string; total?: number })[]) => {
    const rawSales = Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales];
    if (rawSales.length === 0) return [];

    // Generate or maintain consistent transactionId across Supabase and Firestore
    const baseTransactionId = (rawSales[0] as any)?.transactionId || doc(collection(db, 'transactions')).id;
    const nowIso = new Date().toISOString();

    // Create synchronized sales with matching deterministic IDs
    const preparedSales: Sale[] = rawSales.map((s, idx) => {
      const transactionId = (s as any).transactionId || baseTransactionId;
      const saleId = (s as any).id || (rawSales.length === 1 ? transactionId : `${transactionId}_${idx}`);
      const cantidad = Number(s.cantidad) || 1;
      const total = Math.round(Number(s.total !== undefined ? s.total : (cantidad * s.precio)) || 0);
      const precio = Math.round(Number(s.total !== undefined ? (s.total / cantidad) : s.precio) || 0);

      return {
        ...s,
        id: saleId,
        transactionId,
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

    // 2. Persist to Supabase with matching IDs (instant cross-device synchronization)
    try {
      await supabaseService.registerSale(preparedSales);
    } catch (e) {
      console.warn('Supabase registerSale fallback:', e);
    }

    // 3. Persist to Firestore if authenticated
    if (auth.currentUser) {
      const path = 'sales/batch';
      try {
        const batch = writeBatch(db);

        // Pre-fetch product data and consolidate deductions to avoid duplicate batch.update on same document
        const deductionsByProduct = new Map<string, {
          totalQuantity: number;
          variantDeductions: Record<string, number>;
          productRef: any;
          productData: Product | null;
        }>();

        for (const sale of preparedSales) {
          if (sale.productId && !sale.productId.startsWith('manual_') && !sale.productId.startsWith('custom_') && sale.productId !== 'quote_item') {
            let existing = deductionsByProduct.get(sale.productId);
            if (!existing) {
              let pData: Product | null = null;
              let pRef: any = null;
              try {
                pRef = doc(db, 'products', sale.productId);
                const snap = await getDoc(pRef);
                if (snap.exists()) {
                  pData = snap.data() as Product;
                }
              } catch (e) {
                console.warn('Could not read product for stock deduction:', e);
              }
              existing = {
                totalQuantity: 0,
                variantDeductions: {},
                productRef: pRef,
                productData: pData
              };
              deductionsByProduct.set(sale.productId, existing);
            }

            existing.totalQuantity += sale.cantidad;
            if (sale.variantId) {
              existing.variantDeductions[sale.variantId] = (existing.variantDeductions[sale.variantId] || 0) + sale.cantidad;
            }
          }

          // Use the EXACT same ID in Firestore as in Supabase:
          const saleRef = doc(db, 'sales', sale.id);
          const pInfo = sale.productId ? deductionsByProduct.get(sale.productId) : null;
          const currentCost = pInfo?.productData?.costo || (sale as any).costo || 0;

          batch.set(saleRef, sanitizeData({
            ...sale,
            costo: currentCost,
            fecha: serverTimestamp(),
            createdBy: auth.currentUser.uid
          }));

          const movementRef = doc(collection(db, 'movements'));
          batch.set(movementRef, {
            productId: sale.productId,
            productNombre: sale.productNombre,
            tipo: 'venta',
            cantidad: sale.cantidad,
            fecha: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            transactionId: sale.transactionId
          });
        }

        // Apply product stock deductions - exactly once per product
        for (const [productId, info] of deductionsByProduct.entries()) {
          if (info.productRef && info.productData) {
            const updatePayload: any = {
              cantidad: increment(-info.totalQuantity),
              updatedAt: serverTimestamp()
            };
            if (info.productData.variants?.length) {
              updatePayload.variants = info.productData.variants.map(v => {
                const varDeduct = info.variantDeductions[v.id] || 0;
                if (varDeduct > 0) {
                  return { ...v, cantidad: Math.max(0, (v.cantidad || 0) - varDeduct) };
                }
                return v;
              });
            }
            batch.update(info.productRef, updatePayload);
          }
        }

        await batch.commit();
      } catch (error) {
        console.warn('Firestore registerSale batch warning:', error);
      }
    }

    return preparedSales;
  },

  updateSale: async (id: string, data: Partial<Sale>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = `sales/${id}`;
    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', id);
      const saleSnap = await getDoc(saleRef);
      
      if (!saleSnap.exists()) throw new Error('Sale not found');
      const oldSale = saleSnap.data() as Sale;

      let totalComboCost = oldSale.costo || 0;

      // If it's a combo, handle its items
      if (oldSale.isCombo && oldSale.comboItems) {
        const newComboItems = data.comboItems || oldSale.comboItems;
        totalComboCost = 0;
        
        // Map of old items for easy lookup
        const oldItemsMap = new Map(oldSale.comboItems.map(i => [i.productId, i]));
        const newItemsMap = new Map(newComboItems.map(i => [i.productId, i]));

        // Handle stock adjustments for new and updated items
        for (const newItem of newComboItems) {
          const oldItem = oldItemsMap.get(newItem.productId);
          const oldQty = oldItem ? oldItem.cantidad : 0;
          const diff = newItem.cantidad - oldQty;
          
          // Get product data to update cost
          const productRef = doc(db, 'products', newItem.productId);
          const productSnap = await getDoc(productRef);
          const productData = productSnap.data() as Product;
          totalComboCost += (productData?.costo || 0) * newItem.cantidad;

          if (diff !== 0) {
            batch.update(productRef, {
              cantidad: increment(-diff),
              updatedAt: serverTimestamp()
            });

            const movementRef = doc(collection(db, 'movements'));
            batch.set(movementRef, {
              productId: newItem.productId,
              productNombre: newItem.productNombre,
              tipo: 'ajuste',
              cantidad: Math.abs(diff),
              fecha: serverTimestamp(),
              createdBy: auth.currentUser.uid,
              notas: `Ajuste por modificación de combo en venta ${id}. Diferencia: ${-diff}`
            });
          }
        }
        
        // Handle removed items
        for (const oldItem of oldSale.comboItems) {
          if (!newItemsMap.has(oldItem.productId)) {
            const productRef = doc(db, 'products', oldItem.productId);
            batch.update(productRef, {
              cantidad: increment(oldItem.cantidad),
              updatedAt: serverTimestamp()
            });
            
            const movementRef = doc(collection(db, 'movements'));
            batch.set(movementRef, {
              productId: oldItem.productId,
              productNombre: oldItem.productNombre,
              tipo: 'ajuste',
              cantidad: oldItem.cantidad,
              fecha: serverTimestamp(),
              createdBy: auth.currentUser.uid,
              notas: `Ajuste por eliminación de producto en combo de venta ${id}. Retorno: ${oldItem.cantidad}`
            });
          }
        }
      } else if (data.cantidad !== undefined && data.cantidad !== oldSale.cantidad && oldSale.productId !== 'combo') {
        // Standard product stock adjustment
        const diff = data.cantidad - oldSale.cantidad;
        const productRef = doc(db, 'products', oldSale.productId);
        batch.update(productRef, {
          cantidad: increment(-diff),
          updatedAt: serverTimestamp()
        });

        const movementRef = doc(collection(db, 'movements'));
        batch.set(movementRef, {
          productId: oldSale.productId,
          productNombre: oldSale.productNombre,
          tipo: 'ajuste',
          cantidad: Math.abs(diff),
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          notas: `Ajuste por modificación de venta ${id}. Diferencia: ${-diff}`
        });
      }

      // Recalculate total if price or quantity changed
      const newCantidad = data.cantidad !== undefined ? data.cantidad : oldSale.cantidad;
      const newPrecio = data.precio !== undefined ? data.precio : oldSale.precio;
      const newTotal = Math.round(newCantidad * newPrecio);

      batch.update(saleRef, sanitizeData({
        ...data,
        total: newTotal,
        precio: Math.round(newPrecio),
        costo: totalComboCost,
        updatedAt: serverTimestamp()
      }));

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }

    try {
      await supabaseService.updateSale(id, data);
    } catch (e) {
      console.warn('supabase updateSale fallback:', e);
    }
  },

  assignSalesToClient: async (saleIds: string[], client: { id: string; nombre: string }) => {
    if (!saleIds || saleIds.length === 0) return;

    // 1. Update in Firestore if authenticated
    if (auth.currentUser) {
      const path = 'sales';
      try {
        const batch = writeBatch(db);
        for (const id of saleIds) {
          const saleRef = doc(db, 'sales', id);
          batch.update(saleRef, sanitizeData({
            clientId: client.id,
            clientNombre: client.nombre,
            updatedAt: serverTimestamp()
          }));
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    // 2. Update in Supabase / Local storage cache
    try {
      await supabaseService.assignSalesToClient(saleIds, client);
    } catch (e) {
      console.warn('supabase assignSalesToClient fallback:', e);
    }
  },

  registerComboSale: async (data: { 
    nombre: string, 
    items: ComboItem[], 
    total: number, 
    clientId?: string, 
    clientNombre?: string 
  }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'sales/combo_batch';
    try {
      const batch = writeBatch(db);
      const transactionId = doc(collection(db, 'transactions')).id;
      const saleRef = doc(collection(db, 'sales'));

      const finalTotal = Math.round(Number(data.total) || 0);
      let totalComboCost = 0;

      // Calculate total cost and deduct stock for each item in the combo
      for (const item of data.items) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        const productData = productSnap.data() as Product;
        totalComboCost += (productData?.costo || 0) * item.cantidad;

        batch.update(productRef, {
          cantidad: increment(-item.cantidad),
          updatedAt: serverTimestamp()
        });

        const movementRef = doc(collection(db, 'movements'));
        batch.set(movementRef, {
          productId: item.productId,
          productNombre: item.productNombre,
          tipo: 'venta',
          cantidad: item.cantidad,
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          transactionId,
          notas: `Venta de combo: ${data.nombre}`
        });
      }

      // Create a single sale record for the combo
      batch.set(saleRef, sanitizeData({
        productId: 'combo',
        productNombre: data.nombre,
        cantidad: 1,
        precio: finalTotal,
        total: finalTotal,
        costo: totalComboCost,
        clientId: data.clientId,
        clientNombre: data.clientNombre,
        transactionId,
        isCombo: true,
        comboItems: data.items,
        fecha: serverTimestamp(),
        createdBy: auth.currentUser.uid
      }));

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Purchases
  getPurchases: async (days: number = 30) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases';
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Purchase))
        .filter(p => {
          const date = (p.fecha as any)?.toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
          return date >= since;
        })
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any);
          return dateB.getTime() - dateA.getTime();
        });
      return purchases;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getPurchasesBySupplier: async (proveedor: string) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid),
        where('proveedor', '==', proveedor)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Purchase))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 50);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToPurchases: (callback: (purchases: Purchase[]) => void) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const path = 'purchases';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const purchases = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Purchase))
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      callback(purchases);
    }, (error) => {
      console.warn('Purchases snapshot error:', error);
    });
  },

  subscribeToRecentPurchases: (callback: (purchases: Purchase[]) => void, days: number = 30) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const path = 'purchases';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const purchases = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Purchase))
        .filter(p => {
          const date = (p.fecha as any)?.toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
          return date >= since;
        })
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      callback(purchases);
    }, (error) => {
      console.warn('Recent purchases snapshot error:', error);
    });
  },

  registerPurchase: async (purchase: Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'> & { total?: number }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases/batch';
    try {
      const batch = writeBatch(db);
      const total = purchase.total !== undefined ? purchase.total : (purchase.cantidad * purchase.costo);
      const transactionId = doc(collection(db, 'transactions')).id;
      
      const purchaseRef = doc(collection(db, 'purchases'));
      batch.set(purchaseRef, sanitizeData({
        ...purchase,
        total,
        transactionId,
        fecha: serverTimestamp(),
        createdBy: auth.currentUser.uid
      }));

      const productRef = doc(db, 'products', purchase.productId);
      const productSnap = await getDoc(productRef);
      const productData = productSnap.exists() ? (productSnap.data() as Product) : null;

      const updatePayload: any = {
        cantidad: increment(purchase.cantidad),
        updatedAt: serverTimestamp()
      };
      if (purchase.costo && purchase.costo > 0) {
        updatePayload.costo = purchase.costo;
      }
      if (purchase.variantId && productData?.variants?.length) {
        updatePayload.variants = productData.variants.map(v => {
          if (v.id === purchase.variantId) {
            return { ...v, cantidad: (v.cantidad || 0) + purchase.cantidad };
          }
          return v;
        });
      }
      batch.update(productRef, updatePayload);

      const movementRef = doc(collection(db, 'movements'));
      batch.set(movementRef, {
        productId: purchase.productId,
        productNombre: purchase.productNombre,
        tipo: 'compra',
        cantidad: purchase.cantidad,
        fecha: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        transactionId
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  registerBulkPurchase: async (purchases: (Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'> & { total?: number })[]) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases/bulk';
    try {
      const batch = writeBatch(db);
      const transactionId = doc(collection(db, 'transactions')).id;

      for (const purchase of purchases) {
        const total = purchase.total !== undefined ? purchase.total : (purchase.cantidad * purchase.costo);
        const purchaseRef = doc(collection(db, 'purchases'));
        
        batch.set(purchaseRef, sanitizeData({
          ...purchase,
          total,
          transactionId,
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid
        }));

        const productRef = doc(db, 'products', purchase.productId);
        const updatePayload: any = {
          cantidad: increment(purchase.cantidad),
          updatedAt: serverTimestamp()
        };
        if (purchase.costo && purchase.costo > 0) {
          updatePayload.costo = purchase.costo;
        }
        batch.update(productRef, updatePayload);

        const movementRef = doc(collection(db, 'movements'));
        batch.set(movementRef, {
          productId: purchase.productId,
          productNombre: purchase.productNombre,
          tipo: 'compra',
          cantidad: purchase.cantidad,
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          transactionId
        });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteSale: async (id: string) => {
    // 1. Immediately remove from local cache for instant UI feedback
    try {
      const local = getLocal<Sale[]>('sales', []);
      setLocal('sales', local.filter(s => s.id !== id && (s as any).transactionId !== id));
    } catch (e) {}

    // 2. Delete from Supabase (syncs across all devices in real-time)
    try {
      await supabaseService.deleteSale(id);
    } catch (e) {
      console.warn('Supabase deleteSale error:', e);
    }

    // 3. Delete from Firestore if authenticated
    if (!auth.currentUser) return;
    const path = `sales/${id}`;
    try {
      const saleRef = doc(db, 'sales', id);
      const saleSnap = await getDoc(saleRef);
      let sale: Sale | null = null;
      
      if (saleSnap.exists()) {
        sale = saleSnap.data() as Sale;
        // Unconditionally delete the document
        await deleteDoc(saleRef);
      } else {
        // Check if ID is a transactionId or has multiple docs
        try {
          const q = query(collection(db, 'sales'), where('transactionId', '==', id));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            if (!sale) sale = d.data() as Sale;
            await deleteDoc(d.ref);
          }
        } catch (e) {}
      }

      // If document was found, restore stock and log movement safely
      if (sale) {
        try {
          if (sale.isCombo && sale.comboItems) {
            for (const item of sale.comboItems) {
              const productRef = doc(db, 'products', item.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                await updateDoc(productRef, {
                  cantidad: increment(item.cantidad),
                  updatedAt: serverTimestamp()
                });
                try {
                  const movementRef = doc(collection(db, 'movements'));
                  await setDoc(movementRef, {
                    productId: item.productId,
                    productNombre: item.productNombre,
                    tipo: 'entrada',
                    cantidad: item.cantidad,
                    fecha: serverTimestamp(),
                    createdBy: auth.currentUser.uid,
                    nota: `Venta eliminada (Retorno de combo: ${sale.productNombre})`
                  });
                } catch (e) {}
              }
            }
          } else if (sale.productId && sale.productId !== 'combo') {
            const productRef = doc(db, 'products', sale.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const productData = productSnap.data() as Product;
              const updatePayload: any = {
                cantidad: increment(sale.cantidad),
                updatedAt: serverTimestamp()
              };
              if (sale.variantId && productData?.variants?.length) {
                updatePayload.variants = productData.variants.map(v => {
                  if (v.id === sale.variantId) {
                    return { ...v, cantidad: (v.cantidad || 0) + sale.cantidad };
                  }
                  return v;
                });
              }
              await updateDoc(productRef, updatePayload);
              try {
                const movementRef = doc(collection(db, 'movements'));
                await setDoc(movementRef, {
                  productId: sale.productId,
                  productNombre: sale.productNombre,
                  tipo: 'entrada',
                  cantidad: sale.cantidad,
                  fecha: serverTimestamp(),
                  createdBy: auth.currentUser.uid,
                  nota: 'Venta eliminada'
                });
              } catch (e) {}
            }
          }
        } catch (e) {
          console.warn('Stock restore on deleteSale warning:', e);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
    } catch (e) {}

    for (const id of ids) {
      if (auth.currentUser) {
        try {
          const saleRef = doc(db, 'sales', id);
          await deleteDoc(saleRef);
        } catch (e) {}
      }
    }
  },

  deletePurchase: async (id: string) => {
    // 1. Delete from Supabase / local cache
    try {
      await supabaseService.deletePurchase(id);
    } catch (e) {
      console.warn('Supabase deletePurchase error:', e);
    }

    // 2. Delete from Firestore if authenticated
    if (!auth.currentUser) return;
    const path = `purchases/${id}`;
    try {
      const purchaseRef = doc(db, 'purchases', id);
      const purchaseSnap = await getDoc(purchaseRef);
      
      if (!purchaseSnap.exists()) return;
      
      const purchase = purchaseSnap.data() as Purchase;
      const batch = writeBatch(db);
      
      // Delete purchase
      batch.delete(purchaseRef);
      
      // Reduce stock (and variant if specified)
      const productRef = doc(db, 'products', purchase.productId);
      const productSnap = await getDoc(productRef);
      const productData = productSnap.exists() ? (productSnap.data() as Product) : null;
      const updatePayload: any = {
        cantidad: increment(-purchase.cantidad),
        updatedAt: serverTimestamp()
      };
      if (purchase.variantId && productData?.variants?.length) {
        updatePayload.variants = productData.variants.map(v => {
          if (v.id === purchase.variantId) {
            return { ...v, cantidad: Math.max(0, (v.cantidad || 0) - purchase.cantidad) };
          }
          return v;
        });
      }
      batch.update(productRef, updatePayload);
      
      // Add movement for cancellation
      const movementRef = doc(collection(db, 'movements'));
      batch.set(movementRef, {
        productId: purchase.productId,
        productNombre: purchase.productNombre,
        tipo: 'salida', // Reducing stock is an exit
        cantidad: purchase.cantidad,
        fecha: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        nota: 'Compra eliminada'
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  deleteWarehouse: async (id: string) => {
    const path = `warehouses/${id}`;
    try {
      await deleteDoc(doc(db, 'warehouses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Goals
  addGoal: async (goal: Omit<Goal, 'id' | 'createdBy'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'goals';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...goal,
        createdBy: auth.currentUser.uid
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateGoal: async (id: string, goal: Partial<Goal>) => {
    const path = `goals/${id}`;
    try {
      await updateDoc(doc(db, 'goals', id), goal);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteGoal: async (id: string) => {
    const path = `goals/${id}`;
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Notifications
  getRecentNotifications: async (hours: number = 24, maxResults: number = 100) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'notifications';
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const q = query(
        collection(db, path),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .filter(n => {
          const date = (n.fecha as any)?.toDate ? (n.fecha as any).toDate() : new Date(n.fecha as any || 0);
          return date >= since;
        })
        .sort((a, b) => {
          const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
          const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, maxResults);
      return notifications;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  addNotification: async (notification: Omit<Notification, 'id' | 'fecha' | 'userId' | 'leido'>, skipCheck: boolean = false) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'notifications';
    try {
      if (!skipCheck) {
        // Check for existing similar notification in the last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, path),
          where('userId', '==', auth.currentUser.uid),
          where('titulo', '==', notification.titulo),
          where('productId', '==', notification.productId || ''),
          where('fecha', '>=', yesterday),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return; // Skip if already notified recently
      }

      await addDoc(collection(db, path), {
        ...notification,
        userId: auth.currentUser.uid,
        leido: false,
        fecha: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteNotification: async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  clearAllNotifications: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'notifications';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // User Profile
  getUserProfile: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = `users/${auth.currentUser.uid}`;
    try {
      const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snapshot.exists()) {
        return { uid: snapshot.id, ...snapshot.data() } as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  subscribeToUserProfile: (callback: (profile: UserProfile | null) => void) => {
    if (!auth.currentUser) return () => {};
    const path = `users/${auth.currentUser.uid}`;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        callback({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
      } else {
        callback(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
  },

  updateUserProfile: async (profile: Partial<UserProfile>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = `users/${auth.currentUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Backup & Restore
  createBackup: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    try {
      const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'goals', 'notifications'];
      const backupData: Record<string, any[]> = {};

      for (const coll of collections) {
        const ownerField = coll === 'notifications' ? 'userId' : 'createdBy';
        const q = query(collection(db, coll), where(ownerField, '==', auth.currentUser.uid));
        const snap = await getDocs(q);
        backupData[coll] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'backup');
    }
  },

  saveBackupToCloud: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'backups';
    try {
      const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'goals', 'notifications', 'combos'];
      const backupData: Record<string, any[]> = {};

      for (const coll of collections) {
        const ownerField = coll === 'notifications' ? 'userId' : 'createdBy';
        const q = query(collection(db, coll), where(ownerField, '==', auth.currentUser.uid));
        const snap = await getDocs(q);
        backupData[coll] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      await addDoc(collection(db, path), {
        data: JSON.stringify(backupData),
        fecha: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        nombre: `Backup ${new Date().toLocaleString()}`
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  getCloudBackups: async (maxResults: number = 10) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'backups';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
        .slice(0, maxResults);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToCloudBackups: (callback: (backups: any[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'backups';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const backups = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
        .slice(0, 10);
      callback(backups);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  restoreFromCloud: async (backupId: string) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    try {
      const docSnap = await getDoc(doc(db, 'backups', backupId));
      if (!docSnap.exists()) throw new Error('Backup not found');
      
      const backup = docSnap.data();
      const data = JSON.parse(backup.data);
      
      for (const [coll, docs] of Object.entries(data)) {
        if (Array.isArray(docs)) {
          for (let i = 0; i < docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 500);
            chunk.forEach((docData: any) => {
              const { id, ...rest } = docData;
              const docRef = doc(db, coll, id);
              batch.set(docRef, { ...rest, createdBy: auth.currentUser!.uid });
            });
            await batch.commit();
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restore_cloud');
    }
  },

  restoreBackup: async (file: File) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // We'll restore in chunks to avoid batch limits
      for (const [coll, docs] of Object.entries(data)) {
        if (Array.isArray(docs)) {
          for (let i = 0; i < docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 500);
            chunk.forEach((docData: any) => {
              const { id, ...rest } = docData;
              const docRef = doc(db, coll, id);
              batch.set(docRef, { ...rest, createdBy: auth.currentUser!.uid });
            });
            await batch.commit();
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restore');
    }
  },

  resetUserData: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const uid = auth.currentUser.uid;
    const collections = ['products', 'sales', 'purchases', 'movements', 'warehouses', 'clients', 'suppliers', 'notifications', 'goals', 'combos'];
    
    let errors = [];
    for (const collName of collections) {
      try {
        const q = query(collection(db, collName), where('createdBy', '==', uid));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) continue;

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      } catch (error) {
        console.error(`Error resetting collection ${collName}:`, error);
        errors.push(collName);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Error al reiniciar las siguientes colecciones: ${errors.join(', ')}`);
    }
  },

  // Combos
  // Combos
  getCombos: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'combos';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Combo))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToCombos: (callback: (combos: Combo[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'combos';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const combos = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Combo))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      callback(combos);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  addCombo: async (combo: Omit<Combo, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'combos';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...combo,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateCombo: async (id: string, combo: Partial<Combo>) => {
    const path = `combos/${id}`;
    try {
      await updateDoc(doc(db, 'combos', id), sanitizeData(combo));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteCombo: async (id: string) => {
    const path = `combos/${id}`;
    try {
      await deleteDoc(doc(db, 'combos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Finances & Business Money
  getFinances: async () => {
    if (!auth.currentUser) return [];
    const path = 'finances';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as FinanceTransaction))
        .sort((a, b) => {
          const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
          const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
    } catch (e) {
      console.warn('Firestore getFinances warning:', e);
      return [];
    }
  },

  subscribeToFinances: (callback: (transactions: FinanceTransaction[]) => void) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const path = 'finances';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const finances = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as FinanceTransaction))
        .sort((a, b) => {
          const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
          const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      callback(finances);
    }, (error) => {
      console.warn('Finances snapshot error:', error);
    });
  },

  addFinanceTransaction: async (transaction: Omit<FinanceTransaction, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'finances';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...transaction,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateFinanceTransaction: async (id: string, transaction: Partial<FinanceTransaction>) => {
    const path = `finances/${id}`;
    try {
      await updateDoc(doc(db, 'finances', id), sanitizeData(transaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteFinanceTransaction: async (id: string) => {
    const path = `finances/${id}`;
    try {
      await deleteDoc(doc(db, 'finances', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  bulkDeleteFinanceTransactions: async (ids: string[]) => {
    if (!auth.currentUser || ids.length === 0) return;
    try {
      // Process in chunks of 450 (Firestore limit is 500 operations per batch)
      const chunkSize = 450;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'finances', id));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'finances');
      throw error;
    }
  },

  // Cash Audits (Recuentos de dinero)
  subscribeToCashAudits: (callback: (audits: CashAudit[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'cash_audits';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CashAudit))
        .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
      callback(audits);
    }, (error) => handleFirestoreError(error, OperationType.LIST, path));
  },

  addCashAudit: async (audit: Omit<CashAudit, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'cash_audits';
    try {
      const docRef = await addDoc(collection(db, path), sanitizeData({
        ...audit,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteCashAudit: async (id: string) => {
    const path = `cash_audits/${id}`;
    try {
      await deleteDoc(doc(db, 'cash_audits', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Quotes / Presupuestos (Documento no válido como factura)
  getQuotes: async (): Promise<Quote[]> => {
    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;
    const allQuotesMap = new Map<string, Quote>();
    
    // 1. Gather all local cached quotes
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

    // 2. Fetch from Supabase service (instantly shared across all devices)
    try {
      const sbQuotes = await supabaseService.getQuotes();
      if (Array.isArray(sbQuotes) && sbQuotes.length > 0) {
        sbQuotes.forEach(q => {
          if (q && q.id) {
            if (!isQuoteDeleted(q.id, q.numero)) {
              allQuotesMap.set(q.id, q);
            } else {
              // Asynchronously clean zombie from Supabase
              supabaseService.deleteQuote(q.id, q.numero).catch(() => {});
            }
          }
        });
      }
    } catch (e) {
      console.warn('Supabase getQuotes fallback:', e);
    }

    // 3. Fetch from Firestore if authenticated (query all quotes of the business)
    if (auth.currentUser) {
      const path = 'quotes';
      try {
        const snapshot = await getDocs(collection(db, path));
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as Quote;
          const qId = docSnap.id;
          const qNum = data?.numero;
          if (!isQuoteDeleted(qId, qNum)) {
            allQuotesMap.set(qId, { id: qId, ...data });
          } else {
            // Asynchronously clean zombie doc from Firestore
            deleteDoc(docSnap.ref).catch(() => {});
          }
        });
      } catch (error) {
        try {
          const q = query(
            collection(db, path),
            where('createdBy', '==', auth.currentUser.uid)
          );
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data() as Quote;
            const qId = docSnap.id;
            const qNum = data?.numero;
            if (!isQuoteDeleted(qId, qNum)) {
              allQuotesMap.set(qId, { id: qId, ...data });
            } else {
              deleteDoc(docSnap.ref).catch(() => {});
            }
          });
        } catch (e2) {
          console.warn('Firestore quote fetch fallback to local storage:', e2);
        }
      }
    }

    // Final safety filter ensuring no deleted quote can slip through
    const rawList = Array.from(allQuotesMap.values());
    const validQuotes = filterOutDeletedQuotes(rawList);

    const merged = validQuotes.sort((a, b) => {
      const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
      const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
      return dateB.getTime() - dateA.getTime();
    });

    try {
      localStorage.setItem(cacheKey, JSON.stringify(merged));
      localStorage.setItem('cached_quotes_default', JSON.stringify(merged));
      setLocal('quotes', merged);
    } catch (e) {}

    // Auto-sync quotes to cloud (Supabase & Firestore) - ONLY ACTIVE, NON-DELETED QUOTES
    if (merged.length > 0) {
      setTimeout(async () => {
        try {
          const quotesToSync = merged
            .filter(q => !isQuoteDeleted(q.id, q.numero))
            .map(q => ({
              id: String(q.id),
              numero: q.numero || '',
              clientId: q.clientId || '',
              clientNombre: q.clientNombre || 'Consumidor Final',
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
              createdBy: auth.currentUser?.uid || q.createdBy || 'admin'
            }));

          if (quotesToSync.length > 0) {
            await supabase.from('quotes').upsert(quotesToSync, { onConflict: 'id' });
          }

          if (auth.currentUser) {
            for (const q of merged) {
              if (isQuoteDeleted(q.id, q.numero)) continue;
              try {
                const docRef = doc(db, 'quotes', q.id);
                await setDoc(docRef, sanitizeData({
                  ...q,
                  createdBy: auth.currentUser.uid
                }), { merge: true });
              } catch (e) {}
            }
          }
        } catch (e) {
          console.warn('Auto-sync quotes to cloud warning:', e);
        }
      }, 300);
    }

    return merged;
  },

  subscribeToQuotes: (callback: (quotes: Quote[]) => void) => {
    let isUnsubscribed = false;
    let unsubFirestore: (() => void) | null = null;
    let unsubSupabase: (() => void) | null = null;

    const emitCurrent = async () => {
      if (isUnsubscribed) return;
      try {
        const quotes = await inventoryService.getQuotes();
        if (!isUnsubscribed) callback(filterOutDeletedQuotes(quotes));
      } catch (e) {}
    };

    // 1. Deliver immediately from cache & fast fetches
    emitCurrent();

    // 2. Real-time from Supabase (all devices instantly synced)
    try {
      unsubSupabase = supabaseService.subscribeToQuotes(() => {
        if (!isUnsubscribed) emitCurrent();
      });
    } catch (e) {
      console.warn('Supabase subscribeToQuotes error:', e);
    }

    // 3. Real-time from Firestore
    const setupFirestore = () => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (!auth.currentUser) return;

      const path = 'quotes';
      try {
        unsubFirestore = onSnapshot(collection(db, path), () => {
          if (!isUnsubscribed) emitCurrent();
        }, () => {
          if (auth.currentUser && !isUnsubscribed) {
            try {
              const q = query(collection(db, path), where('createdBy', '==', auth.currentUser.uid));
              unsubFirestore = onSnapshot(q, () => {
                if (!isUnsubscribed) emitCurrent();
              }, () => {});
            } catch (e) {}
          }
        });
      } catch (err) {
        console.warn('Firestore subscribeToQuotes warning:', err);
      }
    };

    setupFirestore();

    const unsubAuth = onAuthStateChanged(auth, () => {
      if (!isUnsubscribed) {
        setupFirestore();
        emitCurrent();
      }
    });

    return () => {
      isUnsubscribed = true;
      if (unsubFirestore) unsubFirestore();
      if (unsubSupabase) unsubSupabase();
      unsubAuth();
    };
  },

  createQuote: async (quoteData: Omit<Quote, 'id' | 'fecha' | 'createdBy' | 'numero'> & { numero?: string }) => {
    const userId = auth.currentUser?.uid || 'user_offline';
    const path = 'quotes';
    const cacheKey = `cached_quotes_${userId}`;
    
    // Generate clean quote number e.g. COT-1042
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const numero = quoteData.numero || `COT-${randomSuffix}`;
    const now = new Date();
    const validezFecha = new Date(now.getTime() + (quoteData.validezDias || 7) * 24 * 60 * 60 * 1000).toISOString();

    const newQuote: Omit<Quote, 'id'> = {
      ...quoteData,
      numero,
      validezFecha,
      estado: quoteData.estado || 'pendiente',
      fecha: new Date().toISOString(),
      createdBy: userId
    };

    // Generate document ID upfront
    const docRef = doc(collection(db, path));
    const quoteId = docRef.id;

    // Helper to persist into all local caches
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

    // First, persist to Supabase if available with consistent ID
    try {
      await supabaseService.createQuote({ ...newQuote, id: quoteId });
    } catch (e) {
      console.warn('Supabase createQuote fallback:', e);
    }

    // If authenticated in Firebase, attempt Firestore persistence
    if (auth.currentUser) {
      try {
        await setDoc(docRef, sanitizeData({ ...newQuote, id: quoteId }));
        const created: Quote = { id: quoteId, ...newQuote };
        saveToCaches(created);
        return created;
      } catch (error) {
        console.warn('Fallback: saving quote locally due to firestore error:', error);
      }
    }

    // Local / Offline fallback (always succeeds)
    const created: Quote = { id: quoteId, ...newQuote };
    unmarkQuoteDeleted(quoteId, numero);
    saveToCaches(created);
    return created;
  },

  updateQuote: async (id: string, updates: Partial<Quote>) => {
    try {
      if ('updateQuote' in supabaseService) {
        await (supabaseService as any).updateQuote(id, updates);
      }
    } catch (e) {}

    const path = `quotes/${id}`;
    const userId = auth.currentUser?.uid || 'user_offline';
    const cacheKey = `cached_quotes_${userId}`;

    // Update all local caches
    const keys = [cacheKey, 'cached_quotes_user_offline', 'cached_quotes_default', 'quotes', 'sb_cache_quotes'];
    for (const k of keys) {
      try {
        const cached = localStorage.getItem(k);
        if (cached) {
          const list: Quote[] = JSON.parse(cached);
          const updatedList = list.map(q => q.id === id ? { ...q, ...updates } : q);
          localStorage.setItem(k, JSON.stringify(updatedList));
        }
      } catch (e) {}
    }

    if (auth.currentUser && !id.startsWith('local_')) {
      try {
        await updateDoc(doc(db, 'quotes', id), sanitizeData(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },

  deleteQuote: async (id: string, numero?: string) => {
    // 0. Resolve quote number if not provided
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

    // 1. Mark permanently in tombstones FIRST so no concurrent read or sync resurrects it
    markQuoteAsDeleted(id, resolvedNumero);

    // 2. Aggressively scrub from ALL localStorage keys and cached arrays
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

    // 3. Clean from Supabase service and direct Supabase client
    try {
      await supabaseService.deleteQuote(id, resolvedNumero);
    } catch (e) {
      console.warn('Supabase deleteQuote fallback:', e);
    }

    try {
      if (id) {
        await supabase.from('quotes').delete().eq('id', id);
      }
      if (resolvedNumero) {
        await supabase.from('quotes').delete().eq('numero', resolvedNumero);
      }
    } catch (e) {
      console.warn('Direct Supabase delete warning:', e);
    }

    // 4. Clean from Firestore (try direct doc delete and queries)
    try {
      if (id && !id.startsWith('local_')) {
        await deleteDoc(doc(db, 'quotes', id)).catch(() => {});
      }
      if (resolvedNumero) {
        const qNum = query(collection(db, 'quotes'), where('numero', '==', resolvedNumero));
        const snapNum = await getDocs(qNum);
        for (const d of snapNum.docs) {
          await deleteDoc(doc(db, 'quotes', d.id)).catch(() => {});
        }
      }
      const qId = query(collection(db, 'quotes'), where('id', '==', id));
      const snapId = await getDocs(qId);
      for (const d of snapId.docs) {
        await deleteDoc(doc(db, 'quotes', d.id)).catch(() => {});
      }
    } catch (error) {
      console.warn('Firestore deleteQuote warning:', error);
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

    const baseTxId = doc(collection(db, 'transactions')).id;
    const nowIso = new Date().toISOString();

    // Cache lookup in case items were saved with manual descriptions that match existing products
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

    // 1. Register items as real sales (persists to Supabase, local cache, and Firestore)
    const registered = await inventoryService.registerSale(salesToRegister);

    // 2. Mark the quote as accepted/approved in database
    try {
      await inventoryService.updateQuote(quote.id, { estado: 'aceptada' });
    } catch (e) {
      console.warn('Could not update quote state to aceptada:', e);
    }

    // 3. Delete the pending quotation so it is completely removed from the pending list
    await inventoryService.deleteQuote(quote.id, quote.numero);

    return (registered && registered.length > 0 ? registered : salesToRegister) as Sale[];
  },

  syncAllToSupabase: async () => {
    // 1. Collect products from Firestore and local storage
    let products: Product[] = [];
    try {
      if (auth.currentUser) {
        try {
          const q = query(collection(db, 'products'), where('createdBy', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          products = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        } catch (e) {}
      }
      if (products.length === 0) {
        try {
          const snapAll = await getDocs(collection(db, 'products'));
          products = snapAll.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Firestore products read error during sync:', e);
    }

    if (products.length === 0) {
      // Scan all localStorage keys for any stored products
      try {
        const cached = localStorage.getItem('products') || localStorage.getItem('sb_cache_products') || localStorage.getItem('cached_products');
        if (cached) products = JSON.parse(cached);
      } catch (e) {}

      if (products.length === 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('product') || key.includes('backup') || key.includes('inventory'))) {
            try {
              const val = JSON.parse(localStorage.getItem(key) || '');
              if (Array.isArray(val) && val.length > 0 && (val[0].precio !== undefined || val[0].codigo !== undefined)) {
                products = val;
                break;
              } else if (val && val.products && Array.isArray(val.products)) {
                products = val.products;
                break;
              }
            } catch (e) {}
          }
        }
      }
    }

    // 2. Collect warehouses
    let warehouses: Warehouse[] = [];
    try {
      if (auth.currentUser) {
        try {
          const q = query(collection(db, 'warehouses'), where('createdBy', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          warehouses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
        } catch (e) {}
      }
      if (warehouses.length === 0) {
        try {
          const snapAll = await getDocs(collection(db, 'warehouses'));
          warehouses = snapAll.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
        } catch (e) {}
      }
    } catch (e) {}

    // 3. Collect quotes
    let quotes: Quote[] = [];
    try {
      const cacheKey = auth.currentUser ? `cached_quotes_${auth.currentUser.uid}` : 'cached_quotes_default';
      const cached = localStorage.getItem(cacheKey);
      if (cached) quotes = JSON.parse(cached);
    } catch (e) {}
    if (quotes.length === 0 && auth.currentUser) {
      try {
        const q = query(collection(db, 'quotes'), where('createdBy', '==', auth.currentUser.uid));
        const snap = await getDocs(q);
        quotes = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote));
      } catch (e) {}
    }
    quotes = filterOutDeletedQuotes(quotes);

    // 4. Collect sales
    let sales: Sale[] = [];
    try {
      if (auth.currentUser) {
        try {
          const q = query(collection(db, 'sales'), where('createdBy', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
        } catch (e) {}
      }
      if (sales.length === 0) {
        try {
          const snapAll = await getDocs(collection(db, 'sales'));
          sales = snapAll.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
        } catch (e) {}
      }
    } catch (e) {}

    return await supabaseService.migrateDataToSupabase({
      products,
      warehouses,
      quotes,
      sales
    });
  }
};
