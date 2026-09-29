/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Building2, 
  FileText, 
  Package, 
  Wrench, 
  Wallet, 
  Palette, 
  Cloud, 
  ShieldAlert, 
  Search, 
  RotateCcw, 
  Sparkles, 
  Check, 
  SlidersHorizontal,
  Layers,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../utils/cn';
import ConfirmationModal from '../components/ConfirmationModal';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

// Settings Sections
import { CompanyBrandingSection } from '../components/settings/CompanyBrandingSection';
import { SalesQuotesSettingsSection } from '../components/settings/SalesQuotesSettingsSection';
import { InventoryStockSettingsSection } from '../components/settings/InventoryStockSettingsSection';
import { WorkshopSettingsSection } from '../components/settings/WorkshopSettingsSection';
import { CashPaymentsSettingsSection } from '../components/settings/CashPaymentsSettingsSection';
import { AiSettingsSection } from '../components/settings/AiSettingsSection';
import { InterfaceSettingsSection } from '../components/settings/InterfaceSettingsSection';
import { CloudBackupSettingsSection } from '../components/settings/CloudBackupSettingsSection';
import { SystemVersionSection } from '../components/settings/SystemVersionSection';

type SettingsTab = 
  | 'empresa' 
  | 'ventas' 
  | 'inventario' 
  | 'taller' 
  | 'caja' 
  | 'ia'
  | 'interfaz' 
  | 'nube' 
  | 'sistema';

