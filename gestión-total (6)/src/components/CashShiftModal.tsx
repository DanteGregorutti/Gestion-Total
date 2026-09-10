/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Calculator, 
  Clock, 
  History, 
  X,
  FileText,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';
import { Button, Input } from './ui';
import { cashShiftService } from '../services/cashShiftService';
import { CashShift, Sale, FinanceTransaction } from '../types';
import { toast } from 'sonner';

interface CashShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales?: Sale[];
  finances?: FinanceTransaction[];
  onShiftUpdated: () => void;
}

export function CashShiftModal({
  isOpen,
  onClose,
  sales = [],
  finances = [],
  onShiftUpdated
}: CashShiftModalProps) {
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [history, setHistory] = useState<CashShift[]>([]);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [initialCashInput, setInitialCashInput] = useState<string>('0');
  const [realCashInput, setRealCashInput] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const active = cashShiftService.getActiveShift();
      setActiveShift(active);
      setHistory(cashShiftService.getShiftsHistory());
      setRealCashInput('');
      setCloseNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate live shift numbers if shift is open
  const openingTime = activeShift ? new Date(activeShift.fechaApertura).getTime() : 0;
  
  const currentSales = activeShift ? sales.filter(s => {
    if (!s.fecha) return false;
    const time = (s.fecha as any).toDate ? (s.fecha as any).toDate().getTime() : new Date(s.fecha).getTime();
    return time >= openingTime;
  }) : [];

  const currentFinances = activeShift ? finances.filter(f => {
    if (!f.fecha) return false;
    const time = new Date(f.fecha).getTime();
    return time >= openingTime;
  }) : [];

  // Categorize sales
  const ventasEfectivo = currentSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0); // by default cash sales in current POS
  const ventasDigital = 0; // if explicit digital payment was registered

  // Extra incomes & expenses
  const extraIncomes = currentFinances
    .filter(f => f.tipo === 'ingreso' && f.metodo === 'efectivo')
    .reduce((acc, f) => acc + (Number(f.monto) || 0), 0);

  const expensesCash = currentFinances
    .filter(f => f.tipo === 'egreso' && f.metodo === 'efectivo')
    .reduce((acc, f) => acc + (Number(f.monto) || 0), 0);

  const montoInicial = activeShift ? activeShift.montoInicial : 0;
  const efectivoEsperado = montoInicial + ventasEfectivo + extraIncomes - expensesCash;

  const realCounted = parseFloat(realCashInput) || 0;
  const diferencia = realCashInput !== '' ? realCounted - efectivoEsperado : 0;

  const handleOpenShift = () => {
    const amount = parseFloat(initialCashInput) || 0;
    const newShift = cashShiftService.openShift(amount);
    setActiveShift(newShift);
    toast.success('¡Caja abierta exitosamente!');
    onShiftUpdated();
  };

  const handleCloseShift = () => {
    if (realCashInput === '') {
      toast.error('Por favor ingresá el monto en efectivo contado en la caja');
      return;
    }

    setIsProcessing(true);
    try {
      cashShiftService.closeShift({
        efectivoReal: realCounted,
        totalVentasEfectivo: ventasEfectivo,
        totalVentasDigital: ventasDigital,
        totalIngresosExtra: extraIncomes,
        totalRetirosGastos: expensesCash,
        notas: closeNotes
      });
      toast.success('¡Arqueo y Cierre de Caja guardado con éxito!');
      setActiveShift(null);
      setHistory(cashShiftService.getShiftsHistory());
      onShiftUpdated();
    } catch {
      toast.error('Error al cerrar la caja');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 dark:border-gray-800">
        
        {/* Header */}
        <div className="p-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${activeShift ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {activeShift ? <Unlock size={22} /> : <Lock size={22} />}
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                {activeShift ? 'Caja Diaria Abierta' : 'Apertura de Caja Diaria'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activeShift 
                  ? `Iniciada el ${new Date(activeShift.fechaApertura).toLocaleDateString('es-AR')} a las ${new Date(activeShift.fechaApertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Iniciá tu jornada con el efectivo base en caja'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-3 bg-white dark:bg-gray-900 gap-4">
          <button
            onClick={() => setView('current')}
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              view === 'current'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {activeShift ? 'Arqueo Actual' : 'Abrir Turno'}
          </button>
          <button
            onClick={() => setView('history')}
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              view === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Historial de Cierres ({history.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {view === 'history' ? (
            /* ================= HISTORY LIST ================= */
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">Aún no hay registros de cierres de caja anteriores</p>
                </div>
              ) : (
                history.map(item => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">
                          Cierre del {new Date(item.fechaCierre || item.fechaApertura).toLocaleDateString('es-AR')}
                        </span>
                        <p className="text-[11px] text-gray-500">
                          {new Date(item.fechaApertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} a {item.fechaCierre ? new Date(item.fechaCierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        (item.diferencia || 0) === 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : (item.diferencia || 0) > 0
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {(item.diferencia || 0) === 0 ? 'Exacto $0' : `Dif: ${item.diferencia! > 0 ? '+' : ''}$${item.diferencia?.toLocaleString('es-AR')}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Inicio:</span>
                        <span className="font-bold">${item.montoInicial.toLocaleString('es-AR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Ventas Efectivo:</span>
                        <span className="font-bold text-emerald-600">${(item.totalVentasEfectivo || 0).toLocaleString('es-AR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Cierre Real:</span>
                        <span className="font-black text-indigo-600">${(item.efectivoReal || 0).toLocaleString('es-AR')}</span>
                      </div>
                    </div>

                    {item.notas && (
                      <p className="text-[10px] italic text-gray-500 pt-1">
                        Nota: "{item.notas}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : !activeShift ? (
            /* ================= OPEN SHIFT FORM ================= */
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  💵 ¿Con cuánto cambio o efectivo arrancás la jornada?
                </p>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/70 mt-1">
                  Ingresá el dinero que dejaste en el cajón de cambio. El sistema sumará las ventas y restará los retiros para darte el arqueo exacto al cerrar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Efectivo Inicial en Caja ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-lg font-black text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleOpenShift} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
                  <Unlock size={16} className="mr-2" />
                  Abrir Caja Diaria
                </Button>
              </div>
            </div>
          ) : (
            /* ================= ACTIVE SHIFT ARQUEO & CLOSE ================= */
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Base Inicial</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">
                    ${montoInicial.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Ventas Efectivo</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    +${ventasEfectivo.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">Gastos / Retiros</span>
                  <span className="text-sm font-black text-rose-700 dark:text-rose-400">
                    -${expensesCash.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">Efectivo Teórico</span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                    ${efectivoEsperado.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Counting Box */}
              <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 space-y-3">
                <label className="block text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                  Efectivo Contado Físicamente en Caja ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xl">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={realCashInput}
                    onChange={(e) => setRealCashInput(e.target.value)}
                    placeholder={efectivoEsperado.toString()}
                    className="w-full pl-9 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl text-xl font-black text-gray-900 dark:text-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                {realCashInput !== '' && (
                  <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-black ${
                    diferencia === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : diferencia > 0
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    <span>{diferencia === 0 ? '✓ Caja Cuadrada Perfecta' : diferencia > 0 ? 'Sobró Dinero:' : 'Faltó Dinero:'}</span>
                    <span className="text-sm">{diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Observaciones / Notas del Cierre (Opcional):
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Se retiraron $10.000 para depósito bancario..."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={onClose} className="rounded-xl text-xs">
                  Cerrar Ventana (Mantener Caja Abierta)
                </Button>
                <Button 
                  onClick={handleCloseShift}
                  disabled={isProcessing}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20"
                >
                  <Lock size={15} className="mr-1.5" />
                  Finalizar Jornada y Cerrar Caja
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
