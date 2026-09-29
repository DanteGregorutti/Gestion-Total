/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Layers, 
  Eye, 
  ScanLine, 
  Save, 
  Check, 
  ShieldAlert 
} from 'lucide-react';
import { Button } from '../ui';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function InventoryStockSettingsSection() {
  const { appSettings, updateAppSettings } = useSettings();

  const [form, setForm] = useState({
    lowStockThreshold: appSettings.lowStockThreshold || 5,
    allowNegativeStock: appSettings.allowNegativeStock ?? true,
    showCostAndProfitColumns: appSettings.showCostAndProfitColumns ?? true,
    autoBarcodeScannerMode: appSettings.autoBarcodeScannerMode ?? false,
    groupByCodeAndDesc: appSettings.groupByCodeAndDesc ?? true,
    suggestedProfitMargin: appSettings.suggestedProfitMargin || 40,
    playBeepOnScan: appSettings.playBeepOnScan ?? true,
    defaultMeasurementUnit: appSettings.defaultMeasurementUnit || 'unidades',
    defaultInventorySort: appSettings.defaultInventorySort || 'nombre'
  });

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm({
      lowStockThreshold: appSettings.lowStockThreshold || 5,
      allowNegativeStock: appSettings.allowNegativeStock ?? true,
      showCostAndProfitColumns: appSettings.showCostAndProfitColumns ?? true,
      autoBarcodeScannerMode: appSettings.autoBarcodeScannerMode ?? false,
      groupByCodeAndDesc: appSettings.groupByCodeAndDesc ?? true,
      suggestedProfitMargin: appSettings.suggestedProfitMargin || 40,
      playBeepOnScan: appSettings.playBeepOnScan ?? true,
      defaultMeasurementUnit: appSettings.defaultMeasurementUnit || 'unidades',
      defaultInventorySort: appSettings.defaultInventorySort || 'nombre'
    });
  }, [appSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        lowStockThreshold: Math.max(1, Number(form.lowStockThreshold) || 5),
        allowNegativeStock: Boolean(form.allowNegativeStock),
        showCostAndProfitColumns: Boolean(form.showCostAndProfitColumns),
        autoBarcodeScannerMode: Boolean(form.autoBarcodeScannerMode),
        groupByCodeAndDesc: Boolean(form.groupByCodeAndDesc),
        suggestedProfitMargin: Math.max(0, Number(form.suggestedProfitMargin) || 40),
        playBeepOnScan: Boolean(form.playBeepOnScan),
        defaultMeasurementUnit: form.defaultMeasurementUnit,
        defaultInventorySort: form.defaultInventorySort as any
      });
      toast.success('¡Preferencias de Inventario y Stock guardadas con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar configuración de inventario');
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
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl text-amber-600 dark:text-amber-400">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Inventario & Stock
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Control de alertas de stock mínimo, visibilidad de costos y políticas de venta
              </p>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={isSaving}
            className="self-start sm:self-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-amber-600/20"
          >
            <Save size={16} className="mr-2" />
            Guardar Cambios
          </Button>
        </div>

        {/* Low Stock Alert */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Umbral de Alerta de Stock Bajo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Cantidad mínima para disparar aviso
              </label>
              <input
                type="number"
                min="1"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) || 1 })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Cuando un artículo tenga {form.lowStockThreshold} unidades o menos, se marcará con advertencia amarilla/naranja en el panel de control.
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
              <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-300">
                <p className="font-bold">Notificación Inteligente</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400 leading-relaxed">
                  El centro de notificaciones superior te avisará automáticamente cuando cualquier producto cruce esta cantidad límite.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Policies & View Toggles */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Layers size={14} className="text-indigo-500" />
            Políticas de Venta y Visualización
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Allow Negative Stock */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Permitir venta sin stock disponible
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Si está activo, permite concretar ventas aún si el stock queda en 0 o negativo (ideal para preventas).
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.allowNegativeStock}
                onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Show Cost and Profit Columns */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Mostrar columnas de Costo y Ganancia
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Muestra el costo de compra y el margen de ganancia estimado en la tabla de inventario.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.showCostAndProfitColumns}
                onChange={(e) => setForm({ ...form, showCostAndProfitColumns: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Group by Code and Description */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Agrupación inteligente de variantes
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Agrupa talles y colores bajo un mismo producto para una lista más limpia y ordenada.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.groupByCodeAndDesc}
                onChange={(e) => setForm({ ...form, groupByCodeAndDesc: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Continuous Barcode Scanner Mode */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Modo escáner de pistola continuo
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Mantener el foco en el campo de código de barras para pistolas láser de lectura rápida.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.autoBarcodeScannerMode}
                onChange={(e) => setForm({ ...form, autoBarcodeScannerMode: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Beep on barcode scan */}
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Aviso sonoro al escanear código de barras
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Emite un bip de confirmación auditivo cada vez que se detecta un artículo.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.playBeepOnScan}
                onChange={(e) => setForm({ ...form, playBeepOnScan: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Advanced Commercial Inventory Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Margen de Ganancia Sugerido (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={form.suggestedProfitMargin}
                  onChange={(e) => setForm({ ...form, suggestedProfitMargin: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span>
              </div>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Calcula automáticamente el precio de venta sugerido al ingresar el costo de un producto.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Unidad de Medida Predeterminada
              </label>
              <select
                value={form.defaultMeasurementUnit}
                onChange={(e) => setForm({ ...form, defaultMeasurementUnit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="unidades">Unidades (Piezas)</option>
                <option value="kg">Kilogramos (Kg)</option>
                <option value="litros">Litros (Lts)</option>
                <option value="metros">Metros (Mts)</option>
                <option value="packs">Packs / Cajas</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Unidad asignada automáticamente al crear nuevos artículos.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Orden Predeterminado del Catálogo
              </label>
              <select
                value={form.defaultInventorySort}
                onChange={(e) => setForm({ ...form, defaultInventorySort: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="nombre">Alfabético por Nombre (A-Z)</option>
                <option value="codigo">Por Código de Artículo</option>
                <option value="stock_asc">Menor Stock Primero (Prioridad reposición)</option>
                <option value="precio_desc">Mayor Precio Primero</option>
                <option value="reciente">Recientemente Agregados</option>
              </select>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Criterio de ordenación al ingresar a la pantalla de inventario.
              </span>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
}