export default function Settings() {
  const { 
    t, 
    resetAppSettingsToDefault 
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>('empresa');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [isResetConfigModalOpen, setIsResetConfigModalOpen] = useState(false);
  const [isResettingConfig, setIsResettingConfig] = useState(false);

  const tabs = [
    { 
      id: 'empresa' as const, 
      label: 'Empresa & Marca', 
      icon: Building2, 
      desc: 'Logo, nombre comercial, CUIT y datos bancarios',
      keywords: ['empresa', 'logo', 'marca', 'cuit', 'alias', 'cbu', 'banco', 'slogan', 'nombre']
    },
    { 
      id: 'ventas' as const, 
      label: 'Ventas & Cotizaciones', 
      icon: FileText, 
      desc: 'Moneda, validez de presupuestos, flete, comprobantes',
      keywords: ['ventas', 'cotizaciones', 'presupuesto', 'moneda', 'validez', 'envio', 'flete', 'recibo', 'ticket', 'whatsapp', 'descuento']
    },
    { 
      id: 'inventario' as const, 
      label: 'Inventario & Stock', 
      icon: Package, 
      desc: 'Stock bajo, venta sin stock, costos y pistola de código de barras',
      keywords: ['inventario', 'stock', 'alerta', 'minimo', 'preventa', 'costo', 'ganancia', 'escaner', 'codigo de barras']
    },
    { 
      id: 'taller' as const, 
      label: 'Taller & Servicios', 
      icon: Wrench, 
      desc: 'Garantías de reparación, cláusulas de ingreso y órdenes',
      keywords: ['taller', 'reparacion', 'garantia', 'orden de trabajo', 'diagnostico', 'mecanico', 'prioridad', 'whatsapp']
    },
    { 
      id: 'caja' as const, 
      label: 'Caja & Pagos', 
      icon: Wallet, 
      desc: 'Medios de cobro activos, apertura de turno y fondo inicial',
      keywords: ['caja', 'pagos', 'efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'cuenta corriente', 'turno']
    },
    { 
      id: 'ia' as const, 
      label: 'Inteligencia Artificial (IA)', 
      icon: Sparkles, 
      desc: 'Clave Gemini, latencia en Vercel, modelos y asistente inteligente',
      keywords: ['ia', 'ai', 'gemini', 'asistente', 'clave', 'api', 'modelo', 'velocidad', 'lenta', 'vercel', 'robot']
    },
    { 
      id: 'interfaz' as const, 
      label: 'Apariencia & Pantalla', 
      icon: Palette, 
      desc: 'Modo oscuro/claro, modo PC/celular, página de inicio y sonidos',
      keywords: ['apariencia', 'pantalla', 'tema', 'oscuro', 'claro', 'celular', 'pc', 'inicio', 'sonido']
    },
    { 
      id: 'nube' as const, 
      label: 'Copias & Nube', 
      icon: Cloud, 
      desc: 'Copias de seguridad, Supabase SQL y Bot de Telegram',
      keywords: ['nube', 'backup', 'copia de seguridad', 'restaurar', 'supabase', 'telegram', 'bot']
    },
    { 
      id: 'sistema' as const, 
      label: 'Sistema & Datos', 
      icon: ShieldAlert, 
      desc: 'Versión del sistema, historial y reinicio de prueba',
      keywords: ['sistema', 'version', 'historial', 'reiniciar', 'peligro', 'datos']
    }
  ];

  // Filter tabs if user searches
  const filteredTabs = tabs.filter(tab => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const matchLabel = tab.label.toLowerCase().includes(term);
    const matchDesc = tab.desc.toLowerCase().includes(term);
    const matchKeywords = tab.keywords.some(k => k.toLowerCase().includes(term));
    return matchLabel || matchDesc || matchKeywords;
  });

  const handleResetUserData = async () => {
    setIsResettingData(true);
    try {
      await inventoryService.resetUserData();
      toast.success(t('reset_success') || 'Datos reiniciados con éxito');
      setIsResetDataModalOpen(false);
    } catch (error) {
      toast.error(t('reset_error') || 'Error al reiniciar los datos');
    } finally {
      setIsResettingData(false);
    }
  };

  const handleResetAppSettings = async () => {
    setIsResettingConfig(true);
    try {
      await resetAppSettingsToDefault();
      toast.success('Configuraciones restablecidas a los valores de fábrica');
      setIsResetConfigModalOpen(false);
    } catch (err) {
      toast.error('Error al restablecer la configuración');
    } finally {
      setIsResettingConfig(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
            <SlidersHorizontal size={14} />
            <span>Panel de Configuración Integral</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span>Configuración del Sistema</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              100% Personalizable
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Ajusta todos los parámetros de tu negocio, moneda, cotizaciones, stock, taller, medios de pago y apariencia.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfigModalOpen(true)}
            className="text-xs font-bold rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            title="Restablece las opciones de ventas, stock y taller a sus valores originales"
          >
            <RotateCcw size={14} className="mr-1.5" />
            Restablecer Opciones
          </Button>
        </div>
      </header>

      {/* Global Setting Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cualquier ajuste (ej: stock bajo, moneda, garantía, recibo, whatsapp, caja, logo...)"
          className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* Navigation Pills / Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {filteredTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (searchTerm) setSearchTerm('');
              }}
              className={cn(
                "p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 relative group",
                isActive 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20" 
                  : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
              )}
            >
              <IconComp size={18} className={cn("transition-transform group-hover:scale-110", isActive ? "text-white" : "text-indigo-600 dark:text-indigo-400")} />
              <span className="text-[11px] font-bold tracking-tight leading-tight line-clamp-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div className="space-y-6">
        {activeTab === 'empresa' && <CompanyBrandingSection />}
        {activeTab === 'ventas' && <SalesQuotesSettingsSection />}
        {activeTab === 'inventario' && <InventoryStockSettingsSection />}
        {activeTab === 'taller' && <WorkshopSettingsSection />}
        {activeTab === 'caja' && <CashPaymentsSettingsSection />}
        {activeTab === 'ia' && <AiSettingsSection />}
        {activeTab === 'interfaz' && <InterfaceSettingsSection />}
        {activeTab === 'nube' && <CloudBackupSettingsSection />}

        {activeTab === 'sistema' && (
          <div className="space-y-6">
            <SystemVersionSection />

            {/* Danger Zone */}
            <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-3xl p-6 sm:p-8 border border-rose-200/80 dark:border-rose-900/40 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-2xl text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-rose-900 dark:text-rose-100">
                    Zona de Peligro (Reinicio de Base de Datos)
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-600/80 dark:text-rose-400/80">
                    Borra todos los productos, ventas, cotizaciones, órdenes de taller y clientes de prueba.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  variant="outline"
                  onClick={() => setIsResetDataModalOpen(true)}
                  className="px-6 py-3 border-2 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl font-bold transition-all text-xs"
                >
                  <AlertTriangle size={15} className="mr-2" />
                  Reiniciar todos los datos de prueba
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Reset Data */}
      <ConfirmationModal 
        isOpen={isResetDataModalOpen}
        onClose={() => setIsResetDataModalOpen(false)}
        onConfirm={handleResetUserData}
        title="¿Reiniciar todos los datos de prueba?"
        message="Esta acción eliminará de forma irreversible tus productos cargados, ventas, compras, cotizaciones y órdenes de trabajo. No podrás recuperar esta información a menos que tengas un backup."
        confirmLabel="Sí, reiniciar todo"
        isLoading={isResettingData}
      />

      {/* Confirmation Modal: Reset Config */}
      <ConfirmationModal 
        isOpen={isResetConfigModalOpen}
        onClose={() => setIsResetConfigModalOpen(false)}
        onConfirm={handleResetAppSettings}
        title="¿Restablecer configuraciones a valores de fábrica?"
        message="Se restablecerán los días de validez por defecto, monedas, plantillas de texto y reglas de stock a los valores originales. Tu inventario y tus ventas NO se borrarán."
        confirmLabel="Restablecer opciones"
        isLoading={isResettingConfig}
      />

    </div>
  );
}
