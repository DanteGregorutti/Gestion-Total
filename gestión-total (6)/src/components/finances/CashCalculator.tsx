/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Banknote, 
  CreditCard, 
  RotateCcw, 
  Save, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Plus, 
  Minus,
  X,
  Wallet,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui';
import { inventoryService } from '../../services/inventoryService';
import { CashAudit } from '../../types';

interface CashCalculatorProps {
  expectedCash: number;
  expectedTotal: number;
  onAuditSaved?: () => void;
  mobileCompactMode?: boolean;
}

interface Denomination {
  value: number;
  label: string;
  colorClass: string;
}

const DENOMINATIONS: Denomination[] = [
  { value: 20000, label: '$20.000', colorClass: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/60' },
  { value: 10000, label: '$10.000', colorClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60' },
  { value: 2000, label: '$2.000', colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60' },
  { value: 1000, label: '$1.000', colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60' },
  { value: 500, label: '$500', colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60' },
  { value: 200, label: '$200', colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60' },
  { value: 100, label: '$100', colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60' },
  { value: 50, label: '$50', colorClass: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' }
];

export const CashCalculator: React.FC<CashCalculatorProps> = ({
  expectedCash,
  expectedTotal,
  onAuditSaved,
}) => {
  const [counts, setCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0
  });

  const [digitalAmounts, setDigitalAmounts] = useState({
    bancos: 0,
    mercadoPago: 0,
    otros: 0
  });

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quick increment/decrement
  const handleCountChange = (val: number, delta: number) => {
    setCounts(prev => {
      const current = prev[val] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [val]: next };
    });
  };

  // Direct manual count input
  const handleDirectCount = (val: number, raw: string) => {
    if (raw === '') {
      setCounts(prev => ({ ...prev, [val]: 0 }));
      return;
    }
    const parsed = parseInt(raw, 10);
    setCounts(prev => ({
      ...prev,
      [val]: isNaN(parsed) || parsed < 0 ? 0 : parsed
    }));
  };

  // Reset single denomination
  const handleClearDenomination = (val: number) => {
    setCounts(prev => ({ ...prev, [val]: 0 }));
  };

  // Total bills count (units)
  const totalBillsCount = useMemo(() => {
    return Object.values(counts).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  }, [counts]);

  // Cash calculated
  const totalCash = useMemo(() => {
    return Object.entries(counts).reduce((sum, [denom, count]) => {
      return sum + ((Number(denom) || 0) * (Number(count) || 0));
    }, 0);
  }, [counts]);

  // Digital amounts sum
  const totalDigital = useMemo(() => {
    return (Number(digitalAmounts.bancos) || 0) + (Number(digitalAmounts.mercadoPago) || 0) + (Number(digitalAmounts.otros) || 0);
  }, [digitalAmounts]);

  // Combined Grand Total
  const grandTotal = useMemo(() => {
    const total = totalCash + totalDigital;
    return isNaN(total) ? 0 : total;
  }, [totalCash, totalDigital]);

  // Difference vs Expected cash from sales
  const cashDifference = useMemo(() => {
    const diff = totalCash - (Number(expectedCash) || 0);
    return isNaN(diff) ? 0 : diff;
  }, [totalCash, expectedCash]);

  // Reset all
  const handleReset = () => {
    if (totalBillsCount === 0 && totalDigital === 0 && !notes) return;
    if (window.confirm('¿Deseas vaciar la calculadora a cero?')) {
      setCounts({
        20000: 0,
        10000: 0,
        2000: 0,
        1000: 0,
        500: 0,
        200: 0,
        100: 0,
        50: 0
      });
      setDigitalAmounts({
        bancos: 0,
        mercadoPago: 0,
        otros: 0
      });
      setNotes('');
    }
  };

  const handleSaveAudit = async () => {
    try {
      setIsSaving(true);
      const auditPayload: Omit<CashAudit, 'id' | 'createdAt' | 'createdBy'> = {
        fecha: new Date().toISOString(),
        totalEfectivo: totalCash,
        totalDigital,
        totalContado: grandTotal,
        totalEsperado: expectedCash,
        diferencia: cashDifference,
        desglose: counts,
        notas: notes.trim()
      };

      await inventoryService.addCashAudit(auditPayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
      if (onAuditSaved) onAuditSaved();
    } catch (err) {
      console.error('Error saving cash audit:', err);
      alert('Error al guardar el arqueo de caja');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySummary = () => {
    const dateStr = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const activeBills = DENOMINATIONS
      .filter(d => (counts[d.value] || 0) > 0)
      .map(d => `  • ${counts[d.value]} de ${d.label} = $${(d.value * counts[d.value]).toLocaleString('es-AR')}`)
      .join('\n');

    const text = `📊 *CIERRE & ARQUEO DE CAJA (${dateStr})*
---------------------------------
💵 *Efectivo Físico:* $${totalCash.toLocaleString('es-AR')} (${totalBillsCount} billetes)
${activeBills ? `${activeBills}\n` : ''}
💳 *Dinero Digital:* $${totalDigital.toLocaleString('es-AR')}
  • Mercado Pago: $${(digitalAmounts.mercadoPago || 0).toLocaleString('es-AR')}
  • Bancos / CBU: $${(digitalAmounts.bancos || 0).toLocaleString('es-AR')}
  • Otros: $${(digitalAmounts.otros || 0).toLocaleString('es-AR')}

💰 *TOTAL REAL DISPONIBLE:* $${grandTotal.toLocaleString('es-AR')}
---------------------------------
📋 *Esperado por Sistema:* $${expectedCash.toLocaleString('es-AR')}
⚖️ *Diferencia Efectivo:* ${Math.abs(cashDifference) < 1 ? '✅ Caja cuadrada ($0)' : cashDifference > 0 ? `🟢 Sobrante: +$${cashDifference.toLocaleString('es-AR')}` : `🔴 Faltante: -$${Math.abs(cashDifference).toLocaleString('es-AR')}`}
${notes ? `\n📝 *Nota:* ${notes}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Sleek Compact Financial Summary Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* 1. Efectivo Contado */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Efectivo Físico
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                ${totalCash.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {totalBillsCount} billetes contados
              </div>
            </div>
          </div>

          {/* 2. Cuentas Digitales */}
          <div className="flex items-center gap-3 sm:border-l sm:border-gray-200 sm:dark:border-gray-800 sm:pl-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Bancos & MP
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                ${totalDigital.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                Mercado Pago y cuentas
              </div>
            </div>
          </div>

          {/* 3. Total Real en Mano */}
          <div className="flex items-center gap-3 lg:border-l lg:border-gray-200 lg:dark:border-gray-800 lg:pl-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Total Disponible
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                ${grandTotal.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Efectivo + Digital
              </div>
            </div>
          </div>

          {/* 4. Estado de Caja / Diferencia */}
          <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-800 lg:pl-4 flex flex-col justify-center">
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              Cuadre vs Ventas (${expectedCash.toLocaleString('es-AR')})
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold w-fit ${
              Math.abs(cashDifference) < 1 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                : cashDifference > 0 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}>
              {Math.abs(cashDifference) < 1 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Caja Cuadrada ($0)</span>
                </>
              ) : cashDifference > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Sobrante: +${cashDifference.toLocaleString('es-AR')}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Faltante: -${Math.abs(cashDifference).toLocaleString('es-AR')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left = Bill Counter, Right = Digital & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: Clean, Simple Bill Counter (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                  Recuento de Billetes Físicos
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Anotá cuántos billetes tenés de cada valor
                </p>
              </div>
            </div>

            {totalBillsCount > 0 && (
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Reiniciar todos los billetes a cero"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* Clean Denomination List / Table */}
          <div className="space-y-2">
            {DENOMINATIONS.map(({ value, label, colorClass }) => {
              const count = counts[value] || 0;
              const subtotal = value * count;
              const hasCount = count > 0;

              return (
                <div 
                  key={value}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all gap-2 sm:gap-3 ${
                    hasCount 
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 shadow-sm' 
                      : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {/* Denomination Value Badge */}
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:w-36">
                    <span className={`px-3 py-1.5 rounded-lg font-black text-sm border ${colorClass}`}>
                      {label}
                    </span>
                    <span className="sm:hidden text-xs font-bold text-gray-700 dark:text-gray-300">
                      = ${subtotal.toLocaleString('es-AR')}
                    </span>
                  </div>

                  {/* Ergonomic Stepper & Input */}
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm justify-between sm:justify-center">
                    <button
                      type="button"
                      onClick={() => handleCountChange(value, -1)}
                      disabled={count === 0}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all text-sm"
                      aria-label={`Restar billete de ${label}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <div className="relative flex-1 max-w-[90px]">
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) => handleDirectCount(value, e.target.value)}
                        className="w-full h-8 px-2 text-center font-black text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCountChange(value, 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center active:scale-95 transition-all shadow-sm text-sm"
                      aria-label={`Sumar billete de ${label}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick +5 Chip for rapid counting */}
                    <button
                      type="button"
                      onClick={() => handleCountChange(value, 5)}
                      className="px-2 h-8 rounded-lg bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-[11px] font-bold text-gray-700 dark:text-gray-200 active:scale-95 transition-all"
                      title="Sumar 5 billetes de una vez"
                    >
                      +5
                    </button>

                    {hasCount && (
                      <button
                        type="button"
                        onClick={() => handleClearDenomination(value)}
                        className="w-7 h-8 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors"
                        title="Poner en 0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Subtotal on desktop */}
                  <div className="hidden sm:block text-right sm:w-32">
                    <span className={`text-sm font-black ${
                      hasCount 
                        ? 'text-emerald-700 dark:text-emerald-400' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      ${subtotal.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom subtotal bar */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Total billetes físicos: <strong className="text-gray-900 dark:text-white">{totalBillsCount}</strong>
            </div>
            <div className="flex items-center gap-2 text-base font-black">
              <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Subtotal Efectivo:</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-lg">
                ${totalCash.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Digital Accounts & Audit Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Cuentas Digitales y Billeteras */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                  Bancos & Billeteras Digitales
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ingresá los saldos de tus cuentas
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Mercado Pago */}
              <div>
                <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Mercado Pago / Billeteras Virtuales</span>
                  <span className="text-blue-600 dark:text-blue-400 font-black">
                    ${(digitalAmounts.mercadoPago || 0).toLocaleString('es-AR')}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    value={digitalAmounts.mercadoPago || ''}
                    placeholder="0"
                    onChange={(e) => setDigitalAmounts(prev => ({
                      ...prev,
                      mercadoPago: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Bancos / CBU */}
              <div>
                <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Bancos / Transferencias (CBU / CVU)</span>
                  <span className="text-blue-600 dark:text-blue-400 font-black">
                    ${(digitalAmounts.bancos || 0).toLocaleString('es-AR')}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    value={digitalAmounts.bancos || ''}
                    placeholder="0"
                    onChange={(e) => setDigitalAmounts(prev => ({
                      ...prev,
                      bancos: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Otros / Tarjetas pendientes */}
              <div>
                <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Otros (POSNet / Caja chica / Tarjetas)</span>
                  <span className="text-blue-600 dark:text-blue-400 font-black">
                    ${(digitalAmounts.otros || 0).toLocaleString('es-AR')}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    value={digitalAmounts.otros || ''}
                    placeholder="0"
                    onChange={(e) => setDigitalAmounts(prev => ({
                      ...prev,
                      otros: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Subtotal Digital:</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                ${totalDigital.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Cierre de Caja & Acciones */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                  Cierre de Caja & WhatsApp
                </h4>
              </div>

              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Copiar texto resumen formateado para WhatsApp"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Copiar Resumen</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Nota u observación (Opcional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Dejé $10.000 para cambio del turno mañana..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {savedSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>¡Arqueo guardado exitosamente en el historial!</span>
              </div>
            )}

            <Button
              onClick={handleSaveAudit}
              disabled={isSaving || grandTotal <= 0}
              className="w-full justify-center py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Guardando...' : 'Guardar Cierre de Caja'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
