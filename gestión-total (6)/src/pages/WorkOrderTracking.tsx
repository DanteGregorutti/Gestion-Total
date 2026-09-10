/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  Search, 
  Phone, 
  MapPin, 
  MessageCircle, 
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '../types';
import { workOrderService } from '../services/workOrderService';

export default function WorkOrderTracking() {
  const { orderId } = useParams<{ orderId?: string }>();
  const [searchCode, setSearchCode] = useState(orderId || '');
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchOrder = async (idOrNumber: string) => {
    if (!idOrNumber.trim()) return;
    setIsLoading(true);
    setNotFound(false);

    try {
      const found = await workOrderService.getWorkOrderById(idOrNumber.trim());
      if (found) {
        setOrder(found);
      } else {
        setOrder(null);
        setNotFound(true);
      }
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchCode);
  };

  // Stepper logic
  const steps: { key: WorkOrderStatus; title: string; desc: string }[] = [
    { key: 'ingresado', title: '1. Ingresado', desc: 'Recepción y ficha' },
    { key: 'en_diagnostico', title: '2. En Diagnóstico', desc: 'Revisión técnica' },
    { key: 'en_reparacion', title: '3. En Reparación', desc: 'Trabajo en banco' },
    { key: 'listo', title: '4. Listo para Retirar', desc: 'Finalizado y probado' },
    { key: 'entregado', title: '5. Entregado', desc: 'En manos del cliente' }
  ];

  const getStepIndex = (status: WorkOrderStatus) => {
    switch (status) {
      case 'ingresado': return 0;
      case 'en_diagnostico': return 1;
      case 'esperando_repuestos':
      case 'en_reparacion': return 2;
      case 'listo': return 3;
      case 'entregado': return 4;
      default: return 0;
    }
  };

  const currentStepIdx = order ? getStepIndex(order.estado) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 flex flex-col items-center justify-between p-4 sm:p-6 lg:p-12">
      
      {/* Top Brand Banner */}
      <div className="w-full max-w-2xl text-center space-y-2">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-indigo-700 dark:text-indigo-300">
          <Wrench size={18} />
          <span className="font-black text-sm tracking-tight">TALLER GREGORUTTI</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          Seguimiento de Reparación Online
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Consultá en tiempo real el avance de tu trabajo, diagnóstico y saldo a abonar.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl my-6 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        
        {/* Search Header if not entered */}
        <form onSubmit={handleSearchSubmit} className="p-4 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Número de orden (Ej: OT-0001)..."
              className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl transition-colors shrink-0"
          >
            {isLoading ? 'Buscando...' : 'Consultar'}
          </button>
        </form>

        {/* Content Area */}
        {notFound && (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              No encontramos una orden con ese código
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Verificá haber escrito correctamente el número (ej: OT-0001) o consultanos directamente por WhatsApp.
            </p>
          </div>
        )}

        {order && (
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Status Header Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  ORDEN REGISTRADA
                </span>
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {order.numero}
                </span>
                <p className="text-xs text-gray-500">
                  Ingreso: {new Date(order.fechaIngreso).toLocaleDateString('es-AR')}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  ESTADO ACTUAL
                </span>
                <span className="inline-block px-3 py-1 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-sm">
                  {order.estado === 'listo' 
                    ? '✨ ¡LISTO PARA RETIRAR!' 
                    : order.estado === 'en_reparacion' 
                    ? '🛠️ En Reparación' 
                    : order.estado === 'en_diagnostico' 
                    ? '🔍 En Diagnóstico' 
                    : order.estado === 'entregado'
                    ? '🏁 Entregado'
                    : '📥 Ingresado al Taller'}
                </span>
              </div>
            </div>

            {/* Visual Step Tracker */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Progreso del Trabajo
              </h4>
              
              <div className="grid grid-cols-5 gap-1.5 pt-2">
                {steps.map((s, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div key={s.key} className="flex flex-col items-center text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/50 scale-110' 
                          : isCompleted 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                      }`}>
                        {isCompleted && !isCurrent ? '✓' : idx + 1}
                      </div>
                      <span className={`text-[10px] mt-1.5 font-bold leading-tight ${
                        isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'
                      }`}>
                        {s.title.split('. ')[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipment & Work Card */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  Equipo / Objeto
                </span>
                <p className="text-base font-black text-gray-900 dark:text-white">
                  {order.equipo}
                </p>
                {order.marcaModelo && (
                  <p className="text-xs text-gray-500 font-medium">
                    {order.marcaModelo} {order.serieOPatente ? `(N°: ${order.serieOPatente})` : ''}
                  </p>
                )}
              </div>

              {order.diagnostico && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                    Diagnóstico del Técnico
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                    {order.diagnostico}
                  </p>
                </div>
              )}

              {order.trabajoRealizado && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                    Tareas Realizadas
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                    {order.trabajoRealizado}
                  </p>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="p-4 bg-gray-900 text-white rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">
                  Saldo a Abonar al Retirar
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  ${order.saldoPendiente.toLocaleString('es-AR')}
                </span>
                {order.anticipo > 0 && (
                  <p className="text-[11px] text-gray-400">
                    Seña abonada: ${order.anticipo.toLocaleString('es-AR')}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block">Garantía</span>
                <span className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                  <ShieldCheck size={14} className="text-indigo-400" />
                  30 días oficial
                </span>
              </div>
            </div>

            {/* Direct WhatsApp button to workshop */}
            <div className="pt-2">
              <a
                href={`https://wa.me/5493435123456?text=${encodeURIComponent(`Hola Taller Gregorutti, te consulto por mi orden ${order.numero} (${order.equipo})`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <MessageCircle size={16} />
                <span>Escribirnos por WhatsApp sobre esta orden</span>
              </a>
            </div>

          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-gray-400 space-y-1">
        <p className="font-bold text-gray-600 dark:text-gray-300">Taller Gregorutti • Paraná, Entre Ríos</p>
        <p>Lunes a Viernes de 8:00 a 18:00 hs • Sábados de 8:30 a 12:30 hs</p>
      </div>

    </div>
  );
}
