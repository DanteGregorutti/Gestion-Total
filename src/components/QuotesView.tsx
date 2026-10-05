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
  DollarSign,
  Edit,
  Loader2,
  Truck
} from 'lucide-react';
import { Quote } from '../types';
import { Button, Input, RefreshButton } from './ui';
import { cn } from '../utils/cn';

interface QuotesViewProps {
  quotes: Quote[];
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  statusFilter: 'todas' | 'pendiente' | 'aceptada' | 'rechazada';
  onStatusFilterChange: (val: 'todas' | 'pendiente' | 'aceptada' | 'rechazada') => void;
  onOpenNewQuote: () => void;
  onEditQuote: (quote: Quote) => void;
  onOpenReceipt: (quote: Quote) => void;
  onConvertToSale: (quote: Quote) => void;
  onDeleteQuote: (quoteId: string, quoteNumero?: string) => void;
  onRefresh: () => void;
  convertingQuoteId?: string | null;
}

export function QuotesView({
  quotes,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  onOpenNewQuote,
  onEditQuote,
  onOpenReceipt,
  onConvertToSale,
  onDeleteQuote,
  onRefresh,
  convertingQuoteId
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
    if (q.costoEnvio && q.costoEnvio > 0) {
      if (!q.descuento || q.descuento === 0) {
        msg += `Subtotal artículos: $${(q.subtotal || (q.total - q.costoEnvio)).toLocaleString('es-AR')}\n`;
      }
      msg += `🚚 Envío a domicilio: +$${q.costoEnvio.toLocaleString('es-AR')} (a cargo del cliente)\n`;
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
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText size={20} />
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">
              {pendingQuotes.length} pendiente(s)
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Total Cotizaciones
          </p>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {quotes.length}
          </h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {acceptedQuotes.length} concretada(s) en venta
          </p>
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

          <RefreshButton 
            onRefresh={onRefresh}
            label="Actualizar"
            title="Actualizar cotizaciones"
            className="h-10 px-3 text-xs"
          />
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
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto overflow-y-visible">
        <table className="w-full text-left text-xs border-collapse min-w-[960px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-widest font-black text-[11px] bg-gray-50/70 dark:bg-gray-800/40">
              <th className="py-3.5 px-5">N° Comprobante</th>
              <th className="py-3.5 px-5">Referencia / Cliente</th>
              <th className="py-3.5 px-5">Artículos Cotizados</th>
              <th className="py-3.5 px-5">Total Cotizado</th>
              <th className="py-3.5 px-5">Fecha / Validez</th>
              <th className="py-3.5 px-5">Estado</th>
              {/* Sticky Actions Header: Always pinned to the right edge with solid background */}
              <th className="py-3.5 px-4 text-right sticky right-0 bg-gray-50 dark:bg-gray-800 z-20 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.4)]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  {statusFilter === 'pendiente' && acceptedQuotes.length > 0 ? (
                    <div className="max-w-md mx-auto">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                      <p className="font-bold text-base text-gray-800 dark:text-gray-200">¡Todas las cotizaciones pendientes fueron procesadas!</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tenés {acceptedQuotes.length} cotización(es) concretada(s) con venta registrada.</p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button
                          onClick={() => onStatusFilterChange('aceptada')}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                        >
                          Ver Concretadas ({acceptedQuotes.length})
                        </Button>
                        <Button
                          onClick={() => onStatusFilterChange('todas')}
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-bold"
                        >
                          Ver Todas ({quotes.length})
                        </Button>
                      </div>
                    </div>
                  ) : statusFilter === 'aceptada' && acceptedQuotes.length === 0 ? (
                    <div className="max-w-md mx-auto">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3 opacity-60" />
                      <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No hay cotizaciones concretadas todavía</p>
                      <p className="text-xs text-gray-400 mt-1">Aprobá una cotización pendiente para que quede registrada como venta y concretada.</p>
                      <Button
                        onClick={() => onStatusFilterChange('pendiente')}
                        size="sm"
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                      >
                        Ver Pendientes ({pendingQuotes.length})
                      </Button>
                    </div>
                  ) : (
                    <div>
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
                    </div>
                  )}
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
                  <tr key={quote.id} className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                    
                    {/* Number */}
                    <td className="py-4 px-5 font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {quote.numero}
                    </td>

                    {/* Client */}
                    <td className="py-4 px-5">
                      <p className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]" title={quote.clientNombre}>
                        {quote.clientNombre}
                      </p>
                      {quote.clientTelefono && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {quote.clientTelefono}
                        </p>
                      )}
                    </td>

                    {/* Items */}
                    <td className="py-4 px-5 max-w-xs">
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
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="font-black text-sm text-gray-900 dark:text-white">
                        ${quote.total.toLocaleString('es-AR')}
                      </div>
                      {quote.costoEnvio && quote.costoEnvio > 0 ? (
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5" title="Envío a cargo del cliente (no entra a billetera)">
                          <Truck size={10} className="shrink-0" />
                          <span>+${quote.costoEnvio.toLocaleString('es-AR')} envío</span>
                        </div>
                      ) : null}
                    </td>

                    {/* Date & Validity */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {date.toLocaleDateString('es-AR')}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {quote.validezDias || 7} días de validez
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full inline-block",
                        quote.estado === 'pendiente' && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                        quote.estado === 'aceptada' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                        quote.estado === 'rechazada' && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                      )}>
                        {quote.estado === 'pendiente' ? 'Pendiente' : quote.estado === 'aceptada' ? 'Concretada' : 'Rechazada'}
                      </span>
                    </td>

                    {/* Sticky Actions Column: Never cut off, pinned to right with solid background */}
                    <td className="py-3.5 px-4 text-right sticky right-0 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.4)]">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        
                        {/* Convert to Sale (Aprobar) */}
                        {quote.estado === 'pendiente' && (
                          <Button
                            size="sm"
                            disabled={convertingQuoteId === quote.id}
                            onClick={() => onConvertToSale(quote)}
                            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm shrink-0"
                            title="Aprobar presupuesto, registrar venta y descontar stock"
                          >
                            {convertingQuoteId === quote.id ? (
                              <>
                                <Loader2 size={13} className="mr-1 animate-spin" />
                                <span>Aprobando...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} className="mr-1" />
                                <span>Aprobar</span>
                              </>
                            )}
                          </Button>
                        )}

                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditQuote(quote)}
                          className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl font-bold text-xs shrink-0"
                          title="Modificar cotización"
                        >
                          <Edit size={14} className="xl:mr-1" />
                          <span className="hidden xl:inline">Editar</span>
                        </Button>

                        {/* Ver Comprobante */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenReceipt(quote)}
                          className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl font-bold text-xs shrink-0"
                          title="Ver y descargar comprobante no fiscal"
                        >
                          <FileText size={14} className="xl:mr-1" />
                          <span className="hidden xl:inline">Comprobante</span>
                        </Button>

                        {/* WhatsApp */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendWhatsApp(quote)}
                          className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl font-bold text-xs shrink-0"
                          title="Enviar presupuesto por WhatsApp"
                        >
                          <MessageCircle size={14} className="xl:mr-1" />
                          <span className="hidden xl:inline">WhatsApp</span>
                        </Button>

                        {/* Delete: Always visible, unmistakable, red danger button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteQuote(quote.id, quote.numero)}
                          className="h-8 px-2.5 text-rose-600 hover:text-rose-700 bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/80 rounded-xl font-bold text-xs shrink-0 transition-all flex items-center gap-1 shadow-sm"
                          title="Eliminar cotización permanentemente"
                        >
                          <Trash2 size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="inline">Borrar</span>
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
            {statusFilter === 'pendiente' && acceptedQuotes.length > 0 ? (
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">¡Todas las cotizaciones pendientes fueron procesadas!</p>
                <p className="text-xs text-gray-400 mt-1">Tenés {acceptedQuotes.length} cotización(es) concretada(s) con éxito.</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Button
                    onClick={() => onStatusFilterChange('aceptada')}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    Ver Concretadas ({acceptedQuotes.length})
                  </Button>
                  <Button
                    onClick={() => onStatusFilterChange('todas')}
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs font-bold"
                  >
                    Ver Todas ({quotes.length})
                  </Button>
                </div>
              </div>
            ) : statusFilter === 'aceptada' && acceptedQuotes.length === 0 ? (
              <div>
                <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2 opacity-60" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No hay cotizaciones concretadas todavía</p>
                <p className="text-xs text-gray-400 mt-1">Aprobá una cotización pendiente para que quede registrada como venta.</p>
                <Button
                  onClick={() => onStatusFilterChange('pendiente')}
                  size="sm"
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold w-full"
                >
                  Ver Pendientes ({pendingQuotes.length})
                </Button>
              </div>
            ) : (
              <div>
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
            )}
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
                    {quote.costoEnvio && quote.costoEnvio > 0 ? (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-end gap-1 mt-0.5">
                        <Truck size={10} /> +${quote.costoEnvio.toLocaleString('es-AR')} envío
                      </span>
                    ) : null}
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
                <div className="flex flex-col gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      {date.toLocaleDateString('es-AR')} ({quote.validezDias || 7} días)
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      N° {quote.numero}
                    </span>
                  </div>

                  {/* Action buttons grid: 100% accessible on any screen */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditQuote(quote)}
                      className="h-8 px-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 justify-center"
                    >
                      <Edit size={14} className="mr-1" />
                      Editar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenReceipt(quote)}
                      className="h-8 px-2 rounded-xl text-xs font-bold justify-center"
                    >
                      <FileText size={14} className="mr-1 text-indigo-600" />
                      Comprobante
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleSendWhatsApp(quote)}
                      className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm justify-center"
                    >
                      <MessageCircle size={14} className="mr-1" />
                      WhatsApp
                    </Button>

                    {/* Delete button: distinct red button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteQuote(quote.id, quote.numero)}
                      className="h-8 px-2 text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold justify-center"
                    >
                      <Trash2 size={14} className="mr-1 text-rose-600 dark:text-rose-400" />
                      Eliminar
                    </Button>
                  </div>

                  {/* Primary Convert / Approve CTA */}
                  {quote.estado === 'pendiente' && (
                    <Button
                      size="sm"
                      disabled={convertingQuoteId === quote.id}
                      onClick={() => onConvertToSale(quote)}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm justify-center"
                      title="Aprobar presupuesto, registrar venta y descontar stock"
                    >
                      {convertingQuoteId === quote.id ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Aprobando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} className="mr-1.5" />
                          Aprobar Cotización y Vender
                        </>
                      )}
                    </Button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
