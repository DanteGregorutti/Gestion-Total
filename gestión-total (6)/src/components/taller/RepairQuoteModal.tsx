/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  DollarSign, 
  FileText, 
  MessageCircle, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  User, 
  Phone,
  Settings
} from 'lucide-react';
import { Button } from '../ui';
import Modal from '../Modal';
import { RepairQuote, WorkOrderItem } from '../../types';
import { toast } from 'sonner';

interface RepairQuoteModalProps {
  isOpen: boolean;
  quoteToEdit?: RepairQuote | null;
  onClose: () => void;
  onSave: (quoteData: Partial<RepairQuote>) => Promise<RepairQuote | void>;
  onSaveAndSendWhatsApp?: (quote: RepairQuote) => void;
}

export function RepairQuoteModal({
  isOpen,
  quoteToEdit,
  onClose,
  onSave,
  onSaveAndSendWhatsApp
}: RepairQuoteModalProps) {
  const [clientNombre, setClientNombre] = useState('');
  const [clientTelefono, setClientTelefono] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [equipo, setEquipo] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [serieOPatente, setSerieOPatente] = useState('');
  const [fallaReportada, setFallaReportada] = useState('');
  const [diagnosticoPrevio, setDiagnosticoPrevio] = useState('');
  const [validezDias, setValidezDias] = useState(10);
  const [notas, setNotas] = useState('Presupuesto válido por 10 días corridos. Sujeto a disponibilidad de repuestos.');
  const [costoManoObra, setCostoManoObra] = useState<number>(0);
  const [repuestos, setRepuestos] = useState<WorkOrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New spare part input
  const [newPartDesc, setNewPartDesc] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartPrice, setNewPartPrice] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (quoteToEdit) {
        setClientNombre(quoteToEdit.clientNombre || '');
        setClientTelefono(quoteToEdit.clientTelefono || '');
        setClientEmail(quoteToEdit.clientEmail || '');
        setEquipo(quoteToEdit.equipo || '');
        setMarcaModelo(quoteToEdit.marcaModelo || '');
        setSerieOPatente(quoteToEdit.serieOPatente || '');
        setFallaReportada(quoteToEdit.fallaReportada || '');
        setDiagnosticoPrevio(quoteToEdit.diagnosticoPrevio || '');
        setValidezDias(quoteToEdit.validezDias || 10);
        setNotas(quoteToEdit.notas || '');
        setCostoManoObra(quoteToEdit.costoManoObra || 0);
        setRepuestos(quoteToEdit.repuestos || []);
      } else {
        setClientNombre('');
        setClientTelefono('');
        setClientEmail('');
        setEquipo('');
        setMarcaModelo('');
        setSerieOPatente('');
        setFallaReportada('');
        setDiagnosticoPrevio('');
        setValidezDias(10);
        setNotas('Presupuesto válido por 10 días corridos. Precios sujetos a confirmación.');
        setCostoManoObra(0);
        setRepuestos([]);
      }
      setNewPartDesc('');
      setNewPartQty(1);
      setNewPartPrice(0);
    }
  }, [isOpen, quoteToEdit]);

  const costoRepuestos = repuestos.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const total = (Number(costoManoObra) || 0) + costoRepuestos;

  const handleAddPart = () => {
    if (!newPartDesc.trim()) {
      toast.error('Indica la descripción del repuesto');
      return;
    }
    const qty = Math.max(1, newPartQty);
    const unitPrice = Math.max(0, newPartPrice);
    const subtotal = qty * unitPrice;

    const newItem: WorkOrderItem = {
      id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      descripcion: newPartDesc.trim(),
      cantidad: qty,
      precioUnitario: unitPrice,
      subtotal
    };

    setRepuestos([...repuestos, newItem]);
    setNewPartDesc('');
    setNewPartQty(1);
    setNewPartPrice(0);
    toast.success('Repuesto agregado');
  };

  const handleRemovePart = (id: string) => {
    setRepuestos(repuestos.filter(r => r.id !== id));
  };

  const handleSave = async (andWhatsApp = false) => {
    if (!clientNombre.trim()) {
      toast.error('Indica el nombre del cliente');
      return;
    }
    if (!equipo.trim()) {
      toast.error('Indica el equipo o máquina a reparar');
      return;
    }
    if (!fallaReportada.trim()) {
      toast.error('Indica la falla o motivo de la cotización');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<RepairQuote> = {
        clientNombre: clientNombre.trim(),
        clientTelefono: clientTelefono.trim(),
        clientEmail: clientEmail.trim(),
        equipo: equipo.trim(),
        marcaModelo: marcaModelo.trim(),
        serieOPatente: serieOPatente.trim(),
        fallaReportada: fallaReportada.trim(),
        diagnosticoPrevio: diagnosticoPrevio.trim(),
        costoManoObra: Number(costoManoObra) || 0,
        costoRepuestos,
        total,
        validezDias: Number(validezDias) || 10,
        notas: notas.trim(),
        repuestos
      };

      const result = await onSave(payload);
      toast.success(quoteToEdit ? 'Presupuesto de taller actualizado' : 'Presupuesto creado con éxito');

      if (andWhatsApp && onSaveAndSendWhatsApp) {
        const fullQuote: RepairQuote = {
          ...(quoteToEdit || {}),
          ...payload
        } as RepairQuote;
        onSaveAndSendWhatsApp(result && typeof result === 'object' ? result : fullQuote);
      }

      onClose();
    } catch (e) {
      console.error('Error saving repair quote:', e);
      toast.error('Error al guardar el presupuesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quoteToEdit ? `Modificar Presupuesto de Taller (${quoteToEdit.numero})` : "Cotizar Reparación / Presupuesto de Taller"}
      className="max-w-3xl"
    >
      <div className="space-y-5 pb-2">
        
        {/* Banner */}
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
            <Wrench size={18} />
          </div>
          <div className="text-xs">
            <p className="font-bold text-indigo-950 dark:text-indigo-200">
              Cotización Técnica para Taller Gregorutti
            </p>
            <p className="text-indigo-700 dark:text-indigo-400">
              Permite detallar diagnóstico preliminar, mano de obra especializada y repuestos sin descontar stock hasta que el cliente apruebe.
            </p>
          </div>
        </div>

        {/* Section 1: Customer Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <User size={14} className="text-indigo-600" />
            Datos del Cliente
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Cliente *
              </label>
              <input
                type="text"
                required
                value={clientNombre}
                onChange={(e) => setClientNombre(e.target.value)}
                placeholder="Ej: Marcelo Benítez"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                WhatsApp / Teléfono
              </label>
              <input
                type="tel"
                value={clientTelefono}
                onChange={(e) => setClientTelefono(e.target.value)}
                placeholder="Ej: 1160255767 o 343..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email (Opcional)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Equipment & Diagnosis */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Settings size={14} className="text-indigo-600" />
            Equipo & Diagnóstico
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Equipo / Máquina *
              </label>
              <input
                type="text"
                required
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
                placeholder="Ej: Compresor, Cortadora, Generador"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Marca / Modelo
              </label>
              <input
                type="text"
                value={marcaModelo}
                onChange={(e) => setMarcaModelo(e.target.value)}
                placeholder="Ej: Gamma 50L / Honda GX"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                N° Serie o Patente
              </label>
              <input
                type="text"
                value={serieOPatente}
                onChange={(e) => setSerieOPatente(e.target.value)}
                placeholder="Ej: SN-49824"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Falla Reportada por el Cliente *
              </label>
              <textarea
                rows={2}
                required
                value={fallaReportada}
                onChange={(e) => setFallaReportada(e.target.value)}
                placeholder="Ej: No arranca, hace ruido metálico, pierde aceite..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Diagnóstico Técnico Preliminar
              </label>
              <textarea
                rows={2}
                value={diagnosticoPrevio}
                onChange={(e) => setDiagnosticoPrevio(e.target.value)}
                placeholder="Ej: Desgaste en bobinado, requiere cambio de carbones y rulemán..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Repuestos / Materiales cotizados */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Repuestos y Materiales Necesarios ({repuestos.length})
            </h4>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Subtotal Repuestos: ${costoRepuestos.toLocaleString('es-AR')}
            </span>
          </div>

          {/* Add part inline row */}
          <div className="grid grid-cols-12 gap-2 items-end bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="col-span-6 sm:col-span-6">
              <label className="block text-[10px] font-bold text-gray-500 mb-1">
                Descripción del Repuesto
              </label>
              <input
                type="text"
                value={newPartDesc}
                onChange={(e) => setNewPartDesc(e.target.value)}
                placeholder="Ej: Juego de juntas, Carburador, Bujía..."
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 mb-1">
                Cant.
              </label>
              <input
                type="number"
                min="1"
                value={newPartQty}
                onChange={(e) => setNewPartQty(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              />
            </div>
            <div className="col-span-3 sm:col-span-3">
              <label className="block text-[10px] font-bold text-gray-500 mb-1">
                Precio Unit. ($)
              </label>
              <input
                type="number"
                min="0"
                value={newPartPrice}
                onChange={(e) => setNewPartPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              />
            </div>
            <div className="col-span-1 sm:col-span-1 flex justify-end">
              <Button
                type="button"
                onClick={handleAddPart}
                className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs"
                title="Agregar repuesto"
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>

          {/* Repuestos list */}
          {repuestos.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {repuestos.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-xs"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-gray-900 dark:text-white block">{item.descripcion}</span>
                    <span className="text-[11px] text-gray-500">
                      {item.cantidad} x ${item.precioUnitario.toLocaleString('es-AR')} = ${item.subtotal.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePart(item.id)}
                    className="p-1 text-gray-400 hover:text-rose-500 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Labor & Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Mano de Obra Especializada ($)
              </label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={costoManoObra}
                  onChange={(e) => setCostoManoObra(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Validez de la Cotización (Días)
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={validezDias}
                  onChange={(e) => setValidezDias(parseInt(e.target.value) || 10)}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Condiciones / Notas
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Presupuesto válido por 10 días..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer & Total */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider block">
              Total Presupuesto de Reparación
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              ${total.toLocaleString('es-AR')}
            </span>
            <div className="text-[11px] text-gray-500 flex gap-2 mt-0.5">
              <span>Mano de obra: ${costoManoObra.toLocaleString('es-AR')}</span>
              <span>•</span>
              <span>Repuestos: ${costoRepuestos.toLocaleString('es-AR')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900"
            >
              {isSubmitting ? 'Guardando...' : (quoteToEdit ? 'Guardar Cambios' : 'Guardar Cotización')}
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-200 dark:shadow-none"
            >
              <MessageCircle size={14} className="mr-1.5" />
              {isSubmitting ? 'Guardando...' : 'Guardar y Enviar WhatsApp'}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
