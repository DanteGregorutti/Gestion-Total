/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wrench, 
  User, 
  Phone, 
  FileText, 
  Package, 
  Plus, 
  Trash2, 
  DollarSign, 
  Sparkles, 
  Clock, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui';
import { WorkOrder, WorkOrderItem, WorkOrderStatus, WorkOrderPriority, Client, Product } from '../../types';
import { inventoryService } from '../../services/inventoryService';

interface WorkOrderModalProps {
  isOpen: boolean;
  orderToEdit?: WorkOrder | null;
  onClose: () => void;
  onSave: (orderData: Partial<WorkOrder>) => Promise<void>;
}

export function WorkOrderModal({
  isOpen,
  orderToEdit,
  onClose,
  onSave
}: WorkOrderModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [numero, setNumero] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientNombre, setClientNombre] = useState('');
  const [clientTelefono, setClientTelefono] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  
  const [equipo, setEquipo] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [serieOPatente, setSerieOPatente] = useState('');
  const [fallaReportada, setFallaReportada] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [trabajoRealizado, setTrabajoRealizado] = useState('');
  
  const [repuestos, setRepuestos] = useState<WorkOrderItem[]>([]);
  const [costoManoObra, setCostoManoObra] = useState<number>(0);
  const [anticipo, setAnticipo] = useState<number>(0);
  const [estado, setEstado] = useState<WorkOrderStatus>('ingresado');
  const [prioridad, setPrioridad] = useState<WorkOrderPriority>('normal');
  const [fechaPrometida, setFechaPrometida] = useState('');
  const [notasInternas, setNotasInternas] = useState('');

  // AI Assistant suggestion state
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);

  // Load clients & products for autocompletion
  useEffect(() => {
    if (isOpen) {
      inventoryService.getClients().then(setClients).catch(console.warn);
      inventoryService.getProducts().then(setProducts).catch(console.warn);
    }
  }, [isOpen]);

  // Sync with orderToEdit or reset
  useEffect(() => {
    if (orderToEdit) {
      setNumero(orderToEdit.numero || '');
      setClientId(orderToEdit.clientId || '');
      setClientNombre(orderToEdit.clientNombre || '');
      setClientTelefono(orderToEdit.clientTelefono || '');
      setClientEmail(orderToEdit.clientEmail || '');
      setEquipo(orderToEdit.equipo || '');
      setMarcaModelo(orderToEdit.marcaModelo || '');
      setSerieOPatente(orderToEdit.serieOPatente || '');
      setFallaReportada(orderToEdit.fallaReportada || '');
      setDiagnostico(orderToEdit.diagnostico || '');
      setTrabajoRealizado(orderToEdit.trabajoRealizado || '');
      setRepuestos(orderToEdit.repuestos || []);
      setCostoManoObra(orderToEdit.costoManoObra || 0);
      setAnticipo(orderToEdit.anticipo || 0);
      setEstado(orderToEdit.estado || 'ingresado');
      setPrioridad(orderToEdit.prioridad || 'normal');
      setFechaPrometida(orderToEdit.fechaPrometida ? orderToEdit.fechaPrometida.substring(0, 10) : '');
      setNotasInternas(orderToEdit.notasInternas || '');
      setAiTip(null);
    } else {
      setNumero('');
      setClientId('');
      setClientNombre('');
      setClientTelefono('');
      setClientEmail('');
      setEquipo('');
      setMarcaModelo('');
      setSerieOPatente('');
      setFallaReportada('');
      setDiagnostico('');
      setTrabajoRealizado('');
      setRepuestos([]);
      setCostoManoObra(0);
      setAnticipo(0);
      setEstado('ingresado');
      setPrioridad('normal');
      setFechaPrometida('');
      setNotasInternas('');
      setAiTip(null);
    }
  }, [orderToEdit, isOpen]);

  // Autocomplete client selection
  const handleSelectClient = (cId: string) => {
    setClientId(cId);
    const found = clients.find(c => c.id === cId);
    if (found) {
      setClientNombre(found.nombre);
      setClientTelefono(found.telefono || '');
      setClientEmail(found.email || '');
    }
  };

  // Add spare part / item
  const handleAddRepuesto = (product?: Product) => {
    const newItem: WorkOrderItem = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productId: product?.id,
      descripcion: product ? product.descripcion : '',
      cantidad: 1,
      precioUnitario: product ? product.precio : 0,
      costoUnitario: product ? (product.costo || 0) : 0,
      subtotal: product ? product.precio : 0
    };
    setRepuestos([...repuestos, newItem]);
  };

  const handleUpdateRepuesto = (index: number, field: keyof WorkOrderItem, value: any) => {
    const updated = [...repuestos];
    const item = { ...updated[index], [field]: value };
    if (field === 'cantidad' || field === 'precioUnitario') {
      const q = field === 'cantidad' ? Number(value) : item.cantidad;
      const p = field === 'precioUnitario' ? Number(value) : item.precioUnitario;
      item.subtotal = q * p;
    }
    updated[index] = item;
    setRepuestos(updated);
  };

  const handleRemoveRepuesto = (index: number) => {
    setRepuestos(repuestos.filter((_, i) => i !== index));
  };

  // Calculations
  const costoRepuestos = repuestos.reduce((acc, r) => acc + (r.subtotal || 0), 0);
  const total = Number(costoManoObra || 0) + costoRepuestos;
  const saldoPendiente = Math.max(0, total - Number(anticipo || 0));

  // AI Diagnosis Assistant
  const handleAiDiagnose = () => {
    if (!equipo && !fallaReportada) {
      alert('Ingresá el equipo y el síntoma o falla reportada para que la IA pueda sugerirte un diagnóstico.');
      return;
    }

    setIsAiSuggesting(true);
    setTimeout(() => {
      // Intelligent rule-based engine simulating specialized workshop diagnosis
      const text = `${equipo} ${marcaModelo} ${fallaReportada}`.toLowerCase();
      let diag = '';
      let tasks = '';
      let suggestedLabor = 25000;

      if (text.includes('presión') || text.includes('compresor') || text.includes('aire')) {
        diag = 'Pérdida de rendimiento en cabezal de compresión. Falla común en láminas de válvulas o aros con carbón acumulado.';
        tasks = 'Desarme de cabezal, descarbonización de cilindro, reemplazo de junta de tapa y cambio de aceite sintético.';
        suggestedLabor = 32000;
      } else if (text.includes('no arranca') || text.includes('bujía') || text.includes('explosiones') || text.includes('nafta') || text.includes('generador')) {
        diag = 'Obstrucción en circuito de baja del carburador por combustible degradado y electrodo de bujía desgastado.';
        tasks = 'Limpieza ultrasónica de carburador, drenaje de cuba, sustitución de bujía y calibración de ralentí.';
        suggestedLabor = 22000;
      } else if (text.includes('ruido') || text.includes('zumbido') || text.includes('bomba') || text.includes('motor') || text.includes('ruleman')) {
        diag = 'Rodamientos / rulemanes delanteros o traseros picados con juego radial. Posible desgaste en retén mecánico.';
        tasks = 'Extracción de rodamientos con extractor hidráulico, rectificado de asiento de eje y cambio de retén.';
        suggestedLabor = 28000;
      } else if (text.includes('freno') || text.includes('rueda') || text.includes('suspensión')) {
        diag = 'Desgaste pronunciado en material de fricción y líquido degradado con presencia de aire en circuito.';
        tasks = 'Sustitución de pastillas/zapatas, rectificado de disco/campana y purgado completo de líquido.';
        suggestedLabor = 35000;
      } else {
        diag = `Revisión general de ${equipo}. Síntomas compatibles con desgaste mecánico o falla en alimentación de potencia.`;
        tasks = 'Desmontaje para inspección técnica detallada, chequeo de tolerancias y puesta a punto.';
        suggestedLabor = 25000;
      }

      if (!diagnostico) setDiagnostico(diag);
      if (!trabajoRealizado) setTrabajoRealizado(tasks);
      if (costoManoObra === 0) setCostoManoObra(suggestedLabor);
      setAiTip('💡 Diagnóstico y tareas sugeridas con éxito. Podés ajustar los textos y montos a tu criterio.');
      setIsAiSuggesting(false);
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipo.trim()) {
      alert('Por favor especificá el equipo o trabajo a realizar.');
      return;
    }
    if (!clientNombre.trim()) {
      alert('Por favor indicá el nombre del cliente.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        numero: numero || undefined,
        clientId,
        clientNombre,
        clientTelefono,
        clientEmail,
        equipo,
        marcaModelo,
        serieOPatente,
        fallaReportada,
        diagnostico,
        trabajoRealizado,
        repuestos,
        costoManoObra,
        costoRepuestos,
        total,
        anticipo,
        saldoPendiente,
        estado,
        prioridad,
        fechaPrometida,
        notasInternas
      });
      onClose();
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('Error al guardar la orden de trabajo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                {orderToEdit ? `Modificar Orden ${orderToEdit.numero}` : 'Nueva Orden de Trabajo (Taller)'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ficha técnica de reparación, service, repuestos y presupuesto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* Top Status & Priority Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Estado Actual
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as WorkOrderStatus)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="ingresado">📥 Ingresado / Recepción</option>
                <option value="en_diagnostico">🔍 En Diagnóstico</option>
                <option value="en_reparacion">🛠️ En Taller / Reparación</option>
                <option value="esperando_repuestos">⏳ Esperando Repuestos</option>
                <option value="listo">✨ Listo para Retirar</option>
                <option value="entregado">🏁 Entregado & Finalizado</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as WorkOrderPriority)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="normal">Normal</option>
                <option value="urgente">🔥 Urgente / Prioritario</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-gray-400" />
                Fecha Prometida de Entrega
              </label>
              <input
                type="date"
                value={fechaPrometida}
                onChange={(e) => setFechaPrometida(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Section 1: Cliente */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <User size={14} className="text-indigo-500" />
              1. Datos del Cliente
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {clients.length > 0 && (
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Seleccionar Cliente Registrado
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                  >
                    <option value="">-- Cliente Nuevo / Particular --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.telefono ? `(${c.telefono})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={clients.length > 0 ? "sm:col-span-1" : "sm:col-span-2"}>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={clientNombre}
                  onChange={(e) => setClientNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  WhatsApp / Teléfono
                </label>
                <input
                  type="tel"
                  value={clientTelefono}
                  onChange={(e) => setClientTelefono(e.target.value)}
                  placeholder="Ej: 3435123456"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Datos del Equipo / Máquina */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <Package size={14} className="text-indigo-500" />
              2. Objeto / Equipo / Máquina en Taller
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  ¿Qué equipo o trabajo es? *
                </label>
                <input
                  type="text"
                  required
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  placeholder="Ej: Compresor 50L, Motor Ford 3.0, Taladro DeWalt..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Marca y Modelo
                </label>
                <input
                  type="text"
                  value={marcaModelo}
                  onChange={(e) => setMarcaModelo(e.target.value)}
                  placeholder="Ej: Honda GX200, Gamma, Bosch..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  N° de Serie / Patente / Identificador
                </label>
                <input
                  type="text"
                  value={serieOPatente}
                  onChange={(e) => setSerieOPatente(e.target.value)}
                  placeholder="Ej: SN-94812 o AA 123 CD"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Falla Declarada por el Cliente / Motivo de Entrada
                </label>
                <button
                  type="button"
                  onClick={handleAiDiagnose}
                  disabled={isAiSuggesting}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-black hover:bg-purple-100 transition-colors"
                >
                  <Sparkles size={12} className="text-purple-500 animate-pulse" />
                  <span>{isAiSuggesting ? 'Analizando...' : 'Asistente IA: Sugerir Diagnóstico'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={fallaReportada}
                onChange={(e) => setFallaReportada(e.target.value)}
                placeholder="Ej: No arranca, hace ruido metálico, pierde aceite por retén inferior..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              />
            </div>

            {aiTip && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-800 dark:text-purple-300 flex items-center justify-between">
                <span>{aiTip}</span>
                <button type="button" onClick={() => setAiTip(null)} className="text-purple-400 hover:text-purple-600">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Diagnóstico Técnico
                </label>
                <textarea
                  rows={2}
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  placeholder="Ej: Junta de tapa rota, desgaste en rulemanes delanteros..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Trabajo Realizado / Tareas
                </label>
                <textarea
                  rows={2}
                  value={trabajoRealizado}
                  onChange={(e) => setTrabajoRealizado(e.target.value)}
                  placeholder="Ej: Desarme, rectificado, cambio de sellos, limpieza con ultrasonido..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Repuestos & Materiales */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Wrench size={14} className="text-indigo-500" />
                3. Repuestos & Insumos Utilizados
              </h3>

              <div className="flex items-center gap-2">
                {products.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const prod = products.find(p => p.id === e.target.value);
                        if (prod) handleAddRepuesto(prod);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>+ Cargar desde Inventario...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.descripcion} (${p.precio.toLocaleString('es-AR')})
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => handleAddRepuesto()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus size={12} />
                  <span>Item Libre</span>
                </button>
              </div>
            </div>

            {repuestos.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400">
                No hay repuestos asignados aún. Podés seleccionar artículos de tu inventario o agregar repuestos libres.
              </div>
            ) : (
              <div className="space-y-2">
                {repuestos.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleUpdateRepuesto(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción del repuesto o material"
                      className="flex-1 px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
                    />
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => handleUpdateRepuesto(idx, 'cantidad', Number(e.target.value))}
                        placeholder="Cant."
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-center font-bold text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={item.precioUnitario}
                        onChange={(e) => handleUpdateRepuesto(idx, 'precioUnitario', Number(e.target.value))}
                        placeholder="Precio U."
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-right font-bold text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="w-24 text-right text-xs font-black text-gray-900 dark:text-white pr-2">
                      ${(item.subtotal || 0).toLocaleString('es-AR')}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRepuesto(idx)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Costos & Totales */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              4. Liquidación del Trabajo & Pagos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Mano de Obra ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={costoManoObra}
                  onChange={(e) => setCostoManoObra(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Total Repuestos
                </label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900/50 rounded-xl text-sm font-black text-gray-700 dark:text-gray-300">
                  ${costoRepuestos.toLocaleString('es-AR')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Anticipo / Seña ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={anticipo}
                  onChange={(e) => setAnticipo(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-emerald-600 dark:text-emerald-400 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-indigo-600/10 dark:bg-indigo-500/20 rounded-xl border border-indigo-200 dark:border-indigo-800 text-right">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  Total Orden: ${total.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">Saldo a Cobrar:</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  ${saldoPendiente.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Notas Internas (Solo para el taller)
              </label>
              <input
                type="text"
                value={notasInternas}
                onChange={(e) => setNotasInternas(e.target.value)}
                placeholder="Ej: Cliente apurado, probar durante 20 minutos antes de entregar..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-600/20 px-6"
            >
              {isSubmitting ? 'Guardando...' : orderToEdit ? 'Actualizar Orden' : 'Crear Orden de Taller'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
