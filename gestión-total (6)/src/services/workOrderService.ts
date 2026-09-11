/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
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
import { WorkOrder, WorkOrderStatus, WorkOrderItem, RepairQuote } from '../types';
import { inventoryService } from './inventoryService';

const getStorageKey = () => `taller_work_orders_${auth.currentUser?.uid || 'anon'}`;
const getQuotesStorageKey = () => `taller_repair_quotes_${auth.currentUser?.uid || 'anon'}`;

const getLocalOrders = (): WorkOrder[] => {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading work orders from localStorage:', e);
    return [];
  }
};

const setLocalOrders = (orders: WorkOrder[]) => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving work orders to localStorage:', e);
  }
};

const getLocalRepairQuotes = (): RepairQuote[] => {
  try {
    const raw = localStorage.getItem(getQuotesStorageKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading repair quotes from localStorage:', e);
    return [];
  }
};

const setLocalRepairQuotes = (quotes: RepairQuote[]) => {
  try {
    localStorage.setItem(getQuotesStorageKey(), JSON.stringify(quotes));
  } catch (e) {
    console.error('Error saving repair quotes to localStorage:', e);
  }
};

// Initial sample data (empty to avoid cross-user pollution)
const sampleRepairQuotes: RepairQuote[] = [];
const sampleWorkOrders: WorkOrder[] = [];

export const workOrderService = {
  async getWorkOrders(): Promise<WorkOrder[]> {
    if (!auth.currentUser) return [];
    const uid = auth.currentUser.uid;
    const local = getLocalOrders();

    try {
      const q = query(
        collection(db, 'work_orders'),
        where('createdBy', '==', uid)
      );
      const snapshot = await getDocs(q);
      const remoteOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkOrder[];

      const sorted = remoteOrders.sort(
        (a, b) => new Date(b.fechaIngreso || b.createdAt || 0).getTime() - new Date(a.fechaIngreso || a.createdAt || 0).getTime()
      );
      setLocalOrders(sorted);
      return sorted;
    } catch (e) {
      console.warn('Firestore getWorkOrders fallback to local:', e);
      return local;
    }
  },

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    const orders = await this.getWorkOrders();
    return orders.find(o => o.id === id || o.numero === id) || null;
  },

  getNextOrderNumber(currentOrders: WorkOrder[]): string {
    let maxNum = 0;
    currentOrders.forEach(o => {
      const match = o.numero?.match(/OT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `OT-${(maxNum + 1).toString().padStart(4, '0')}`;
  },

  async createWorkOrder(data: Partial<WorkOrder>): Promise<WorkOrder> {
    const currentOrders = await this.getWorkOrders();
    const numero = data.numero || this.getNextOrderNumber(currentOrders);
    const now = new Date().toISOString();
    const id = `ot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const total = (Number(data.costoManoObra) || 0) + (Number(data.costoRepuestos) || 0);
    const anticipo = Number(data.anticipo) || 0;
    const saldoPendiente = Math.max(0, total - anticipo);

    const newOrder: WorkOrder = {
      id,
      numero,
      clientId: data.clientId || '',
      clientNombre: data.clientNombre || 'Cliente Particular',
      clientTelefono: data.clientTelefono || '',
      clientEmail: data.clientEmail || '',
      equipo: data.equipo || 'Equipo / Trabajo sin especificar',
      marcaModelo: data.marcaModelo || '',
      serieOPatente: data.serieOPatente || '',
      fallaReportada: data.fallaReportada || '',
      diagnostico: data.diagnostico || '',
      trabajoRealizado: data.trabajoRealizado || '',
      repuestos: data.repuestos || [],
      costoManoObra: Number(data.costoManoObra) || 0,
      costoRepuestos: Number(data.costoRepuestos) || 0,
      total,
      anticipo,
      saldoPendiente,
      estado: data.estado || 'ingresado',
      prioridad: data.prioridad || 'normal',
      fechaIngreso: data.fechaIngreso || now,
      fechaPrometida: data.fechaPrometida || '',
      fechaEntrega: data.fechaEntrega || '',
      notasInternas: data.notasInternas || '',
      createdBy: auth.currentUser?.uid || 'admin',
      createdAt: now,
      updatedAt: now
    };

    // Save locally
    const updated = [newOrder, ...currentOrders];
    setLocalOrders(updated);

    // Save to Firestore asynchronously
    try {
      await setDoc(doc(db, 'work_orders', id), newOrder);
    } catch (e) {
      console.warn('Firestore createWorkOrder fallback:', e);
    }

    return newOrder;
  },

  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    const currentOrders = await this.getWorkOrders();
    const index = currentOrders.findIndex(o => o.id === id);
    if (index === -1) throw new Error('Orden de trabajo no encontrada');

    const existing = currentOrders[index];

    // Recompute total & balance if prices changed
    const costoManoObra = updates.costoManoObra !== undefined ? Number(updates.costoManoObra) : existing.costoManoObra;
    const costoRepuestos = updates.costoRepuestos !== undefined ? Number(updates.costoRepuestos) : existing.costoRepuestos;
    const total = updates.total !== undefined ? Number(updates.total) : (costoManoObra + costoRepuestos);
    const anticipo = updates.anticipo !== undefined ? Number(updates.anticipo) : existing.anticipo;
    const saldoPendiente = Math.max(0, total - anticipo);

    const merged: WorkOrder = {
      ...existing,
      ...updates,
      costoManoObra,
      costoRepuestos,
      total,
      anticipo,
      saldoPendiente,
      updatedAt: new Date().toISOString()
    };

    currentOrders[index] = merged;
    setLocalOrders(currentOrders);

    // Sync to Firestore
    try {
      const docRef = doc(db, 'work_orders', id);
      await updateDoc(docRef, updates as any);
    } catch (e) {
      console.warn('Firestore updateWorkOrder fallback:', e);
    }

    return merged;
  },

  async updateStatus(id: string, estado: WorkOrderStatus): Promise<WorkOrder> {
    const updates: Partial<WorkOrder> = { estado };
    if (estado === 'entregado') {
      updates.fechaEntrega = new Date().toISOString();
    }
    return this.updateWorkOrder(id, updates);
  },

  async deleteWorkOrder(id: string): Promise<void> {
    const current = getLocalOrders();
    const filtered = current.filter(o => o.id !== id && o.numero !== id);
    setLocalOrders(filtered);

    try {
      await deleteDoc(doc(db, 'work_orders', id));
    } catch (e) {
      console.warn('Firestore direct deleteWorkOrder fallback:', e);
    }

    try {
      const q = query(collection(db, 'work_orders'), where('id', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'work_orders', d.id));
      }
    } catch (e) {
      console.warn('Firestore query deleteWorkOrder fallback:', e);
    }

    try {
      const qNum = query(collection(db, 'work_orders'), where('numero', '==', id));
      const snapNum = await getDocs(qNum);
      for (const d of snapNum.docs) {
        await deleteDoc(doc(db, 'work_orders', d.id));
      }
    } catch (e) {}
  },

  subscribeToWorkOrders(callback: (orders: WorkOrder[]) => void) {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const uid = auth.currentUser.uid;
    const local = getLocalOrders();
    callback(local);

    try {
      const q = query(
        collection(db, 'work_orders'),
        where('createdBy', '==', uid)
      );
      return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as WorkOrder[];

        const sorted = orders.sort(
          (a, b) => new Date(b.fechaIngreso || b.createdAt || 0).getTime() - new Date(a.fechaIngreso || a.createdAt || 0).getTime()
        );
        setLocalOrders(sorted);
        callback(sorted);
      }, (err) => {
        console.warn('Snapshot listener for work_orders:', err);
      });
    } catch (e) {
      console.warn('Could not establish real-time listener for work_orders:', e);
      return () => {};
    }
  },

  /**
   * Convert an Order into a registered Sale, deducting inventory stock
   */
  async convertOrderToSale(order: WorkOrder): Promise<{ saleId: string }> {
    const transactionId = `trans_${Date.now()}`;
    const saleItems: any[] = [];

    // 1. If repuestos exist from inventory, register them as sales to deduct stock
    if (order.repuestos && order.repuestos.length > 0) {
      for (const rep of order.repuestos) {
        saleItems.push({
          productId: rep.productId || 'repuesto_generico',
          productNombre: rep.descripcion,
          cantidad: rep.cantidad,
          precio: rep.precioUnitario,
          total: rep.subtotal,
          clientId: order.clientId,
          clientNombre: order.clientNombre,
          transactionId,
          fecha: new Date(),
          createdBy: auth.currentUser?.uid || 'admin'
        });
      }
    }

    // 2. Add labor (Mano de obra) as a sale item if greater than 0
    if (order.costoManoObra > 0) {
      saleItems.push({
        productId: 'mano_de_obra_servicio',
        productNombre: `Servicio de Reparación: ${order.equipo} (${order.numero})`,
        cantidad: 1,
        precio: order.costoManoObra,
        total: order.costoManoObra,
        clientId: order.clientId,
        clientNombre: order.clientNombre,
        transactionId,
        fecha: new Date(),
        createdBy: auth.currentUser?.uid || 'admin'
      });
    }

    // Register sale in inventory & register transaction in finances
    if (saleItems.length > 0) {
      await inventoryService.registerSale(saleItems);
    }

    // Mark order as delivered and associate sale
    await this.updateWorkOrder(order.id, {
      estado: 'entregado',
      saleId: transactionId,
      fechaEntrega: new Date().toISOString()
    });

    return { saleId: transactionId };
  },

  /**
   * WhatsApp Message Generator for Workshop Customer updates
   */
  getWhatsAppMessage(order: WorkOrder, type: 'ingreso' | 'presupuesto' | 'listo' | 'entregado'): string {
    const phone = order.clientTelefono?.replace(/\D/g, '') || '';
    const encodedTrackingUrl = `${window.location.origin}/seguimiento/${order.id}`;

    let text = '';

    switch (type) {
      case 'ingreso':
        text = `🔧 *TALLER GREGORUTTI - FICHA DE INGRESO*\n\n` +
               `¡Hola *${order.clientNombre}*! Tu equipo ha sido ingresado al taller:\n\n` +
               `📋 *Orden N°:* ${order.numero}\n` +
               `🛠️ *Equipo:* ${order.equipo} ${order.marcaModelo ? `(${order.marcaModelo})` : ''}\n` +
               `⚠️ *Motivo de Ingreso:* ${order.fallaReportada}\n` +
               (order.anticipo > 0 ? `💵 *Seña abonada:* $${order.anticipo.toLocaleString('es-AR')}\n` : '') +
               `\n🔍 *Podes consultar el avance en vivo desde este link:*\n${encodedTrackingUrl}\n\n` +
               `¡Te mantendremos avisado en cuanto tengamos el diagnóstico listo!`;
        break;

      case 'presupuesto':
        text = `📋 *TALLER GREGORUTTI - PRESUPUESTO TÉCNICO*\n\n` +
               `¡Hola *${order.clientNombre}*! Te enviamos el presupuesto para la orden *${order.numero}* (*${order.equipo}*):\n\n` +
               `🔍 *Diagnóstico:* ${order.diagnostico || 'Revisión técnica completada.'}\n` +
               (order.repuestos.length > 0 
                 ? `⚙️ *Repuestos:* $${order.costoRepuestos.toLocaleString('es-AR')}\n` 
                 : '') +
               `👨‍🔧 *Mano de Obra:* $${order.costoManoObra.toLocaleString('es-AR')}\n` +
               `💰 *TOTAL ESTIMADO:* $${order.total.toLocaleString('es-AR')}\n` +
               (order.anticipo > 0 ? `💵 *Seña previa:* $${order.anticipo.toLocaleString('es-AR')}\n` : '') +
               `💳 *Saldo a Abonar:* $${order.saldoPendiente.toLocaleString('es-AR')}\n\n` +
               `Por favor confírmanos si damos comienzo a los trabajos. ¡Muchas gracias!`;
        break;

      case 'listo':
        text = `✅ *¡TU EQUIPO ESTÁ LISTO PARA RETIRAR!*\n\n` +
               `¡Hola *${order.clientNombre}*! Te avisamos de *Taller Gregorutti* que tu trabajo ya fue finalizado con éxito:\n\n` +
               `📋 *Orden N°:* ${order.numero}\n` +
               `🛠️ *Equipo:* ${order.equipo}\n` +
               (order.trabajoRealizado ? `🔧 *Detalle:* ${order.trabajoRealizado}\n` : '') +
               `💰 *Saldo pendiente a abonar:* $${order.saldoPendiente.toLocaleString('es-AR')}\n\n` +
               `📍 Ya podés pasar a retirarlo en nuestro horario habitual.\n` +
               `¡Te esperamos!`;
        break;

      case 'entregado':
        text = `🤝 *GRACIAS POR CONFIAR EN TALLER GREGORUTTI*\n\n` +
               `¡Hola *${order.clientNombre}*! Esperamos que tu *${order.equipo}* esté funcionando a la perfección tras su reparación (Orden ${order.numero}).\n\n` +
               `Cualquier consulta o duda técnica, estamos a tu entera disposición. ¡Hasta la próxima!`;
        break;
    }

    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  },

  /**
   * REPAIR QUOTES (PRESUPUESTOS DE TALLER)
   */
  async getRepairQuotes(): Promise<RepairQuote[]> {
    if (!auth.currentUser) return [];
    const uid = auth.currentUser.uid;
    const local = getLocalRepairQuotes();

    try {
      const q = query(
        collection(db, 'repair_quotes'),
        where('createdBy', '==', uid)
      );
      const snap = await getDocs(q);
      const firestoreQuotes: RepairQuote[] = snap.docs.map(doc => ({
        ...(doc.data() as RepairQuote),
        id: doc.id
      }));
      const sorted = firestoreQuotes.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.fecha || 0).getTime();
        const dateB = new Date(b.createdAt || b.fecha || 0).getTime();
        return dateB - dateA;
      });
      setLocalRepairQuotes(sorted);
      return sorted;
    } catch (e) {
      console.warn('Firestore repair quotes fallback to local:', e);
      return local;
    }
  },

  subscribeToRepairQuotes(callback: (quotes: RepairQuote[]) => void) {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const uid = auth.currentUser.uid;
    const local = getLocalRepairQuotes();
    callback(local);

    try {
      const q = query(
        collection(db, 'repair_quotes'),
        where('createdBy', '==', uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const quotes: RepairQuote[] = snapshot.docs.map(doc => ({
          ...(doc.data() as RepairQuote),
          id: doc.id
        }));
        const sorted = quotes.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.fecha || 0).getTime();
          const dateB = new Date(b.createdAt || b.fecha || 0).getTime();
          return dateB - dateA;
        });
        setLocalRepairQuotes(sorted);
        callback(sorted);
      }, (error) => {
        console.warn('Repair quotes snapshot error, using local:', error);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Could not subscribe to repair quotes:', e);
      return () => {};
    }
  },

  getNextRepairQuoteNumber(quotes: RepairQuote[]): string {
    if (!quotes.length) return 'COT-0001';
    const numbers = quotes
      .map(q => {
        const m = q.numero?.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const max = numbers.length ? Math.max(...numbers) : 0;
    return `COT-${String(max + 1).padStart(4, '0')}`;
  },

  async createRepairQuote(data: Partial<RepairQuote>): Promise<RepairQuote> {
    const current = await this.getRepairQuotes();
    const numero = data.numero || this.getNextRepairQuoteNumber(current);
    const now = new Date().toISOString();
    const id = `cot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const costoRepuestos = Number(data.costoRepuestos) || (data.repuestos?.reduce((a, b) => a + (b.subtotal || 0), 0) || 0);
    const costoManoObra = Number(data.costoManoObra) || 0;
    const total = (Number(data.total) || 0) > 0 ? Number(data.total) : (costoManoObra + costoRepuestos);

    const newQuote: RepairQuote = {
      id,
      numero,
      clientNombre: data.clientNombre || 'Cliente Particular',
      clientTelefono: data.clientTelefono || '',
      clientEmail: data.clientEmail || '',
      equipo: data.equipo || 'Equipo sin especificar',
      marcaModelo: data.marcaModelo || '',
      serieOPatente: data.serieOPatente || '',
      fallaReportada: data.fallaReportada || '',
      diagnosticoPrevio: data.diagnosticoPrevio || '',
      repuestos: data.repuestos || [],
      costoManoObra,
      costoRepuestos,
      total,
      validezDias: Number(data.validezDias) || 10,
      estado: data.estado || 'pendiente',
      notas: data.notas || '',
      fecha: data.fecha || now,
      createdBy: auth.currentUser?.uid || 'admin',
      createdAt: now,
      updatedAt: now
    };

    const updated = [newQuote, ...current];
    setLocalRepairQuotes(updated);

    try {
      await setDoc(doc(db, 'repair_quotes', id), newQuote);
    } catch (e) {
      console.warn('Firestore createRepairQuote fallback:', e);
    }

    return newQuote;
  },

  async updateRepairQuote(id: string, updates: Partial<RepairQuote>): Promise<RepairQuote> {
    const current = await this.getRepairQuotes();
    const idx = current.findIndex(q => q.id === id);
    if (idx === -1) throw new Error('Cotización no encontrada');

    const existing = current[idx];
    const costoRepuestos = updates.costoRepuestos !== undefined ? Number(updates.costoRepuestos) : existing.costoRepuestos;
    const costoManoObra = updates.costoManoObra !== undefined ? Number(updates.costoManoObra) : existing.costoManoObra;
    const total = updates.total !== undefined ? Number(updates.total) : (costoManoObra + costoRepuestos);

    const updatedQuote: RepairQuote = {
      ...existing,
      ...updates,
      costoRepuestos,
      costoManoObra,
      total,
      updatedAt: new Date().toISOString()
    };

    current[idx] = updatedQuote;
    setLocalRepairQuotes([...current]);

    try {
      const docRef = doc(db, 'repair_quotes', id);
      await updateDoc(docRef, updatedQuote as any);
    } catch (e) {
      console.warn('Firestore updateRepairQuote fallback:', e);
    }

    return updatedQuote;
  },

  async deleteRepairQuote(id: string): Promise<void> {
    const current = getLocalRepairQuotes();
    const filtered = current.filter(q => q.id !== id && q.numero !== id);
    setLocalRepairQuotes(filtered);

    try {
      await deleteDoc(doc(db, 'repair_quotes', id));
    } catch (e) {
      console.warn('Firestore direct deleteRepairQuote fallback:', e);
    }

    try {
      const q = query(collection(db, 'repair_quotes'), where('id', '==', id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'repair_quotes', d.id));
      }
    } catch (e) {
      console.warn('Firestore query deleteRepairQuote fallback:', e);
    }

    try {
      const qNum = query(collection(db, 'repair_quotes'), where('numero', '==', id));
      const snapNum = await getDocs(qNum);
      for (const d of snapNum.docs) {
        await deleteDoc(doc(db, 'repair_quotes', d.id));
      }
    } catch (e) {}
  },

  async convertRepairQuoteToWorkOrder(quote: RepairQuote): Promise<WorkOrder> {
    const orderData: Partial<WorkOrder> = {
      clientNombre: quote.clientNombre,
      clientTelefono: quote.clientTelefono,
      clientEmail: quote.clientEmail,
      equipo: quote.equipo,
      marcaModelo: quote.marcaModelo,
      serieOPatente: quote.serieOPatente,
      fallaReportada: quote.fallaReportada,
      diagnostico: quote.diagnosticoPrevio || 'Presupuesto aprobado por el cliente.',
      repuestos: quote.repuestos,
      costoManoObra: quote.costoManoObra,
      costoRepuestos: quote.costoRepuestos,
      total: quote.total,
      anticipo: 0,
      saldoPendiente: quote.total,
      estado: 'en_reparacion',
      prioridad: 'normal',
      notasInternas: `Originado de Cotización ${quote.numero}. ${quote.notas || ''}`
    };

    const newOrder = await this.createWorkOrder(orderData);

    await this.updateRepairQuote(quote.id, {
      estado: 'aprobado',
      workOrderId: newOrder.id
    });

    return newOrder;
  },

  getRepairQuoteWhatsAppMessage(quote: RepairQuote): string {
    const phone = quote.clientTelefono?.replace(/\D/g, '') || '';
    const itemsList = quote.repuestos.length > 0
      ? `⚙️ *Repuestos cotizados:*\n` + quote.repuestos.map(r => `  • ${r.cantidad}x ${r.descripcion}: $${(r.subtotal || 0).toLocaleString('es-AR')}`).join('\n') + `\n`
      : '';

    const text = `📋 *PRESUPUESTO DE REPARACIÓN - ${quote.numero}*\n\n` +
                 `¡Hola *${quote.clientNombre}*! Te enviamos la cotización solicitada para tu equipo:\n\n` +
                 `🛠️ *Equipo:* ${quote.equipo} ${quote.marcaModelo ? `(${quote.marcaModelo})` : ''}\n` +
                 `⚠️ *Falla Detectada / Reportada:* ${quote.fallaReportada}\n` +
                 (quote.diagnosticoPrevio ? `🔍 *Diagnóstico técnico:* ${quote.diagnosticoPrevio}\n\n` : '\n') +
                 itemsList +
                 `👨‍🔧 *Mano de Obra especializada:* $${quote.costoManoObra.toLocaleString('es-AR')}\n` +
                 (quote.costoRepuestos > 0 ? `🔩 *Total Repuestos:* $${quote.costoRepuestos.toLocaleString('es-AR')}\n` : '') +
                 `💰 *TOTAL COTIZACIÓN:* $${quote.total.toLocaleString('es-AR')}\n\n` +
                 `⏱️ *Validez:* ${quote.validezDias} días corridos.\n` +
                 (quote.notas ? `📝 *Nota:* ${quote.notas}\n\n` : '\n') +
                 `Por favor respondenos a este mensaje si deseas autorizar el inicio del trabajo. ¡Muchas gracias!`;

    return phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
};
