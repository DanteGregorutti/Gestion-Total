/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  Truck, 
  Printer, 
  MessageCircle, 
  Check, 
  Save, 
  UserCheck, 
  Tag, 
  Layers,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Button, Input } from '../ui';
import { useSettings, AppSettings } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function SalesQuotesSettingsSection() {
  const { appSettings, updateAppSettings } = useSettings();

  const [form, setForm] = useState({
    currencySymbol: appSettings.currencySymbol || '$',
    currencyCode: appSettings.currencyCode || 'ARS',
    defaultQuoteValidityDays: appSettings.defaultQuoteValidityDays || 7,
    defaultQuoteNotes: appSettings.defaultQuoteNotes || 'Presupuesto válido por 7 días. Precios sujetos a confirmación.',
    defaultShippingCost: appSettings.defaultShippingCost || 0,
    defaultReceiptStyle: appSettings.defaultReceiptStyle || 'modern',
    autoPrintReceiptAfterSale: appSettings.autoPrintReceiptAfterSale ?? true,
    enableDiscountsOnSale: appSettings.enableDiscountsOnSale ?? true,
    requireClientOnSale: appSettings.requireClientOnSale ?? false,
    whatsappMessageTemplate: appSettings.whatsappMessageTemplate || '¡Hola! Te compartimos el detalle de tu comprobante comercial.',
    quickClientChipsLimit: appSettings.quickClientChipsLimit || 5,
    quoteNumberPrefix: appSettings.quoteNumberPrefix || 'COT-',
    saleNumberPrefix: appSettings.saleNumberPrefix || 'TKT-',
    receiptFooterMessage: appSettings.receiptFooterMessage || '¡Gracias por su compra y confianza! Conserve este comprobante para cualquier reclamo o cambio.',
    enableTaxVat: appSettings.enableTaxVat ?? false,
    defaultTaxVatRate: appSettings.defaultTaxVatRate || 21,
    pricesIncludeTax: appSettings.pricesIncludeTax ?? true,
    blockSaleOnZeroStock: appSettings.blockSaleOnZeroStock ?? false
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync when context changes
  React.useEffect(() => {
    setForm({
      currencySymbol: appSettings.currencySymbol || '$',
      currencyCode: appSettings.currencyCode || 'ARS',
      defaultQuoteValidityDays: appSettings.defaultQuoteValidityDays || 7,
      defaultQuoteNotes: appSettings.defaultQuoteNotes || 'Presupuesto válido por 7 días. Precios sujetos a confirmación.',
      defaultShippingCost: appSettings.defaultShippingCost || 0,
      defaultReceiptStyle: appSettings.defaultReceiptStyle || 'modern',
      autoPrintReceiptAfterSale: appSettings.autoPrintReceiptAfterSale ?? true,
      enableDiscountsOnSale: appSettings.enableDiscountsOnSale ?? true,
      requireClientOnSale: appSettings.requireClientOnSale ?? false,
      whatsappMessageTemplate: appSettings.whatsappMessageTemplate || '¡Hola! Te compartimos el detalle de tu comprobante comercial.',
      quickClientChipsLimit: appSettings.quickClientChipsLimit || 5,
      quoteNumberPrefix: appSettings.quoteNumberPrefix || 'COT-',
      saleNumberPrefix: appSettings.saleNumberPrefix || 'TKT-',
      receiptFooterMessage: appSettings.receiptFooterMessage || '¡Gracias por su compra y confianza! Conserve este comprobante para cualquier reclamo o cambio.',
      enableTaxVat: appSettings.enableTaxVat ?? false,
      defaultTaxVatRate: appSettings.defaultTaxVatRate || 21,
      pricesIncludeTax: appSettings.pricesIncludeTax ?? true,
      blockSaleOnZeroStock: appSettings.blockSaleOnZeroStock ?? false
    });
  }, [appSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        currencySymbol: form.currencySymbol.trim() || '$',
        currencyCode: form.currencyCode.trim() || 'ARS',
        defaultQuoteValidityDays: Number(form.defaultQuoteValidityDays) || 7,
        defaultQuoteNotes: form.defaultQuoteNotes.trim(),
        defaultShippingCost: Math.max(0, Number(form.defaultShippingCost) || 0),
        defaultReceiptStyle: form.defaultReceiptStyle as any,
        autoPrintReceiptAfterSale: Boolean(form.autoPrintReceiptAfterSale),
        enableDiscountsOnSale: Boolean(form.enableDiscountsOnSale),
        requireClientOnSale: Boolean(form.requireClientOnSale),
        whatsappMessageTemplate: form.whatsappMessageTemplate.trim(),
        quickClientChipsLimit: Math.max(1, Number(form.quickClientChipsLimit) || 5),
        quoteNumberPrefix: form.quoteNumberPrefix.trim() || 'COT-',
        saleNumberPrefix: form.saleNumberPrefix.trim() || 'TKT-',
        receiptFooterMessage: form.receiptFooterMessage.trim(),
        enableTaxVat: Boolean(form.enableTaxVat),
        defaultTaxVatRate: Number(form.defaultTaxVatRate) || 21,
        pricesIncludeTax: Boolean(form.pricesIncludeTax),
        blockSaleOnZeroStock: Boolean(form.blockSaleOnZeroStock)
      });
      toast.success('¡Preferencias de Ventas y Cotizaciones guardadas con éxito!');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const receiptStylesList = [
    { id: 'modern', name: 'Moderno (Estándar)', desc: 'Gradiente indigo limpio y profesional con código QR' },
    { id: 'classic', name: 'Clásico Formal', desc: 'Diseño sobrio de factura comercial en blanco y negro' },
    { id: 'minimal', name: 'Minimalista', desc: 'Líneas finas, tipografía liviana y elegante' },
    { id: 'technical', name: 'Técnico / Industrial', desc: 'Detallado con especificaciones y códigos de repuesto' },
    { id: 'automotive', name: 'Mecánico / Taller', desc: 'Ideal para repuestos automotrices, motos y maquinaria' },
    { id: 'executive_gold', name: 'Gold VIP', desc: 'Detalles dorados elegantes para clientes premium' },
    { id: 'compact_express', name: 'Express A5', desc: 'Tamaño medio compacto para media hoja' },
    { id: 'ticket', name: 'Ticket Térmico (80mm)', desc: 'Optimizado para impresoras térmicas de punto de venta' }
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Ventas & Cotizaciones
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Personaliza la moneda, validez por defecto, condiciones y estilos de comprobante
              </p>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={isSaving}
            className="self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/20"
          >
            <Save size={16} className="mr-2" />
            Guardar Cambios
          </Button>
        </div>

        {/* Currency & Money Format */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <DollarSign size={14} className="text-emerald-500" />
            Moneda & Formato de Precios
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Símbolo de Moneda
              </label>
              <input
                type="text"
                value={form.currencySymbol}
                onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                placeholder="$"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Ejemplo: $, USD, ARS, €, etc.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Código de Moneda
              </label>
              <select
                value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="USD">USD - Dólares Estadounidenses</option>
                <option value="EUR">EUR - Euros</option>
                <option value="CLP">CLP - Pesos Chilenos</option>
                <option value="UYU">UYU - Pesos Uruguayos</option>
                <option value="BRL">BRL - Reales Brasileños</option>
                <option value="MXN">MXN - Pesos Mexicanos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quotes Defaults */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-500" />
            Valores Predeterminados al Cotizar
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Validez Inicial de Cotizaciones
              </label>
              <select
                value={form.defaultQuoteValidityDays}
                onChange={(e) => setForm({ ...form, defaultQuoteValidityDays: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              >
                <option value={3}>3 días</option>
                <option value={7}>7 días (Recomendado)</option>
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Plazo sugerido cada vez que abras una nueva cotización.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Precio de Envío Sugerido ($)
              </label>
              <input
                type="number"
                min="0"
                value={form.defaultShippingCost || ''}
                onChange={(e) => setForm({ ...form, defaultShippingCost: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Monto base para flete/envío a cargo del cliente (deja en 0 si varía).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Clientes Frecuentes Rápidos
              </label>
              <select
                value={form.quickClientChipsLimit}
                onChange={(e) => setForm({ ...form, quickClientChipsLimit: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              >
                <option value={3}>Mostrar 3 clientes rápidos</option>
                <option value={5}>Mostrar 5 clientes rápidos</option>
                <option value={8}>Mostrar 8 clientes rápidos</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Accesos directos de 1 clic en el selector de clientes.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Condiciones / Notas Comerciales por Defecto
            </label>
            <textarea
              rows={2}
              value={form.defaultQuoteNotes}
              onChange={(e) => setForm({ ...form, defaultQuoteNotes: e.target.value })}
              placeholder="Ej: Presupuesto válido por 7 días. Precios sujetos a confirmación de stock..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              Se cargará automáticamente en cada presupuesto emitido (podrás modificarlo antes de guardar si lo deseas).
            </span>
          </div>
        </div>

        {/* Default Receipt / Comprobante Style */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Printer size={14} className="text-purple-500" />
            Estilo de Comprobante / Recibo Predeterminado
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Elige cuál de los 8 formatos visuales deseas que se abra automáticamente al imprimir o generar presupuestos y ventas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {receiptStylesList.map((st) => {
              const isSelected = form.defaultReceiptStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setForm({ ...form, defaultReceiptStyle: st.id as any })}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    isSelected 
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20' 
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check size={12} />
                    </div>
                  )}
                  <p className="font-bold text-xs text-gray-900 dark:text-white pr-5">
                    {st.name}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {st.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* WhatsApp & Sales Behavior Toggles */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <MessageCircle size={14} className="text-emerald-500" />
            Comportamiento Comercial & WhatsApp
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Toggle: Require Client */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Exigir cliente al registrar ventas
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Obliga a seleccionar un cliente o registrarlo antes de concretar una venta.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.requireClientOnSale}
                onChange={(e) => setForm({ ...form, requireClientOnSale: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Toggle: Allow Discounts */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Habilitar descuentos manuales
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Permite aplicar rebajas monetarias directamente en cotizaciones y ventas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.enableDiscountsOnSale}
                onChange={(e) => setForm({ ...form, enableDiscountsOnSale: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Toggle: Strict Zero Stock Block */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer sm:col-span-2">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Bloquear ventas si el producto no tiene stock disponible
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Si se activa, el sistema no permitirá facturar un producto con cantidad 0 o insuficiente.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.blockSaleOnZeroStock}
                onChange={(e) => setForm({ ...form, blockSaleOnZeroStock: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Numbering Prefixes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Prefijo para Números de Cotización
              </label>
              <input
                type="text"
                value={form.quoteNumberPrefix}
                onChange={(e) => setForm({ ...form, quoteNumberPrefix: e.target.value })}
                placeholder="COT-"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Ej: "COT-00123" o "PRES-".
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Prefijo para Comprobantes de Venta
              </label>
              <input
                type="text"
                value={form.saleNumberPrefix}
                onChange={(e) => setForm({ ...form, saleNumberPrefix: e.target.value })}
                placeholder="TKT-"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Ej: "TKT-", "VTA-", "FAC-".
              </span>
            </div>
          </div>

          {/* Taxes / VAT Configuration */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Régimen de IVA / Impuestos Comerciales
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                  Permite desglosar y calcular alícuotas fiscales en comprobantes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.enableTaxVat}
                onChange={(e) => setForm({ ...form, enableTaxVat: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {form.enableTaxVat && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Alícuota de IVA por defecto (%)
                  </label>
                  <input
                    type="number"
                    value={form.defaultTaxVatRate}
                    onChange={(e) => setForm({ ...form, defaultTaxVatRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={form.pricesIncludeTax}
                      onChange={(e) => setForm({ ...form, pricesIncludeTax: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Los precios de lista ya incluyen IVA</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Message */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Pie de Página de Cotizaciones y Recibos
            </label>
            <textarea
              rows={2}
              value={form.receiptFooterMessage}
              onChange={(e) => setForm({ ...form, receiptFooterMessage: e.target.value })}
              placeholder="¡Gracias por su compra y confianza! Conserve este comprobante para cualquier reclamo."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              Aparecerá impreso al pie de los comprobantes PDF, tickets y cotizaciones enviadas al cliente.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Cabecera del Mensaje de WhatsApp
            </label>
            <input
              type="text"
              value={form.whatsappMessageTemplate}
              onChange={(e) => setForm({ ...form, whatsappMessageTemplate: e.target.value })}
              placeholder="Ej: ¡Hola! Te compartimos el detalle de tu compra/presupuesto:"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              Texto inicial que acompaña a los detalles de artículos y precios enviados a WhatsApp.
            </span>
          </div>
        </div>

      </div>
    </form>
  );
}
