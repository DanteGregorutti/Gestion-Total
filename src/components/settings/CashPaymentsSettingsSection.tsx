/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft, 
  ShieldCheck, 
  Save, 
  DollarSign, 
  Check, 
  Lock 
} from 'lucide-react';
import { Button } from '../ui';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function CashPaymentsSettingsSection() {
  const { appSettings, updateAppSettings } = useSettings();

  const [form, setForm] = useState({
    enforceCashShiftBeforeSale: appSettings.enforceCashShiftBeforeSale ?? false,
    suggestedCashOpeningAmount: appSettings.suggestedCashOpeningAmount || 0,
    enableBlindCashClosing: appSettings.enableBlindCashClosing ?? false,
    cashWithdrawalThreshold: appSettings.cashWithdrawalThreshold || 0,
    activePaymentMethods: {
      efectivo: appSettings.activePaymentMethods?.efectivo ?? true,
      transferencia: appSettings.activePaymentMethods?.transferencia ?? true,
      debito: appSettings.activePaymentMethods?.debito ?? true,
      credito: appSettings.activePaymentMethods?.credito ?? true,
      mercadopago: appSettings.activePaymentMethods?.mercadopago ?? true,
      cuenta_corriente: appSettings.activePaymentMethods?.cuenta_corriente ?? true,
      otro: appSettings.activePaymentMethods?.otro ?? true,
    },
    paymentMethodSurcharges: {
      efectivo: appSettings.paymentMethodSurcharges?.efectivo ?? 0,
      transferencia: appSettings.paymentMethodSurcharges?.transferencia ?? 0,
      debito: appSettings.paymentMethodSurcharges?.debito ?? 0,
      credito: appSettings.paymentMethodSurcharges?.credito ?? 10,
      mercadopago: appSettings.paymentMethodSurcharges?.mercadopago ?? 0,
      cuenta_corriente: appSettings.paymentMethodSurcharges?.cuenta_corriente ?? 0,
      otro: appSettings.paymentMethodSurcharges?.otro ?? 0,
    }
  });

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm({
      enforceCashShiftBeforeSale: appSettings.enforceCashShiftBeforeSale ?? false,
      suggestedCashOpeningAmount: appSettings.suggestedCashOpeningAmount || 0,
      enableBlindCashClosing: appSettings.enableBlindCashClosing ?? false,
      cashWithdrawalThreshold: appSettings.cashWithdrawalThreshold || 0,
      activePaymentMethods: {
        efectivo: appSettings.activePaymentMethods?.efectivo ?? true,
        transferencia: appSettings.activePaymentMethods?.transferencia ?? true,
        debito: appSettings.activePaymentMethods?.debito ?? true,
        credito: appSettings.activePaymentMethods?.credito ?? true,
        mercadopago: appSettings.activePaymentMethods?.mercadopago ?? true,
        cuenta_corriente: appSettings.activePaymentMethods?.cuenta_corriente ?? true,
        otro: appSettings.activePaymentMethods?.otro ?? true,
      },
      paymentMethodSurcharges: {
        efectivo: appSettings.paymentMethodSurcharges?.efectivo ?? 0,
        transferencia: appSettings.paymentMethodSurcharges?.transferencia ?? 0,
        debito: appSettings.paymentMethodSurcharges?.debito ?? 0,
        credito: appSettings.paymentMethodSurcharges?.credito ?? 10,
        mercadopago: appSettings.paymentMethodSurcharges?.mercadopago ?? 0,
        cuenta_corriente: appSettings.paymentMethodSurcharges?.cuenta_corriente ?? 0,
        otro: appSettings.paymentMethodSurcharges?.otro ?? 0,
      }
    });
  }, [appSettings]);

  const handleTogglePaymentMethod = (key: keyof typeof form.activePaymentMethods) => {
    setForm(prev => ({
      ...prev,
      activePaymentMethods: {
        ...prev.activePaymentMethods,
        [key]: !prev.activePaymentMethods[key]
      }
    }));
  };

  const handleSurchargeChange = (key: keyof typeof form.paymentMethodSurcharges, value: number) => {
    setForm(prev => ({
      ...prev,
      paymentMethodSurcharges: {
        ...prev.paymentMethodSurcharges,
        [key]: value
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        enforceCashShiftBeforeSale: Boolean(form.enforceCashShiftBeforeSale),
        suggestedCashOpeningAmount: Math.max(0, Number(form.suggestedCashOpeningAmount) || 0),
        enableBlindCashClosing: Boolean(form.enableBlindCashClosing),
        cashWithdrawalThreshold: Math.max(0, Number(form.cashWithdrawalThreshold) || 0),
        activePaymentMethods: form.activePaymentMethods,
        paymentMethodSurcharges: form.paymentMethodSurcharges
      });
      toast.success('¡Preferencias de Caja & Métodos de Pago guardadas con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar configuración de caja');
    } finally {
      setIsSaving(false);
    }
  };

  const paymentOptions = [
    { key: 'efectivo', label: 'Efectivo', desc: 'Cobro en billetes en mano con vuelto sugerido', icon: Banknote, color: 'text-emerald-500' },
    { key: 'transferencia', label: 'Transferencia Bancaria', desc: 'Transferencias por CBU, Alias o CVU', icon: ArrowRightLeft, color: 'text-blue-500' },
    { key: 'mercadopago', label: 'Mercado Pago / Billeteras QR', desc: 'Pagos mediante QR o dinero en cuenta', icon: CreditCard, color: 'text-sky-500' },
    { key: 'debito', label: 'Tarjeta de Débito', desc: 'Cobros presenciales por terminal POS / posnet', icon: CreditCard, color: 'text-indigo-500' },
    { key: 'credito', label: 'Tarjeta de Crédito', desc: 'Cobros con tarjeta de crédito en 1 o varias cuotas', icon: CreditCard, color: 'text-purple-500' },
    { key: 'cuenta_corriente', label: 'Cuenta Corriente (A Cuenta / Fiado)', desc: 'Imputa saldo pendiente a la cuenta del cliente registrado', icon: Wallet, color: 'text-amber-500' },
    { key: 'otro', label: 'Otros Medios / Cheques', desc: 'Pagos combinados o cheques al día/diferidos', icon: DollarSign, color: 'text-gray-500' }
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Caja & Métodos de Pago
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Administra los medios de cobro visibles al vender y el control de turnos de caja
              </p>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={isSaving}
            className="self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20"
          >
            <Save size={16} className="mr-2" />
            Guardar Cambios
          </Button>
        </div>

        {/* Active Payment Methods */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <CreditCard size={14} className="text-emerald-500" />
            Métodos de Pago Habilitados en Ventas
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Desactiva los medios de cobro que no aceptes en tu negocio para que no aparezcan en la pantalla de cobro.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {paymentOptions.map((opt) => {
              const isChecked = form.activePaymentMethods[opt.key as keyof typeof form.activePaymentMethods];
              const IconComp = opt.icon;
              return (
                <div
                  key={opt.key}
                  onClick={() => handleTogglePaymentMethod(opt.key as any)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 shadow-2xs'
                      : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/80 dark:border-gray-800 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-white dark:bg-gray-800 shadow-2xs ${opt.color}`}>
                      <IconComp size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-900 dark:text-white">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent onClick
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                  />
                </div>
              );
            })}
          </div>
          {/* Surcharges / Discounts by payment method */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                Recargos (+) o Descuentos (-) Automáticos por Medio de Pago (%)
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Se aplicarán automáticamente al seleccionar el medio de pago en el mostrador. Usa valores negativos para descuentos (ej. -10 para 10% OFF en efectivo) y positivos para recargos (ej. 15 para 15% con tarjeta en cuotas).
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'efectivo', label: 'Efectivo' },
                { key: 'transferencia', label: 'Transferencia' },
                { key: 'debito', label: 'Débito' },
                { key: 'credito', label: 'Crédito' },
                { key: 'mercadopago', label: 'Mercado Pago' },
                { key: 'cuenta_corriente', label: 'Cta. Corriente' },
                { key: 'otro', label: 'Otro' },
              ].map(item => (
                <div key={item.key} className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                  <span className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">{item.label}</span>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.paymentMethodSurcharges[item.key as keyof typeof form.paymentMethodSurcharges] || 0}
                      onChange={(e) => handleSurchargeChange(item.key as any, Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full pl-2 pr-6 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash Shift Session Rules */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Lock size={14} className="text-indigo-500" />
            Control de Caja y Turnos
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Monto Inicial Sugerido para Apertura ($)
              </label>
              <input
                type="number"
                min="0"
                value={form.suggestedCashOpeningAmount || ''}
                onChange={(e) => setForm({ ...form, suggestedCashOpeningAmount: Number(e.target.value) || 0 })}
                placeholder="Ej: 10000"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Fondo de cambio predeterminado para abrir turno de caja cada mañana.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Alerta de Retiro por Excedente de Efectivo ($)
              </label>
              <input
                type="number"
                min="0"
                value={form.cashWithdrawalThreshold || ''}
                onChange={(e) => setForm({ ...form, cashWithdrawalThreshold: Number(e.target.value) || 0 })}
                placeholder="Ej: 150000 (0 para desactivar)"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Alerta al cajero para retirar dinero al banco o caja fuerte si supera esta cifra.
              </span>
            </div>

            <div className="flex items-center">
              <label className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
                <div className="pr-4">
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">
                    Exigir apertura de caja para vender
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                    Modo estricto: bloquea ventas y cobros hasta que un operador abra turno con su fondo inicial.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.enforceCashShiftBeforeSale}
                  onChange={(e) => setForm({ ...form, enforceCashShiftBeforeSale: e.target.checked })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="flex items-center">
              <label className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
                <div className="pr-4">
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">
                    Cierre de caja ciego (Auditoría segura)
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                    El operador debe contar y declarar el dinero físico sin ver el total esperado del sistema.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.enableBlindCashClosing}
                  onChange={(e) => setForm({ ...form, enableBlindCashClosing: e.target.checked })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
}
