/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  query, 
  where,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItem } from '../types';
import { inventoryService } from './inventoryService';

const getStorageKey = () => `purchases_orders_${auth.currentUser?.uid || 'anon'}`;

const getLocalOrders = (): PurchaseOrder[] => {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading purchase orders from localStorage:', e);
    return [];
  }
};

const setLocalOrders = (orders: PurchaseOrder[]) => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving purchase orders to localStorage:', e);
  }
};

export const samplePurchaseOrders: PurchaseOrder[] = [];

export const purchaseOrderService = {
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    if (!auth.currentUser) return [];
    const uid = auth.currentUser.uid;
    const local = getLocalOrders();

    try {
      const q = query(
        collection(db, 'purchase_orders'),
        where('createdBy', '==', uid)
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        ...(doc.data() as PurchaseOrder),
        id: doc.id
      })).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.fechaEmision || 0).getTime();
        const dateB = new Date(b.createdAt || b.fechaEmision || 0).getTime();
        return dateB - dateA;
      });
      setLocalOrders(orders);
      return orders;
    } catch (e) {
      console.warn('Firestore purchase orders fallback to local:', e);
      return local;
    }
  },

  async createPurchaseOrder(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const currentOrders = await this.getPurchaseOrders();
    
    // Generate next number: OC-1001, OC-1002...
    const maxNum = currentOrders.reduce((max, o) => {
      const match = o.numero?.match(/OC-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 1000);
    const numero = `OC-${maxNum + 1}`;
    const newDocRef = doc(collection(db, 'purchase_orders'));
    const id = newDocRef.id;
    const now = new Date().toISOString();

    const subtotal = (data.items || []).reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    const flete = Number(data.flete) || 0;
    const total = subtotal + flete;

    const newOrder: PurchaseOrder = {
      id,
      numero,
      proveedor: data.proveedor || 'Proveedor General',
      proveedorTelefono: data.proveedorTelefono || '',
      proveedorEmail: data.proveedorEmail || '',
      fechaEmision: data.fechaEmision || now,
      fechaEsperada: data.fechaEsperada || '',
      condicionPago: data.condicionPago || 'Contado',
      estado: data.estado || 'borrador',
      items: data.items || [],
      subtotal,
      flete,
      total,
      notas: data.notas || '',
      createdBy: auth.currentUser?.uid || 'anon',
      createdAt: now,
      updatedAt: now
    };

    const updated = [newOrder, ...currentOrders];
    setLocalOrders(updated);

    try {
      await setDoc(newDocRef, newOrder);
    } catch (e) {
      console.warn('Firestore createPurchaseOrder fallback:', e);
    }

    return newOrder;
  },

  async updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const currentOrders = await this.getPurchaseOrders();
    const index = currentOrders.findIndex(o => o.id === id);
    if (index === -1) throw new Error('Orden de compra no encontrada');

    const existing = currentOrders[index];

    let subtotal = existing.subtotal;
    if (updates.items) {
      subtotal = updates.items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    }
    const flete = updates.flete !== undefined ? Number(updates.flete) : (existing.flete || 0);
    const total = subtotal + flete;

    const merged: PurchaseOrder = {
      ...existing,
      ...updates,
      subtotal,
      flete,
      total,
      updatedAt: new Date().toISOString()
    };

    currentOrders[index] = merged;
    setLocalOrders(currentOrders);

    try {
      await updateDoc(doc(db, 'purchase_orders', id), merged as any);
    } catch (e) {
      console.warn('Firestore updatePurchaseOrder fallback:', e);
    }

    return merged;
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    const current = getLocalOrders();
    const filtered = current.filter(o => o.id !== id && o.numero !== id);
    setLocalOrders(filtered);

    try {
      await deleteDoc(doc(db, 'purchase_orders', id));
    } catch (e) {
      console.warn('Firestore direct deletePurchaseOrder fallback:', e);
    }

    try {
      const q = query(collection(db, 'purchase_orders'), where('id', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'purchase_orders', d.id));
      }
    } catch (e) {
      console.warn('Firestore query deletePurchaseOrder fallback:', e);
    }
  },

  async updateStatus(id: string, estado: PurchaseOrderStatus): Promise<PurchaseOrder> {
    const updates: Partial<PurchaseOrder> = { estado };
    if (estado === 'recibida') {
      updates.receivedAt = new Date().toISOString();
    }
    return this.updatePurchaseOrder(id, updates);
  },

  async updateOrderStatus(id: string, estado: PurchaseOrderStatus): Promise<PurchaseOrder> {
    return this.updateStatus(id, estado);
  },

  /**
   * Receives goods from a Purchase Order and automatically adds stock and registers purchases
   */
  async receiveOrderAndStock(order: PurchaseOrder): Promise<void> {
    const purchaseRecords = order.items.map(item => ({
      productId: item.productId,
      productNombre: item.productNombre,
      cantidad: item.cantidad,
      costo: item.costoEstimado,
      proveedor: order.proveedor
    }));

    // Register all bulk purchases in the inventory service (updates stock automatically)
    await inventoryService.registerBulkPurchase(purchaseRecords);

    // Mark PO as received
    await this.updateStatus(order.id, 'recibida');
  },

  async receiveGoods(orderId: string, _items?: any[], _notes?: string): Promise<void> {
    const orders = await this.getPurchaseOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await this.receiveOrderAndStock(order);
    }
  },

  subscribeToPurchaseOrders(callback: (orders: PurchaseOrder[]) => void) {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const uid = auth.currentUser.uid;
    const local = getLocalOrders();
    callback(local);

    try {
      const q = query(
        collection(db, 'purchase_orders'),
        where('createdBy', '==', uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          ...(doc.data() as PurchaseOrder),
          id: doc.id
        })).sort((a, b) => {
          const dateA = new Date(a.createdAt || a.fechaEmision || 0).getTime();
          const dateB = new Date(b.createdAt || b.fechaEmision || 0).getTime();
          return dateB - dateA;
        });
        setLocalOrders(orders);
        callback(orders);
      }, (err) => {
        console.warn('Snapshot listener for purchase_orders:', err);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Could not establish real-time listener for purchase_orders:', e);
      return () => {};
    }
  },

  /**
   * Formats order details for WhatsApp to send directly to the supplier
   */
  getWhatsAppMessage(order: PurchaseOrder): string {
    let msg = `*ORDEN DE COMPRA OFICIAL*\n`;
    msg += `📋 *Número:* ${order.numero}\n`;
    msg += `🏢 *Proveedor:* ${order.proveedor}\n`;
    msg += `📅 *Fecha:* ${new Date(order.fechaEmision).toLocaleDateString('es-AR')}\n`;
    if (order.fechaEsperada) {
      msg += `🚚 *Fecha requerida de entrega:* ${new Date(order.fechaEsperada).toLocaleDateString('es-AR')}\n`;
    }
    if (order.condicionPago) {
      msg += `💳 *Condición de Pago:* ${order.condicionPago}\n`;
    }
    msg += `--------------------------------\n`;
    msg += `*DETALLE DE ARTÍCULOS PEDIDOS:*\n`;

    order.items.forEach((item, idx) => {
      const codStr = item.codigo ? `[${item.codigo}] ` : '';
      msg += `${idx + 1}. *${codStr}${item.productNombre}*\n`;
      msg += `   ${item.cantidad} un. x $${item.costoEstimado.toLocaleString('es-AR')} = *$${item.subtotal.toLocaleString('es-AR')}*\n`;
    });

    msg += `--------------------------------\n`;
    if (order.flete && order.flete > 0) {
      msg += `Subtotal: $${order.subtotal.toLocaleString('es-AR')}\n`;
      msg += `Flete / Envío: $${order.flete.toLocaleString('es-AR')}\n`;
    }
    msg += `💰 *TOTAL ESTIMADO: $${order.total.toLocaleString('es-AR')}*\n\n`;

    if (order.notas) {
      msg += `📝 *Instrucciones / Observaciones:* ${order.notas}\n\n`;
    }

    msg += `_Por favor confirmar recepción del pedido, stock disponible y fecha de despacho._\n`;
    msg += `¡Muchas gracias!`;

    const encoded = encodeURIComponent(msg);
    if (order.proveedorTelefono) {
      const cleanPhone = order.proveedorTelefono.replace(/\D/g, '');
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }
};
