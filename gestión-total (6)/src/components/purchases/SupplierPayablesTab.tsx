/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  ArrowUpRight,
  Eye,
  Calendar
} from 'lucide-react';
import { PurchaseOrder } from '../../types';
import { Button, Input } from '../ui';
import { cn } from '../../utils/cn';

interface SupplierPayablesTabProps {
  orders: PurchaseOrder[];
  onOpenPaymentModal: (order: PurchaseOrder) => void;
  onViewOrderReceipt?: (order: PurchaseOrder) => void;
  onViewReceipt?: (order: PurchaseOrder) => void;
}

export function SupplierPayablesTab({
  orders,
  onOpenPaymentModal,
  onViewOrderReceipt,
  onViewReceipt
}: SupplierPayablesTabProps) {
  const handleViewReceipt = onViewReceipt || onViewOrderReceipt;
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'partial' | 'paid'>('pending');

  // Compute metrics
  const { totalDebt, pendingOrdersCount, paidThisMonth, totalPurchases } = useMemo(() => {
    let debt = 0;
    let pendingCount = 0;
    let paidMonth = 0;
    let totalPurch = 0;

    const currentMonth = new Date().toISOString().slice(0, 7);

    orders.forEach(o => {
      const tot = Number(o.total) || 0;
      const paid = Number(o.montoPagado) || 0;
      const pending = Math.max(0, tot - paid);
      
      totalPurch += tot;
      if (pending > 0) {
        debt += pending;
        pendingCount += 1;
      }

      // Check payments in current month
      (o.historialPagos || []).forEach(p => {
        if (p.fecha && p.fecha.startsWith(currentMonth)) {
          paidMonth += Number(p.monto) || 0;
        }
      });
    });

    return {
      totalDebt: debt,
      pendingOrdersCount: pendingCount,
      paidThisMonth: paidMonth,
      totalPurchases: totalPurch
    };
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const tot = Number(o.total) || 0;
      const paid = Number(o.montoPagado) || 0;
      const pending = Math.max(0, tot - paid);

      if (paymentFilter === 'pending' && (pending === 0 || paid > 0)) return false;
      if (paymentFilter === 'partial' && (paid === 0 || pending === 0)) return false;
      if (paymentFilter === 'paid' && pending > 0) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNum = (o.numero || '').toLowerCase().includes(term);
        const matchProv = (o.proveedor || '').toLowerCase().includes(term);
        return matchNum || matchProv;
      }

      return true;
    });
  }, [orders, paymentFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Deuda Pendiente a Proveedores</p>
            <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
              ${totalDebt.toLocaleString('es-AR')}
            </h4>
            <p className="text-[11px] text-gray-500">{pendingOrdersCount} órdenes con saldo a abonar</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Abonado Este Mes</p>
            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ${paidThisMonth.toLocaleString('es-AR')}
            </h4>
            <p className="text-[11px] text-gray-500">Pagos registrados a proveedores</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Volumen Total Facturado</p>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              ${totalPurchases.toLocaleString('es-AR')}
            </h4>
            <p className="text-[11px] text-gray-500">{orders.length} órdenes históricas</p>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por N° orden o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPaymentFilter('pending')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                paymentFilter === 'pending'
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-rose-600"
              )}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('partial')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                paymentFilter === 'partial'
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-amber-600"
              )}
            >
              Pago Parcial
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('paid')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                paymentFilter === 'paid'
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-emerald-600"
              )}
            >
              Saldadas
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                paymentFilter === 'all'
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Todas ({orders.length})
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">N° Orden</th>
                <th className="py-3.5 px-4">Proveedor</th>
                <th className="py-3.5 px-4">Emisión</th>
                <th className="py-3.5 px-4 text-right">Total Factura</th>
                <th className="py-3.5 px-4 text-right">Abonado</th>
                <th className="py-3.5 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3.5 px-4 text-center">Estado de Pago</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <CreditCard className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-gray-600 dark:text-gray-300">No se encontraron cuentas con el filtro actual</p>
                    <p className="text-xs text-gray-400 mt-1">Modifica los filtros o registra una nueva orden de compra.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const total = Number(order.total) || 0;
                  const paid = Number(order.montoPagado) || 0;
                  const pending = Math.max(0, total - paid);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                        {order.numero}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900 dark:text-white block">{order.proveedor}</span>
                        {order.proveedorTelefono && (
                          <span className="text-[10px] text-gray-400">Tel: {order.proveedorTelefono}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(order.fechaEmision).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700 dark:text-gray-300">
                        ${total.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        ${paid.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                        ${pending.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full font-black text-[10px] uppercase tracking-wider",
                          pending === 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : paid > 0
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        )}>
                          {pending === 0 ? 'Saldado' : paid > 0 ? 'Parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pending > 0 && (
                            <Button
                              size="sm"
                              onClick={() => onOpenPaymentModal(order)}
                              className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                            >
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Pagar
                            </Button>
                          )}
                          {handleViewReceipt && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewReceipt(order)}
                              className="h-7 w-7 p-0 rounded-lg text-gray-500 hover:text-gray-900"
                              title="Ver Comprobante"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
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
