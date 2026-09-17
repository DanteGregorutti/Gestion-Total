/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Package, 
  ShoppingCart, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  DollarSign, 
  Building2, 
  Download,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Product, PurchaseOrderItem } from '../../types';
import { Button, Input } from '../ui';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';

interface RestockAssistantProps {
  products: Product[];
  onGeneratePurchaseOrder: (items: PurchaseOrderItem[], defaultSupplier?: string) => void;
}

export function RestockAssistant({ products, onGeneratePurchaseOrder }: RestockAssistantProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'out' | 'low'>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Detect critical items (stock <= stockMinimo or <= 3, or stock === 0)
  const criticalProducts = useMemo(() => {
    return products.filter(p => {
      const minStock = p.stockMinimo !== undefined && p.stockMinimo !== null ? p.stockMinimo : 5;
      return p.cantidad <= minStock;
    }).sort((a, b) => {
      // 0 stock first, then lowest stock
      if (a.cantidad === 0 && b.cantidad > 0) return -1;
      if (b.cantidad === 0 && a.cantidad > 0) return 1;
      return a.cantidad - b.cantidad;
    });
  }, [products]);

  // Filtered items based on search and subfilter
  const filteredProducts = useMemo(() => {
    return criticalProducts.filter(p => {
      if (filterType === 'out' && p.cantidad > 0) return false;
      if (filterType === 'low' && p.cantidad === 0) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCode = (p.codigo || '').toLowerCase().includes(term);
        const matchDesc = (p.descripcion || '').toLowerCase().includes(term);
        const matchProc = (p.procedencia || '').toLowerCase().includes(term);
        return matchCode || matchDesc || matchProc;
      }
      return true;
    });
  }, [criticalProducts, filterType, searchTerm]);

  // Default suggested reorder qty
  const getSuggestedQty = (p: Product): number => {
    if (customQuantities[p.id] !== undefined) {
      return customQuantities[p.id];
    }
    const minStock = p.stockMinimo || 5;
    const target = minStock * 2;
    const needed = target - p.cantidad;
    return Math.max(needed, 5);
  };

  const handleQtyChange = (productId: string, qty: number) => {
    setCustomQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, qty)
    }));
  };

  const handleToggleSelect = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  // Selected totals
  const selectedProductsList = useMemo(() => {
    return criticalProducts.filter(p => selectedProductIds.has(p.id));
  }, [criticalProducts, selectedProductIds]);

  const totalEstimatedInvestment = useMemo(() => {
    return selectedProductsList.reduce((acc, p) => {
      const qty = getSuggestedQty(p);
      const cost = Number(p.costo) || 0;
      return acc + (qty * cost);
    }, 0);
  }, [selectedProductsList, customQuantities]);

  const handleLaunchGroupOrder = () => {
    if (selectedProductsList.length === 0) {
      toast.error('Selecciona al menos un producto para generar la orden de compra');
      return;
    }

    const orderItems: PurchaseOrderItem[] = selectedProductsList.map(p => {
      const qty = getSuggestedQty(p);
      const cost = Number(p.costo) || 0;
      return {
        productId: p.id,
        codigo: p.codigo,
        productNombre: p.descripcion,
        cantidad: qty,
        costoEstimado: cost,
        subtotal: qty * cost
      };
    });

    // Determine supplier if they share one
    const suppliers = Array.from(new Set(selectedProductsList.map(p => p.procedencia).filter(Boolean)));
    const defaultSupplier = suppliers.length === 1 ? suppliers[0] : undefined;

    onGeneratePurchaseOrder(orderItems, defaultSupplier);
    toast.success(`Orden de compra cargada con ${orderItems.length} ítems`);
  };

  const handleLaunchSingleOrder = (p: Product) => {
    const qty = getSuggestedQty(p);
    const cost = Number(p.costo) || 0;
    const item: PurchaseOrderItem = {
      productId: p.id,
      codigo: p.codigo,
      productNombre: p.descripcion,
      cantidad: qty,
      costoEstimado: cost,
      subtotal: qty * cost
    };
    onGeneratePurchaseOrder([item], p.procedencia || undefined);
  };

  const handleExportCsv = () => {
    if (criticalProducts.length === 0) {
      toast.info('No hay productos con stock crítico para exportar');
      return;
    }

    const headers = ['Código', 'Descripción', 'Categoría/Proveedor', 'Stock Actual', 'Stock Mínimo', 'Cantidad Sugerida', 'Costo Unit.', 'Inversión Estimada'];
    const rows = criticalProducts.map(p => {
      const qty = getSuggestedQty(p);
      const cost = Number(p.costo) || 0;
      return [
        `"${p.codigo || ''}"`,
        `"${p.descripcion || ''}"`,
        `"${p.procedencia || ''}"`,
        p.cantidad,
        p.stockMinimo || 5,
        qty,
        cost,
        qty * cost
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reposicion_stock_critico_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte de reposición exportado en CSV');
  };

  const outOfStockCount = criticalProducts.filter(p => p.cantidad === 0).length;
  const lowStockCount = criticalProducts.filter(p => p.cantidad > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Productos Agotados</p>
            <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{outOfStockCount}</h4>
            <p className="text-[11px] text-gray-500">Stock en cero unidades</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Stock Crítico</p>
            <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</h4>
            <p className="text-[11px] text-gray-500">Por debajo del mínimo</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Inversión Sugerida</p>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              ${criticalProducts.reduce((acc, p) => acc + (getSuggestedQty(p) * (Number(p.costo) || 0)), 0).toLocaleString('es-AR')}
            </h4>
            <p className="text-[11px] text-gray-500">Para reabastecer todo el stock</p>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por código, producto o procedencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filterType === 'all'
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Todos ({criticalProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('out')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filterType === 'out'
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-rose-600"
              )}
            >
              Agotados ({outOfStockCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('low')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filterType === 'low'
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-amber-600"
              )}
            >
              Bajo Stock ({lowStockCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          >
            <Download className="w-4 h-4 mr-1.5" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            onClick={handleLaunchGroupOrder}
            disabled={selectedProductsList.length === 0}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm disabled:opacity-50"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            <span>Generar Orden ({selectedProductsList.length})</span>
          </Button>
        </div>
      </div>

      {/* Bulk Action Sticky Bar when items are selected */}
      {selectedProductsList.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
              {selectedProductsList.length}
            </span>
            <div>
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                {selectedProductsList.length} productos seleccionados para reabastecimiento
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                Inversión estimada: <strong>${totalEstimatedInvestment.toLocaleString('es-AR')}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProductIds(new Set())}
              className="text-xs text-indigo-700 hover:text-indigo-900"
            >
              Desmarcar todos
            </Button>
            <Button
              size="sm"
              onClick={handleLaunchGroupOrder}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
            >
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              Crear Orden de Compra Ahora
            </Button>
          </div>
        </div>
      )}

      {/* Restock Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    title="Seleccionar todos"
                  >
                    {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Producto & Código</th>
                <th className="py-3.5 px-4">Procedencia / Proveedor</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-center">Mínimo</th>
                <th className="py-3.5 px-4 text-center w-28">Cant. a Pedir</th>
                <th className="py-3.5 px-4 text-right">Costo Est.</th>
                <th className="py-3.5 px-4 text-right">Total Est.</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-gray-600 dark:text-gray-300">¡Todo el stock está al día!</p>
                    <p className="text-xs text-gray-400 mt-1">No hay productos que requieran reposición en este momento.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isSelected = selectedProductIds.has(p.id);
                  const isZero = p.cantidad === 0;
                  const suggestedQty = getSuggestedQty(p);
                  const cost = Number(p.costo) || 0;
                  const itemTotal = suggestedQty * cost;

                  return (
                    <tr 
                      key={p.id}
                      className={cn(
                        "transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40",
                        isSelected && "bg-indigo-50/40 dark:bg-indigo-950/20"
                      )}
                    >
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(p.id)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            isZero ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                          )} />
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white leading-tight">{p.descripcion}</p>
                            <span className="text-[10px] font-mono text-gray-400">COD: {p.codigo || 'S/C'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">
                          {p.procedencia || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full font-black text-xs",
                          isZero 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        )}>
                          {p.cantidad} un.
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-400 font-bold">
                        {p.stockMinimo || 5} un.
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="1"
                          value={suggestedQty}
                          onChange={(e) => handleQtyChange(p.id, parseInt(e.target.value, 10) || 1)}
                          className="w-20 px-2 py-1 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300 font-medium">
                        ${cost.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-gray-900 dark:text-white">
                        ${itemTotal.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleLaunchSingleOrder(p)}
                          className="h-7 px-2.5 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[11px] font-bold"
                          title="Crear orden para este ítem"
                        >
                          Pedir
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
