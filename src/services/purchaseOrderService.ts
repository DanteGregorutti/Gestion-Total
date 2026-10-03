/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from '../firebase';
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('purchase_orders_changed', { detail: orders }));
    }
  } catch (e) {
    console.error('Error saving purchase orders to localStorage:', e);
  }
};

export const samplePurchaseOrders: PurchaseOrder[] = [];

export const purchaseOrderService = {
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const local = getLocalOrders();
    return local.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.fechaEmision || 0).getTime();
      const dateB = new Date(b.createdAt || b.fechaEmision || 0).getTime();
      return dateB - dateA;
    });
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
    const id = 'po_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
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

    return merged;
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    const current = getLocalOrders();
    const filtered = current.filter(o => o.id !== id && o.numero !== id);
    setLocalOrders(filtered);
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
    const emit = () => {
      const local = getLocalOrders().sort((a, b) => {
        const dateA = new Date(a.createdAt || a.fechaEmision || 0).getTime();
        const dateB = new Date(b.createdAt || b.fechaEmision || 0).getTime();
        return dateB - dateA;
      });
      callback(local);
    };

    emit();

    const handler = () => emit();
    if (typeof window !== 'undefined') {
      window.addEventListener('purchase_orders_changed', handler);
      window.addEventListener('storage', handler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('purchase_orders_changed', handler);
        window.removeEventListener('storage', handler);
      }
    };
  },

  /**
   * Formats order details for WhatsApp to send directly to the supplier
   */
  getWhatsAppMessage(order: PurchaseOrder): string {
    const lines = [
      `*ORDEN DE COMPRA: ${order.numero}*`,
      `📅 Fecha: ${new Date(order.fechaEmision).toLocaleDateString()}`,
      `🏭 Proveedor: ${order.proveedor}`,
      `💳 Condición: ${order.condicionPago}`,
      '',
      '*DETALLE DE PRODUCTOS:*'
    ];

    order.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.productNombre} x${item.cantidad} ($${item.costoEstimado.toLocaleString()} c/u) = $${item.subtotal.toLocaleString()}`);
    });

    if (order.flete && order.flete > 0) {
      lines.push(`🚚 Flete / Envío: $${order.flete.toLocaleString()}`);
    }

    lines.push('');
    lines.push(`*TOTAL ORDEN: $${order.total.toLocaleString()}*`);

    if (order.fechaEsperada) {
      lines.push(`⏱️ Entrega esperada: ${new Date(order.fechaEsperada).toLocaleDateString()}`);
    }

    if (order.notas) {
      lines.push(`📝 Observaciones: ${order.notas}`);
    }

    return encodeURIComponent(lines.join('\n'));
  }
};
