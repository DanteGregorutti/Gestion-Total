/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from '../firebase';
import { WorkOrder, WorkOrderStatus, WorkOrderItem, RepairQuote } from '../types';
import { inventoryService } from './inventoryService';
import { 
  markRepairQuoteAsDeleted, 
  unmarkRepairQuoteDeleted, 
  isRepairQuoteDeleted, 
  filterOutDeletedRepairQuotes 
} from '../utils/quoteTombstones';

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('work_orders_changed', { detail: orders }));
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('repair_quotes_changed', { detail: quotes }));
    }
  } catch (e) {
    console.error('Error saving repair quotes to localStorage:', e);
  }
};

export const sampleRepairQuotes: RepairQuote[] = [];
export const sampleWorkOrders: WorkOrder[] = [];

export const workOrderService = {
  async getWorkOrders(): Promise<WorkOrder[]> {
    const local = getLocalOrders();
    return local.sort(
      (a, b) => new Date(b.fechaIngreso || b.createdAt || 0).getTime() - new Date(a.fechaIngreso || a.createdAt || 0).getTime()
    );
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

    const updated = [newOrder, ...currentOrders];
    setLocalOrders(updated);

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
  },

  subscribeToWorkOrders(callback: (orders: WorkOrder[]) => void) {
    const emit = () => {
      const local = getLocalOrders().sort(
        (a, b) => new Date(b.fechaIngreso || b.createdAt || 0).getTime() - new Date(a.fechaIngreso || a.createdAt || 0).getTime()
      );
      callback(local);
    };

    emit();

    const handler = () => emit();
    if (typeof window !== 'undefined') {
      window.addEventListener('work_orders_changed', handler);
      window.addEventListener('storage', handler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('work_orders_changed', handler);
        window.removeEventListener('storage', handler);
      }
    };
  },

  /**
   * Generates a pre-filled WhatsApp message based on the work order status or message type
   */
  getWhatsAppMessage(order: WorkOrder, tipo?: 'ingreso' | 'presupuesto' | 'listo' | 'entregado' | string): string {
    const phone = order.clientTelefono ? order.clientTelefono.replace(/\D/g, '') : '';
    let text = '';

    const effectiveTipo = tipo || order.estado;

    switch (effectiveTipo) {
      case 'ingreso':
      case 'ingresado':
        text = `Hola ${order.clientNombre}! 👋 Le confirmamos el ingreso de su equipo *${order.equipo}* (Orden N° *${order.numero}*) a nuestro taller.\n\nFalla reportada: ${order.fallaReportada || 'Revisión técnica'}\n\nLe avisaremos cuando tengamos el diagnóstico listo. ¡Muchas gracias!`;
        break;
      case 'presupuesto':
        text = `Hola ${order.clientNombre}! 📋 Le enviamos el presupuesto para la reparación de su equipo *${order.equipo}* (Orden N° *${order.numero}*):\n\nDiagnóstico: ${order.diagnostico || 'Revisión técnica'}\nTotal: *$${order.total.toLocaleString('es-AR')}*\n\nPor favor confírmenos si desea autorizar la reparación. ¡Muchas gracias!`;
        break;
      case 'en_reparacion':
        text = `Hola ${order.clientNombre}! Le informamos que su equipo *${order.equipo}* (Orden N° *${order.numero}*) ya se encuentra en proceso de reparación técnica por parte de nuestro equipo. 🛠️`;
        break;
      case 'esperando_repuestos':
        text = `Hola ${order.clientNombre}! Le avisamos que para su equipo *${order.equipo}* (Orden N° *${order.numero}*) estamos a la espera de los repuestos necesarios para finalizar la reparación. Le mantendremos informado. ⚙️`;
        break;
      case 'listo':
        text = `¡Buenas noticias ${order.clientNombre}! 🎉 Su equipo *${order.equipo}* (Orden N° *${order.numero}*) ya está *LISTO PARA RETIRAR*.\n\n` +
          `Total: $${order.total.toLocaleString('es-AR')}\n` +
          (order.saldoPendiente > 0 ? `Saldo pendiente: *$${order.saldoPendiente.toLocaleString('es-AR')}*\n\n` : `Pagado: *Completo* ✅\n\n`) +
          `Puede pasar a retirarlo en nuestro horario habitual. ¡Lo esperamos!`;
        break;
      case 'entregado':
        text = `Hola ${order.clientNombre}! Gracias por confiar en nuestro servicio técnico para la reparación de su *${order.equipo}* (Orden N° *${order.numero}*). Quedamos a su entera disposición. ¡Que tenga un excelente día! 🙌`;
        break;
      case 'cancelado':
        text = `Hola ${order.clientNombre}. Le informamos que la Orden N° *${order.numero}* correspondiente a *${order.equipo}* ha sido cancelada. Por favor comuníquese con nosotros para coordinar el retiro del equipo.`;
        break;
      default:
        text = `Hola ${order.clientNombre}! Le contactamos desde el taller en relación a su orden N° *${order.numero}* (*${order.equipo}*).`;
        break;
    }

    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  },

  /**
   * Converts a completed work order into sales and registers income in finances
   */
  async convertOrderToSale(order: WorkOrder): Promise<void> {
    const saleItems: any[] = [];
    
    // 1. Convert repuestos into sales items and deduct inventory
    if (order.repuestos && order.repuestos.length > 0) {
      for (const rep of order.repuestos) {
        const cantidad = Number(rep.cantidad) || 1;
        const precio = Number(rep.precioUnitario) || 0;
        const total = Number(rep.subtotal !== undefined ? rep.subtotal : cantidad * precio) || 0;
        saleItems.push({
          productId: rep.productId || 'manual_repuesto',
          productNombre: rep.descripcion || 'Repuesto de taller',
          cantidad,
          precio,
          total,
          clientId: order.clientId || '',
          clientNombre: order.clientNombre || 'Cliente Taller',
        });
      }
    }

    // 2. Add labor / mano de obra as service sale item if > 0
    if (order.costoManoObra > 0) {
      saleItems.push({
        productId: 'servicio_taller',
        productNombre: `Mano de obra (Orden ${order.numero} - ${order.equipo})`,
        cantidad: 1,
        precio: Number(order.costoManoObra) || 0,
        total: Number(order.costoManoObra) || 0,
        clientId: order.clientId || '',
        clientNombre: order.clientNombre || 'Cliente Taller',
      });
    }

    // Fallback if neither repuestos nor mano de obra but order.total > 0
    if (saleItems.length === 0 && order.total > 0) {
      saleItems.push({
        productId: 'reparacion_taller',
        productNombre: `Reparación ${order.equipo} (Orden ${order.numero})`,
        cantidad: 1,
        precio: Number(order.total) || 0,
        total: Number(order.total) || 0,
        clientId: order.clientId || '',
        clientNombre: order.clientNombre || 'Cliente Taller',
      });
    }

    if (saleItems.length > 0) {
      await inventoryService.registerSale(saleItems);
    }

    // 3. Register finance income for saldo pendiente or total collected upon delivery
    const amountToRegister = order.saldoPendiente > 0 ? order.saldoPendiente : order.total;
    if (amountToRegister > 0) {
      await inventoryService.addFinanceTransaction({
        tipo: 'ingreso',
        monto: amountToRegister,
        concepto: `Cobro Reparación Orden ${order.numero} - ${order.equipo} (${order.clientNombre})`,
        categoria: 'Servicio Técnico / Taller',
        fecha: new Date().toISOString(),
        metodo: 'efectivo'
      });
    }

    // 4. Mark order as entregado and fully paid
    await this.updateWorkOrder(order.id, {
      estado: 'entregado',
      saldoPendiente: 0,
      fechaEntrega: new Date().toISOString()
    });
  },

  /**
   * REPAIR QUOTES (PRESUPUESTOS DE TALLER)
   */
  async getRepairQuotes(): Promise<RepairQuote[]> {
    const local = getLocalRepairQuotes();
    const sorted = local.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.fecha || 0).getTime();
      const dateB = new Date(b.createdAt || b.fecha || 0).getTime();
      return dateB - dateA;
    });
    return filterOutDeletedRepairQuotes(sorted);
  },

  subscribeToRepairQuotes(callback: (quotes: RepairQuote[]) => void) {
    const emit = () => {
      const local = getLocalRepairQuotes();
      const sorted = local.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.fecha || 0).getTime();
        const dateB = new Date(b.createdAt || b.fecha || 0).getTime();
        return dateB - dateA;
      });
      callback(filterOutDeletedRepairQuotes(sorted));
    };

    emit();

    const handler = () => emit();
    if (typeof window !== 'undefined') {
      window.addEventListener('repair_quotes_changed', handler);
      window.addEventListener('storage', handler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('repair_quotes_changed', handler);
        window.removeEventListener('storage', handler);
      }
    };
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

    return updatedQuote;
  },

  async deleteRepairQuote(id: string): Promise<void> {
    const current = getLocalRepairQuotes();
    const target = current.find(q => q.id === id || q.numero === id);
    markRepairQuoteAsDeleted(id, target?.numero);

    const filtered = current.filter(q => q.id !== id && q.numero !== id);
    setLocalRepairQuotes(filtered);
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

    // Mark the repair quote as approved in database and cache (do not delete it)
    unmarkRepairQuoteDeleted(quote.id, quote.numero);
    try {
      await this.updateRepairQuote(quote.id, { estado: 'aprobado' });
    } catch (e) {
      console.warn('Could not update repair quote status to aprobado:', e);
    }

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
