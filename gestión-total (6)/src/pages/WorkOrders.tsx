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
  ChevronDown,
  FileText,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Send,
  Smartphone,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui';
import { WorkOrder, WorkOrderStatus, WorkOrderPriority, RepairQuote } from '../types';
import { workOrderService } from '../services/workOrderService';
import { WorkOrderCard } from '../components/taller/WorkOrderCard';
import { WorkOrderModal } from '../components/taller/WorkOrderModal';
import { WorkOrderPrintTicket } from '../components/taller/WorkOrderPrintTicket';
import { RepairQuotesTab } from '../components/taller/RepairQuotesTab';
import { RepairQuoteModal } from '../components/taller/RepairQuoteModal';
import { RepairQuotePrintTicket } from '../components/taller/RepairQuotePrintTicket';
import { toast } from 'sonner';

export default function WorkOrders() {
  const [activeTab, setActiveTab] = useState<'ordenes' | 'cotizaciones' | 'seguimiento'>('ordenes');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [repairQuotes, setRepairQuotes] = useState<RepairQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Search and filters for Work Orders
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modals state for Work Orders
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [printingOrder, setPrintingOrder] = useState<WorkOrder | null>(null);

  // Modals state for Repair Quotes
  const [isRepairQuoteModalOpen, setIsRepairQuoteModalOpen] = useState(false);
  const [editingRepairQuote, setEditingRepairQuote] = useState<RepairQuote | null>(null);
  const [printingRepairQuote, setPrintingRepairQuote] = useState<RepairQuote | null>(null);

  // Tracking link helper
  const [copiedLink, setCopiedLink] = useState(false);
  const generalTrackingUrl = `${window.location.origin}/seguimiento`;

  // Load orders & repair quotes with real-time sync
  useEffect(() => {
    setIsLoading(true);
    const unsubscribeOrders = workOrderService.subscribeToWorkOrders((data) => {
      setOrders(data);
      setIsLoading(false);
    });

    const unsubscribeQuotes = workOrderService.subscribeToRepairQuotes((data) => {
      setRepairQuotes(data);
    });

    return () => {
      if (typeof unsubscribeOrders === 'function') unsubscribeOrders();
      if (typeof unsubscribeQuotes === 'function') unsubscribeQuotes();
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

  // Handlers for Work Orders
  const handleCreateNewOrder = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEditOrder = (order: WorkOrder) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleSaveOrder = async (orderData: Partial<WorkOrder>) => {
    if (editingOrder) {
      await workOrderService.updateWorkOrder(editingOrder.id, orderData);
      toast.success('Orden de trabajo actualizada');
    } else {
      await workOrderService.createWorkOrder(orderData);
      toast.success('Nueva orden de trabajo creada');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta orden de trabajo?')) {
      await workOrderService.deleteWorkOrder(id);
      toast.success('Orden eliminada');
    }
  };

  const handleStatusChange = async (id: string, newStatus: WorkOrderStatus) => {
    await workOrderService.updateStatus(id, newStatus);
    toast.success('Estado de la orden actualizado');
  };

  const handleConvertToSale = async (order: WorkOrder) => {
    if (confirm(`¿Facturar y entregar la orden ${order.numero}? Esto descontará del inventario los repuestos utilizados y registrará el saldo en Finanzas.`)) {
      try {
        await workOrderService.convertOrderToSale(order);
        toast.success(`¡Orden ${order.numero} facturada y entregada con éxito!`);
      } catch (e) {
        console.error('Error converting order to sale:', e);
        toast.error('Hubo un error al convertir la orden en venta.');
      }
    }
  };

  // Handlers for Repair Quotes
  const handleCreateNewRepairQuote = () => {
    setEditingRepairQuote(null);
    setIsRepairQuoteModalOpen(true);
  };

  const handleEditRepairQuote = (quote: RepairQuote) => {
    setEditingRepairQuote(quote);
    setIsRepairQuoteModalOpen(true);
  };

  const handleSaveRepairQuote = async (quoteData: Partial<RepairQuote>): Promise<RepairQuote | void> => {
    if (editingRepairQuote) {
      const updated = await workOrderService.updateRepairQuote(editingRepairQuote.id, quoteData);
      setEditingRepairQuote(null);
      return updated;
    } else {
      const created = await workOrderService.createRepairQuote(quoteData);
      return created;
    }
  };

  const handleDeleteRepairQuote = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este presupuesto de reparación?')) {
      await workOrderService.deleteRepairQuote(id);
      toast.success('Presupuesto eliminado');
    }
  };

  const handleConvertToWorkOrder = async (quote: RepairQuote) => {
    if (confirm(`¿Aprobar y pasar el presupuesto ${quote.numero} a una orden de trabajo activa en el taller?`)) {
      try {
        await workOrderService.convertRepairQuoteToWorkOrder(quote);
        toast.success(`¡Presupuesto ${quote.numero} aprobado! Ya está en el tablero de trabajo.`);
        setActiveTab('ordenes');
      } catch (e) {
        console.error('Error converting quote to work order:', e);
        toast.error('Error al convertir presupuesto en orden');
      }
    }
  };

  const handleSaveAndSendWhatsApp = (quote: RepairQuote) => {
    const url = workOrderService.getRepairQuoteWhatsAppMessage(quote);
    window.open(url, '_blank');
  };

  // Handler for sending tracking link
  const handleSendTrackingLink = (order: WorkOrder) => {
    const trackingUrl = `${window.location.origin}/seguimiento/${order.id}`;
    const text = `¡Hola *${order.clientNombre}*! Te compartimos el enlace para seguir el estado de tu equipo (*${order.equipo}* - Orden ${order.numero}) en vivo desde tu celular:\n\n🔗 ${trackingUrl}\n\nAllí podrás ver el diagnóstico técnico, repuestos cotizados y el progreso de la reparación en tiempo real. ¡Cualquier duda avísanos a nuestro WhatsApp oficial 11-6025-5767!`;
    const phone = order.clientTelefono?.replace(/\D/g, '') || '';
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            Gestión completa de servicio técnico: presupuestos con mano de obra y repuestos, seguimiento en vivo y órdenes de trabajo
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'ordenes' && (
            <Button
              onClick={handleCreateNewOrder}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Nueva Orden</span>
            </Button>
          )}

          {activeTab === 'cotizaciones' && (
            <Button
              onClick={handleCreateNewRepairQuote}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Cotizar Reparación</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('ordenes')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ordenes'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Wrench size={16} />
          <span>Órdenes de Trabajo ({activeOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cotizaciones')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'cotizaciones'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileText size={16} />
          <span>Cotizar Reparaciones ({repairQuotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('seguimiento')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'seguimiento'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Smartphone size={16} />
          <span>Seguimiento WhatsApp para Clientes</span>
        </button>
      </div>

      {/* TAB 1: WORK ORDERS (ORDENES DE TRABAJO) */}
      {activeTab === 'ordenes' && (
        <div className="space-y-6">
          
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

            {/* Filter Dropdowns & View Switch */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
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
                            onEdit={handleEditOrder}
                            onDelete={handleDeleteOrder}
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
                              onClick={() => handleEditOrder(o)}
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
        </div>
      )}

      {/* TAB 2: REPAIR QUOTES (COTIZAR REPARACIONES) */}
      {activeTab === 'cotizaciones' && (
        <RepairQuotesTab
          quotes={repairQuotes}
          onNewQuote={handleCreateNewRepairQuote}
          onEditQuote={handleEditRepairQuote}
          onPrintQuote={setPrintingRepairQuote}
          onDeleteQuote={handleDeleteRepairQuote}
          onConvertToWorkOrder={handleConvertToWorkOrder}
        />
      )}

      {/* TAB 3: CLIENT TRACKING PORTAL (SEGUIMIENTO EN VIVO PARA CLIENTES) */}
      {activeTab === 'seguimiento' && (
        <div className="space-y-6">
          
          {/* Hero Banner - Same impactful design loved by user */}
          <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-emerald-600 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
            <div className="max-w-3xl">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest inline-block mb-3">
                🛠️ Portal de Taller en Vivo para tus Clientes
              </span>
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Tus Clientes Pueden Seguir su Reparación Directo por WhatsApp y Web
              </h2>
              <p className="text-xs sm:text-sm opacity-90 mt-2 leading-relaxed">
                El Portal de Seguimiento es una página moderna donde tus clientes ven en tiempo real si su equipo está en diagnóstico, en taller o listo para retirar. Cuenta con botón de contacto directo a tu WhatsApp oficial 11-6025-5767, detalle de garantía y saldo a abonar.
              </p>
            </div>

            {/* Link Box */}
            <div className="bg-black/25 backdrop-blur-md p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-white/10">
              <div className="w-full truncate font-mono text-xs text-white/90">
                {generalTrackingUrl}
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(generalTrackingUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                    toast.success('¡Enlace copiado al portapapeles!');
                  }}
                  className="bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-bold text-xs"
                >
                  {copiedLink ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
                  {copiedLink ? '¡Copiado!' : 'Copiar Link'}
                </Button>
                <Button
                  onClick={() => window.open(generalTrackingUrl, '_blank')}
                  variant="outline"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 rounded-xl font-bold text-xs"
                >
                  <ExternalLink size={14} className="mr-1" />
                  Abrir Portal
                </Button>
              </div>
            </div>
          </div>

          {/* 3 Step Process Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                1
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Recibes el equipo y creas la orden</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ingresas los datos del cliente, máquina y fallas. El sistema genera un código de orden único (ej: OT-1001) y su link privado.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                2
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">El cliente consulta el estado en vivo</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Desde su celular o computadora, ve el progreso paso a paso, diagnósticos técnicos y el saldo exacto sin tener que llamar.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                3
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Aviso automático de retiro</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Cuando pasas la orden a "Listo para Retirar", tocas un botón y le envías el aviso de retiro a su WhatsApp al instante.
              </p>
            </div>
          </div>

          {/* Active Orders List with Direct WhatsApp Share */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle size={18} className="text-emerald-500" />
              Enviar Enlace de Seguimiento a Clientes Activos
            </h3>
            <p className="text-xs text-gray-500">
              Toca el botón verde para abrir WhatsApp y enviarle a tu cliente el enlace personalizado de su reparación:
            </p>

            {activeOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No hay órdenes activas en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeOrders.map(order => (
                  <div key={order.id} className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between text-xs border border-gray-100 dark:border-gray-700/60">
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-[11px]">{order.numero}</span>
                        <span className="font-bold text-gray-900 dark:text-white block truncate">{order.clientNombre}</span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 text-[11px] block truncate">{order.equipo}</span>
                      <span className="text-[10px] text-gray-400">{order.clientTelefono || 'Sin teléfono'}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleSendTrackingLink(order)}
                        className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-sm"
                        title="Enviar seguimiento por WhatsApp"
                      >
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => window.open(`/seguimiento/${order.id}`, '_blank')}
                        className="p-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl transition-all"
                        title="Ver página de seguimiento"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL: EDIT / NEW WORK ORDER */}
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

      {/* MODAL: PRINT WORK ORDER TICKET */}
      {printingOrder && (
        <WorkOrderPrintTicket
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* MODAL: EDIT / NEW REPAIR QUOTE */}
      {isRepairQuoteModalOpen && (
        <RepairQuoteModal
          isOpen={isRepairQuoteModalOpen}
          quoteToEdit={editingRepairQuote}
          onClose={() => {
            setIsRepairQuoteModalOpen(false);
            setEditingRepairQuote(null);
          }}
          onSave={handleSaveRepairQuote}
          onSaveAndSendWhatsApp={handleSaveAndSendWhatsApp}
        />
      )}

      {/* MODAL: PRINT REPAIR QUOTE TICKET */}
      {printingRepairQuote && (
        <RepairQuotePrintTicket
          quote={printingRepairQuote}
          onClose={() => setPrintingRepairQuote(null)}
        />
      )}

    </div>
  );
}
