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
import { supabase } from '../supabase';
import { supabaseService } from './supabaseService';
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

export const inventoryService = {
  // Products
  getProducts: async () => {
    try {
      const sbProducts = await supabaseService.getProducts();
      if (sbProducts && sbProducts.length > 0) {
        return sbProducts;
      }
    } catch (e) {
      console.warn('Supabase getProducts warning:', e);
    }

    if (!auth.currentUser) {
      return await supabaseService.getProducts();
    }
    const path = 'products';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any || 0);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any || 0);
          return dateB.getTime() - dateA.getTime();
        });
      return list.length > 0 ? list : await supabaseService.getProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return await supabaseService.getProducts();
    }
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
    // Initial fetch from Supabase
    supabaseService.getProducts().then(products => {
      if (products && products.length > 0) callback(products);
    }).catch(() => {});

    // Supabase Realtime channel
    const channel = supabase
      .channel('public:products_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const updated = await supabaseService.getProducts();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    try {
      const sbW = await supabaseService.getWarehouses();
      if (sbW && sbW.length > 0) return sbW;
    } catch (e) {
      console.warn('Supabase getWarehouses fallback:', e);
    }

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
    supabaseService.getWarehouses().then(warehouses => {
      if (warehouses && warehouses.length > 0) callback(warehouses);
    }).catch(() => {});

    const channel = supabase
      .channel('public:warehouses_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, async () => {
        const updated = await supabaseService.getWarehouses();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    let sbClients: Client[] = [];
    try {
      sbClients = await supabaseService.getClients();
    } catch (e) {
      console.warn(e);
    }

    if (!auth.currentUser) return sbClients;
    const path = 'clients';
    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const fsClients = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Client));

      const map = new Map<string, Client>();
      sbClients.forEach(c => map.set(c.id, c));
      fsClients.forEach(c => map.set(c.id, c));
      return Array.from(map.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return sbClients;
    }
  },

  subscribeToClients: (callback: (clients: Client[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'clients';
    const q = query(
      collection(db, path),
      where('createdBy', '==', auth.currentUser.uid),
      orderBy('nombre', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
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
      where('createdBy', '==', auth.currentUser.uid),
      orderBy('nombre', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
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
        where('createdBy', '==', auth.currentUser.uid),
        orderBy('fecha', 'desc'),
        limit(maxResults) 
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement));
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
        where('productId', '==', productId),
        orderBy('fecha', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement));
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
  getSales: async (days: number = 30) => {
    let sbSales: Sale[] = [];
    try {
      sbSales = await supabaseService.getSales();
    } catch (e) {
      console.warn('Supabase getSales warning:', e);
    }

    let fsSales: Sale[] = [];
    if (auth.currentUser) {
      const path = 'sales';
      try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, path),
          where('createdBy', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        fsSales = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Sale))
          .filter(s => {
            const date = (s.fecha as any)?.toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any);
            return date >= since;
          });
      } catch (error) {
        console.warn('Firestore getSales warning:', error);
      }
    }

    // Merge & Deduplicate fsSales and sbSales without duplicates
    const salesMap = new Map<string, Sale>();
    const seenTx = new Set<string>();

    const getTimestamp = (s: Sale): number => {
      const d = (s.fecha as any)?.toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any || 0);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // 1. Prioritize Firestore sales (authoritative cloud records)
    for (const s of fsSales) {
      salesMap.set(s.id, s);
      if (s.transactionId) {
        seenTx.add(`${s.transactionId}_${s.productId || ''}`);
      }
    }

    // 2. Include Supabase sales only if not already present in Firestore
    for (const s of sbSales) {
      if (salesMap.has(s.id)) continue;
      if (s.transactionId && seenTx.has(`${s.transactionId}_${s.productId || ''}`)) continue;

      // Check if there is already a matching sale with same product, qty, total within 25 seconds
      const sTime = getTimestamp(s);
      let isDuplicate = false;
      if (sTime > 0) {
        for (const existing of salesMap.values()) {
          const exTime = getTimestamp(existing);
          if (
            existing.productId === s.productId &&
            (existing.variantId || '') === (s.variantId || '') &&
            existing.cantidad === s.cantidad &&
            existing.total === s.total &&
            Math.abs(exTime - sTime) <= 25000
          ) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        salesMap.set(s.id, s);
        if (s.transactionId) {
          seenTx.add(`${s.transactionId}_${s.productId || ''}`);
        }
      }
    }

    // 3. Sort by date descending
    const merged = Array.from(salesMap.values());
    merged.sort((a, b) => {
      const dateA = getTimestamp(a);
      const dateB = getTimestamp(b);
      return dateB - dateA;
    });

    // 4. Secondary deduplication filter (catches any duplicate records saved in the database)
    const result: Sale[] = [];
    for (const sale of merged) {
      const saleTime = getTimestamp(sale);
      const dup = result.some(prev => {
        if (prev.id === sale.id) return true;
        if (prev.transactionId && sale.transactionId && prev.transactionId === sale.transactionId && (prev.productId || '') === (sale.productId || '')) return true;
        const timeDiff = Math.abs(getTimestamp(prev) - saleTime);
        const isIdentical =
          prev.productId === sale.productId &&
          (prev.variantId || '') === (sale.variantId || '') &&
          prev.cantidad === sale.cantidad &&
          prev.total === sale.total;
        return isIdentical && timeDiff <= 15000;
      });

      if (!dup) {
        result.push(sale);
      }
    }

    return result;
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

  subscribeToSales: (callback: (sales: Sale[]) => void) => {
    supabaseService.getSales(100).then(sales => {
      if (sales) callback(sales);
    }).catch(() => {});

    const channel = supabase
      .channel('public:sales_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async () => {
        const updated = await supabaseService.getSales(100);
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToRecentSales: (callback: (sales: Sale[]) => void, days: number = 30) => {
    supabaseService.getSales(days).then(sales => {
      if (sales) callback(sales);
    }).catch(() => {});

    const channel = supabase
      .channel('public:sales_recent_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async () => {
        const updated = await supabaseService.getSales(days);
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  registerSale: async (saleOrSales: (Omit<Sale, 'id' | 'fecha' | 'createdBy' | 'total'> & { id?: string; transactionId?: string; total?: number }) | (Omit<Sale, 'id' | 'fecha' | 'createdBy' | 'total'> & { id?: string; transactionId?: string; total?: number })[]) => {
    const rawSales = Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales];
    if (rawSales.length === 0) return;

    // Generate or maintain consistent transactionId across Supabase and Firestore
    const baseTransactionId = (rawSales[0] as any)?.transactionId || doc(collection(db, 'transactions')).id;

    // Create synchronized sales with matching deterministic IDs
    const preparedSales = rawSales.map((s, idx) => {
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
        total
      };
    });

    // 1. Persist to Supabase / Local storage cache with matching IDs
    try {
      await supabaseService.registerSale(preparedSales);
    } catch (e) {
      console.warn('Supabase registerSale fallback:', e);
    }

    // 2. Persist to Firestore if authenticated
    if (!auth.currentUser) return;
    const path = 'sales/batch';
    try {
      const batch = writeBatch(db);

      for (const sale of preparedSales) {
        const productRef = doc(db, 'products', sale.productId);
        const productSnap = await getDoc(productRef);
        const productData = productSnap.data() as Product;
        const currentCost = productData?.costo || 0;

        // Use the EXACT same ID in Firestore as in Supabase:
        const saleRef = doc(db, 'sales', sale.id);
        batch.set(saleRef, sanitizeData({
          ...sale,
          costo: currentCost,
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid
        }));

        // Handle Stock Deduction (overall and variant if present)
        const updatePayload: any = {
          cantidad: increment(-sale.cantidad),
          updatedAt: serverTimestamp()
        };
        if (sale.variantId && productData?.variants?.length) {
          updatePayload.variants = productData.variants.map(v => {
            if (v.id === sale.variantId) {
              return { ...v, cantidad: Math.max(0, (v.cantidad || 0) - sale.cantidad) };
            }
            return v;
          });
        }
        batch.update(productRef, updatePayload);

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

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
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
        where('proveedor', '==', proveedor),
        orderBy('fecha', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToPurchases: (callback: (purchases: Purchase[]) => void) => {
    supabaseService.getPurchases().then(purchases => {
      if (purchases) callback(purchases);
    }).catch(() => {});

    const channel = supabase
      .channel('public:purchases_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, async () => {
        const updated = await supabaseService.getPurchases();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToRecentPurchases: (callback: (purchases: Purchase[]) => void, days: number = 30) => {
    supabaseService.getPurchases().then(purchases => {
      if (purchases) callback(purchases);
    }).catch(() => {});

    const channel = supabase
      .channel('public:purchases_recent_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, async () => {
        const updated = await supabaseService.getPurchases();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  registerPurchase: async (purchase: Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases/batch';
    try {
      const batch = writeBatch(db);
      const total = purchase.cantidad * purchase.costo;
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

  registerBulkPurchase: async (purchases: Omit<Purchase, 'id' | 'fecha' | 'createdBy' | 'total'>[]) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'purchases/bulk';
    try {
      const batch = writeBatch(db);
      const transactionId = doc(collection(db, 'transactions')).id;

      for (const purchase of purchases) {
        const total = purchase.cantidad * purchase.costo;
        const purchaseRef = doc(collection(db, 'purchases'));
        
        batch.set(purchaseRef, sanitizeData({
          ...purchase,
          total,
          transactionId,
          fecha: serverTimestamp(),
          createdBy: auth.currentUser.uid
        }));

        const productRef = doc(db, 'products', purchase.productId);
        batch.update(productRef, {
          cantidad: increment(purchase.cantidad),
          updatedAt: serverTimestamp()
        });

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
    // 1. Delete from Supabase / local cache first for instant UI response and persistence
    try {
      await supabaseService.deleteSale(id);
    } catch (e) {
      console.warn('Supabase deleteSale error:', e);
    }

    // 2. Delete from Firestore if authenticated
    if (!auth.currentUser) return;
    const path = `sales/${id}`;
    try {
      const saleRef = doc(db, 'sales', id);
      const saleSnap = await getDoc(saleRef);
      
      if (!saleSnap.exists()) return;
      
      const sale = saleSnap.data() as Sale;
      const batch = writeBatch(db);
      
      // Delete sale document
      batch.delete(saleRef);
      
      if (sale.isCombo && sale.comboItems) {
        // Restore stock for all combo items
        for (const item of sale.comboItems) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            batch.update(productRef, {
              cantidad: increment(item.cantidad),
              updatedAt: serverTimestamp()
            });

            const movementRef = doc(collection(db, 'movements'));
            batch.set(movementRef, {
              productId: item.productId,
              productNombre: item.productNombre,
              tipo: 'entrada',
              cantidad: item.cantidad,
              fecha: serverTimestamp(),
              createdBy: auth.currentUser.uid,
              nota: `Venta eliminada (Retorno de combo: ${sale.productNombre})`
            });
          }
        }
      } else if (sale.productId && sale.productId !== 'combo') {
        const productRef = doc(db, 'products', sale.productId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          // Restore stock for standard sale (and variant if specified)
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
          batch.update(productRef, updatePayload);
          
          // Add movement for cancellation
          const movementRef = doc(collection(db, 'movements'));
          batch.set(movementRef, {
            productId: sale.productId,
            productNombre: sale.productNombre,
            tipo: 'entrada',
            cantidad: sale.cantidad,
            fecha: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            nota: 'Venta eliminada'
          });
        }
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
        where('createdBy', '==', auth.currentUser.uid),
        orderBy('fecha', 'desc'),
        limit(maxResults)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      where('createdBy', '==', auth.currentUser.uid),
      orderBy('fecha', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      const backups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      where('createdBy', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Combo));
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
    try {
      const sbFinances = await supabaseService.getFinances();
      if (sbFinances && sbFinances.length > 0) return sbFinances;
    } catch (e) {}

    return [];
  },

  subscribeToFinances: (callback: (transactions: FinanceTransaction[]) => void) => {
    supabaseService.getFinances().then(finances => {
      if (finances) callback(finances);
    }).catch(() => {});

    const channel = supabase
      .channel('public:finances_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, async () => {
        const updated = await supabaseService.getFinances();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      where('createdBy', '==', auth.currentUser.uid),
      orderBy('fecha', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashAudit));
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
  getQuotes: async () => {
    try {
      const sbQuotes = await supabaseService.getQuotes();
      if (sbQuotes && sbQuotes.length > 0) {
        return sbQuotes;
      }
    } catch (e) {
      console.warn('Supabase getQuotes warning:', e);
    }

    const cacheKey = auth.currentUser ? `cached_quotes_${auth.currentUser.uid}` : 'cached_quotes_default';
    let localQuotes: Quote[] = [];
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) localQuotes = JSON.parse(cached);
    } catch (e) {}

    if (!auth.currentUser) return localQuotes;
    const path = 'quotes';

    try {
      const q = query(
        collection(db, path),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const firestoreQuotes = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Quote));

      // Merge firestore quotes with local cache
      const map = new Map<string, Quote>();
      firestoreQuotes.forEach(q => map.set(q.id, q));
      localQuotes.forEach(q => {
        if (!map.has(q.id)) {
          map.set(q.id, q);
        }
      });

      const merged = Array.from(map.values()).sort((a, b) => {
        const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha as any || 0);
        const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha as any || 0);
        return dateB.getTime() - dateA.getTime();
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    } catch (error) {
      console.warn('Firestore quote fetch fallback to local storage:', error);
      return localQuotes;
    }
  },

  subscribeToQuotes: (callback: (quotes: Quote[]) => void) => {
    supabaseService.getQuotes().then(quotes => {
      if (quotes) callback(quotes);
    }).catch(() => {});

    const channel = supabase
      .channel('public:quotes_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, async () => {
        const updated = await supabaseService.getQuotes();
        callback(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  createQuote: async (quoteData: Omit<Quote, 'id' | 'fecha' | 'createdBy' | 'numero'> & { numero?: string }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'quotes';
    const cacheKey = `cached_quotes_${auth.currentUser.uid}`;
    
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
      createdBy: auth.currentUser.uid
    };

    // Persist to Supabase
    try {
      await supabaseService.createQuote(newQuote);
    } catch (e) {
      console.warn('Supabase createQuote fallback:', e);
    }

    try {
      const docRef = await addDoc(collection(db, path), sanitizeData(newQuote));
      const created: Quote = { id: docRef.id, ...newQuote };
      
      // Update local storage immediately
      try {
        const cached = localStorage.getItem(cacheKey);
        const list: Quote[] = cached ? JSON.parse(cached) : [];
        const updated = [created, ...list.filter(q => q.id !== created.id)];
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {}
      
      return created;
    } catch (error) {
      console.warn('Fallback: saving quote locally due to firestore error:', error);
      const localId = `local_quote_${Date.now()}`;
      const created: Quote = { id: localId, ...newQuote };
      try {
        const cached = localStorage.getItem(cacheKey);
        const list: Quote[] = cached ? JSON.parse(cached) : [];
        const updated = [created, ...list.filter(q => q.id !== created.id)];
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {}
      return created;
    }
  },

  updateQuote: async (id: string, updates: Partial<Quote>) => {
    try {
      // If needed, update in supabase
    } catch (e) {}

    const path = `quotes/${id}`;
    const cacheKey = auth.currentUser ? `cached_quotes_${auth.currentUser.uid}` : 'cached_quotes_default';

    // Update local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list: Quote[] = JSON.parse(cached);
        const updatedList = list.map(q => q.id === id ? { ...q, ...updates } : q);
        localStorage.setItem(cacheKey, JSON.stringify(updatedList));
      }
    } catch (e) {}

    if (auth.currentUser && !id.startsWith('local_')) {
      try {
        await updateDoc(doc(db, 'quotes', id), sanitizeData(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },

  deleteQuote: async (id: string) => {
    try {
      await supabaseService.deleteQuote(id);
    } catch (e) {
      console.warn('Supabase deleteQuote fallback:', e);
    }

    const path = `quotes/${id}`;
    const cacheKey = auth.currentUser ? `cached_quotes_${auth.currentUser.uid}` : 'cached_quotes_default';

    // Update local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list: Quote[] = JSON.parse(cached);
        const filtered = list.filter(q => q.id !== id);
        localStorage.setItem(cacheKey, JSON.stringify(filtered));
      }
    } catch (e) {}

    if (auth.currentUser && !id.startsWith('local_')) {
      try {
        await deleteDoc(doc(db, 'quotes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  convertQuoteToSale: async (quote: Quote) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    // Register items as real sales which reduces inventory stock
    const salesToRegister = quote.items.map(item => ({
      productId: item.productId,
      productNombre: item.productNombre,
      variantId: item.variantId,
      variantNombre: item.variantNombre,
      cantidad: item.cantidad,
      precio: item.precio,
      total: item.total,
      clientId: quote.clientId,
      clientNombre: quote.clientNombre
    }));

    await inventoryService.registerSale(salesToRegister);
    await inventoryService.updateQuote(quote.id, {
      estado: 'aceptada'
    });
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
