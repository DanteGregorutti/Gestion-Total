/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Wrench, 
  ShoppingBag,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '../ui';
import { inventoryService } from '../../services/inventoryService';
import { workOrderService } from '../../services/workOrderService';
import { Sale, FinanceTransaction, WorkOrder } from '../../types';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyReportModal({ isOpen, onClose }: DailyReportModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [sales, setSales] = useState<Sale[]>([]);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      inventoryService.getSales(7).then(setSales).catch(console.warn);
      const unsubFinances = inventoryService.subscribeToFinances(setFinances);
      workOrderService.getWorkOrders().then(setWorkOrders).catch(console.warn);
      return () => {
        unsubFinances?.();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter items for selected date
  const isDateMatch = (rawDate: any, target: string) => {
    if (!rawDate) return false;
    let dStr = '';
    if (typeof rawDate === 'string') dStr = rawDate.substring(0, 10);
    else if (rawDate?.toDate) dStr = rawDate.toDate().toISOString().substring(0, 10);
    else if (rawDate instanceof Date) dStr = rawDate.toISOString().substring(0, 10);
    return dStr === target;
  };

  const daySales = sales.filter(s => isDateMatch(s.fecha, selectedDate));
  const dayFinances = finances.filter(f => isDateMatch(f.fecha, selectedDate));
  
  const totalSalesRevenue = daySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const extraIncome = dayFinances
    .filter(f => f.tipo === 'ingreso')
    .reduce((acc, f) => acc + Number(f.monto || 0), 0);
  const dayExpenses = dayFinances
    .filter(f => f.tipo === 'egreso')
    .reduce((acc, f) => acc + Number(f.monto || 0), 0);

  const totalIncome = totalSalesRevenue + extraIncome;
  const netBalance = totalIncome - dayExpenses;

  // Work orders delivered or completed today
  const deliveredOrders = workOrders.filter(o => 
    o.estado === 'entregado' && isDateMatch(o.fechaEntrega || o.updatedAt, selectedDate)
  );

  // Active work orders in progress
  const activeOrdersCount = workOrders.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado').length;

  // Top products sold today
  const productCountMap = new Map<string, { name: string; qty: number; total: number }>();
  daySales.forEach(s => {
    const prev = productCountMap.get(s.productId) || { name: s.productNombre, qty: 0, total: 0 };
    productCountMap.set(s.productId, {
      name: s.productNombre,
      qty: prev.qty + (s.cantidad || 1),
      total: prev.total + (s.total || 0)
    });
  });

  const topProducts = Array.from(productCountMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Format formatted WhatsApp Text
  const formattedDateStr = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const reportText = 
`📊 *CIERRE DIARIO - TALLER GREGORUTTI*
📅 *Fecha:* ${formattedDateStr}
──────────────────────────────
💰 *RESUMEN ECONÓMICO:*
• *Ventas registradas:* $${totalSalesRevenue.toLocaleString('es-AR')} (${daySales.length} operaciones)
${extraIncome > 0 ? `• *Ingresos extras:* $${extraIncome.toLocaleString('es-AR')}\n` : ''}• *Gastos / Egresos:* -$${dayExpenses.toLocaleString('es-AR')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *BALANCE NETO DEL DÍA:* $${netBalance.toLocaleString('es-AR')}

🛠️ *ACTIVIDAD DE TALLER:*
• *Órdenes entregadas hoy:* ${deliveredOrders.length}
• *Órdenes activas en curso:* ${activeOrdersCount}

📦 *ARTÍCULOS DESTACADOS DEL DÍA:*
${topProducts.length === 0 ? '• Sin artículos registrados hoy.' : topProducts.map(p => `• ${p.name} (x${p.qty}) → $${p.total.toLocaleString('es-AR')}`).join('\n')}
──────────────────────────────
_Generado automáticamente desde Gestión Taller Gregorutti_`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(reportText)}`;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Cierre Diario & Resumen WhatsApp
              </h2>
              <p className="text-[11px] text-gray-400">
                Balance del día listo para compartir con socios o equipo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          
          {/* Date Picker */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              Día a consultar:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Ingresos</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                ${totalIncome.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
              <span className="text-[10px] uppercase font-bold text-rose-600 block">Egresos</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-300">
                ${dayExpenses.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <span className="text-[10px] uppercase font-bold text-indigo-600 block">Neto del Día</span>
              <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
                ${netBalance.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Formatted Message Box */}
          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 block">
              Vista Previa del Mensaje
            </span>
            <pre className="p-4 bg-gray-950 text-emerald-400 font-mono text-xs rounded-2xl border border-gray-800 whitespace-pre-wrap leading-relaxed select-all">
              {reportText}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 py-3"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar Texto'}</span>
            </Button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all text-center"
            >
              <MessageCircle size={16} />
              <span>Enviar por WhatsApp</span>
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}
