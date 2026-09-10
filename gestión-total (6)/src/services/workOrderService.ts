/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  query, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WorkOrder, WorkOrderStatus, WorkOrderItem } from '../types';
import { inventoryService } from './inventoryService';

const STORAGE_KEY = 'taller_work_orders';

const getLocalOrders = (): WorkOrder[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading work orders from localStorage:', e);
    return [];
  }
};

const setLocalOrders = (orders: WorkOrder[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving work orders to localStorage:', e);
  }
};

// Initial sample data for demonstration if empty
const sampleWorkOrders: WorkOrder[] = [
  {
    id: 'ot-1001',
    numero: 'OT-0001',
    clientNombre: 'Carlos Gregorutti',
    clientTelefono: '3435123456',
    equipo: 'Compresor de Aire 50L',
    marcaModelo: 'Gamma CP50',
    serieOPatente: 'SN-99824',
    fallaReportada: 'No levanta presión y recalienta el cabezal tras 5 minutos de uso.',
    diagnostico: 'Desgaste severo en láminas de válvula y junta de tapa soplada. Requiere cambio de aros y aceite.',
    trabajoRealizado: 'Desarme completo, rectificado de plano, cambio de juego de válvulas y cambio de aceite de compresor.',
    repuestos: [
      {
        id: 'rep-1',
        descripcion: 'Juego de láminas de válvulas Gamma 50L',
        cantidad: 1,
        precioUnitario: 14500,
        subtotal: 14500
      },
      {
        id: 'rep-2',
        descripcion: 'Aceite sintético para compresor 1L',
        cantidad: 1,
        precioUnitario: 8200,
        subtotal: 8200
      }
    ],
    costoManoObra: 28000,
    costoRepuestos: 22700,
    total: 50700,
    anticipo: 20000,
    saldoPendiente: 30700,
    estado: 'listo',
    prioridad: 'urgente',
    fechaIngreso: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    fechaPrometida: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    notasInternas: 'Cliente habitual del taller. Prioridad alta.',
    createdBy: 'admin'
  },
  {
    id: 'ot-1002',
    numero: 'OT-0002',
    clientNombre: 'Esteban Martínez',
    clientTelefono: '3434991122',
    equipo: 'Generador Eléctrico 3500W',
    marcaModelo: 'Honda GX200',
    serieOPatente: 'GX-4412',
    fallaReportada: 'Tira explosiones por el carburador y se apaga al meterle carga.',
    diagnostico: 'Chicler sucio con sedimentos de nafta vieja, filtro de aire tapado y bujía en corto.',
    trabajoRealizado: 'Limpieza ultrasónica de carburador, regulación de válvulas y bujía NGK nueva.',
    repuestos: [
      {
        id: 'rep-3',
        descripcion: 'Bujía NGK BPR6ES',
        cantidad: 1,
        precioUnitario: 6500,
        subtotal: 6500
      },
      {
        id: 'rep-4',
        descripcion: 'Filtro de aire esponja Honda',
        cantidad: 1,
        precioUnitario: 7800,
        subtotal: 7800
      }
    ],
    costoManoObra: 22000,
    costoRepuestos: 14300,
    total: 36300,
    anticipo: 15000,
    saldoPendiente: 21300,
    estado: 'en_reparacion',
    prioridad: 'normal',
    fechaIngreso: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notasInternas: 'Esperar a regular antes de llamar.',
    createdBy: 'admin'
  },
  {
    id: 'ot-1003',
    numero: 'OT-0003',
    clientNombre: 'Agropecuaria El Trébol',
    clientTelefono: '3436882233',
    equipo: 'Bomba Centrífuga 2HP',
    marcaModelo: 'Rotor Pump 200',
    fallaReportada: 'Hace zumbido fuerte pero el eje no gira. Salta la térmica.',
    diagnostico: 'Rodamientos delanteros y traseros clavados por humedad. Capacitor desvalorizado.',
    repuestos: [],
    costoManoObra: 18000,
    costoRepuestos: 0,
    total: 18000,
    anticipo: 0,
    saldoPendiente: 18000,
    estado: 'en_diagnostico',
    prioridad: 'normal',
    fechaIngreso: new Date().toISOString(),
    createdBy: 'admin'
  }
];

export const workOrderService = {
  async getWorkOrders(): Promise<WorkOrder[]> {
    let local = getLocalOrders();
    if (local.length === 0) {
      setLocalOrders(sampleWorkOrders);
      local = sampleWorkOrders;
    }

    try {
      const q = query(collection(db, 'work_orders'), orderBy('fechaIngreso', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const remoteOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkOrder[];

        // Merge keeping remote as priority
        const map = new Map<string, WorkOrder>();
        remoteOrders.forEach(o => map.set(o.id, o));
        local.forEach(o => {
          if (!map.has(o.id)) map.set(o.id, o);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime()
        );
        setLocalOrders(merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firestore getWorkOrders fallback to local:', e);
    }

    return local.sort(
      (a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime()
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

    // Save locally
    const updated = [newOrder, ...currentOrders];
    setLocalOrders(updated);

    // Save to Firestore asynchronously
    try {
      await addDoc(collection(db, 'work_orders'), newOrder);
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
    const current = await this.getWorkOrders();
    const filtered = current.filter(o => o.id !== id);
    setLocalOrders(filtered);

    try {
      await deleteDoc(doc(db, 'work_orders', id));
    } catch (e) {
      console.warn('Firestore deleteWorkOrder fallback:', e);
    }
  },

  subscribeToWorkOrders(callback: (orders: WorkOrder[]) => void) {
    // Initial emit
    this.getWorkOrders().then(callback);

    try {
      const q = query(collection(db, 'work_orders'), orderBy('fechaIngreso', 'desc'));
      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as WorkOrder[];
          setLocalOrders(orders);
          callback(orders);
        }
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
  }
};
