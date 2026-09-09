/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Search, 
  Trash2, 
  Check,
  CheckCircle2, 
  Banknote, 
  CreditCard, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Calculator,
  Sparkles,
  RotateCcw,
  Bot
} from 'lucide-react';
import { Button } from '../components/ui';
import ConfirmationModal from '../components/ConfirmationModal';
import { TransactionModal } from '../components/finances/TransactionModal';
import { TelegramBotModal } from '../components/telegram/TelegramBotModal';
import { CashCalculator } from '../components/finances/CashCalculator';
import { PriceProfitCalculator } from '../components/finances/PriceProfitCalculator';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import { FinanceTransaction, FinanceType, Sale, Purchase } from '../types';
import { toast } from 'sonner';

type DateFilter = 'today' | 'week' | 'month' | 'all';
type TypeFilter = 'all' | 'ingreso' | 'egreso';

export default function Finances() {
  const { t, mobileCompactMode } = useSettings();

  // Primary states
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeInventory, setIncludeInventory] = useState<boolean>(false);

  // Modals & Forms
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalType, setModalType] = useState<FinanceType>('egreso');
  const [telegramModalOpen, setTelegramModalOpen] = useState<boolean>(false);

  // Secondary tools (collapsible)
  const [showAdvancedTools, setShowAdvancedTools] = useState<boolean>(false);
  const [advancedTab, setAdvancedTab] = useState<'billetes' | 'margenes'>('billetes');

  // Delete confirmation target
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    concepto: string;
    tipo: 'finance' | 'sale' | 'purchase';
    monto: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Multi-selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);

  // Subscribe to real-time transactions (finances, sales, and purchases)
  useEffect(() => {
    let unsubscribeFinances: () => void = () => {};
    let unsubscribeSales: () => void = () => {};
    let unsubscribePurchases: () => void = () => {};

    const setupSubscriptions = () => {
      setLoading(true);

      unsubscribeFinances = inventoryService.subscribeToFinances((data) => {
        setFinances(data);
        setLoading(false);
      });

      unsubscribeSales = inventoryService.subscribeToSales((salesData) => {
        setSales(salesData);
      });

      unsubscribePurchases = inventoryService.subscribeToPurchases((purchasesData) => {
        setPurchases(purchasesData);
      });
    };

    setupSubscriptions();

    return () => {
      unsubscribeFinances();
      unsubscribeSales();
      unsubscribePurchases();
    };
  }, []);

  // Helper date checker
  const isWithinDateFilter = (rawDate: any, filter: DateFilter) => {
    if (filter === 'all') return true;
    const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
    const now = new Date();
    
    if (filter === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }
    if (filter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Open modal preconfigured for Income or Expense
  const handleOpenAddMoney = () => {
    setModalType('ingreso');
    setModalOpen(true);
  };

  const handleOpenAddExpense = () => {
    setModalType('egreso');
    setModalOpen(true);
  };

  // Unified items
  const allItems = useMemo(() => {
    const list: Array<{
      id: string;
      tipo: 'ingreso' | 'egreso';
      concepto: string;
      categoria: string;
      monto: number;
      metodo: string;
      fecha: any;
      isCustom: boolean;
    }> = [];

    // User's custom finances (highest priority)
    finances.forEach(f => {
      list.push({
        id: f.id,
        tipo: f.tipo,
        concepto: f.concepto,
        categoria: f.categoria,
        monto: Number(f.monto) || 0,
        metodo: f.metodo || 'efectivo',
        fecha: f.fecha,
        isCustom: true
      });
    });

    // Optionally include sales and purchases from inventory
    if (includeInventory) {
      sales.forEach(s => {
        list.push({
          id: `sale-${s.id}`,
          tipo: 'ingreso',
          concepto: s.isCombo ? `Venta Combo: ${s.productNombre}` : `Venta: ${s.productNombre} (x${s.cantidad})`,
          categoria: 'Venta',
          monto: Number(s.total) || 0,
          metodo: 'efectivo',
          fecha: s.fecha,
          isCustom: false
        });
      });

      purchases.forEach(p => {
        list.push({
          id: `purchase-${p.id}`,
          tipo: 'egreso',
          concepto: `Compra stock: ${p.productNombre} (x${p.cantidad})`,
          categoria: 'Mercadería',
          monto: Number(p.total) || 0,
          metodo: 'efectivo',
          fecha: p.fecha,
          isCustom: false
        });
      });
    }

    // Sort by date descending
    return list.sort((a, b) => {
      const dateA = (a.fecha as any)?.toDate ? (a.fecha as any).toDate() : new Date(a.fecha);
      const dateB = (b.fecha as any)?.toDate ? (b.fecha as any).toDate() : new Date(b.fecha);
      return dateB.getTime() - dateA.getTime();
    });
  }, [finances, sales, purchases, includeInventory]);

  // Filtered by selected period
  const periodItems = useMemo(() => {
    return allItems.filter(item => isWithinDateFilter(item.fecha, dateFilter));
  }, [allItems, dateFilter]);

  // Totals for current period
  const totalIncome = useMemo(() => {
    return periodItems
      .filter(i => i.tipo === 'ingreso')
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);
  }, [periodItems]);

  const totalExpense = useMemo(() => {
    return periodItems
      .filter(i => i.tipo === 'egreso')
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);
  }, [periodItems]);

  const currentBalance = useMemo(() => {
    const bal = totalIncome - totalExpense;
    return isNaN(bal) ? 0 : bal;
  }, [totalIncome, totalExpense]);

  // Filtered for list display (type & search)
  const displayedItems = useMemo(() => {
    return periodItems.filter(item => {
      if (typeFilter !== 'all' && item.tipo !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchConcept = item.concepto.toLowerCase().includes(query);
        const matchCat = item.categoria.toLowerCase().includes(query);
        if (!matchConcept && !matchCat) return false;
      }
      return true;
    });
  }, [periodItems, typeFilter, searchQuery]);

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.tipo === 'sale') {
        const saleId = deleteTarget.id.replace('sale-', '');
        await inventoryService.deleteSale(saleId);
        toast.success('Venta eliminada y stock restituido al inventario');
      } else if (deleteTarget.tipo === 'purchase') {
        const purchaseId = deleteTarget.id.replace('purchase-', '');
        await inventoryService.deletePurchase(purchaseId);
        toast.success('Compra eliminada del inventario');
      } else {
        await inventoryService.deleteFinanceTransaction(deleteTarget.id);
        toast.success('Movimiento eliminado');
      }
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      toast.error('Error al eliminar: ' + (err.message || 'Intente de nuevo'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Selection Helpers
  const isAllDisplayedSelected = displayedItems.length > 0 && displayedItems.every(item => selectedIds.includes(item.id));
  const isSomeDisplayedSelected = displayedItems.some(item => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllDisplayedSelected) {
      // Unselect all displayed items
      const displayedIdsSet = new Set(displayedItems.map(item => item.id));
      setSelectedIds(prev => prev.filter(id => !displayedIdsSet.has(id)));
    } else {
      // Select all displayed items
      const newIds = new Set(selectedIds);
      displayedItems.forEach(item => newIds.add(item.id));
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectedItemsData = useMemo(() => {
    return allItems.filter(item => selectedIds.includes(item.id));
  }, [allItems, selectedIds]);

  const selectedTotalAmount = useMemo(() => {
    const total = selectedItemsData.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
    return isNaN(total) ? 0 : total;
  }, [selectedItemsData]);

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const salesToDelete: string[] = [];
      const purchasesToDelete: string[] = [];
      const financesToDelete: string[] = [];

      selectedItemsData.forEach(item => {
        if (item.id.startsWith('sale-')) {
          salesToDelete.push(item.id.replace('sale-', ''));
        } else if (item.id.startsWith('purchase-')) {
          purchasesToDelete.push(item.id.replace('purchase-', ''));
        } else {
          financesToDelete.push(item.id);
        }
      });

      // 1. Delete sales in parallel (safely restitutes inventory stock)
      if (salesToDelete.length > 0) {
        await Promise.all(salesToDelete.map(id => inventoryService.deleteSale(id)));
      }

      // 2. Delete purchases in parallel (cancels stock additions)
      if (purchasesToDelete.length > 0) {
        await Promise.all(purchasesToDelete.map(id => inventoryService.deletePurchase(id)));
      }

      // 3. Delete finances in batch
      if (financesToDelete.length > 0) {
        await inventoryService.bulkDeleteFinanceTransactions(financesToDelete);
      }

      toast.success(`${selectedIds.length} movimiento(s) eliminado(s) correctamente`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      console.error('Error in bulk delete:', err);
      toast.error('Error al eliminar en masa: ' + (err.message || 'Intente de nuevo'));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Mi Dinero & Gastos
                </h1>
                <button
                  onClick={() => setTelegramModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 text-sky-700 dark:text-sky-400 text-xs font-bold hover:bg-sky-100 transition-colors"
                  title="Anotar gastos y ventas enviando un mensaje de Telegram"
                >
                  <Bot className="w-3.5 h-3.5 text-sky-500" />
                  <span>Bot Telegram Activo</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Agregá tu dinero y anotá lo que vas gastando
              </p>
            </div>
          </div>
        </div>

        {/* Action and Date Filter */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setTelegramModalOpen(true)}
            className="sm:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 text-sky-700 dark:text-sky-400 text-xs font-bold"
          >
            <Bot className="w-3.5 h-3.5 text-sky-500" />
            <span>Bot</span>
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateFilter === 'today'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateFilter === 'week'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            7 Días
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateFilter === 'month'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateFilter === 'all'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* Hero Financial Card: Dinero Disponible + Two Big Action Buttons */}
      <div className="bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-900/90 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 sm:p-7 space-y-6">
        
        {/* Balance Display */}
        <div className="text-center space-y-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Dinero Disponible (Saldo Actual)
          </span>
          <div className={`text-4xl sm:text-5xl font-black tracking-tight ${
            currentBalance >= 0 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            ${currentBalance.toLocaleString('es-AR')}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentBalance >= 0 
              ? 'Tenés este saldo a favor para tus gastos' 
              : 'Gastaste más de lo que ingresaste en este período'}
          </p>
        </div>

        {/* Two Large, Ergonomic Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
          {/* 1. AGREGAR DINERO */}
          <button
            onClick={handleOpenAddMoney}
            className="flex items-center justify-center gap-3 py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-600/20 font-black text-base transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <span>+ Agregar Dinero</span>
          </button>

          {/* 2. ANOTAR GASTO */}
          <button
            onClick={handleOpenAddExpense}
            className="flex items-center justify-center gap-3 py-4 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white shadow-md shadow-rose-600/20 font-black text-base transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MinusCircle className="w-5 h-5 text-white" />
            </div>
            <span>- Anotar Gasto</span>
          </button>
        </div>

        {/* Sub-totals Strip */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Total Ingresado
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                +${totalIncome.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Total Gastado
              </div>
              <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                -${totalExpense.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Movements Section */}
      <div className="space-y-4">
        
        {/* Section Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Historial de Movimientos
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {displayedItems.length} movimiento{displayedItems.length === 1 ? '' : 's'} en este período
            </p>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setTypeFilter('egreso')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'egreso'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <MinusCircle className="w-3.5 h-3.5" />
              <span>Gastos</span>
            </button>
            <button
              onClick={() => setTypeFilter('ingreso')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'ingreso'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Ingresos</span>
            </button>
          </div>
        </div>

        {/* Search bar & optional catalog toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar gasto o dinero (ej. comida, nafta)..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            />
          </div>

          {(sales.length > 0 || purchases.length > 0) && (
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer self-start sm:self-center select-none">
              <input
                type="checkbox"
                checked={includeInventory}
                onChange={(e) => setIncludeInventory(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span>Incluir ventas y compras del stock</span>
            </label>
          )}
        </div>

        {/* List of Transactions */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {displayedItems.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50/90 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isAllDisplayedSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : isSomeDisplayedSelected
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-indigo-400'
                  }`}
                  title={isAllDisplayedSelected ? "Deseleccionar todos" : "Seleccionar todo"}
                >
                  {isAllDisplayedSelected ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : isSomeDisplayedSelected ? (
                    <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-sm" />
                  ) : null}
                </button>
                <button 
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {isAllDisplayedSelected ? 'Deseleccionar todos' : 'Seleccionar todo'} ({displayedItems.length})
                </button>
              </div>

              {selectedIds.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 hidden sm:inline bg-gray-200/60 dark:bg-gray-700/60 px-2 py-1 rounded-md">
                    {selectedIds.length} selecc. (${selectedTotalAmount.toLocaleString('es-AR')})
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-2.5 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-semibold text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <Button
                    type="button"
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1 px-3 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar ({selectedIds.length})</span>
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-gray-400 italic hidden sm:inline">
                  Tildá los gastos o ingresos que quieras eliminar en masa
                </span>
              )}
            </div>
          )}

          {displayedItems.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mx-auto flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  No hay movimientos registrados
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tocá en <strong>+ Agregar Dinero</strong> para cargar lo que tenés en mano o <strong>- Anotar Gasto</strong> para registrar lo que compraste.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button 
                  onClick={handleOpenAddMoney}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-2 px-4"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Cargar mi dinero
                </Button>
                <Button 
                  onClick={handleOpenAddExpense}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold py-2 px-4"
                >
                  <MinusCircle className="w-4 h-4 mr-1.5" />
                  Anotar un gasto
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {displayedItems.map((item) => {
                const isIncome = item.tipo === 'ingreso';
                const isSelected = selectedIds.includes(item.id);
                const dateObj = item.fecha?.toDate ? item.fecha.toDate() : new Date(item.fecha);
                const dateStr = dateObj.toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short'
                });

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelectItem(item.id)}
                    className={`p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors gap-3 cursor-pointer select-none ${
                      isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    {/* Left: Checkbox, Icon & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectItem(item.id, e)}
                        className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-indigo-400'
                        }`}
                        title={isSelected ? "Deseleccionar" : "Seleccionar para borrar"}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center font-black ${
                        isIncome 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                      }`}>
                        {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                          {item.concepto}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {dateStr}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{item.categoria.replace(/_/g, ' ')}</span>
                          <span>•</span>
                          <span className="capitalize">{item.metodo}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Delete */}
                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className={`font-black text-sm sm:text-base tracking-tight ${
                        isIncome 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isIncome ? '+' : '-'}${(Number(item.monto) || 0).toLocaleString('es-AR')}
                      </span>

                      <button
                        onClick={() => setDeleteTarget({
                          id: item.id,
                          concepto: item.concepto,
                          tipo: item.id.startsWith('sale-') ? 'sale' : item.id.startsWith('purchase-') ? 'purchase' : 'finance',
                          monto: Number(item.monto) || 0
                        })}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Eliminar este movimiento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Advanced Secondary Tools: Optional Collapsible */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setShowAdvancedTools(prev => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800/80 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 transition-all"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-500" />
            <span>Herramientas opcionales (Contador de billetes y calculadora de márgenes)</span>
          </div>
          {showAdvancedTools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvancedTools && (
          <div className="mt-4 space-y-4 animate-in fade-in duration-200">
            {/* Tabs for advanced tools */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              <button
                onClick={() => setAdvancedTab('billetes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  advancedTab === 'billetes'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Contador de Billetes Físicos
              </button>
              <button
                onClick={() => setAdvancedTab('margenes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  advancedTab === 'margenes'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Calculadora de Precios & Márgenes
              </button>
            </div>

            {advancedTab === 'billetes' && (
              <CashCalculator
                expectedCash={Math.max(0, currentBalance)}
                expectedTotal={currentBalance}
                mobileCompactMode={mobileCompactMode}
              />
            )}

            {advancedTab === 'margenes' && (
              <PriceProfitCalculator />
            )}
          </div>
        )}
      </div>

      {/* Fast Input Modal for Adding Money or Expense */}
      <TransactionModal
        isOpen={modalOpen}
        defaultType={modalType}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          // Handled via real-time subscription
        }}
      />

      {/* Telegram Bot Helper Modal */}
      <TelegramBotModal 
        isOpen={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Movimiento"
        message={
          deleteTarget?.tipo === 'sale'
            ? `¿Deseas eliminar "${deleteTarget.concepto}" por $${(Number(deleteTarget?.monto) || 0).toLocaleString('es-AR')}? Se borrará el registro de la venta y se devolverán las unidades vendidas al stock en el inventario.`
            : deleteTarget?.tipo === 'purchase'
            ? `¿Deseas eliminar "${deleteTarget?.concepto}" por $${(Number(deleteTarget?.monto) || 0).toLocaleString('es-AR')}? Se cancelará la compra y se descontarán las unidades del stock.`
            : `¿Deseas eliminar el registro de "${deleteTarget?.concepto}" por $${(Number(deleteTarget?.monto) || 0).toLocaleString('es-AR')}?`
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Eliminar Movimientos en Masa"
        message={`¿Estás seguro de que deseas eliminar permanentemente los ${selectedIds.length} movimientos seleccionados por un total de $${selectedTotalAmount.toLocaleString('es-AR')}? Si incluía ventas o compras, sus cantidades de inventario se restituirán automáticamente.`}
        confirmLabel={`Sí, eliminar ${selectedIds.length} seleccionados`}
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isBulkDeleting}
      />

    </div>
  );
}
