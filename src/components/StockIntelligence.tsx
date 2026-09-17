/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Package, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight,
  ShoppingCart,
  Layers,
  HelpCircle
} from 'lucide-react';
import { Product, Sale } from '../types';
import { Button } from './ui';
import { useNavigate } from 'react-router-dom';

interface StockIntelligenceProps {
  products: Product[];
  sales: Sale[];
}

export function StockIntelligence({ products, sales }: StockIntelligenceProps) {
  const navigate = useNavigate();
  const [filterClass, setFilterClass] = useState<'all' | 'A' | 'B' | 'C'>('all');

  // 1. Calculate sales per product in the last 30 days
  const intelligence = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Group sales by product id or name
    const salesStats: Record<string, { unitsSold: number; revenue: number }> = {};
    sales.forEach(s => {
      const saleDate = (s.fecha as any)?.toDate ? (s.fecha as any).toDate().getTime() : new Date(s.fecha).getTime();
      if (saleDate >= thirtyDaysAgo) {
        const key = s.productId || s.productNombre.toLowerCase();
        if (!salesStats[key]) {
          salesStats[key] = { unitsSold: 0, revenue: 0 };
        }
        salesStats[key].unitsSold += (Number(s.cantidad) || 0);
        salesStats[key].revenue += (Number(s.total) || 0);
      }
    });

    const totalRevenue30d = Object.values(salesStats).reduce((acc, v) => acc + v.revenue, 0);

    // Build analysis for each product
    const productMetrics = products.map(p => {
      const stats = salesStats[p.id] || salesStats[p.descripcion.toLowerCase()] || { unitsSold: 0, revenue: 0 };
      const avgDailySales = stats.unitsSold / 30;
      
      // Days of stock remaining before stockout
      const daysOfStock = avgDailySales > 0 ? Math.round(p.cantidad / avgDailySales) : 999;

      // Recommended restock quantity (target 30 days buffer)
      const idealStock30d = Math.ceil(avgDailySales * 30);
      const suggestedRestock = Math.max(0, idealStock30d - p.cantidad);

      return {
        product: p,
        unitsSold: stats.unitsSold,
        revenue: stats.revenue,
        avgDailySales: avgDailySales.toFixed(1),
        daysOfStock,
        suggestedRestock,
        revenuePercentage: totalRevenue30d > 0 ? (stats.revenue / totalRevenue30d) * 100 : 0
      };
    });

    // Sort by revenue descending for ABC classification (Pareto principle 80/15/5)
    productMetrics.sort((a, b) => b.revenue - a.revenue);

    let cumulativeRevenue = 0;
    const classified = productMetrics.map(item => {
      cumulativeRevenue += item.revenuePercentage;
      let abcCategory: 'A' | 'B' | 'C' = 'C';
      if (cumulativeRevenue <= 80 || item.unitsSold > 10) {
        abcCategory = 'A'; // High rotation / top revenue
      } else if (cumulativeRevenue <= 95 || item.unitsSold > 3) {
        abcCategory = 'B'; // Moderate rotation
      } else {
        abcCategory = 'C'; // Low rotation / dormant stock
      }
      return { ...item, abcCategory };
    });

    // Replenishment alerts: High or moderate rotation products that will stock out in <= 7 days
    const replenishmentAlerts = classified.filter(item => 
      item.suggestedRestock > 0 && (item.daysOfStock <= 7 || item.product.cantidad <= (item.product.minStock || 3))
    );

    return {
      items: classified,
      replenishmentAlerts,
      countA: classified.filter(c => c.abcCategory === 'A').length,
      countB: classified.filter(c => c.abcCategory === 'B').length,
      countC: classified.filter(c => c.abcCategory === 'C').length
    };
  }, [products, sales]);

  const filteredItems = intelligence.items.filter(item => 
    filterClass === 'all' || item.abcCategory === filterClass
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Restock Suggestions */}
      {intelligence.replenishmentAlerts.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Sugerencias de Reposición Urgente ({intelligence.replenishmentAlerts.length} productos)
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              Riesgo de Quiebre de Stock
            </span>
          </div>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-4">
            Según tu velocidad de ventas de los últimos 30 días, estos artículos de alta demanda se agotarán en menos de 7 días:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {intelligence.replenishmentAlerts.slice(0, 6).map(({ product, daysOfStock, suggestedRestock }) => (
              <div 
                key={product.id} 
                className="p-3 bg-white dark:bg-gray-800/90 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block truncate max-w-[170px]">
                    {product.descripcion}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Stock actual: <strong className="text-rose-600">{product.cantidad} un.</strong> ({daysOfStock === 0 ? '¡Agotado!' : `Quedan ~${daysOfStock} días`})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-600 font-bold block uppercase">Comprar</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    +{suggestedRestock} un.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABC Classification Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div 
          onClick={() => setFilterClass(filterClass === 'A' ? 'all' : 'A')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filterClass === 'A'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-emerald-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Categoría A (Estrella)
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              {intelligence.countA}
            </span>
          </div>
          <p className="text-xs text-gray-500">Generan el ~80% de tus ingresos. Nunca deben faltar.</p>
        </div>

        <div 
          onClick={() => setFilterClass(filterClass === 'B' ? 'all' : 'B')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filterClass === 'B'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Categoría B (Medio)
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              {intelligence.countB}
            </span>
          </div>
          <p className="text-xs text-gray-500">Rotación moderada. Mantener stock regular.</p>
        </div>

        <div 
          onClick={() => setFilterClass(filterClass === 'C' ? 'all' : 'C')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filterClass === 'C'
              ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/20'
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-purple-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Categoría C (Baja Salida)
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              {intelligence.countC}
            </span>
          </div>
          <p className="text-xs text-gray-500">Bajo movimiento. Evitar sobre-stockear capital parado.</p>
        </div>
      </div>

      {/* Intelligence Table */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Análisis de Rotación y Demanda (Últimos 30 días)
          </h4>
          {filterClass !== 'all' && (
            <button 
              onClick={() => setFilterClass('all')}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Ver todos ({intelligence.items.length})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="p-3.5">Producto</th>
                <th className="p-3.5 text-center">Clasificación ABC</th>
                <th className="p-3.5 text-right">Ventas (30d)</th>
                <th className="p-3.5 text-right">Stock Actual</th>
                <th className="p-3.5 text-right">Días Restantes</th>
                <th className="p-3.5 text-right">Sugerencia Reposición</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredItems.slice(0, 30).map(({ product, unitsSold, revenue, daysOfStock, suggestedRestock, abcCategory }) => (
                <tr key={product.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                  <td className="p-3.5">
                    <span className="font-bold text-gray-900 dark:text-white block">{product.descripcion}</span>
                    <span className="text-[11px] text-gray-400">Código: {product.codigo || 'S/C'}</span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      abcCategory === 'A'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : abcCategory === 'B'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    }`}>
                      Clase {abcCategory}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-bold text-gray-700 dark:text-gray-300">
                    {unitsSold} un. (${revenue.toLocaleString('es-AR')})
                  </td>
                  <td className="p-3.5 text-right font-bold text-gray-900 dark:text-white">
                    {product.cantidad} un.
                  </td>
                  <td className="p-3.5 text-right">
                    <span className={`font-bold ${
                      daysOfStock <= 7 ? 'text-rose-600' : daysOfStock <= 15 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {daysOfStock > 180 ? '>6 meses' : `${daysOfStock} días`}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {suggestedRestock > 0 ? (
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        Pedir +{suggestedRestock} un.
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Óptimo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
