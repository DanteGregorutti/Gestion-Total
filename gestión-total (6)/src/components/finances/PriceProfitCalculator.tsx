/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Percent, 
  TrendingUp, 
  Scale, 
  DollarSign, 
  HelpCircle, 
  Tag, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const PriceProfitCalculator: React.FC = () => {
  // Mode 1: Product Pricing Calculator
  const [costPrice, setCostPrice] = useState<number>(5000);
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(40);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [feePercent, setFeePercent] = useState<number>(6.5); // Example: Mercado Pago or card fee

  // Mode 2: Break-Even / Punto de Equilibrio
  const [rentCost, setRentCost] = useState<number>(150000);
  const [utilitiesCost, setUtilitiesCost] = useState<number>(40000);
  const [salariesOrOwnerWage, setSalariesOrOwnerWage] = useState<number>(300000);
  const [otherFixedCosts, setOtherFixedCosts] = useState<number>(30000);
  const [businessAverageMargin, setBusinessAverageMargin] = useState<number>(35);

  // Pricing calculations
  const { suggestedPrice, netProfit, feeAmount, profitOnCostPercent } = useMemo(() => {
    const baseCost = (costPrice || 0) + (packagingCost || 0);
    // If user wants margin on sale: Price = BaseCost / (1 - (margin% + fee%)/100)
    const totalDeductionPercent = ((profitMarginPercent || 0) + (feePercent || 0)) / 100;
    
    let price = 0;
    if (totalDeductionPercent < 0.99) {
      price = baseCost / (1 - totalDeductionPercent);
    } else {
      // Fallback simple markup on cost
      price = baseCost * (1 + (profitMarginPercent || 0) / 100);
    }

    price = Math.round(price) || 0;
    const fee = Math.round(price * ((feePercent || 0) / 100)) || 0;
    const profit = Math.max(0, price - baseCost - fee) || 0;
    const profitOnCost = baseCost > 0 ? ((profit / baseCost) * 100) : 0;

    return {
      suggestedPrice: isNaN(price) || !isFinite(price) ? 0 : price,
      netProfit: isNaN(profit) || !isFinite(profit) ? 0 : profit,
      feeAmount: isNaN(fee) || !isFinite(fee) ? 0 : fee,
      profitOnCostPercent: isNaN(profitOnCost) || !isFinite(profitOnCost) ? 0 : Math.round(profitOnCost)
    };
  }, [costPrice, profitMarginPercent, packagingCost, feePercent]);

  // Break-even calculations
  const { totalFixedCosts, monthlyBreakEvenRevenue, dailyBreakEvenRevenue } = useMemo(() => {
    const fixed = (rentCost || 0) + (utilitiesCost || 0) + (salariesOrOwnerWage || 0) + (otherFixedCosts || 0);
    const marginRatio = (businessAverageMargin || 35) / 100;
    const breakEven = marginRatio > 0 ? fixed / marginRatio : 0;
    const daily = breakEven / 30;

    return {
      totalFixedCosts: isNaN(fixed) || !isFinite(fixed) ? 0 : Math.round(fixed),
      monthlyBreakEvenRevenue: isNaN(breakEven) || !isFinite(breakEven) ? 0 : Math.round(breakEven),
      dailyBreakEvenRevenue: isNaN(daily) || !isFinite(daily) ? 0 : Math.round(daily)
    };
  }, [rentCost, utilitiesCost, salariesOrOwnerWage, otherFixedCosts, businessAverageMargin]);

  const MARGIN_PRESETS = [20, 30, 40, 50, 75, 100];
  const FEE_PRESETS = [
    { label: '0% (Efectivo)', value: 0 },
    { label: '3.5% (Débito)', value: 3.5 },
    { label: '6.5% (Crédito / MP)', value: 6.5 },
    { label: '10% (Financiado)', value: 10 }
  ];

  return (
    <div className="space-y-8">
      {/* SECTION 1: Product Pricing & Profit Margin Calculator */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Calculadora de Precio de Venta & Ganancia Neta
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Calcula el precio justo para cubrir costos, comisiones de cobro y asegurar tu ganancia
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
            Fórmula Inteligente
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Costo Base */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Costo del Producto / Insumos ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Margen de Ganancia Pretendido */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Margen de Ganancia Pretendido (%)
                </label>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {profitMarginPercent}%
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MARGIN_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setProfitMarginPercent(preset)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      profitMarginPercent === preset
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                value={profitMarginPercent}
                onChange={(e) => setProfitMarginPercent(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Comisión de Cobro (Tarjetas / MP) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  Comisión de Cobro (Billetera / POS)
                </label>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {feePercent}%
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FEE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFeePercent(p.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                      feePercent === p.value
                        ? 'bg-amber-600 text-white font-bold shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Empaque o Envío Opcional */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Empaque / Flete / Envoltorio Opcional ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  value={packagingCost || ''}
                  onChange={(e) => setPackagingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0 (opcional)"
                  className="w-full pl-8 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Result Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800/60 shadow-md">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Precio Sugerido de Venta
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  ${suggestedPrice.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Cubre tus costos y deja tu ganancia íntegra
              </p>

              {/* Breakdown */}
              <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-gray-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">💰 Tu Ganancia Neta Limpia:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    +${netProfit.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">📦 Costo de Mercadería:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    ${costPrice.toLocaleString('es-AR')}
                  </span>
                </div>
                {packagingCost > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">✉️ Empaque / Logística:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      ${packagingCost.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
                {feeAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">💳 Retención Pasarela ({feePercent}%):</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      -${feeAmount.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-white/80 dark:bg-gray-900/80 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Rendimiento: <strong>{profitOnCostPercent}% de retorno</strong> sobre lo invertido.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Punto de Equilibrio / Break-Even Simulator */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Simulador de Punto de Equilibrio (Break-Even)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Calcula cuánto dinero necesita facturar tu negocio al mes y por día para cubrir gastos fijos
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-xs px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
            Salud Financiera
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Fixed costs inputs (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Alquiler del Local / Taller ($/mes)
              </label>
              <input
                type="number"
                min="0"
                value={rentCost || ''}
                onChange={(e) => setRentCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Servicios (Luz, Gas, Internet) ($/mes)
              </label>
              <input
                type="number"
                min="0"
                value={utilitiesCost || ''}
                onChange={(e) => setUtilitiesCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Sueldos / Tu Retiro Emprendedor ($/mes)
              </label>
              <input
                type="number"
                min="0"
                value={salariesOrOwnerWage || ''}
                onChange={(e) => setSalariesOrOwnerWage(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Otros Fijos (Publicidad, Contador) ($/mes)
              </label>
              <input
                type="number"
                min="0"
                value={otherFixedCosts || ''}
                onChange={(e) => setOtherFixedCosts(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Margen de Ganancia Promedio del Negocio
                </label>
                <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400">
                  {businessAverageMargin}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={businessAverageMargin}
                onChange={(e) => setBusinessAverageMargin(parseInt(e.target.value, 10))}
                className="w-full accent-purple-600 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Break-even stats (5 cols) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800/40 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  Venta Mínima Mensual Requerida
                </span>
                <div className="text-3xl font-black text-purple-900 dark:text-purple-100 mt-0.5">
                  ${monthlyBreakEvenRevenue.toLocaleString('es-AR')}
                </div>
                <p className="text-xs text-purple-700/80 dark:text-purple-300/80">
                  Para cubrir <strong>${totalFixedCosts.toLocaleString('es-AR')}</strong> de costos fijos mensuales.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-purple-100 dark:border-purple-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 Meta Diaria de Venta:</span>
                  <span className="font-extrabold text-purple-700 dark:text-purple-300 text-sm">
                    ${dailyBreakEvenRevenue.toLocaleString('es-AR')} / día
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🛡️ Costos Fijos Totales:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ${totalFixedCosts.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-purple-800 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-900/30 p-2.5 rounded-xl">
              💡 <em>Toda venta por encima de <strong>${monthlyBreakEvenRevenue.toLocaleString('es-AR')}</strong> es ganancia limpia de tu negocio.</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
