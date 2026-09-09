/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  MessageCircle, 
  ArrowUpRight, 
  Send, 
  Package, 
  User, 
  Phone,
  Filter,
  DollarSign
} from 'lucide-react';
import { Quote } from '../types';
import { Button, Input } from './ui';
import { cn } from '../utils/cn';

interface QuotesViewProps {
  quotes: Quote[];
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  statusFilter: 'todas' | 'pendiente' | 'aceptada' | 'rechazada';
  onStatusFilterChange: (val: 'todas' | 'pendiente' | 'aceptada' | 'rechazada') => void;
  onOpenNewQuote: () => void;
  onOpenReceipt: (quote: Quote) => void;
  onConvertToSale: (quote: Quote) => void;
  onDeleteQuote: (quoteId: string) => void;
  onRefresh: () => void;
}

export function QuotesView({
  quotes,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  onOpenNewQuote,
  onOpenReceipt,
  onConvertToSale,
  onDeleteQuote,
  onRefresh
}: QuotesViewProps) {
  // Compute quote metrics
  const pendingQuotes = quotes.filter(q => q.estado === 'pendiente');
  const acceptedQuotes = quotes.filter(q => q.estado === 'aceptada');
  const totalPendingAmount = pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0);
  const totalAcceptedAmount = acceptedQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0);

  // Filter quotes
  const filteredQuotes = quotes.filter(q => {
    if (statusFilter !== 'todas' && q.estado !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchClient = (q.clientNombre || '').toLowerCase().includes(term);
      const matchNumber = (q.numero || '').toLowerCase().includes(term);
      const matchItems = (q.items || []).some(i => (i.productNombre || '').toLowerCase().includes(term));
      return matchClient || matchNumber || matchItems;
    }
    return true;
  });

  const handleSendWhatsApp = (q: Quote) => {
    let msg = `*PRESUPUESTO / COTIZACIÓN*\n`;
    msg += `📄 *N°:* ${q.numero}\n`;
    msg += `👤 *Cliente:* ${q.clientNombre}\n`;
    msg += `--------------------------------\n`;
    (q.items || []).forEach((item, idx) => {
      const variantStr = item.variantNombre ? ` [${item.variantNombre}]` : '';
      msg += `${idx + 1}. *${item.productNombre}${variantStr}*\n`;
      msg += `   ${item.cantidad} un. x $${item.precio.toLocaleString('es-AR')} = *$${item.total.toLocaleString('es-AR')}*\n`;
    });
    msg += `--------------------------------\n`;
    if (q.descuento && q.descuento > 0) {
      msg += `Subtotal: $${(q.subtotal || q.total).toLocaleString('es-AR')}\n`;
      msg += `Descuento: -$${q.descuento.toLocaleString('es-AR')}\n`;
    }
    msg += `💰 *TOTAL: $${q.total.toLocaleString('es-AR')}*\n\n`;
    if (q.notas) {
      msg += `📝 *Notas:* ${q.notas}\n\n`;
    }
    msg += `⚠️ _DOCUMENTO NO VÁLIDO COMO FACTURA_\n`;
    msg += `_Comprobante emitido con validez por ${q.validezDias || 7} días._`;

    const encoded = encodeURIComponent(msg);
    let url = `https://api.whatsapp.com/send?text=${encoded}`;
    if (q.clientTelefono) {
      const cleanPhone = q.clientTelefono.replace(/\D/g, '');
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Non-Fiscal Top Banner */}
      <div className="p-4 bg-amber-50/90 dark:bg-amber-950/30 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 flex items-start sm:items-center gap-3.5 shadow-sm">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-400 shrink-0">
          <AlertCircle size={22} />
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              DOCUMENTO NO VÁLIDO COMO FACTURA
            </span>
            <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-bold rounded-full text-[10px]">
              No descuenta stock
            </span>
          </div>
          <p className="text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            Armá presupuestos y cotizaciones para tus clientes con detalle de artículos, talles y precios. Podés compartirlos por WhatsApp, imprimirlos o convertirlos a venta real con un solo clic cuando el cliente te confirme.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Clock size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">
              {pendingQuotes.length} en espera
            </span>
          </div>
          <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest">
            Total Cotizado Pendiente
          </p>
          <h3 className="text-2xl font-black mt-1 tracking-tight">
            ${totalPendingAmount.toLocaleString('es-AR')}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <FileText size={20} />
            </div>
            <span className="text-xs font-bold text-gray-400">
              {quotes.length} emitidas en total
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Cotizaciones Activas
          </p>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {pendingQuotes.length}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ${totalAcceptedAmount.toLocaleString('es-AR')}
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Ventas Concretadas
          </p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {acceptedQuotes.length}
          </h3>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-4 h-4" />
            <Input 
              placeholder="Buscar por cliente, N° cotización, producto..."
              className="pl-11 text-xs" 
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
            />
          </div>

          <Button 
            variant="outline" 
            onClick={onRefresh}
            className="rounded-xl border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 h-10 px-3"
            title="Actualizar cotizaciones"
          >
            <Clock className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline text-xs">Actualizar</span>
          </Button>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-x-auto">
          <button
            onClick={() => onStatusFilterChange('todas')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
              statusFilter === 'todas'
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            Todas ({quotes.length})
          </button>
          <button
            onClick={() => onStatusFilterChange('pendiente')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
              statusFilter === 'pendiente'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            Pendientes ({pendingQuotes.length})
          </button>
          <button
            onClick={() => onStatusFilterChange('aceptada')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
              statusFilter === 'aceptada'
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            Concretadas ({acceptedQuotes.length})
          </button>
          <button
            onClick={() => onStatusFilterChange('rechazada')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
              statusFilter === 'rechazada'
                ? "bg-rose-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            Rechazadas
          </button>
        </div>

        <Button
          onClick={onOpenNewQuote}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none text-xs font-black shrink-0 h-10 px-4"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva Cotización
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-widest font-black text-[11px] bg-gray-50/50 dark:bg-gray-800/30">
              <th className="py-3.5 px-6">N° Comprobante</th>
              <th className="py-3.5 px-6">Referencia / Cliente</th>
              <th className="py-3.5 px-6">Artículos Cotizados</th>
              <th className="py-3.5 px-6">Total Cotizado</th>
              <th className="py-3.5 px-6">Fecha / Validez</th>
              <th className="py-3.5 px-6">Estado</th>
              <th className="py-3.5 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3 opacity-60" />
                  <p className="font-bold text-sm text-gray-500 dark:text-gray-400">No se encontraron cotizaciones</p>
                  <p className="text-xs text-gray-400 mt-1">Hacé clic en "Nueva Cotización" para emitir un presupuesto a tu cliente.</p>
                  <Button
                    onClick={onOpenNewQuote}
                    size="sm"
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Crear Primera Cotización
                  </Button>
                </td>
              </tr>
            ) : (
              filteredQuotes.map((quote) => {
                let date: Date;
                try {
                  date = (quote.fecha as any)?.toDate ? (quote.fecha as any).toDate() : new Date(quote.fecha as any);
                  if (isNaN(date.getTime())) date = new Date();
                } catch (e) {
                  date = new Date();
                }

                const totalItemsCount = (quote.items || []).reduce((acc, i) => acc + (i.cantidad || 1), 0);
                const itemsSummary = (quote.items || []).map(i => `${i.productNombre}${i.variantNombre ? ` (${i.variantNombre})` : ''}`).join(', ');

                return (
                  <tr key={quote.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    
                    {/* Number */}
                    <td className="py-4 px-6 font-black text-indigo-600 dark:text-indigo-400">
                      {quote.numero}
                    </td>

                    {/* Client */}
                    <td className="py-4 px-6">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {quote.clientNombre}
                      </p>
                      {quote.clientTelefono && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {quote.clientTelefono}
                        </p>
                      )}
                    </td>

                    {/* Items */}
                    <td className="py-4 px-6 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[11px] font-bold shrink-0">
                          {totalItemsCount} un.
                        </span>
                        <p className="text-xs text-gray-600 dark:text-gray-300 truncate" title={itemsSummary}>
                          {itemsSummary}
                        </p>
                      </div>
                    </td>

                    {/* Total */}
                    <td className="py-4 px-6 font-black text-sm text-gray-900 dark:text-white">
                      ${quote.total.toLocaleString('es-AR')}
                    </td>

                    {/* Date & Validity */}
                    <td className="py-4 px-6">
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {date.toLocaleDateString('es-AR')}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {quote.validezDias || 7} días de validez
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full inline-block",
                        quote.estado === 'pendiente' && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                        quote.estado === 'aceptada' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                        quote.estado === 'rechazada' && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                      )}>
                        {quote.estado === 'pendiente' ? 'Pendiente' : quote.estado === 'aceptada' ? 'Concretada' : 'Rechazada'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Ver Comprobante */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenReceipt(quote)}
                          className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl font-bold text-xs"
                          title="Ver y descargar comprobante no fiscal"
                        >
                          <FileText size={15} className="mr-1" />
                          Comprobante
                        </Button>

                        {/* WhatsApp */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendWhatsApp(quote)}
                          className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl font-bold text-xs"
                          title="Enviar presupuesto por WhatsApp"
                        >
                          <MessageCircle size={15} className="mr-1" />
                          WhatsApp
                        </Button>

                        {/* Convert to Sale */}
                        {quote.estado === 'pendiente' && (
                          <Button
                            size="sm"
                            onClick={() => onConvertToSale(quote)}
                            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm"
                            title="Aprobar presupuesto, registrar venta y descontar stock"
                          >
                            <CheckCircle2 size={14} className="mr-1" />
                            Aprobar
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteQuote(quote.id)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                          title="Eliminar cotización"
                        >
                          <Trash2 size={15} />
                        </Button>

                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-4">
        {filteredQuotes.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 text-center text-gray-500">
            <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2 opacity-60" />
            <p className="font-bold text-sm">No hay cotizaciones</p>
            <p className="text-xs text-gray-400 mt-1">Creá una cotización para enviarle a tu cliente.</p>
            <Button
              onClick={onOpenNewQuote}
              size="sm"
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Cotización
            </Button>
          </div>
        ) : (
          filteredQuotes.map((quote) => {
            let date: Date;
            try {
              date = (quote.fecha as any)?.toDate ? (quote.fecha as any).toDate() : new Date(quote.fecha as any);
              if (isNaN(date.getTime())) date = new Date();
            } catch (e) {
              date = new Date();
            }

            return (
              <div 
                key={quote.id} 
                className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4"
              >
                {/* Card Top */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                        {quote.numero}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                        quote.estado === 'pendiente' && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                        quote.estado === 'aceptada' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                        quote.estado === 'rechazada' && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                      )}>
                        {quote.estado === 'pendiente' ? 'Pendiente' : quote.estado === 'aceptada' ? 'Concretada' : 'Rechazada'}
                      </span>
                    </div>
                    <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                      {quote.clientNombre}
                    </p>
                    {quote.clientTelefono && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone size={12} /> {quote.clientTelefono}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                      Total
                    </span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      ${quote.total.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* Items preview */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Artículos ({quote.items?.length || 0}):
                  </span>
                  {(quote.items || []).slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span className="truncate pr-2">
                        {item.cantidad}x {item.productNombre} {item.variantNombre ? `(${item.variantNombre})` : ''}
                      </span>
                      <span className="font-bold shrink-0">${item.total.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                  {(quote.items || []).length > 3 && (
                    <p className="text-[10px] text-gray-400 italic pt-0.5">
                      +{(quote.items || []).length - 3} artículos más
                    </p>
                  )}
                </div>

                {/* Footer and Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-[10px] text-gray-400">
                    Fecha: {date.toLocaleDateString('es-AR')}
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenReceipt(quote)}
                      className="h-8 px-2.5 rounded-xl text-xs font-bold"
                    >
                      <FileText size={14} className="mr-1 text-indigo-600" />
                      Comprobante
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleSendWhatsApp(quote)}
                      className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      <MessageCircle size={14} className="mr-1" />
                      WhatsApp
                    </Button>

                    {quote.estado === 'pendiente' && (
                      <Button
                        size="sm"
                        onClick={() => onConvertToSale(quote)}
                        className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                        title="Aprobar y descontar stock"
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Vender
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteQuote(quote.id)}
                      className="h-8 w-8 text-rose-500 rounded-xl"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
