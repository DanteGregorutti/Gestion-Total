import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  Package, 
  Info, 
  ExternalLink,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { Product, Purchase } from '../types';
import { useNavigate } from 'react-router-dom';

export interface CalculatedProductItem {
  id: string;
  codigo: string;
  descripcion: string;
  talle?: string;
  units: number;
  rawUnits: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalSale: number;
  estimatedProfit: number;
  marginPercent: number;
  hasCost: boolean;
  hasPrice: boolean;
  hasNegativeStock: boolean;
  hasInvertedMargin: boolean;
  hasVariants: boolean;
}

interface StockValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  purchases?: Purchase[];
  initialTab?: 'all' | 'missing-cost' | 'top-profit';
}

export default function StockValuationModal({
  isOpen,
  onClose,
  products,
  purchases = [],
  initialTab = 'all'
}: StockValuationModalProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'missing-cost' | 'top-profit'>(initialTab);
  const [sortBy, setSortBy] = useState<'profit' | 'sale' | 'cost' | 'units'>('profit');

  // Compute detailed financial stock items
  const calculatedItems = useMemo<CalculatedProductItem[]>(() => {
    return products.map(p => {
      const variants = p.variants;
      const hasVariantsWithStock = Boolean(
        variants && 
        variants.length > 0 && 
        variants.some(v => (Number(v.cantidad) || 0) !== 0)
      );

      let units = 0;
      let rawUnits = 0;
      let totalCost = 0;
      let totalSale = 0;
      let profit = 0;
      let hasCost = false;
      let hasPrice = false;
      let hasInvertedMargin = false;

      if (hasVariantsWithStock && variants) {
        variants.forEach(v => {
          const vQtyRaw = Number(v.cantidad) || 0;
          rawUnits += vQtyRaw;
          const vQty = Math.max(0, vQtyRaw);

          let vCost = Number(v.costo) || 0;
          if (vCost <= 0) vCost = Number(p.costo) || 0;
          if (vCost <= 0) {
            const lastP = purchases.find(pu => pu.productId === p.id && (!pu.variantId || pu.variantId === v.id));
            if (lastP && Number(lastP.costo) > 0) vCost = Number(lastP.costo);
          }

          let vPrice = Number(v.precio) || 0;
          if (vPrice <= 0) vPrice = Number(p.precio) || 0;

          if (vCost > 0) hasCost = true;
          if (vPrice > 0) hasPrice = true;
          if (vCost > vPrice && vPrice > 0) hasInvertedMargin = true;

          units += vQty;
          totalCost += vQty * vCost;
          totalSale += vQty * vPrice;

          if (vCost > 0 && vPrice > 0) {
            profit += vQty * Math.max(0, vPrice - vCost);
          }
        });
      } else {
        const pQtyRaw = Number(p.cantidad) || 0;
        rawUnits = pQtyRaw;
        const qty = Math.max(0, pQtyRaw);

        let cost = Number(p.costo) || 0;
        if (cost <= 0) {
          const lastP = purchases.find(pu => pu.productId === p.id);
          if (lastP && Number(lastP.costo) > 0) cost = Number(lastP.costo);
        }

        const price = Number(p.precio) || 0;

        if (cost > 0) hasCost = true;
        if (price > 0) hasPrice = true;
        if (cost > price && price > 0) hasInvertedMargin = true;

        units = qty;
        totalCost = qty * cost;
        totalSale = qty * price;

        if (cost > 0 && price > 0) {
          profit = qty * Math.max(0, price - cost);
        }
      }

      const unitCost = units > 0 ? totalCost / units : (Number(p.costo) || 0);
      const unitPrice = units > 0 ? totalSale / units : (Number(p.precio) || 0);
      const marginPercent = totalCost > 0 ? Math.round(((totalSale - totalCost) / totalCost) * 100) : 0;

      return {
        id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        talle: p.talle,
        units,
        rawUnits,
        unitCost,
        unitPrice,
        totalCost,
        totalSale,
        estimatedProfit: profit,
        marginPercent,
        hasCost,
        hasPrice,
        hasNegativeStock: rawUnits < 0,
        hasInvertedMargin,
        hasVariants: Boolean(variants && variants.length > 0)
      };
    });
  }, [products, purchases]);

  // Overall Totals
  const overall = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    let totalSale = 0;
    let totalProfit = 0;
    let countMissingCost = 0;
    let countNegativeStock = 0;
    let countInvertedMargin = 0;

    calculatedItems.forEach(item => {
      totalUnits += item.units;
      totalCost += item.totalCost;
      totalSale += item.totalSale;
      totalProfit += item.estimatedProfit;

      if (item.units > 0 && !item.hasCost) {
        countMissingCost++;
      }
      if (item.hasNegativeStock) {
        countNegativeStock++;
      }
      if (item.hasInvertedMargin) {
        countInvertedMargin++;
      }
    });

    const averageMargin = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

    return {
      totalUnits,
      totalCost,
      totalSale,
      totalProfit,
      averageMargin,
      countMissingCost,
      countNegativeStock,
      countInvertedMargin
    };
  }, [calculatedItems]);

  // Filtered & Sorted list
  const displayItems = useMemo(() => {
    let list = calculatedItems.filter(item => {
      const matchesSearch = 
        item.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codigo.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'missing-cost') {
        return item.units > 0 && !item.hasCost;
      }
      if (activeTab === 'top-profit') {
        return item.estimatedProfit > 0;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'profit') return b.estimatedProfit - a.estimatedProfit;
      if (sortBy === 'sale') return b.totalSale - a.totalSale;
      if (sortBy === 'cost') return b.totalCost - a.totalCost;
      if (sortBy === 'units') return b.units - a.units;
      return 0;
    });

    return list;
  }, [calculatedItems, searchTerm, activeTab, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-blue-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Valorización de Stock y Ganancia Estimada
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                Auditoría financiera transparente: inversión en stock, facturación potencial y margen proyectado.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Financial KPI Summary */}
        <div className="p-6 bg-gray-50/50 dark:bg-gray-950/40 border-b border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Inversión en Stock (Costo)
            </span>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              ${Math.round(overall.totalCost).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Costo total de reposición
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Valor de Venta (PVP)
            </span>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              ${Math.round(overall.totalSale).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Ingreso si vendés todo el stock
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Ganancia Estimada
            </span>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              ${Math.round(overall.totalProfit).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Diferencia: Venta - Costo
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Rentabilidad Promedio
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              +{overall.averageMargin}%
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Sobre la inversión en costo
            </p>
          </div>
        </div>

        {/* Alert banners if missing costs or negative stock */}
        {(overall.countMissingCost > 0 || overall.countNegativeStock > 0 || overall.countInvertedMargin > 0) && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {overall.countMissingCost > 0 && (
                  <>
                    Hay <strong>{overall.countMissingCost} productos sin precio de costo cargado</strong> (su costo se toma como $0 y no suman a la inversión).
                  </>
                )}
                {overall.countNegativeStock > 0 && (
                  <span className="ml-1">
                    ({overall.countNegativeStock} productos tienen stock negativo y fueron omitidos del valor físico).
                  </span>
                )}
              </span>
            </div>
            {overall.countMissingCost > 0 && (
              <button
                onClick={() => setActiveTab('missing-cost')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors"
              >
                Ver sin costo ({overall.countMissingCost})
              </button>
            )}
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'all' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todos ({calculatedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('top-profit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'top-profit' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Con Ganancia ({calculatedItems.filter(i => i.estimatedProfit > 0).length})
            </button>
            <button
              onClick={() => setActiveTab('missing-cost')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'missing-cost' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
              }`}
            >
              Sin Costo ({overall.countMissingCost})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar producto o código..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="profit">Mayor Ganancia</option>
              <option value="sale">Mayor Venta</option>
              <option value="cost">Mayor Inversión</option>
              <option value="units">Mayor Stock</option>
            </select>
          </div>
        </div>

        {/* Product Items Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Producto</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3 text-right">Costo Unit.</th>
                  <th className="py-3 px-3 text-right">Precio Venta</th>
                  <th className="py-3 px-3 text-right">Inversión (Costo)</th>
                  <th className="py-3 px-3 text-right">Venta Total</th>
                  <th className="py-3 px-3 text-right font-black text-blue-600 dark:text-blue-400">Ganancia Est.</th>
                  <th className="py-3 px-4 text-center rounded-r-xl">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No se encontraron productos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 dark:text-white leading-tight">
                          {item.descripcion}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                          <span>{item.codigo}</span>
                          {item.talle && <span>• Talle: {item.talle}</span>}
                          {item.hasVariants && <span className="text-indigo-500 font-bold">• Variantes</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-full ${item.rawUnits <= 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                          {item.units} u.
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {item.hasCost ? (
                          <span className="font-bold text-gray-600 dark:text-gray-300">
                            ${Math.round(item.unitCost).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                            Sin costo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                        ${Math.round(item.unitPrice).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700 dark:text-amber-400">
                        ${Math.round(item.totalCost).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        ${Math.round(item.totalSale).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                          ${Math.round(item.estimatedProfit).toLocaleString()}
                        </span>
                        {item.marginPercent > 0 && (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            +{item.marginPercent}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            onClose();
                            navigate('/inventario');
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                          title="Ver en inventario"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info and close */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Info size={14} className="text-gray-400 shrink-0" />
            <span>
              La <strong>Ganancia Estimada</strong> se calcula como <code>(Precio de Venta - Costo) × Cantidad</code> para cada producto en stock.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}
