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
  Printer,
  ChevronDown,
  FileText,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  User,
  SlidersHorizontal,
  X
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
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'sonner';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('all');

  // Modals state for Work Orders
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [initialModalStatus, setInitialModalStatus] = useState<WorkOrderStatus | undefined>(undefined);
  const [printingOrder, setPrintingOrder] = useState<WorkOrder | null>(null);

  // Modals state for Repair Quotes
  const [isRepairQuoteModalOpen, setIsRepairQuoteModalOpen] = useState(false);
  const [editingRepairQuote, setEditingRepairQuote] = useState<RepairQuote | null>(null);
  const [printingRepairQuote, setPrintingRepairQuote] = useState<RepairQuote | null>(null);

  // In-app deletion confirmation (prevents iframe sandbox confirm() blocking)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    type: 'order' | 'quote';
    title: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Tracking link helper
  const [copiedLink, setCopiedLink] = useState(false);
  const generalTrackingUrl = `${window.location.origin}/seguimiento`;

  // Load orders & repair quotes with real-time sync scoped to active account
  useEffect(() => {
    setIsLoading(true);
    let unsubOrders: (() => void) | undefined;
    let unsubQuotes: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubOrders) unsubOrders();
      if (unsubQuotes) unsubQuotes();

      if (user) {
        setIsLoading(true);
        unsubOrders = workOrderService.subscribeToWorkOrders((data) => {
          setOrders(data);
          setIsLoading(false);
        });

        unsubQuotes = workOrderService.subscribeToRepairQuotes((data) => {
          setRepairQuotes(data);
        });
      } else {
        setOrders([]);
        setRepairQuotes([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubOrders) unsubOrders();
      if (unsubQuotes) unsubQuotes();
    };
  }, []);

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      o.numero.toLowerCase().includes(q) ||
      o.clientNombre.toLowerCase().includes(q) ||
      o.equipo.toLowerCase().includes(q) ||
      (o.marcaModelo && o.marcaModelo.toLowerCase().includes(q)) ||
      (o.serieOPatente && o.serieOPatente.toLowerCase().includes(q)) ||
      (o.clientTelefono && o.clientTelefono.includes(q))
    );

    const matchesStatus = statusFilter === 'all' || o.estado === statusFilter;
    const matchesPriority = priorityFilter === 'all' || o.prioridad === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Handlers for Work Orders
  const handleCreateNewOrder = (presetStatus?: WorkOrderStatus) => {
    setEditingOrder(null);
    setInitialModalStatus(presetStatus);
    setIsModalOpen(true);
  };

  const handleEditOrder = (order: WorkOrder) => {
    setEditingOrder(order);
    setInitialModalStatus(undefined);
    setIsModalOpen(true);
  };

  const handleSaveOrder = async (orderData: Partial<WorkOrder>) => {
    if (editingOrder) {
      await workOrderService.updateWorkOrder(editingOrder.id, orderData);
      toast.success('Orden de trabajo actualizada');
    } else {
      await workOrderService.createWorkOrder({
        ...orderData,
        estado: initialModalStatus || orderData.estado || 'ingresado'
      });
      toast.success('Nueva orden de trabajo creada');
    }
    setIsModalOpen(false);
  };

  const handleDeleteOrder = (id: string) => {
    const order = orders.find(o => o.id === id);
    setDeleteConfirmation({
      id,
      type: 'order',
      title: order ? `la Orden ${order.numero} (${order.equipo})` : 'esta orden de trabajo'
    });
  };

  const handleDeleteRepairQuote = (id: string) => {
    const quote = repairQuotes.find(q => q.id === id);
    setDeleteConfirmation({
      id,
      type: 'quote',
      title: quote ? `el Presupuesto ${quote.numero} (${quote.equipo})` : 'este presupuesto'
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, type } = deleteConfirmation;
    setIsDeletingItem(true);
    try {
      if (type === 'order') {
        // Optimistic UI removal
        setOrders(prev => prev.filter(o => o.id !== id));
        await workOrderService.deleteWorkOrder(id);
        toast.success('Orden de trabajo eliminada correctamente');
      } else {
        // Optimistic UI removal
        setRepairQuotes(prev => prev.filter(q => q.id !== id));
        await workOrderService.deleteRepairQuote(id);
        toast.success('Presupuesto de taller eliminado');
      }
      setDeleteConfirmation(null);
    } catch (e) {
      console.error('Error al eliminar:', e);
      toast.error('Error al intentar eliminar el elemento');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: WorkOrderStatus) => {
    await workOrderService.updateStatus(id, newStatus);
    toast.success('Estado actualizado correctamente');
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

  const handleSaveRepairQuote = async (quoteData: Partial<RepairQuote>) => {
    if (editingRepairQuote) {
      await workOrderService.updateRepairQuote(editingRepairQuote.id, quoteData);
      toast.success('Presupuesto de reparación actualizado');
    } else {
      await workOrderService.createRepairQuote(quoteData);
      toast.success('Nuevo presupuesto de reparación creado');
    }
    setIsRepairQuoteModalOpen(false);
  };

  const handleConvertToWorkOrder = async (quote: RepairQuote) => {
    if (confirm(`¿Aprobar el presupuesto ${quote.numero} y crear una Orden de Trabajo activa en el taller?`)) {
      try {
        const newOrderId = await workOrderService.convertRepairQuoteToWorkOrder(quote);
        toast.success(`¡Orden de Trabajo creada con éxito a partir del presupuesto!`);
        setActiveTab('ordenes');
      } catch (e) {
        console.error('Error converting quote to order:', e);
        toast.error('Hubo un error al convertir el presupuesto a orden.');
      }
    }
  };

  // Metrics
  const activeOrders = orders.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado');
  const readyOrders = orders.filter(o => o.estado === 'listo');
  const waitingPartsOrders = orders.filter(o => o.estado === 'esperando_repuestos');
  const totalPendingBalance = activeOrders.reduce((acc, o) => acc + (o.saldoPendiente || 0), 0);

  // Kanban Columns Definition
  const kanbanColumns: { id: WorkOrderStatus; title: string; icon: string; color: string }[] = [
    { id: 'ingresado', title: 'Ingresado', icon: '📥', color: 'border-t-blue-500' },
    { id: 'en_diagnostico', title: 'Diagnóstico', icon: '🔍', color: 'border-t-purple-500' },
    { id: 'en_reparacion', title: 'En Taller', icon: '🛠️', color: 'border-t-amber-500' },
    { id: 'esperando_repuestos', title: 'Faltan Repuestos', icon: '⏳', color: 'border-t-orange-500' },
    { id: 'listo', title: 'Listo para Retirar', icon: '✨', color: 'border-t-emerald-500' },
    { id: 'entregado', title: 'Entregados', icon: '🏁', color: 'border-t-slate-500' }
  ];

  const visibleColumns = selectedColumnFilter === 'all' 
    ? kanbanColumns 
    : kanbanColumns.filter(c => c.id === selectedColumnFilter);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Wrench size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Taller & Reparaciones
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {activeOrders.length} activas
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Gestión técnica de reparaciones, órdenes de servicio, seguimiento en vivo y presupuestos con repuestos
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => handleCreateNewOrder()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Nueva Orden</span>
          </Button>

          <Button
            onClick={handleCreateNewRepairQuote}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl font-bold text-xs sm:text-sm px-4 py-2.5 flex items-center gap-2"
          >
            <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>Cotizar Reparación</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('ordenes')}
          className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
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
          className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
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
          className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
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
            
            <div 
              onClick={() => setSelectedColumnFilter('all')}
              className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-all"
            >
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
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Wrench size={22} />
              </div>
            </div>

            <div 
              onClick={() => setSelectedColumnFilter('listo')}
              className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500/50 transition-all"
            >
              <div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
                  Listas p/ Retirar
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {readyOrders.length}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Listas para entrega
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div 
              onClick={() => setSelectedColumnFilter('esperando_repuestos')}
              className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-all"
            >
              <div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
                  Faltan Repuestos
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                  {waitingPartsOrders.length}
                </span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                  Requieren compra
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
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
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                  Saldo pendiente
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <DollarSign size={22} />
              </div>
            </div>

          </div>

          {/* Search, Filter Bar & Stage Selector */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              
              {/* Search */}
              <div className="relative w-full sm:w-96">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar orden, cliente, equipo, modelo o patente..."
                  className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Priority & View Toggle */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas las Prioridades</option>
                  <option value="urgente">🔥 Solo Urgentes</option>
                  <option value="normal">Prioridad Normal</option>
                  <option value="baja">Prioridad Baja</option>
                </select>

                {/* View Mode Switch */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === 'kanban' 
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Columns size={14} />
                    <span>Tablero</span>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === 'list' 
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <List size={14} />
                    <span>Lista</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Quick Stage Filter Chips (Tablero columns filter) */}
            {viewMode === 'kanban' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                  <Filter size={12} />
                  Etapas:
                </span>
                
                <button
                  onClick={() => setSelectedColumnFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedColumnFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>Ver Todas</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                    {filteredOrders.length}
                  </span>
                </button>

                {kanbanColumns.map(col => {
                  const count = filteredOrders.filter(o => o.estado === col.id).length;
                  const isSelected = selectedColumnFilter === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setSelectedColumnFilter(col.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{col.icon}</span>
                      <span>{col.title}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          {/* Main Content: Kanban or List */}
          {viewMode === 'kanban' ? (
            /* Fluid horizontal scroll Kanban board */
            <div className="flex gap-5 overflow-x-auto pb-6 pt-1 items-start">
              {visibleColumns.map(col => {
                const colOrders = filteredOrders.filter(o => o.estado === col.id);
                return (
                  <div 
                    key={col.id} 
                    className={`w-[330px] min-w-[310px] shrink-0 bg-gray-100/80 dark:bg-gray-900/50 rounded-3xl p-3.5 border border-gray-200/80 dark:border-gray-800/80 border-t-4 ${col.color} shadow-sm flex flex-col min-h-[500px]`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between px-1 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{col.icon}</span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                          {col.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700">
                          {colOrders.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCreateNewOrder(col.id)}
                          title={`Agregar orden en ${col.title}`}
                          className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Orders List inside column */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[72vh] pr-0.5">
                      {colOrders.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/80 flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl opacity-40">{col.icon}</span>
                          <p className="text-xs text-gray-400 font-medium">
                            Sin órdenes en {col.title.toLowerCase()}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCreateNewOrder(col.id)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-1"
                          >
                            <Plus size={12} />
                            <span>Crear orden aquí</span>
                          </button>
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
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Orden #</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Equipo / Reparación</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-right">Presupuesto</th>
                      <th className="py-3.5 px-4 text-right">Saldo Pendiente</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400">
                          No se encontraron órdenes con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(o => (
                        <tr key={o.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-black text-gray-900 dark:text-white">
                            {o.numero}
                            {o.prioridad === 'urgente' && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                                🔥 Urgente
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <User size={12} className="text-gray-400" />
                              <span>{o.clientNombre}</span>
                            </div>
                            {o.clientTelefono && (
                              <a
                                href={workOrderService.getWhatsAppMessage(o, 'ingreso')}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline block font-mono pl-4"
                              >
                                {o.clientTelefono}
                              </a>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                              <Wrench size={13} className="text-indigo-600 shrink-0" />
                              <span>{o.equipo}</span>
                            </div>
                            {o.marcaModelo && (
                              <div className="text-[11px] text-gray-500 pl-4">{o.marcaModelo}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={o.estado}
                              onChange={(e) => handleStatusChange(o.id, e.target.value as WorkOrderStatus)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 cursor-pointer focus:outline-none"
                            >
                              <option value="ingresado">📥 Ingresado</option>
                              <option value="en_diagnostico">🔍 Diagnóstico</option>
                              <option value="en_reparacion">🛠️ En Taller</option>
                              <option value="esperando_repuestos">⏳ Faltan Repuestos</option>
                              <option value="listo">✨ Listo p/ Retirar</option>
                              <option value="entregado">🏁 Entregado</option>
                              <option value="cancelado">❌ Cancelado</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-gray-900 dark:text-white">
                            ${o.total.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={`font-black ${o.saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {o.saldoPendiente === 0 ? 'Abonado' : `$${o.saldoPendiente.toLocaleString('es-AR')}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => setPrintingOrder(o)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Imprimir Ficha"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              onClick={() => handleEditOrder(o)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(o.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Eliminar"
                            >
                              ✕
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
          
          {/* Hero Banner */}
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
                Le envías el link por WhatsApp con 1 clic. El cliente ingresa su código o teléfono y ve la etapa en la que se encuentra su máquina.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                3
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Avisas retiro y cobras con garantía</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Cuando pasa a "Listo para Retirar", el sistema te prepara el mensaje de WhatsApp para que el cliente pase a abonar y retirar.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Work Order Modal */}
      {isModalOpen && (
        <WorkOrderModal
          isOpen={isModalOpen}
          orderToEdit={editingOrder}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveOrder}
        />
      )}

      {/* Work Order Print Ticket */}
      {printingOrder && (
        <WorkOrderPrintTicket
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* Repair Quote Modal */}
      {isRepairQuoteModalOpen && (
        <RepairQuoteModal
          isOpen={isRepairQuoteModalOpen}
          quoteToEdit={editingRepairQuote}
          onClose={() => setIsRepairQuoteModalOpen(false)}
          onSave={handleSaveRepairQuote}
        />
      )}

      {/* Repair Quote Print Ticket */}
      {printingRepairQuote && (
        <RepairQuotePrintTicket
          quote={printingRepairQuote}
          onClose={() => setPrintingRepairQuote(null)}
        />
      )}

      {/* In-app Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeletingItem}
        title={deleteConfirmation?.type === 'order' ? 'Eliminar Orden de Trabajo' : 'Eliminar Presupuesto de Taller'}
        message={`¿Estás seguro de que deseas eliminar ${deleteConfirmation?.title}? Esta acción es definitiva.`}
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        variant="danger"
      />

    </div>
  );
}
