/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Building2, 
  History,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderPayment } from '../../types';
import { Button, Input } from '../ui';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';

interface SupplierPayablesModalProps {
  isOpen: boolean;
  order: PurchaseOrder | null;
  onClose: () => void;
  onSavePayment: (orderId: string, updatedOrder: Partial<PurchaseOrder>) => Promise<void>;
}

export function SupplierPayablesModal({
  isOpen,
  order,
  onClose,
  onSavePayment
}: SupplierPayablesModalProps) {
  if (!isOpen || !order) return null;

  const total = Number(order.total) || 0;
  const alreadyPaid = Number(order.montoPagado) || 0;
  const currentPending = Math.max(0, total - alreadyPaid);

  const [paymentAmount, setPaymentAmount] = useState<number | ''>(currentPending);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'>('transferencia');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPaymentAmount(currentPending);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReceiptNumber('');
    setNotes('');
  }, [order, currentPending]);

  const handleQuickAmount = (type: 'full' | 'half') => {
    if (type === 'full') {
      setPaymentAmount(currentPending);
    } else {
      setPaymentAmount(Math.round(currentPending / 2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un importe de pago válido');
      return;
    }

    if (amount > currentPending) {
      toast.error(`El monto no puede superar el saldo pendiente ($${currentPending.toLocaleString('es-AR')})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newPayment: PurchaseOrderPayment = {
        id: `PAY-${Date.now()}`,
        fecha: paymentDate,
        monto: amount,
        metodo: paymentMethod,
        comprobante: receiptNumber || undefined,
        notas: notes || undefined
      };

      const newPaidTotal = alreadyPaid + amount;
      const newPending = Math.max(0, total - newPaidTotal);
      const newPaymentStatus = newPending === 0 ? 'pagado' : 'parcial';
      const existingHistory = order.historialPagos || [];

      await onSavePayment(order.id, {
        montoPagado: newPaidTotal,
        saldoPendiente: newPending,
        estadoPago: newPaymentStatus,
        historialPagos: [...existingHistory, newPayment]
      });

      toast.success(`Pago de $${amount.toLocaleString('es-AR')} registrado con éxito`);
      onClose();
    } catch (error) {
      console.error('Error saving supplier payment:', error);
      toast.error('Error al registrar el pago al proveedor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Registrar Pago a Proveedor</h3>
              <p className="text-xs text-gray-500 font-mono">Orden: {order.numero} &bull; {order.proveedor}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Balance overview card */}
          <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Total Facturado</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">${total.toLocaleString('es-AR')}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Ya Abonado</span>
              <span className="text-sm font-bold text-emerald-600">${alreadyPaid.toLocaleString('es-AR')}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Saldo Pendiente</span>
              <span className="text-sm font-black text-rose-600">${currentPending.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {/* Quick amount selectors */}
          {currentPending > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Monto rápido:</span>
              <button
                type="button"
                onClick={() => handleQuickAmount('full')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              >
                Saldar 100% (${currentPending.toLocaleString('es-AR')})
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount('half')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              >
                50% (${Math.round(currentPending / 2).toLocaleString('es-AR')})
              </button>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Importe a Pagar ($) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="number"
                  min="1"
                  max={currentPending}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="pl-9 font-bold text-base rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Fecha de Pago
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="pl-9 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo / Caja</option>
                  <option value="cheque">Cheque Propio / Terceros</option>
                  <option value="tarjeta">Tarjeta Débito / Crédito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                N° de Comprobante / Transferencia (Opcional)
              </label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="Ej: Transf. 984128 / Cheque N° 0041"
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Observaciones del Pago
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Prior payment history if any */}
          {order.historialPagos && order.historialPagos.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Historial de Pagos Anteriores ({order.historialPagos.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {order.historialPagos.map((pay) => (
                  <div key={pay.id} className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white">${pay.monto.toLocaleString('es-AR')}</span>
                      <span className="text-gray-400 ml-1.5 capitalize font-medium">({pay.metodo})</span>
                      {pay.comprobante && <span className="text-gray-400 block text-[10px]">Comp: {pay.comprobante}</span>}
                    </div>
                    <span className="text-gray-400 text-[11px] font-mono">{pay.fecha}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-gray-200 dark:border-gray-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || currentPending === 0}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar Pago'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
