/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical,
  Package, 
  Layers, 
  MapPin, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  TrendingUp,
  CheckCircle2,
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Lightbulb, 
  Map, 
  Settings, 
  Share2,
  X, 
  Plus,
  Loader2,
  Wallet,
  Wrench,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  EyeOff,
  RotateCcw,
  Check,
  LayoutGrid
} from 'lucide-react';
import { DailyReportModal } from '../components/finances/DailyReportModal';
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import StatCard from '../components/StatCard';
import { cn } from '../utils/cn';
import { inventoryService } from '../services/inventoryService';
import { Product, Movement, Sale, Purchase, Warehouse } from '../types';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { GoalsWidget } from '../components/GoalsWidget';
import { Button, RefreshButton } from '../components/ui';
import StockValuationModal from '../components/StockValuationModal';

export const DEFAULT_DASHBOARD_WIDGETS = ['stats', 'secondary_stats', 'charts', 'recommendations', 'goals', 'movements'];

export const WIDGET_METADATA: Record<string, { label: string; desc: string; icon: string }> = {
  stats: { label: 'Métricas Principales', desc: 'Ingresos, ganancia y valorización de inventario', icon: '💰' },
  secondary_stats: { label: 'Alertas & Resumen', desc: 'Stock bajo y productos sin costo cargado', icon: '⚠️' },
  charts: { label: 'Gráficos Interactivos', desc: 'Ventas vs Compras, flujo de stock y productos top', icon: '📊' },
  recommendations: { label: 'Recomendaciones IA', desc: 'Consejos de reposición e inteligencia de stock', icon: '✨' },
  goals: { label: 'Metas del Mes', desc: 'Objetivos mensuales de ventas y progreso', icon: '🎯' },
  movements: { label: 'Últimos Movimientos', desc: 'Historial reciente de entradas y salidas', icon: '📦' }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, loading: settingsLoading, mobileCompactMode } = useSettings();
  const { products, refreshProducts: refreshAllProducts } = useProducts();
  const [totalProducts, setTotalProducts] = React.useState(0);
  const [lowStockProducts, setLowStockProducts] = React.useState<Product[]>([]);
  const [movements, setMovements] = React.useState<Movement[]>([]);
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [purchases, setPurchases] = React.useState<Purchase[]>([]);
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeChart, setActiveChart] = React.useState(0);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isValuationModalOpen, setIsValuationModalOpen] = React.useState(false);
  const [valuationInitialTab, setValuationInitialTab] = React.useState<'all' | 'missing-cost' | 'top-profit'>('all');
  const [isDailyReportOpen, setIsDailyReportOpen] = React.useState(false);

  const getInitialWidgets = () => {
    try {
      const saved = localStorage.getItem('dashboard_widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(w => DEFAULT_DASHBOARD_WIDGETS.includes(w));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {
      console.error('Error parsing dashboard widgets:', e);
    }
    return DEFAULT_DASHBOARD_WIDGETS;
  };

  const [visibleWidgets, setVisibleWidgets] = React.useState<string[]>(getInitialWidgets);

  React.useEffect(() => {
    setVisibleWidgets(getInitialWidgets());
  }, []);

  React.useEffect(() => {
    localStorage.setItem('dashboard_widgets', JSON.stringify(visibleWidgets));
  }, [visibleWidgets]);

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const currentIndex = visibleWidgets.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visibleWidgets.length) return;
    setVisibleWidgets(arrayMove(visibleWidgets, currentIndex, targetIndex));
  };

  const toggleWidget = (id: string) => {
    if (visibleWidgets.includes(id)) {
      setVisibleWidgets(visibleWidgets.filter(w => w !== id));
    } else {
      const targetIndex = DEFAULT_DASHBOARD_WIDGETS.indexOf(id);
      const newWidgets = [...visibleWidgets];
      const nextVisible = newWidgets.findIndex(w => DEFAULT_DASHBOARD_WIDGETS.indexOf(w) > targetIndex);
      if (nextVisible !== -1) {
        newWidgets.splice(nextVisible, 0, id);
      } else {
        newWidgets.push(id);
      }
      setVisibleWidgets(newWidgets);
    }
  };

  const resetWidgets = () => {
    setVisibleWidgets(DEFAULT_DASHBOARD_WIDGETS);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        const [count, lowStock, m, s, pu, w] = await Promise.all([
          inventoryService.getProductsCount(),
          inventoryService.getLowStockProducts(5),
          inventoryService.getRecentMovements(7),
          inventoryService.getSales(90),
          inventoryService.getPurchases(7),
          inventoryService.getWarehouses()
        ]);
        setTotalProducts(count);
        setLowStockProducts(lowStock);
        setMovements(m);
        setSales(s);
        setPurchases(pu);
        setWarehouses(w);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      const [count, lowStock, m, s, pu, w] = await Promise.all([
        inventoryService.getProductsCount(),
        inventoryService.getLowStockProducts(5),
        inventoryService.getRecentMovements(7),
        inventoryService.getSales(90),
        inventoryService.getPurchases(7),
        inventoryService.getWarehouses(),
        refreshAllProducts()
      ]);
      setTotalProducts(count);
      setLowStockProducts(lowStock);
      setMovements(m);
      setSales(s);
      setPurchases(pu);
      setWarehouses(w);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Notification and Inactivity Logic
  const lastNotificationCheck = React.useRef<number>(0);
  
  React.useEffect(() => {
    if (products.length === 0) return;

    const checkNotifications = async () => {
      // Throttle: only check once every 15 minutes to save quota
      const nowTime = Date.now();
      const lastCheck = localStorage.getItem('last_notification_check');
      const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0;
      
      if (nowTime - lastCheckTime < 15 * 60 * 1000) {
        return;
      }
      
      localStorage.setItem('last_notification_check', nowTime.toString());
      lastNotificationCheck.current = nowTime;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      try {
        // Fetch recent notifications once to avoid O(N) queries
        const recentNotifications = await inventoryService.getRecentNotifications(24);
        
        // If quota exceeded or error, recentNotifications will be null
        if (!recentNotifications) return;

        for (const product of products) {
          // Low stock check
          const threshold = product.minStock || 3;
          if (product.cantidad <= threshold) {
            const title = t('low_stock_alert') || 'Alerta de Stock Bajo';
            const alreadyNotified = recentNotifications.some(n => 
              n.titulo === title && n.productId === product.id
            );

            if (!alreadyNotified) {
              await inventoryService.addNotification({
                titulo: title,
                mensaje: `El producto "${product.descripcion || product.codigo}" tiene solo ${product.cantidad} unidades (Mínimo: ${threshold}).`,
                tipo: 'warning',
                productId: product.id
              }, true); // skipCheck=true because we already checked
            }
          }

          // Inactivity check
          const lastMovement = product.lastMovementAt ? new Date(product.lastMovementAt) : null;
          if (lastMovement && lastMovement < thirtyDaysAgo) {
            const title = t('inactivity_detected') || 'Inactividad Detectada';
            const alreadyNotified = recentNotifications.some(n => 
              n.titulo === title && n.productId === product.id
            );

            if (!alreadyNotified) {
              await inventoryService.addNotification({
                titulo: title,
                mensaje: `${product.descripcion || product.codigo} no ha tenido movimientos en más de 30 días.`,
                tipo: 'inactivity',
                productId: product.id
              }, true); // skipCheck=true because we already checked
            }
          }
        }
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    const timer = setTimeout(checkNotifications, 10000); // Check after 10s to avoid spamming on load
    return () => clearTimeout(timer);
  }, [products, t]);

  // Stock movements chart data
  const stockChartData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }).reverse();

    return last7Days.map(day => {
      const dayMovements = movements.filter(m => {
        if (!m.fecha) return false;
        const date = (m.fecha as any).toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
        if (isNaN(date.getTime())) return false;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) === day;
      });

      return {
        name: day,
        ingresos: dayMovements.filter(m => m.tipo === 'entrada' || m.tipo === 'compra').reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0),
        egresos: dayMovements.filter(m => m.tipo === 'salida' || m.tipo === 'venta').reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0),
      };
    });
  }, [movements]);

  // Sales vs Purchases chart data
  const financialChartData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }).reverse();

    return last7Days.map(day => {
      const daySales = sales.filter(s => {
        if (!s.fecha) return false;
        const date = (s.fecha as any).toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any);
        if (isNaN(date.getTime())) return false;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) === day;
      });

      const dayPurchases = purchases.filter(p => {
        if (!p.fecha) return false;
        const date = (p.fecha as any).toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
        if (isNaN(date.getTime())) return false;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) === day;
      });

      return {
        name: day,
        ventas: daySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0),
        compras: dayPurchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0),
      };
    });
  }, [sales, purchases]);

  // Warehouse distribution chart data
  const warehouseChartData = React.useMemo(() => {
    return warehouses.map(w => {
      const count = products.filter(p => p.almacenId === w.id).reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
      return {
        name: w.nombre,
        value: count
      };
    }).filter(w => w.value > 0);
  }, [warehouses, products]);

  // Top products chart data
  const topProductsData = React.useMemo(() => {
    const productSales: Record<string, number> = {};
    sales.forEach(s => {
      if (s.isCombo && s.comboItems) {
        s.comboItems.forEach(item => {
          const name = item.productNombre || item.productId || 'Desconocido';
          // Multiply item quantity by sale quantity to get total units sold
          productSales[name] = (productSales[name] || 0) + ((Number(item.cantidad) || 0) * (Number(s.cantidad) || 1));
        });
      } else {
        const name = s.productNombre || s.productId || 'Desconocido';
        productSales[name] = (productSales[name] || 0) + (Number(s.cantidad) || 0);
      }
    });

    return Object.entries(productSales)
      .map(([name, value]) => ({ name, value }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales]);

  // Robust stock financials computation handling variants, cost fallbacks and non-negative units
  const stockFinancials = React.useMemo(() => {
    let units = 0;
    let costTotal = 0;
    let saleTotal = 0;
    let profitTotal = 0;
    let countMissingCost = 0;
    let countNegativeStock = 0;
    let countInvertedMargin = 0;

    products.forEach(p => {
      const variants = p.variants;
      const hasVariantsWithStock = Boolean(
        variants && 
        variants.length > 0 && 
        variants.some(v => (Number(v.cantidad) || 0) !== 0)
      );

      if (hasVariantsWithStock && variants) {
        variants.forEach(v => {
          const vQtyRaw = Number(v.cantidad) || 0;
          if (vQtyRaw < 0) countNegativeStock++;
          const vQty = Math.max(0, vQtyRaw);
          if (vQty === 0) return;

          let vCost = Number(v.costo) || 0;
          if (vCost <= 0) vCost = Number(p.costo) || 0;
          if (vCost <= 0) {
            const lastP = purchases.find(pu => pu.productId === p.id && (!pu.variantId || pu.variantId === v.id));
            if (lastP && Number(lastP.costo) > 0) vCost = Number(lastP.costo);
          }

          let vPrice = Number(v.precio) || 0;
          if (vPrice <= 0) vPrice = Number(p.precio) || 0;

          if (vCost <= 0) countMissingCost++;
          if (vCost > vPrice && vPrice > 0) countInvertedMargin++;

          units += vQty;
          costTotal += vQty * vCost;
          saleTotal += vQty * vPrice;

          if (vCost > 0 && vPrice > 0) {
            profitTotal += vQty * Math.max(0, vPrice - vCost);
          }
        });
      } else {
        const pQtyRaw = Number(p.cantidad) || 0;
        if (pQtyRaw < 0) countNegativeStock++;
        const qty = Math.max(0, pQtyRaw);

        let cost = Number(p.costo) || 0;
        if (cost <= 0) {
          const lastP = purchases.find(pu => pu.productId === p.id);
          if (lastP && Number(lastP.costo) > 0) cost = Number(lastP.costo);
        }

        const price = Number(p.precio) || 0;

        if (cost <= 0 && qty > 0) countMissingCost++;
        if (cost > price && price > 0) countInvertedMargin++;

        units += qty;
        costTotal += qty * cost;
        saleTotal += qty * price;

        if (cost > 0 && price > 0) {
          profitTotal += qty * Math.max(0, price - cost);
        }
      }
    });

    const averageMargin = costTotal > 0 ? Math.round((profitTotal / costTotal) * 100) : 0;

    return {
      totalUnits: units,
      totalStockValue: costTotal,
      totalPotentialRevenue: saleTotal,
      estimatedProfit: profitTotal,
      averageMargin,
      countMissingCost,
      countNegativeStock,
      countInvertedMargin
    };
  }, [products, purchases]);

  const {
    totalUnits,
    totalStockValue,
    totalPotentialRevenue,
    estimatedProfit,
    averageMargin,
    countMissingCost
  } = stockFinancials;

  const lowStockCount = lowStockProducts.length;
  const uniqueLocations = new Set(products.map(p => p.ubicacion).filter(Boolean)).size;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sales7d = sales.filter(s => {
    if (!s.fecha) return false;
    const date = (s.fecha as any).toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any);
    return date >= sevenDaysAgo;
  });

  const totalRevenue7d = sales7d.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalProfit7d = sales7d.reduce((acc, s) => {
    const cost = s.costo !== undefined ? (Number(s.costo) || 0) : (Number(products.find(p => p.id === s.productId)?.costo) || 0);
    return acc + (Number(s.total) || 0) - ((Number(s.cantidad) || 0) * cost);
  }, 0);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

  const CustomTooltip = ({ active, payload, label, isMoney }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 backdrop-blur-md bg-opacity-95 dark:bg-opacity-95">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-50 dark:border-gray-700 pb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-6 py-1.5">
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full mr-2.5 shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 capitalize">{entry.name}:</span>
              </div>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                {isMoney ? `$${Math.round(entry.value).toLocaleString('es-AR')}` : Math.round(entry.value).toLocaleString('es-AR')}
                {!isMoney && <span className="ml-1 text-[10px] text-gray-400 font-bold uppercase">Items</span>}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading')}</p>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = visibleWidgets.indexOf(active.id as string);
      const newIndex = visibleWidgets.indexOf(over.id as string);
      setVisibleWidgets(arrayMove(visibleWidgets, oldIndex, newIndex));
    }
  };

  const renderControls = (id: string, attributes?: any, listeners?: any) => {
    if (!isEditMode) return null;
    const meta = WIDGET_METADATA[id] || { label: 'Bloque', icon: '📦' };
    const currentIndex = visibleWidgets.indexOf(id);
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === visibleWidgets.length - 1;

    return (
      <div className="mb-4 p-2.5 sm:p-3 bg-white/95 dark:bg-gray-900/95 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-md z-30">
        <div className="flex items-center gap-2 pl-1">
          <span className="text-base sm:text-lg">{meta.icon}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-gray-900 dark:text-white">
              {meta.label}
            </span>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50">
              #{currentIndex + 1} de {visibleWidgets.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveWidget(id, 'up'); }}
            disabled={isFirst}
            className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Subir bloque una posición"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveWidget(id, 'down'); }}
            disabled={isLast}
            className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Bajar bloque una posición"
          >
            <ChevronDown size={16} />
          </button>
          <div 
            {...attributes} 
            {...listeners}
            className="p-2 px-3 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl cursor-grab active:cursor-grabbing hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1.5 text-xs font-bold select-none shadow-xs"
            title="Presionar y arrastrar para ordenar"
          >
            <GripVertical size={16} />
            <span className="hidden sm:inline">Arrastrar</span>
          </div>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWidget(id); }}
            className="p-2 px-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs"
            title="Ocultar este bloque"
          >
            <EyeOff size={14} />
            <span className="hidden sm:inline">Ocultar</span>
          </button>
        </div>
      </div>
    );
  };

  const SortableWidget = ({ id, children, ...props }: { id: string, children: (attributes: any, listeners: any) => React.ReactNode, [key: string]: any }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id });

    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 'auto',
    };

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
          "relative transition-all duration-300",
          isDragging ? "scale-[1.02] rotate-1 shadow-2xl opacity-80" : "opacity-100",
          isEditMode && "p-3 sm:p-4 rounded-3xl border-2 border-dashed border-indigo-400/70 dark:border-indigo-600/70 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-sm"
        )} 
        {...props}
      >
        {children(attributes, listeners)}
      </div>
    );
  };

  const charts = [
    {
      title: t('stock_movements'),
      subtitle: t('income_expense_7d'),
      legend: [
        { label: t('income'), color: 'bg-indigo-500' },
        { label: t('expense'), color: 'bg-rose-500' }
      ],
      render: () => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stockChartData}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" />
            <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorEgresos)" />
          </AreaChart>
        </ResponsiveContainer>
      )
    },
    {
      title: t('sales_vs_purchases'),
      subtitle: t('sales_purchases_7d'),
      legend: [
        { label: t('sales'), color: 'bg-emerald-500' },
        { label: t('purchases'), color: 'bg-amber-500' }
      ],
      render: () => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={financialChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
            <Bar dataKey="compras" name="Compras" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      title: t('top_products'),
      subtitle: t('most_sold_products'),
      legend: [
        { label: t('units_sold'), color: 'bg-indigo-500' }
      ],
      render: () => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topProductsData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Unidades" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    {
      title: t('stock_distribution'),
      subtitle: t('stock_by_warehouse'),
      legend: warehouseChartData.slice(0, 3).map((w, i) => ({ label: w.name, color: `bg-[${COLORS[i % COLORS.length]}]` })),
      render: () => (
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={warehouseChartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
                animationBegin={0}
                animationDuration={1200}
                stroke="none"
              >
                {warehouseChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('total_stock')}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">
              {warehouseChartData.reduce((acc, curr) => acc + curr.value, 0)}
            </p>
          </div>
        </div>
      )
    }
  ];

  const nextChart = () => setActiveChart((prev) => (prev + 1) % charts.length);
  const prevChart = () => setActiveChart((prev) => (prev - 1 + charts.length) % charts.length);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            {t('dashboard')} <span className="text-2xl">🚀</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">¡Hola! Aquí tienes el resumen de hoy.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={() => navigate('/cuentas')}
            className="rounded-xl font-bold flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm py-2 text-xs sm:text-sm"
          >
            <Wallet size={16} />
            <span>{t('finances')}</span>
          </Button>
          <Button 
            onClick={() => navigate('/catalogo')}
            className="rounded-xl font-bold flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 border-none shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 py-2 text-xs sm:text-sm"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">Publicar Stock</span>
            <span className="sm:hidden">Publicar</span>
          </Button>
          <RefreshButton 
            onRefresh={refreshStats}
            isLoading={isLoading}
            label={t('refresh') || 'Actualizar'}
            title="Actualizar estadísticas del panel"
          />
          <Button 
            variant={isEditMode ? "primary" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="rounded-xl font-bold flex items-center gap-2 shadow-sm py-2 text-xs sm:text-sm"
          >
            {isEditMode ? <Check size={16} /> : <Settings size={16} />}
            {isEditMode ? (t('finish_editing') || 'Finalizar') : (t('dashboard_edit_mode') || 'Modo Edición')}
          </Button>
        </div>
      </div>

      {/* Dedicated Edit Mode Toolbar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border-2 border-indigo-500/30 dark:border-indigo-500/40 backdrop-blur-xs space-y-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white text-base flex items-center gap-2 flex-wrap">
                    <span>Modo Edición del Panel de Control</span>
                    <span className="text-[11px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                      {visibleWidgets.length} de {DEFAULT_DASHBOARD_WIDGETS.length} bloques activos
                    </span>
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Podés reorganizar las secciones con las flechas o arrastrándolas. Tocá los botones de abajo para activar u ocultar bloques.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <Button
                  variant="outline"
                  onClick={resetWidgets}
                  className="rounded-xl text-xs font-bold flex items-center gap-1.5 border-gray-300 dark:border-gray-700 h-9"
                  title="Restablecer todos los bloques en su orden original"
                >
                  <RotateCcw size={14} />
                  <span>Restablecer</span>
                </Button>
                <Button
                  onClick={() => setIsEditMode(false)}
                  className="rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 h-9"
                >
                  <Check size={14} />
                  <span>Finalizar</span>
                </Button>
              </div>
            </div>

            {/* Quick Toggle Widget Badges */}
            <div className="pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                Bloques del Panel (tocá para activar u ocultar):
              </p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_DASHBOARD_WIDGETS.map((widgetId) => {
                  const meta = WIDGET_METADATA[widgetId] || { label: widgetId, icon: '📦' };
                  const isVisible = visibleWidgets.includes(widgetId);
                  return (
                    <button
                      key={widgetId}
                      type="button"
                      onClick={() => toggleWidget(widgetId)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all select-none border",
                        isVisible
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs hover:bg-indigo-700"
                          : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600"
                      )}
                      title={isVisible ? "Clic para ocultar" : "Clic para activar"}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      {isVisible ? (
                        <Check size={13} className="text-white" />
                      ) : (
                        <Plus size={13} className="text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State when all widgets are hidden */}
      {visibleWidgets.length === 0 && (
        <div className="text-center py-16 px-6 bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-4">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            🧩
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Todos los bloques están ocultos</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
              Podés reactivar los bloques que quieras desde el modo edición o restablecer el diseño inicial con un solo clic.
            </p>
          </div>
          <Button onClick={resetWidgets} className="rounded-xl font-bold">
            <RotateCcw size={16} className="mr-2" />
            Restablecer Bloques Predeterminados
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={visibleWidgets}
            strategy={verticalListSortingStrategy}
          >
            {visibleWidgets.map((widgetId) => (
              <SortableWidget key={widgetId} id={widgetId}>
                {(attributes, listeners) => {
                  switch (widgetId) {
                    case 'stats':
                      return (
                        <motion.div layout className="relative">
                          {renderControls('stats', attributes, listeners)}
                          <div className={cn("grid gap-6", mobileCompactMode ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
                            <StatCard 
                              title={`${t('revenue')} (7d)`} 
                              value={`$${Math.round(totalRevenue7d).toLocaleString()}`} 
                              icon={TrendingUp} 
                              color="indigo"
                              className="bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30"
                              description="Total de dinero ingresado por ventas concretadas en la última semana."
                            />
                            <StatCard 
                              title={`${t('profit')} (7d)`} 
                              value={`$${Math.round(totalProfit7d).toLocaleString()}`} 
                              icon={TrendingUp} 
                              color="emerald"
                              className="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                              description="Dinero que te queda después de restar el costo de los productos vendidos (7 días)."
                            />
                            <StatCard 
                              title="Ganancia Estimada" 
                              value={`$${Math.round(estimatedProfit).toLocaleString()}`} 
                              icon={TrendingUp} 
                              color="blue"
                              className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
                              subtitle={averageMargin > 0 ? `Margen: +${averageMargin}% sobre costo` : undefined}
                              extraBadge={countMissingCost > 0 ? (
                                <span 
                                  className="text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full"
                                  title={`${countMissingCost} productos con stock no tienen costo asignado`}
                                >
                                  {countMissingCost} sin costo
                                </span>
                              ) : undefined}
                              onClick={() => {
                                setValuationInitialTab('top-profit');
                                setIsValuationModalOpen(true);
                              }}
                              titleTooltip="Ganancia neta total proyectada al vender todo tu stock (Precio - Costo)"
                              description="Diferencia entre venta y costo de compra en stock. Clic para ver desglose."
                            />
                            <StatCard 
                              title="Valor de Stock (Costo)" 
                              value={`$${Math.round(totalStockValue).toLocaleString()}`} 
                              icon={Layers} 
                              color="amber"
                              className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30"
                              subtitle={`Venta potencial: $${Math.round(totalPotentialRevenue).toLocaleString()}`}
                              extraBadge={countMissingCost > 0 ? (
                                <span 
                                  className="text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full"
                                  title={`${countMissingCost} productos con stock no tienen costo asignado`}
                                >
                                  {countMissingCost} sin costo
                                </span>
                              ) : undefined}
                              onClick={() => {
                                setValuationInitialTab('all');
                                setIsValuationModalOpen(true);
                              }}
                              titleTooltip="Inversión total en mercadería parada a precio de reposición (costo)"
                              description="Inversión en productos en stock hoy. Clic para auditar producto por producto."
                            />
                            <StatCard 
                              title={t('low_stock')} 
                              value={lowStockCount} 
                              icon={AlertTriangle} 
                              color="rose"
                              className="bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30"
                              onClick={() => navigate('/inventario', { state: { filter: 'low-stock' } })}
                              description="Cantidad de productos que se están agotando y necesitan reposición urgente."
                            />
                          </div>
                        </motion.div>
                      );
                    case 'secondary_stats':
                      return (
                        <motion.div layout className="relative">
                          {renderControls('secondary_stats', attributes, listeners)}
                          <div className={cn("grid gap-6", mobileCompactMode ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4")}>
                            <StatCard 
                              title={t('total_products')} 
                              value={totalProducts} 
                              icon={Package} 
                              color="indigo"
                              variant="outline"
                              onClick={() => navigate('/inventario')}
                              description="Variedad total de artículos diferentes que tenés registrados."
                            />
                            <StatCard 
                              title={t('total_units')} 
                              value={totalUnits} 
                              icon={Package} 
                              color="emerald"
                              variant="outline"
                              onClick={() => navigate('/inventario')}
                              description="Suma física de todas las unidades (pares, piezas) de todos tus productos."
                            />
                            <StatCard 
                              title={t('total_potential_revenue') || 'Valor de Venta Total'} 
                              value={`$${Math.round(totalPotentialRevenue).toLocaleString()}`} 
                              icon={TrendingUp} 
                              color="indigo"
                              variant="outline"
                              subtitle={`Inversión en costo: $${Math.round(totalStockValue).toLocaleString()}`}
                              onClick={() => {
                                setValuationInitialTab('all');
                                setIsValuationModalOpen(true);
                              }}
                              titleTooltip="Valor total del inventario si se vendiera todo al precio actual"
                              description="La suma de dinero que recaudarías si vendieras hoy mismo todo tu stock."
                            />
                            <StatCard 
                              title={t('locations')} 
                              value={uniqueLocations} 
                              icon={MapPin} 
                              color="amber"
                              variant="outline"
                              onClick={() => navigate('/inventario')}
                              description="Cantidad de cajas o lugares diferentes donde tenés mercadería guardada."
                            />
                          </div>
                        </motion.div>
                      );
                    case 'charts':
                      return (
                        <motion.div layout className="relative space-y-8">
                          {renderControls('charts', attributes, listeners)}
                          
                          {/* Sección A: Movimiento de Mercadería (Items) */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <Package size={20} />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Sección A: Movimiento de Mercadería (Items)</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Seguimiento físico de tus productos: qué entra, qué sale y cuáles son los más populares.</p>
                              </div>
                            </div>
                            
                            <div className={cn("grid gap-6", mobileCompactMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                              {/* Stock Movements Chart */}
                              <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border-2 border-gray-100 dark:border-gray-800 shadow-lg">
                                <div className="flex items-center justify-between mb-6">
                                  <div>
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{t('stock_movements')}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('income_expense_7d')}</p>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center">
                                      <div className="w-2.5 h-2.5 rounded-full mr-2 bg-indigo-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('income')}</span>
                                    </div>
                                    <div className="flex items-center">
                                      <div className="w-2.5 h-2.5 rounded-full mr-2 bg-rose-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('expense')}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="h-[250px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stockChartData}>
                                      <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
                                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                      <Tooltip content={<CustomTooltip isMoney={false} />} />
                                      <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" />
                                      <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorEgresos)" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Top Products Chart */}
                              <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border-2 border-gray-100 dark:border-gray-800 shadow-lg">
                                <div className="flex items-center justify-between mb-6">
                                  <div>
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{t('top_products')}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('most_sold_products')}</p>
                                  </div>
                                </div>
                                <div className="h-[250px] w-full">
                                  {topProductsData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                      <Package className="w-12 h-12 mb-2 opacity-20" />
                                      <p className="text-sm font-medium">{t('no_sales_yet') || 'Aún no hay ventas'}</p>
                                    </div>
                                  ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={topProductsData} layout="vertical" margin={{ left: 30, right: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                        <YAxis 
                                          dataKey="name" 
                                          type="category" 
                                          axisLine={false} 
                                          tickLine={false} 
                                          tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                          width={120} 
                                        />
                                        <Tooltip content={<CustomTooltip isMoney={false} />} />
                                        <Bar dataKey="value" name="Unidades" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Sección B: Rendimiento Financiero (Dinero) */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                <TrendingUp size={20} />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Sección B: Rendimiento Financiero (Dinero)</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Análisis de rentabilidad: ingresos brutos vs costos para entender la salud económica de tu negocio.</p>
                              </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 shadow-xl">
                              <div className="flex items-center justify-between mb-8">
                                <div>
                                  <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{t('sales_vs_purchases')}</h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Flujo de caja en $ ARS (Ventas vs Compras)</p>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full mr-2 bg-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ingresos Totales</span>
                                  </div>
                                  <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-full mr-2 bg-amber-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Costos</span>
                                  </div>
                                </div>
                              </div>
                              <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={financialChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-800" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                                    <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                                      tickFormatter={(val) => `$${val.toLocaleString('es-AR')}`}
                                    />
                                    <Tooltip content={<CustomTooltip isMoney={true} />} />
                                    <Bar dataKey="ventas" name="Ingresos Totales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} />
                                    <Bar dataKey="compras" name="Costos" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={30} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    case 'recommendations':
                      return (
                        <motion.div layout className="relative">
                          {renderControls('recommendations', attributes, listeners)}
                          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/30">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <Sparkles className="w-6 h-6" />
                              </div>
                              <div>
                                <h4>{t('recommendations')}</h4>
                                <p className="text-xs text-indigo-100 font-medium opacity-80 italic">Nuestro sistema analiza tu stock y ventas para sugerirte acciones críticas de reposición o promociones.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {lowStockProducts.length === 0 && topProductsData.length === 0 && products.filter(p => p.lastMovementAt && new Date(p.lastMovementAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length === 0 ? (
                                <div className="md:col-span-2 flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/10">
                                  <Lightbulb className="w-8 h-8 text-indigo-200 opacity-50 mb-3" />
                                  <p className="text-sm font-medium text-indigo-100 opacity-70 text-center">
                                    {t('no_new_recommendations') || 'No hay nuevas sugerencias por el momento. ¡Buen trabajo!'}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {lowStockProducts.slice(0, 2).map(p => (
                                    <div key={p.id} className="flex items-start gap-3 text-sm bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors border border-white/10 backdrop-blur-sm">
                                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300" />
                                      <div className="flex flex-col">
                                        <span className="font-black text-white uppercase tracking-wider text-[10px] mb-1">Reponer Stock</span>
                                        <span className="font-medium leading-relaxed">
                                          El producto <strong className="text-white underline decoration-amber-300/50 underline-offset-4">{p.descripcion || p.codigo}</strong> está por debajo del mínimo ({p.minStock || 5}).
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                  {topProductsData.slice(0, 1).map(p => (
                                    <div key={p.name} className="flex items-start gap-3 text-sm bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors border border-white/10 backdrop-blur-sm">
                                      <TrendingUp className="w-5 h-5 shrink-0 text-emerald-300" />
                                      <div className="flex flex-col">
                                        <span className="font-black text-white uppercase tracking-wider text-[10px] mb-1">Oportunidad</span>
                                        <span className="font-medium leading-relaxed">
                                          <strong className="text-white underline decoration-emerald-300/50 underline-offset-4">{p.name}</strong> es tu producto estrella. Considera aumentar el stock.
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                  {products.filter(p => p.lastMovementAt && new Date(p.lastMovementAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).slice(0, 1).map(p => (
                                    <div key={p.id} className="flex items-start gap-3 text-sm bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-colors border border-white/10 backdrop-blur-sm">
                                      <Clock className="w-5 h-5 shrink-0 text-blue-300" />
                                      <div className="flex flex-col">
                                        <span className="font-black text-white uppercase tracking-wider text-[10px] mb-1">Rotación Lenta</span>
                                        <span className="font-medium leading-relaxed">
                                          El producto <strong className="text-white underline decoration-blue-300/50 underline-offset-4">{p.descripcion || p.codigo}</strong> no ha tenido movimientos en 30 días.
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                  {products.length > 0 && products.every(p => p.cantidad > (p.minStock || 5)) && (
                                    <div className="md:col-span-2 flex items-center justify-center gap-3 text-sm bg-white/10 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                                      <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                                      <span className="font-bold text-white">¡Excelente! Todos tus productos tienen stock suficiente.</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    case 'goals':
                      return (
                        <motion.div layout className="relative">
                          {renderControls('goals', attributes, listeners)}
                          <GoalsWidget />
                        </motion.div>
                      );
                    case 'movements':
                      return (
                        <motion.div layout className="relative">
                          {renderControls('movements', attributes, listeners)}
                          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 shadow-xl">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t('recent_movements')}</h3>
                              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <Clock size={20} className="text-slate-500" />
                              </div>
                            </div>
                            <div className="space-y-6">
                              {movements.length === 0 ? (
                                <div className="text-center py-12">
                                  <p className="text-gray-400 text-sm font-medium">{t('no_movements')}</p>
                                </div>
                              ) : (
                                movements.map((m) => {
                                  const date = (m.fecha as any).toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
                                  return (
                                    <div key={m.id} className="flex items-center justify-between group/item p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all">
                                      <div className="flex items-center">
                                        <div className={cn(
                                          "p-3 rounded-2xl mr-4 transition-all shadow-sm group-hover/item:scale-110",
                                          m.tipo === 'venta' || m.tipo === 'salida' 
                                            ? "bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" 
                                            : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                        )}>
                                          {m.tipo === 'venta' || m.tipo === 'salida' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[120px]">{m.productNombre}</p>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{date.toLocaleDateString('es-ES')} • {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className={cn(
                                          "text-sm font-black text-rose-600",
                                          m.tipo === 'venta' || m.tipo === 'salida' ? "text-rose-600" : "text-emerald-600"
                                        )}>
                                          {m.tipo === 'venta' || m.tipo === 'salida' ? '-' : '+'}{m.cantidad}
                                        </p>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-300">{m.tipo}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <button 
                              onClick={() => navigate('/inventario')}
                              className="w-full mt-8 py-4 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-2xl transition-all active:scale-95 shadow-sm"
                            >
                              {t('view_inventory')}
                            </button>
                          </div>
                        </motion.div>
                      );
                    default:
                      return null;
                  }
                }}
              </SortableWidget>
            ))}
          </SortableContext>
        </DndContext>

        <StockValuationModal
          isOpen={isValuationModalOpen}
          onClose={() => setIsValuationModalOpen(false)}
          products={products}
          purchases={purchases}
          initialTab={valuationInitialTab}
        />

        <DailyReportModal
          isOpen={isDailyReportOpen}
          onClose={() => setIsDailyReportOpen(false)}
        />
      </div>
    </div>
  );
}
