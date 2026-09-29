/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Smartphone, 
  Monitor, 
  Volume2, 
  VolumeX, 
  LayoutGrid, 
  Compass, 
  Save, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { Button } from '../ui';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function InterfaceSettingsSection() {
  const { 
    theme, 
    setTheme, 
    mobileCompactMode, 
    setMobileCompactMode, 
    appSettings, 
    updateAppSettings 
  } = useSettings();

  const [form, setForm] = useState({
    defaultStartPage: appSettings.defaultStartPage || '/ventas',
    accentColor: appSettings.accentColor || 'indigo',
    enableSoundEffects: appSettings.enableSoundEffects ?? true,
    compactCardsView: appSettings.compactCardsView ?? false,
    showSystemVersionBadge: appSettings.showSystemVersionBadge ?? true,
    sidebarModules: {
      dashboard: appSettings.sidebarModules?.dashboard ?? true,
      sales: appSettings.sidebarModules?.sales ?? true,
      inventory: appSettings.sidebarModules?.inventory ?? true,
      workshop: appSettings.sidebarModules?.workshop ?? true,
      purchases: appSettings.sidebarModules?.purchases ?? true,
      finances: appSettings.sidebarModules?.finances ?? true,
      warehouses: appSettings.sidebarModules?.warehouses ?? true,
    }
  });

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm({
      defaultStartPage: appSettings.defaultStartPage || '/ventas',
      accentColor: appSettings.accentColor || 'indigo',
      enableSoundEffects: appSettings.enableSoundEffects ?? true,
      compactCardsView: appSettings.compactCardsView ?? false,
      showSystemVersionBadge: appSettings.showSystemVersionBadge ?? true,
      sidebarModules: {
        dashboard: appSettings.sidebarModules?.dashboard ?? true,
        sales: appSettings.sidebarModules?.sales ?? true,
        inventory: appSettings.sidebarModules?.inventory ?? true,
        workshop: appSettings.sidebarModules?.workshop ?? true,
        purchases: appSettings.sidebarModules?.purchases ?? true,
        finances: appSettings.sidebarModules?.finances ?? true,
        warehouses: appSettings.sidebarModules?.warehouses ?? true,
      }
    });
  }, [appSettings]);

  const handleToggleModule = (key: keyof typeof form.sidebarModules) => {
    setForm(prev => ({
      ...prev,
      sidebarModules: {
        ...prev.sidebarModules,
        [key]: !prev.sidebarModules[key]
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        defaultStartPage: form.defaultStartPage,
        accentColor: form.accentColor as any,
        enableSoundEffects: Boolean(form.enableSoundEffects),
        compactCardsView: Boolean(form.compactCardsView),
        showSystemVersionBadge: Boolean(form.showSystemVersionBadge),
        sidebarModules: form.sidebarModules
      });
      toast.success('¡Preferencias de Interfaz & Pantalla guardadas con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const startPagesList = [
    { path: '/ventas', title: 'Ventas & Cotizar', desc: 'Directo al mostrador de ventas y presupuestos (Recomendado)' },
    { path: '/', title: 'Panel de Control', desc: 'Resumen general, métricas del día y gráficos' },
    { path: '/taller', title: 'Taller & Servicios', desc: 'Recepción y órdenes de trabajo en taller' },
    { path: '/inventario', title: 'Inventario', desc: 'Catálogo de stock, precios y búsqueda de repuestos' }
  ];

  const accentColors = [
    { id: 'indigo', name: 'Índigo Pulse', colorClass: 'bg-indigo-600', ringClass: 'ring-indigo-600' },
    { id: 'purple', name: 'Púrpura VIP', colorClass: 'bg-purple-600', ringClass: 'ring-purple-600' },
    { id: 'emerald', name: 'Esmeralda Pro', colorClass: 'bg-emerald-600', ringClass: 'ring-emerald-600' },
    { id: 'blue', name: 'Azul Océano', colorClass: 'bg-blue-600', ringClass: 'ring-blue-600' },
    { id: 'amber', name: 'Ámbar Gold', colorClass: 'bg-amber-600', ringClass: 'ring-amber-600' },
    { id: 'rose', name: 'Rosa Coral', colorClass: 'bg-rose-600', ringClass: 'ring-rose-600' },
    { id: 'cyan', name: 'Cian Neón', colorClass: 'bg-cyan-600', ringClass: 'ring-cyan-600' },
    { id: 'crimson', name: 'Carmesí Taller', colorClass: 'bg-red-600', ringClass: 'ring-red-600' },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-pink-50 dark:bg-pink-950/40 rounded-2xl text-pink-600 dark:text-pink-400">
              <Palette size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Apariencia & Pantalla
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Ajusta el tema visual, tamaño de pantalla, pantalla de inicio y alertas audibles
              </p>
            </div>
          </div>

          <Button
            type="submit"
            isLoading={isSaving}
            className="self-start sm:self-auto bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-pink-600/20"
          >
            <Save size={16} className="mr-2" />
            Guardar Cambios
          </Button>
        </div>

        {/* Theme: Light vs Dark */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Sun size={14} className="text-amber-500" />
            Tema Visual
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                theme === 'dark'
                  ? 'bg-indigo-950/40 border-indigo-500 text-white ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gray-900 text-indigo-400 flex items-center justify-center shrink-0 border border-gray-700">
                <Moon size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Modo Oscuro (Predeterminado)</span>
                  {theme === 'dark' && <Check size={16} className="text-indigo-400" />}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fondo navy profundo, descanso visual y menor consumo de batería
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                theme === 'light'
                  ? 'bg-amber-50/50 border-amber-500 text-gray-900 ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <Sun size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Modo Claro</span>
                  {theme === 'light' && <Check size={16} className="text-amber-600" />}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fondo blanco limpio para ambientes de trabajo muy iluminados
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Display Density: Mobile vs Desktop */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Monitor size={14} className="text-indigo-500" />
            Densidad de Pantalla Predeterminada
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMobileCompactMode(true)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                mobileCompactMode
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-white ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Smartphone size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Modo Celular (Optimizado)</span>
                  {mobileCompactMode && <Check size={16} className="text-emerald-500" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Botones grandes, navegación táctil y vistas verticales optimizadas
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMobileCompactMode(false)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                !mobileCompactMode
                  ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-white ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <Monitor size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Modo Computadora (PC)</span>
                  {!mobileCompactMode && <Check size={16} className="text-indigo-500" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tablas completas de ancho amplio para pantallas de escritorio y monitores
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Default Startup Page */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Compass size={14} className="text-blue-500" />
            Página de Inicio al Abrir la Aplicación
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {startPagesList.map((pg) => {
              const isSelected = form.defaultStartPage === pg.path;
              return (
                <button
                  key={pg.path}
                  type="button"
                  onClick={() => setForm({ ...form, defaultStartPage: pg.path })}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                      : 'bg-gray-50/50 dark:bg-gray-900/40 border-gray-200/80 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check size={12} />
                    </div>
                  )}
                  <p className="font-bold text-xs text-gray-900 dark:text-white pr-6">
                    {pg.title}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {pg.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visible Modules in Sidebar */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Módulos Activos en el Menú Lateral
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Personaliza qué secciones del sistema se muestran en tu barra de navegación lateral según las necesidades de tu negocio.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              { key: 'dashboard', label: 'Panel de Control', desc: 'Métricas, gráficos y KPIs' },
              { key: 'sales', label: 'Ventas & Cotizaciones', desc: 'Mostrador, presupuestos y clientes' },
              { key: 'inventory', label: 'Inventario & Stock', desc: 'Artículos, precios y códigos' },
              { key: 'workshop', label: 'Taller & Servicios', desc: 'Órdenes mecánicas y reparaciones' },
              { key: 'purchases', label: 'Compras & Proveedores', desc: 'Ingreso de mercadería y costos' },
              { key: 'finances', label: 'Dinero & Finanzas', desc: 'Arqueo de caja y gastos diarios' },
              { key: 'warehouses', label: 'Almacenes & Depósitos', desc: 'Distribución y ubicaciones' },
            ].map(mod => {
              const isEnabled = form.sidebarModules[mod.key as keyof typeof form.sidebarModules];
              return (
                <div
                  key={mod.key}
                  onClick={() => handleToggleModule(mod.key as any)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isEnabled
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 shadow-2xs'
                      : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/80 dark:border-gray-800 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">{mod.label}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{mod.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Sound & System Badges */}
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Volume2 size={14} className="text-amber-500" />
            Sonidos y Comportamiento Visual
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Sonidos de confirmación y escaneo
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Emite un pitido agradable al registrar ventas o escanear productos.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.enableSoundEffects}
                onChange={(e) => setForm({ ...form, enableSoundEffects: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer">
              <div className="pr-4">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Mostrar versión del sistema en ajustes
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                  Visualiza el badge con la versión instalada y el historial de cambios.
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.showSystemVersionBadge}
                onChange={(e) => setForm({ ...form, showSystemVersionBadge: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

      </div>
    </form>
  );
}
