/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Filter, 
  Columns, 
  List, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  RefreshCw,
  Sparkles,
  Printer,
  ChevronDown
} from 'lucide-react';
import { Button } from '../components/ui';
import { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '../types';
import { workOrderService } from '../services/workOrderService';
import { WorkOrderCard } from '../components/taller/WorkOrderCard';
import { WorkOrderModal } from '../components/taller/WorkOrderModal';
import { WorkOrderPrintTicket } from '../components/taller/WorkOrderPrintTicket';

export default function WorkOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [printingOrder, setPrintingOrder] = useState<WorkOrder | null>(null);

  // Load orders with real-time sync
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = workOrderService.subscribeToWorkOrders((data) => {
      setOrders(data);
      setIsLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.clientNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.equipo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.marcaModelo && o.marcaModelo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.serieOPatente && o.serieOPatente.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || o.estado === statusFilter;
    const matchesPriority = priorityFilter === 'all' || o.prioridad === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Handlers
  const handleCreateNew = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleSaveOrder = async (orderData: Partial<WorkOrder>) => {
    if (editingOrder) {
      await workOrderService.updateWorkOrder(editingOrder.id, orderData);
    } else {
      await workOrderService.createWorkOrder(orderData);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta orden de trabajo?')) {
      await workOrderService.deleteWorkOrder(id);
    }
  };

  const handleStatusChange = async (id: string, newStatus: WorkOrderStatus) => {
    await workOrderService.updateStatus(id, newStatus);
  };

  const handleConvertToSale = async (order: WorkOrder) => {
    if (confirm(`¿Facturar y entregar la orden ${order.numero}? Esto descontará del inventario los repuestos utilizados y registrará el saldo en Finanzas.`)) {
      try {
        await workOrderService.convertOrderToSale(order);
        alert(`¡Orden ${order.numero} facturada y entregada con éxito!`);
      } catch (e) {
        console.error('Error converting order to sale:', e);
        alert('Hubo un error al convertir la orden en venta.');
      }
    }
  };

  // Metrics
  const activeOrders = orders.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado');
  const readyOrders = orders.filter(o => o.estado === 'listo');
  const waitingPartsOrders = orders.filter(o => o.estado === 'esperando_repuestos');
  const totalPendingBalance = activeOrders.reduce((acc, o) => acc + (o.saldoPendiente || 0), 0);

  // Kanban Columns Definition
  const kanbanColumns: { id: WorkOrderStatus; title: string; icon: string }[] = [
    { id: 'ingresado', title: 'Ingresado', icon: '📥' },
    { id: 'en_diagnostico', title: 'Diagnóstico', icon: '🔍' },
    { id: 'en_reparacion', title: 'En Taller', icon: '🛠️' },
    { id: 'esperando_repuestos', title: 'Faltan Repuestos', icon: '⏳' },
    { id: 'listo', title: 'Listo para Retirar', icon: '✨' },
    { id: 'entregado', title: 'Entregados', icon: '🏁' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Taller & Reparaciones
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeOrders.length} activas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control integral de órdenes de trabajo, equipos, repuestos de stock, diagnósticos y seguimiento WhatsApp
          </p>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Columns size={14} />
              <span className="hidden sm:inline">Tablero</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List size={14} />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>

          <Button
            onClick={handleCreateNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Nueva Orden</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
              En Reparación
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
              {activeOrders.length}
            </span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
              Órdenes en proceso
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Wrench size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
              Listas p/ Retirar
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {readyOrders.length}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              Avisar a clientes
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
              Faltan Repuestos
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              {waitingPartsOrders.length}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              Requiere comprar
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
              Por Cobrar Taller
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
              ${totalPendingBalance.toLocaleString('es-AR')}
            </span>
            <span className="text-[11px] text-gray-500 font-bold">
              Saldo pendiente
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <DollarSign size={22} />
          </div>
        </div>

      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, equipo, OT-..., o serie..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">Todos los Estados</option>
            <option value="ingresado">📥 Ingresados</option>
            <option value="en_diagnostico">🔍 Diagnóstico</option>
            <option value="en_reparacion">🛠️ En Reparación</option>
            <option value="esperando_repuestos">⏳ Esperando Repuestos</option>
            <option value="listo">✨ Listos para Retirar</option>
            <option value="entregado">🏁 Entregados</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">Todas las Prioridades</option>
            <option value="urgente">🔥 Solo Urgentes</option>
            <option value="normal">Normal</option>
            <option value="baja">Baja</option>
          </select>
        </div>

      </div>

      {/* Main Content: Kanban or List */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 items-start">
          {kanbanColumns.map(col => {
            const colOrders = filteredOrders.filter(o => o.estado === col.id);
            return (
              <div 
                key={col.id} 
                className="bg-gray-100/70 dark:bg-gray-900/40 rounded-3xl p-3.5 border border-gray-200/80 dark:border-gray-800/80 flex flex-col min-h-[350px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span>{col.icon}</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      {col.title}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    {colOrders.length}
                  </span>
                </div>

                {/* Orders List inside column */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[68vh] pr-1">
                  {colOrders.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                      Sin órdenes aquí
                    </div>
                  ) : (
                    colOrders.map(order => (
                      <WorkOrderCard
                        key={order.id}
                        order={order}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPrint={setPrintingOrder}
                        onStatusChange={handleStatusChange}
                        onConvertToSale={handleConvertToSale}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Orden #</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Equipo / Trabajo</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-right">Saldo Pendiente</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No se encontraron órdenes con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-black text-gray-900 dark:text-white">
                        {o.numero}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">{o.clientNombre}</div>
                        {o.clientTelefono && (
                          <div className="text-[11px] text-gray-500">{o.clientTelefono}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">{o.equipo}</div>
                        <div className="text-[11px] text-gray-500 truncate max-w-xs">{o.fallaReportada}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                          {o.estado}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white">
                        ${o.total.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-amber-600 dark:text-amber-400">
                        ${o.saldoPendiente.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => setPrintingOrder(o)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg"
                          title="Imprimir Ficha"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={() => handleEdit(o)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg font-bold"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / New Modal */}
      {isModalOpen && (
        <WorkOrderModal
          isOpen={isModalOpen}
          orderToEdit={editingOrder}
          onClose={() => {
            setIsModalOpen(false);
            setEditingOrder(null);
          }}
          onSave={handleSaveOrder}
        />
      )}

      {/* Print Ticket Modal */}
      {printingOrder && (
        <WorkOrderPrintTicket
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

    </div>
  );
}
