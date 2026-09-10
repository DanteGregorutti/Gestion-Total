/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Truck,
  ArrowDownRight,
  TrendingDown,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { cashShiftService } from '../../services/cashShiftService';
import { inventoryService } from '../../services/inventoryService';
import { Supplier, Purchase, PaymentMethod } from '../../types';
import { toast } from 'sonner';

interface AccountsLedgerViewProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  onRefresh: () => void;
}

export function AccountsLedgerView({
  suppliers,
  purchases,
  onRefresh
}: AccountsLedgerViewProps) {
  const navigate = useNavigate();
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentEntity, setPaymentEntity] = useState<{ id: string; name: string; type: 'supplier'; balance: number } | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [payConcept, setPayConcept] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const accountPayments = cashShiftService.getAccountPayments();

  // Calculate Supplier Accounts (Cuentas por Pagar)
  const supplierAccounts = suppliers.map(supplier => {
    const supplierPurchases = purchases.filter(p => p.supplierId === supplier.id || p.proveedor?.toLowerCase() === supplier.nombre.toLowerCase());
    const totalPurchased = supplierPurchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

    const supplierPayments = accountPayments.filter(p => p.entityId === supplier.id && p.entityType === 'supplier');
    const totalPaid = supplierPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const balance = totalPurchased - totalPaid; // positive means we owe supplier

    return {
      id: supplier.id,
      nombre: supplier.nombre,
      telefono: supplier.telefono,
      email: supplier.email,
      totalPurchased,
      totalPaid,
      balance,
      purchasesCount: supplierPurchases.length,
      lastDate: supplierPurchases[0]?.fecha
    };
  });

  // Totals
  const totalPayable = supplierAccounts.reduce((acc, s) => acc + Math.max(0, s.balance), 0);

  const filteredSuppliers = supplierAccounts.filter(s => 
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedEntityId === 'all' || s.id === selectedEntityId)
  );

  const openPaymentModal = (entity: { id: string; name: string; type: 'supplier'; balance: number }) => {
    setPaymentEntity(entity);
    setPayAmount(Math.max(0, entity.balance).toString());
    setPayConcept(`Pago a proveedor - ${entity.name}`);
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEntity) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }

    try {
      // 1. Save account payment
      cashShiftService.addAccountPayment({
        entityId: paymentEntity.id,
        entityType: 'supplier',
        monto: amount,
        metodo: payMethod,
        fecha: new Date().toISOString().split('T')[0],
        concepto: payConcept,
        notas: payNotes,
        createdBy: 'admin'
      });

      // 2. Also reflect in general Finances as an Expense
      await inventoryService.addFinanceTransaction({
        tipo: 'egreso',
        categoria: 'proveedores',
        concepto: payConcept,
        monto: amount,
        metodo: payMethod,
        fecha: new Date().toISOString().split('T')[0],
        notas: `Asentado en Cta Corriente de Proveedor: ${paymentEntity.name}. ${payNotes}`
      });

      toast.success('¡Pago a proveedor registrado con éxito!');
      setIsPaymentModalOpen(false);
      setPaymentEntity(null);
      onRefresh();
    } catch {
      toast.error('Error al registrar el pago');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner pointing to dedicated Clients section */}
      <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div>
            <span className="font-bold">¿Buscás las cuentas corrientes y cobros de clientes?</span>
            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">Todas las cuentas de clientes, cobranzas, deudas y recordatorios están unificadas en la sección <strong>Clientes</strong>.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/clientes')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shrink-0 text-xs py-2 px-3.5 shadow-sm"
        >
          Ir a Clientes
        </Button>
      </div>

      {/* Top Metrics Cards */}
      <div className="bg-white dark:bg-gray-800/80 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Cuentas por Pagar (Proveedores)
            </span>
            <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-600">
              <Truck size={20} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            ${totalPayable.toLocaleString('es-AR')}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Total adeudado a proveedores en compras y mercadería
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left sm:text-right sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-6">
            <span className="text-xs font-bold text-gray-400 block">Proveedores con Saldo</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">
              {supplierAccounts.filter(s => s.balance > 0).length} de {supplierAccounts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2 flex items-center gap-2">
          <Truck size={15} className="text-gray-400" />
          <span>Detalle de Facturas y Saldos con Proveedores ({filteredSuppliers.length})</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full sm:w-64 pl-3 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table Content: SUPPLIERS (PAYABLE) */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="p-4">Proveedor</th>
                <th className="p-4 text-right">Total Compras</th>
                <th className="p-4 text-right">Total Pagado</th>
                <th className="p-4 text-right">Deuda Pendiente</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 font-medium">
                    No se encontraron proveedores registrados con compras pendientes.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <span className="font-black text-gray-900 dark:text-white block">{supplier.nombre}</span>
                      {supplier.telefono && <span className="text-[11px] text-gray-400">Tel: {supplier.telefono}</span>}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-700 dark:text-gray-300">
                      ${supplier.totalPurchased.toLocaleString('es-AR')}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      ${supplier.totalPaid.toLocaleString('es-AR')}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        supplier.balance > 0 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400' 
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      }`}>
                        {supplier.balance > 0 ? `Por pagar $${supplier.balance.toLocaleString('es-AR')}` : 'Saldado $0'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => openPaymentModal({ id: supplier.id, name: supplier.nombre, type: 'supplier', balance: supplier.balance })}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                      >
                        Asentar Pago
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Recording Modal */}
      {isPaymentModalOpen && paymentEntity && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Registrar Pago a Proveedor
            </h3>
            <p className="text-xs text-gray-500">
              {paymentEntity.name} — Saldo pendiente: <strong className="text-indigo-600">${paymentEntity.balance.toLocaleString('es-AR')}</strong>
            </p>

            <form onSubmit={handleRegisterPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Monto a Abonar ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl text-lg font-black text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Método de Pago
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria / MP</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Concepto / Detalle
                </label>
                <input
                  type="text"
                  required
                  value={payConcept}
                  onChange={(e) => setPayConcept(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Notas adicionales (Opcional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="N° de comprobante, factura, etc."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                >
                  Confirmar Asiento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

