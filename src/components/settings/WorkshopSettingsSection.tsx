/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wrench, 
  ShieldCheck, 
  Clock, 
  MessageCircle, 
  AlertCircle, 
  Save, 
  Check, 
  FileCheck 
} from 'lucide-react';
import { Button } from '../ui';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function WorkshopSettingsSection() {
  const { appSettings, updateAppSettings } = useSettings();

  const [form, setForm] = useState({
    defaultWorkOrderWarrantyDays: appSettings.defaultWorkOrderWarrantyDays || 30,
    defaultWorkOrderTerms: appSettings.defaultWorkOrderTerms || 'El cliente autoriza la inspección técnica y el desarme previo del equipo para elaboración de presupuesto.',
    defaultWorkOrderPriority: appSettings.defaultWorkOrderPriority || 'normal',
    autoSendWhatsappOnWorkOrderReady: appSettings.autoSendWhatsappOnWorkOrderReady ?? true,
    requireTechnicianNoteOnDelivery: appSettings.requireTechnicianNoteOnDelivery ?? false,
    workOrderPrefix: appSettings.workOrderPrefix || 'OT-',
    defaultDiagnosticHours: appSettings.defaultDiagnosticHours || 48,
    notifyClientOnStatusChange: appSettings.notifyClientOnStatusChange ?? true
  });

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm({
      defaultWorkOrderWarrantyDays: appSettings.defaultWorkOrderWarrantyDays || 30,
      defaultWorkOrderTerms: appSettings.defaultWorkOrderTerms || 'El cliente autoriza la inspección técnica y el desarme previo del equipo para elaboración de presupuesto.',
      defaultWorkOrderPriority: appSettings.defaultWorkOrderPriority || 'normal',
      autoSendWhatsappOnWorkOrderReady: appSettings.autoSendWhatsappOnWorkOrderReady ?? true,
      requireTechnicianNoteOnDelivery: appSettings.requireTechnicianNoteOnDelivery ?? false,
      workOrderPrefix: appSettings.workOrderPrefix || 'OT-',
      defaultDiagnosticHours: appSettings.defaultDiagnosticHours || 48,
      notifyClientOnStatusChange: appSettings.notifyClientOnStatusChange ?? true
    });
  }, [appSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        defaultWorkOrderWarrantyDays: Number(form.defaultWorkOrderWarrantyDays) || 30,
        defaultWorkOrderTerms: form.defaultWorkOrderTerms.trim(),
        defaultWorkOrderPriority: form.defaultWorkOrderPriority as any,
        autoSendWhatsappOnWorkOrderReady: Boolean(form.autoSendWhatsappOnWorkOrderReady),
        requireTechnicianNoteOnDelivery: Boolean(form.requireTechnicianNoteOnDelivery),
        workOrderPrefix: form.workOrderPrefix.trim() || 'OT-',
        defaultDiagnosticHours: Number(form.defaultDiagnosticHours) || 48,
        notifyClientOnStatusChange: Boolean(form.notifyClientOnStatusChange)
      });
      toast.success('¡Preferencias de Taller & Reparaciones guardadas con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar configuración de taller');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl text-purple-600 dark:text-purple-400">
              <Wrench size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Taller & Reparaciones
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Parámetros de órdenes de trabajo, garantías de servicio y mensajes al cliente
              </p>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={isSaving}
            className="self-start sm:self-auto bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-purple-600/20"
          >
            <Save size={16} className="mr-2" />
            Guardar Cambios
          </Button>
        </div>

        {/* Warranty & Priority */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-purple-500" />
            Garantías y Prioridades Predeterminadas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Días de Garantía por Defecto en Servicios
              </label>
              <select
                value={form.defaultWorkOrderWarrantyDays}
                onChange={(e) => setForm({ ...form, defaultWorkOrderWarrantyDays: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días (1 mes estándar)</option>
                <option value={60}>60 días (2 meses)</option>
                <option value={90}>90 días (3 meses)</option>
                <option value={180}>180 días (6 meses)</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Se imprimirá en el comprobante de entrega como plazo de cobertura del servicio.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Prioridad Inicial en Nuevas Órdenes
              </label>
              <select
                value={form.defaultWorkOrderPriority}
                onChange={(e) => setForm({ ...form, defaultWorkOrderPriority: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="baja">Baja</option>
                <option value="normal">Normal (Estándar)</option>
                <option value="urgente">Urgente</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Nivel de urgencia sugerido al ingresar un nuevo equipo al taller.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Prefijo para Número de Órdenes
              </label>
              <input
                type="text"
                value={form.workOrderPrefix}
                onChange={(e) => setForm({ ...form, workOrderPrefix: e.target.value })}
                placeholder="OT-"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-mono text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Ej: "OT-00145", "REP-", "ORD-".
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Tiempo Estimado de Diagnóstico
              </label>
              <select
                value={form.defaultDiagnosticHours}
                onChange={(e) => setForm({ ...form, defaultDiagnosticHours: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none"
              >
                <option value={24}>24 horas (1 día)</option>
                <option value={48}>48 horas (2 días)</option>
                <option value={72}>72 horas (3 días)</option>
                <option value={120}>5 días hábiles</option>
                <option value={168}>1 semana</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Plazo sugerido para presupuestar la reparación.
              </span>
            </div>
          </div>
        </div>

        {/* Disclaimer / Terms of Service */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <FileCheck size={14} className="text-indigo-500" />
            Términos y Condiciones al Recibir Equipos
          </h3>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Condición legal / Cláusula de ingreso impresa en el ticket de recepción
            </label>
            <textarea
              rows={3}
              value={form.defaultWorkOrderTerms}
              onChange={(e) => setForm({ ...form, defaultWorkOrderTerms: e.target.value })}
              placeholder="Ej: El cliente autoriza la inspección técnica y el desarme previo del equipo para elaboración de presupuesto..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none leading-relaxed"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Aparece en la constancia que firma el cliente al dejar su vehículo o máquina en el taller.
            </span>
          </div>
        </div>

        {/* Communication Toggles */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <MessageCircle size={14} className="text-emerald-500" />
            Notificaciones y Entrega
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Aviso por WhatsApp al finalizar reparación
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Prepara automáticamente el mensaje de aviso cuando cambias el estado de la orden a "Listo para retirar".
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.autoSendWhatsappOnWorkOrderReady}
                onChange={(e) => setForm({ ...form, autoSendWhatsappOnWorkOrderReady: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Exigir detalle técnico al entregar
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Obliga a dejar asentado el trabajo final realizado antes de marcar una orden como entregada.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.requireTechnicianNoteOnDelivery}
                onChange={(e) => setForm({ ...form, requireTechnicianNoteOnDelivery: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

      </div>
    </form>
  );
}
