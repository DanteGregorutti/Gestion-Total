/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  PlusCircle, 
  MinusCircle, 
  Calendar, 
  Tag, 
  DollarSign, 
  FileText, 
  CreditCard,
  Building2,
  Banknote
} from 'lucide-react';
import { Button } from '../ui';
import { FinanceTransaction, FinanceType, FinanceCategory, PaymentMethod } from '../../types';
import { inventoryService } from '../../services/inventoryService';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: FinanceType;
}

const CATEGORIES_EGRESO = [
  { id: 'comida_super', label: 'Comida & Supermercado' },
  { id: 'servicios_luz_agua', label: 'Servicios (Luz, Agua, Gas, Internet, Celular)' },
  { id: 'alquiler', label: 'Alquiler / Expensas' },
  { id: 'transporte_nafta', label: 'Transporte / Nafta / Viajes' },
  { id: 'compras_ropa', label: 'Compras / Ropa / Hogar' },
  { id: 'salud_farmacia', label: 'Salud & Farmacia' },
  { id: 'salidas_ocio', label: 'Salidas, Ocio & Restaurantes' },
  { id: 'herramientas_insumos', label: 'Herramientas, Insumos & Repuestos' },
  { id: 'otro', label: 'Otro Gasto' }
];

const CATEGORIES_INGRESO = [
  { id: 'fondo_inicial', label: 'Fondo Inicial / Saldo Actual' },
  { id: 'sueldo_cobro', label: 'Sueldo / Cobro Principal' },
  { id: 'venta_changa', label: 'Venta / Changa / Extra' },
  { id: 'transferencia_regalo', label: 'Transferencia / Regalo' },
  { id: 'otro', label: 'Otro Ingreso' }
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'egreso'
}) => {
  const [tipo, setTipo] = useState<FinanceType>(defaultType);
  const [categoria, setCategoria] = useState<string>(defaultType === 'ingreso' ? 'fondo_inicial' : 'comida_super');
  const [concepto, setConcepto] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [metodo, setMetodo] = useState<PaymentMethod>('efectivo');
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when defaultType changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTipo(defaultType);
      setCategoria(defaultType === 'ingreso' ? 'fondo_inicial' : 'comida_super');
      setConcepto('');
      setMonto('');
      setError(null);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = parseFloat(monto);
    if (!concepto.trim()) {
      setError('Por favor indica un concepto o descripción.');
      return;
    }
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await inventoryService.addFinanceTransaction({
        tipo,
        categoria,
        concepto: concepto.trim(),
        monto: Math.round(parsedMonto),
        metodo,
        fecha: new Date(fecha).toISOString(),
        notas: notas.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError('Error al registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategories = tipo === 'egreso' ? CATEGORIES_EGRESO : CATEGORIES_INGRESO;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {tipo === 'egreso' ? (
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <MinusCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {tipo === 'ingreso' ? 'Cargar Dinero' : 'Anotar Gasto'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tipo === 'ingreso' 
                  ? 'Suma plata a tu saldo disponible (sueldo, fondo inicial, changa)' 
                  : 'Resta lo que gastaste (comida, compras, servicios, etc.)'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Tipo Selector (Egreso vs Ingreso) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
            <button
              type="button"
              onClick={() => { setTipo('ingreso'); setCategoria('fondo_inicial'); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                tipo === 'ingreso'
                  ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Cargar Dinero</span>
            </button>
            <button
              type="button"
              onClick={() => { setTipo('egreso'); setCategoria('comida_super'); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                tipo === 'egreso'
                  ? 'bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>- Anotar Gasto</span>
            </button>
          </div>

          {/* Monto principal en grande */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              ¿Cuánto dinero es? ($)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">$</span>
              <input
                type="number"
                min="0"
                step="any"
                required
                autoFocus
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl text-gray-900 dark:text-white font-black text-xl focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Concepto / Descripción */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              {tipo === 'ingreso' ? '¿De qué es este dinero? (Detalle)' : '¿En qué lo gastaste? (Detalle)'}
            </label>
            <input
              type="text"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === 'ingreso' ? 'Ej. Sueldo, Cobro de trabajo, Plata que tenía en billetera' : 'Ej. Supermercado, Almuerzo, Nafta, Factura de luz'}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Fecha
            </label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Método de Pago / Salida
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMetodo('efectivo')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  metodo === 'efectivo'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('transferencia')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  metodo === 'transferencia'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Transferencia</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('tarjeta')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  metodo === 'tarjeta'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Tarjeta / POS</span>
              </button>
            </div>
          </div>

          {/* Notas opcionales */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Notas adicionales (Opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Número de comprobante, datos del beneficiario, etc."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white ${
                tipo === 'egreso'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? 'Guardando...' : tipo === 'egreso' ? 'Guardar Gasto' : 'Guardar Ingreso'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
