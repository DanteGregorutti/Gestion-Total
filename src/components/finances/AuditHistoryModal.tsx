/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  History, 
  Calendar, 
  Banknote, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  Sparkles
} from 'lucide-react';
import { CashAudit } from '../../types';
import { inventoryService } from '../../services/inventoryService';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  audits: CashAudit[];
  onRefresh: () => void;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  isOpen,
  onClose,
  audits,
  onRefresh
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este registro de arqueo?')) return;
    try {
      setDeletingId(id);
      await inventoryService.deleteCashAudit(id);
      onRefresh();
    } catch (err) {
      console.error('Error deleting audit:', err);
      alert('No se pudo eliminar el arqueo');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 my-8 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Historial de Arqueos y Cierres de Caja
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Registro de recuentos físicos y cuadres de dinero realizados
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {audits.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500 space-y-2">
              <History className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">Aún no hay arqueos de caja registrados.</p>
              <p className="text-xs">Usa la calculadora de billetes para contar tu dinero y guardá tu primer cierre.</p>
            </div>
          ) : (
            audits.map((audit) => {
              const diff = audit.diferencia || 0;
              const dateFormatted = new Date(audit.fecha).toLocaleString('es-AR', {
                dateStyle: 'medium',
                timeStyle: 'short'
              });

              return (
                <div
                  key={audit.id}
                  className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        {dateFormatted}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                          Math.abs(diff) < 1
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : diff > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        }`}
                      >
                        {Math.abs(diff) < 1
                          ? 'Cuadrada'
                          : diff > 0
                            ? `Sobrante +$${diff.toLocaleString('es-AR')}`
                            : `Faltante -$${Math.abs(diff).toLocaleString('es-AR')}`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <span>
                        💵 Efectivo: <strong>${(audit.totalEfectivo || 0).toLocaleString('es-AR')}</strong>
                      </span>
                      {audit.totalDigital > 0 && (
                        <span>
                          💳 Digital: <strong>${(audit.totalDigital || 0).toLocaleString('es-AR')}</strong>
                        </span>
                      )}
                      <span>
                        💰 Total Contado: <strong className="text-indigo-600 dark:text-indigo-400 font-black">${(audit.totalContado || 0).toLocaleString('es-AR')}</strong>
                      </span>
                    </div>

                    {audit.notas && (
                      <p className="text-xs italic text-gray-500 dark:text-gray-400">
                        "{audit.notas}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDelete(audit.id)}
                      disabled={deletingId === audit.id}
                      className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Eliminar este arqueo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
