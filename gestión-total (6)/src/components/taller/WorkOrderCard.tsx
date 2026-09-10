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
  ChevronRight, 
  Phone, 
  AlertTriangle,
  ArrowRight,
  DollarSign,
  ExternalLink,
  ShoppingBag
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

  const getStatusColor = (st: WorkOrderStatus) => {
    switch (st) {
      case 'ingresado':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'en_diagnostico':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'en_reparacion':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'esperando_repuestos':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'listo':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-black animate-pulse';
      case 'entregado':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
      case 'cancelado':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
  };

  const getStatusLabel = (st: WorkOrderStatus) => {
    switch (st) {
      case 'ingresado': return 'Ingresado';
      case 'en_diagnostico': return 'Diagnóstico';
      case 'en_reparacion': return 'En Taller';
      case 'esperando_repuestos': return 'Faltan Repuestos';
      case 'listo': return '✨ Listo para Retirar';
      case 'entregado': return '🏁 Entregado';
      case 'cancelado': return 'Cancelado';
    }
  };

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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative group">
      
      {/* Card Header: OT # + Priority + Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
            {order.numero}
          </span>
          {order.prioridad === 'urgente' && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1">
              🔥 Urgente
            </span>
          )}
        </div>

        {/* Status Dropdown */}
        <select
          value={order.estado}
          onChange={(e) => onStatusChange(order.id, e.target.value as WorkOrderStatus)}
          className={`text-[11px] font-bold px-2 py-1 rounded-xl border focus:outline-none cursor-pointer ${getStatusColor(order.estado)}`}
        >
          <option value="ingresado">📥 Ingresado</option>
          <option value="en_diagnostico">🔍 Diagnóstico</option>
          <option value="en_reparacion">🛠️ En Taller</option>
          <option value="esperando_repuestos">⏳ Faltan Repuestos</option>
          <option value="listo">✨ Listo para Retirar</option>
          <option value="entregado">🏁 Entregado</option>
          <option value="cancelado">❌ Cancelado</option>
        </select>
      </div>

      {/* Equipment & Fault Info */}
      <div>
        <h4 className="text-sm font-black text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
          <Wrench size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{order.equipo}</span>
        </h4>
        {order.marcaModelo && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {order.marcaModelo} {order.serieOPatente ? `• ${order.serieOPatente}` : ''}
          </p>
        )}
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 italic bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800/60">
          "{order.fallaReportada || 'Sin falla detallada'}"
        </p>
      </div>

      {/* Client Row */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800/80 text-xs">
        <span className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
          {order.clientNombre}
        </span>
        {order.clientTelefono && (
          <a
            href={`tel:${order.clientTelefono}`}
            className="text-gray-400 hover:text-indigo-600 flex items-center gap-1 text-[11px]"
          >
            <Phone size={11} />
            <span>{order.clientTelefono}</span>
          </a>
        )}
      </div>

      {/* Financial Info */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/70 p-2 rounded-xl border border-gray-100 dark:border-gray-700/60 text-xs">
        <div>
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Total</span>
          <span className="font-bold text-gray-900 dark:text-white">
            ${order.total.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 block uppercase font-bold">Saldo</span>
          <span className={`font-black text-sm ${order.saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {order.saldoPendiente === 0 ? 'Pagado' : `$${order.saldoPendiente.toLocaleString('es-AR')}`}
          </span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between gap-1 pt-1">
        {/* WhatsApp Menu button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowWhatsAppMenu(!showWhatsAppMenu)}
            title="Avisar por WhatsApp"
            className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-xs font-bold"
          >
            <MessageCircle size={14} />
            <span className="text-[11px]">WhatsApp</span>
          </button>

          {/* WhatsApp Dropdown */}
          {showWhatsAppMenu && (
            <div className="absolute left-0 bottom-full mb-1 z-30 w-52 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 space-y-1 text-xs">
              <span className="block px-2 py-1 text-[10px] font-black uppercase text-gray-400">
                Mensaje Automático
              </span>
              <a
                href={workOrderService.getWhatsAppMessage(order, 'ingreso')}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppMenu(false)}
                className="block px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                📋 Enviar Ficha de Ingreso
              </a>
              <a
                href={workOrderService.getWhatsAppMessage(order, 'presupuesto')}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppMenu(false)}
                className="block px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                💰 Enviar Presupuesto
              </a>
              <a
                href={workOrderService.getWhatsAppMessage(order, 'listo')}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppMenu(false)}
                className="block px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
              >
                ✅ Avisar: "¡Listo para retirar!"
              </a>
              <a
                href={workOrderService.getWhatsAppMessage(order, 'entregado')}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppMenu(false)}
                className="block px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                🤝 Agradecimiento / Garantía
              </a>
            </div>
          )}
        </div>

        {/* Quick Advance or Convert to Sale button */}
        {nextStatus && (
          <button
            type="button"
            onClick={() => onStatusChange(order.id, nextStatus)}
            className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 text-[11px] font-bold"
            title={`Avanzar a: ${getStatusLabel(nextStatus)}`}
          >
            <span>Avanzar</span>
            <ArrowRight size={12} />
          </button>
        )}

        {order.estado === 'listo' && (
          <button
            type="button"
            onClick={() => onConvertToSale(order)}
            className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black flex items-center gap-1 text-[11px] shadow-sm"
            title="Entregar y Registrar Venta"
          >
            <ShoppingBag size={12} />
            <span>Facturar</span>
          </button>
        )}

        {/* Utility buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPrint(order)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Imprimir Ficha de Taller"
          >
            <Printer size={14} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(order)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Editar Ficha"
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(order.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Eliminar Orden"
          >
            <Trash2 size={14} />
          </button>
        </div>

      </div>

    </div>
  );
}
