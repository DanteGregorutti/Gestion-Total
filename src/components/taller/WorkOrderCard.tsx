/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  MessageCircle, 
  Printer, 
  Edit, 
  Trash2, 
  Phone, 
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  User,
  ChevronDown,
  Tag,
  DollarSign
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { workOrderService } from '../../services/workOrderService';

interface WorkOrderCardProps {
  order: WorkOrder;
  onEdit: (order: WorkOrder) => void;
  onDelete: (id: string) => void;
  onPrint: (order: WorkOrder) => void;
  onStatusChange: (id: string, newStatus: WorkOrderStatus) => void;
  onConvertToSale: (order: WorkOrder) => void;
}

export function WorkOrderCard({
  order,
  onEdit,
  onDelete,
  onPrint,
  onStatusChange,
  onConvertToSale
}: WorkOrderCardProps) {
  const [showWhatsAppMenu, setShowWhatsAppMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const getStatusBadge = (st: WorkOrderStatus) => {
    switch (st) {
      case 'ingresado':
        return {
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          dot: 'bg-blue-500',
          label: 'Ingresado',
          icon: '📥'
        };
      case 'en_diagnostico':
        return {
          bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          dot: 'bg-purple-500',
          label: 'Diagnóstico',
          icon: '🔍'
        };
      case 'en_reparacion':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
          label: 'En Taller',
          icon: '🛠️'
        };
      case 'esperando_repuestos':
        return {
          bg: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
          dot: 'bg-orange-500',
          label: 'Faltan Repuestos',
          icon: '⏳'
        };
      case 'listo':
        return {
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
          dot: 'bg-emerald-500',
          label: 'Listo p/ Retirar',
          icon: '✨'
        };
      case 'entregado':
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-400',
          label: 'Entregado',
          icon: '🏁'
        };
      case 'cancelado':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500',
          label: 'Cancelado',
          icon: '❌'
        };
    }
  };

  const statusInfo = getStatusBadge(order.estado);

  const nextStatusMap: Record<WorkOrderStatus, WorkOrderStatus | null> = {
    ingresado: 'en_diagnostico',
    en_diagnostico: 'en_reparacion',
    en_reparacion: 'listo',
    esperando_repuestos: 'en_reparacion',
    listo: 'entregado',
    entregado: null,
    cancelado: null
  };

  const nextStatus = nextStatusMap[order.estado];

  const getNextStatusName = (st: WorkOrderStatus | null) => {
    if (!st) return '';
    switch (st) {
      case 'en_diagnostico': return 'Diagnóstico';
      case 'en_reparacion': return 'A Taller';
      case 'listo': return 'Listo p/ Retirar';
      case 'entregado': return 'Entregar';
      default: return st;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-800/90 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 flex flex-col p-4 gap-3 relative overflow-hidden group">
      
      {/* Top Header: OT Number + Priority + Status Tag */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200/60 dark:border-gray-700/60">
            {order.numero}
          </span>
          {order.prioridad === 'urgente' && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
              🔥 Urgente
            </span>
          )}
        </div>

        {/* Status Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1.5 transition-colors ${statusInfo.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
            <span>{statusInfo.label}</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1 space-y-0.5 text-xs animate-in fade-in zoom-in-95 duration-100">
              <span className="block px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Cambiar Estado
              </span>
              {[
                { id: 'ingresado', label: '📥 Ingresado' },
                { id: 'en_diagnostico', label: '🔍 Diagnóstico' },
                { id: 'en_reparacion', label: '🛠️ En Taller' },
                { id: 'esperando_repuestos', label: '⏳ Faltan Repuestos' },
                { id: 'listo', label: '✨ Listo p/ Retirar' },
                { id: 'entregado', label: '🏁 Entregado' },
                { id: 'cancelado', label: '❌ Cancelado' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onStatusChange(order.id, item.id as WorkOrderStatus);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    order.estado === item.id 
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Equipment Information */}
      <div className="space-y-1">
        <h4 className="text-sm font-black text-gray-900 dark:text-white leading-snug flex items-start gap-1.5">
          <Wrench size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <span className="break-words line-clamp-2">{order.equipo}</span>
        </h4>
        
        {(order.marcaModelo || order.serieOPatente) && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400 pl-5">
            {order.marcaModelo && (
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {order.marcaModelo}
              </span>
            )}
            {order.marcaModelo && order.serieOPatente && <span>•</span>}
            {order.serieOPatente && (
              <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded text-[10px]">
                {order.serieOPatente}
              </span>
            )}
          </div>
        )}

        {/* Reported Fault Box */}
        <div className="mt-2 bg-gray-50/90 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
          "{order.fallaReportada || 'Sin detalle de falla'}"
        </div>
      </div>

      {/* Client Information */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/60 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0">
            {order.clientNombre ? order.clientNombre.charAt(0).toUpperCase() : 'C'}
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {order.clientNombre}
          </span>
        </div>

        {order.clientTelefono && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${order.clientTelefono}`}
              className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
              title="Llamar"
            >
              <Phone size={13} />
            </a>
            <a
              href={workOrderService.getWhatsAppMessage(order, 'ingreso')}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors p-1 font-mono text-[11px] font-bold"
              title="Enviar WhatsApp"
            >
              {order.clientTelefono}
            </a>
          </div>
        )}
      </div>

      {/* Financial Breakdown */}
      <div className="bg-gray-50/80 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Total</span>
          <span className="font-black text-gray-900 dark:text-white text-sm">
            ${order.total.toLocaleString('es-AR')}
          </span>
        </div>

        {order.anticipo > 0 && (
          <div className="text-center">
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Anticipo</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              ${order.anticipo.toLocaleString('es-AR')}
            </span>
          </div>
        )}

        <div className="text-right">
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Saldo</span>
          <span className={`font-black text-sm ${order.saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {order.saldoPendiente === 0 ? 'Abonado' : `$${order.saldoPendiente.toLocaleString('es-AR')}`}
          </span>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800/70 flex items-center justify-between gap-1.5 flex-wrap">
        
        {/* Left Side: Status Progression */}
        <div className="flex items-center gap-1.5">
          {order.estado === 'listo' ? (
            <button
              type="button"
              onClick={() => onConvertToSale(order)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-950 font-black flex items-center gap-1 text-xs shadow-sm transition-transform active:scale-95"
              title="Facturar, entregar y descontar repuestos de stock"
            >
              <ShoppingBag size={13} />
              <span>Facturar</span>
            </button>
          ) : nextStatus ? (
            <button
              type="button"
              onClick={() => onStatusChange(order.id, nextStatus)}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1 text-xs font-bold"
              title={`Avanzar a: ${getNextStatusName(nextStatus)}`}
            >
              <span>{getNextStatusName(nextStatus)}</span>
              <ArrowRight size={12} />
            </button>
          ) : null}

          {/* WhatsApp Menu Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWhatsAppMenu(!showWhatsAppMenu)}
              title="Avisar al cliente por WhatsApp"
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-xs font-bold"
            >
              <MessageCircle size={14} />
              <span className="hidden sm:inline text-[11px]">Avisar</span>
            </button>

            {showWhatsAppMenu && (
              <div className="absolute left-0 bottom-full mb-2 z-40 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                <span className="block px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Mensaje WhatsApp
                </span>
                <a
                  href={workOrderService.getWhatsAppMessage(order, 'ingreso')}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowWhatsAppMenu(false)}
                  className="block px-2.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium transition-colors"
                >
                  📋 Ficha de Ingreso
                </a>
                <a
                  href={workOrderService.getWhatsAppMessage(order, 'presupuesto')}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowWhatsAppMenu(false)}
                  className="block px-2.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium transition-colors"
                >
                  💰 Enviar Presupuesto
                </a>
                <a
                  href={workOrderService.getWhatsAppMessage(order, 'listo')}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowWhatsAppMenu(false)}
                  className="block px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold transition-colors"
                >
                  ✨ "¡Listo para retirar!"
                </a>
                <a
                  href={workOrderService.getWhatsAppMessage(order, 'entregado')}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowWhatsAppMenu(false)}
                  className="block px-2.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium transition-colors"
                >
                  🤝 Garantía y Entrega
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tools (Print, Edit, Delete) */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => onPrint(order)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Imprimir Ficha de Taller"
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(order)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
            title="Editar Ficha"
          >
            <Edit size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(order.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Eliminar Orden"
          >
            <Trash2 size={15} />
          </button>
        </div>

      </div>

    </div>
  );
}
