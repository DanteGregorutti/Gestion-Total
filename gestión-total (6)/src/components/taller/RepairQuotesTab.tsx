/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  MessageCircle, 
  Printer, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Wrench,
  DollarSign,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui';
import { RepairQuote } from '../../types';
import { workOrderService } from '../../services/workOrderService';
import { toast } from 'sonner';

interface RepairQuotesTabProps {
  quotes: RepairQuote[];
  onNewQuote: () => void;
  onEditQuote: (quote: RepairQuote) => void;
  onPrintQuote: (quote: RepairQuote) => void;
  onDeleteQuote: (id: string) => void;
  onConvertToWorkOrder: (quote: RepairQuote) => void;
}

export function RepairQuotesTab({
  quotes,
  onNewQuote,
  onEditQuote,
  onPrintQuote,
  onDeleteQuote,
  onConvertToWorkOrder
}: RepairQuotesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado'>('todas');

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.clientNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.marcaModelo && q.marcaModelo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'todas' || q.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = quotes.filter(q => q.estado === 'pendiente').length;
  const approvedCount = quotes.filter(q => q.estado === 'aprobado').length;
  const totalAmount = quotes.reduce((sum, q) => sum + (q.total || 0), 0);

  const handleSendWhatsApp = (quote: RepairQuote) => {
    const url = workOrderService.getRepairQuoteWhatsAppMessage(quote);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Total Presupuestos
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
              {quotes.length}
            </span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
              Cotizaciones de taller
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Pendientes de Respuesta
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              {pendingCount}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              A la espera de cliente
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Aprobados / En Taller
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {approvedCount}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              Pasados a reparación
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Volumen Cotizado
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
              ${totalAmount.toLocaleString('es-AR')}
            </span>
            <span className="text-[11px] text-gray-500 font-bold">
              En repuestos y mano de obra
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

      </div>

      {/* Filter & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, COT-..., o máquina..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* Filter Pills & New Quote Button */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {(['todas', 'pendiente', 'aprobado', 'rechazado'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {st === 'todas' ? 'Todas' : st}
              </button>
            ))}
          </div>

          <Button
            onClick={onNewQuote}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs px-3.5 py-2 shadow-sm flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Nueva Cotización</span>
          </Button>
        </div>

      </div>

      {/* Quotes Cards Grid */}
      {filteredQuotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileText size={26} />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            No hay presupuestos de taller con estos filtros
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Genera presupuestos técnicos para tus clientes con mano de obra y repuestos antes de iniciar el trabajo.
          </p>
          <Button
            onClick={onNewQuote}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs"
          >
            <Plus size={14} className="mr-1" />
            Crear Primer Presupuesto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => {
            const isApproved = quote.estado === 'aprobado';
            const isPending = quote.estado === 'pendiente';

            return (
              <div 
                key={quote.id}
                className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-all space-y-4"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {quote.numero}
                      </span>
                      <h4 className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                        {quote.equipo}
                      </h4>
                      {quote.marcaModelo && (
                        <p className="text-xs text-gray-500 font-medium">
                          {quote.marcaModelo} {quote.serieOPatente ? `• ${quote.serieOPatente}` : ''}
                        </p>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border ${
                      isApproved 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : quote.estado === 'rechazado'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}>
                      {isApproved ? '✓ Aprobado' : quote.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">Cliente</span>
                      <span className="font-bold text-gray-900 dark:text-white">{quote.clientNombre}</span>
                    </div>
                    {quote.clientTelefono && (
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Contacto</span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{quote.clientTelefono}</span>
                      </div>
                    )}
                  </div>

                  {/* Falla & Diagnóstico */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-xs space-y-1.5">
                    <div>
                      <span className="text-gray-400 text-[10px] font-bold uppercase block">Falla Reportada:</span>
                      <p className="text-gray-700 dark:text-gray-300 font-medium line-clamp-2">{quote.fallaReportada}</p>
                    </div>
                    {quote.diagnosticoPrevio && (
                      <div className="pt-1.5 border-t border-gray-200/60 dark:border-gray-700/60">
                        <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase block">Diagnóstico:</span>
                        <p className="text-gray-600 dark:text-gray-300 line-clamp-2">{quote.diagnosticoPrevio}</p>
                      </div>
                    )}
                  </div>

                  {/* Repuestos preview */}
                  {quote.repuestos.length > 0 && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {quote.repuestos.length} repuesto(s) cotizado(s):
                      </span>{' '}
                      {quote.repuestos.map(r => `${r.cantidad}x ${r.descripcion}`).join(', ')}
                    </div>
                  )}
                </div>

                {/* Price and Actions */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                        Total Cotizado
                      </span>
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        ${quote.total.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-gray-400">
                      <span>Validez: {quote.validezDias} días</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    
                    {/* WhatsApp */}
                    <Button
                      size="sm"
                      onClick={() => handleSendWhatsApp(quote)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-8 px-2.5 shadow-sm"
                      title="Enviar cotización detallada por WhatsApp"
                    >
                      <MessageCircle size={14} className="mr-1" />
                      WhatsApp
                    </Button>

                    {/* Print */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPrintQuote(quote)}
                      className="rounded-xl text-xs font-bold h-8 px-2.5 text-gray-700 dark:text-gray-300"
                      title="Imprimir presupuesto técnico"
                    >
                      <Printer size={14} className="mr-1 text-gray-500" />
                      Imprimir
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditQuote(quote)}
                      className="rounded-xl text-xs font-bold h-8 px-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      title="Modificar cotización"
                    >
                      <Edit size={14} className="mr-1" />
                      Editar
                    </Button>

                    {/* Convert to Work Order if pending */}
                    {isPending && (
                      <Button
                        size="sm"
                        onClick={() => onConvertToWorkOrder(quote)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black h-8 px-2.5 ml-auto shadow-sm"
                        title="Aprobar y pasar a orden de trabajo activa en taller"
                      >
                        <Wrench size={13} className="mr-1" />
                        Pasar a Taller
                      </Button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteQuote(quote.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg ml-auto"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 size={14} />
                    </button>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
