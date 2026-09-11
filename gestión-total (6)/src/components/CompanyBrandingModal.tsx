/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  X, 
  Building2, 
  Upload, 
  Trash2, 
  Check, 
  Image as ImageIcon, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Sparkles,
  Store
} from 'lucide-react';
import { Button } from './ui';
import { useSettings, CompanyProfile } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface CompanyBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyBrandingModal({ isOpen, onClose }: CompanyBrandingModalProps) {
  const { companyProfile, updateCompanyProfile } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CompanyProfile>({
    name: companyProfile.name || 'PulseStore',
    logoUrl: companyProfile.logoUrl || '',
    slogan: companyProfile.slogan || 'Venta de Accesorios, Repuestos & Taller',
    phone: companyProfile.phone || '',
    email: companyProfile.email || '',
    address: companyProfile.address || '',
    taxId: companyProfile.taxId || '',
    bankAlias: companyProfile.bankAlias || 'PULSESTORE.PAGO',
    bankCbu: companyProfile.bankCbu || ''
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleccione un archivo de imagen válido (PNG, JPG, WebP o SVG)');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2.5MB para garantizar impresiones y carga rápidas');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setForm(prev => ({ ...prev, logoUrl: base64 }));
      toast.success('Logotipo cargado correctamente. Haz clic en "Guardar y Aplicar" para confirmar');
    };
    reader.onerror = () => {
      toast.error('Error al procesar la imagen');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateCompanyProfile(form);
      toast.success('¡Perfil de empresa y logotipo guardados correctamente!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar los datos de la empresa');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 dark:border-gray-800 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:px-6 sm:py-4 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <Store size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight flex items-center gap-2">
                Identidad de Empresa & Logo
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  Branding
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Personaliza cómo se verá PulseStore en presupuestos, tickets y la barra lateral
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Logo Upload Box */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider flex items-center gap-1.5">
              <ImageIcon size={14} className="text-indigo-600 dark:text-indigo-400" />
              Logotipo Comercial (Para Cotizaciones e Interfaz)
            </label>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              {/* Preview Thumbnail */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {form.logoUrl ? (
                  <img 
                    src={form.logoUrl} 
                    alt="Logo preview" 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <div className="text-center p-2 text-gray-400">
                    <Store className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <span className="text-[10px] leading-tight block">Sin logo</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/png, image/jpeg, image/webp, image/svg+xml" 
                  onChange={handleImageUpload}
                  className="hidden" 
                />
                
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl font-bold flex items-center gap-1.5 text-xs"
                  >
                    <Upload size={14} />
                    {form.logoUrl ? 'Cambiar Logotipo' : 'Subir Logotipo'}
                  </Button>

                  {form.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="rounded-xl font-semibold text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Quitar
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-gray-400">
                  Recomendado: PNG o JPG con fondo transparente o blanco. Aparecerá en el encabezado de tus cotizaciones y en la barra lateral.
                </p>
              </div>
            </div>
          </div>

          {/* Company Name & Slogan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5">
                Nombre del Negocio / Empresa *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: PulseStore"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5">
                Slogan / Rubro Comercial
              </label>
              <input
                type="text"
                value={form.slogan || ''}
                onChange={e => setForm(prev => ({ ...prev, slogan: e.target.value }))}
                placeholder="Ej: Venta de Accesorios, Repuestos & Taller"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5 flex items-center gap-1">
                <Phone size={13} className="text-gray-400" />
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Ej: +54 9 11 6025-5767"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5 flex items-center gap-1">
                <Mail size={13} className="text-gray-400" />
                Email Comercial
              </label>
              <input
                type="email"
                value={form.email || ''}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Ej: pulsestore07@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Address & Tax ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                Dirección / Sucursal
              </label>
              <input
                type="text"
                value={form.address || ''}
                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ej: Av. Principal 1234, Local 2"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider mb-1.5">
                CUIT / Identificación Fiscal (Opcional)
              </label>
              <input
                type="text"
                value={form.taxId || ''}
                onChange={e => setForm(prev => ({ ...prev, taxId: e.target.value }))}
                placeholder="Ej: 20-12345678-9"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Bank Alias for Quotes */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                Datos de Cobro Bancario (Se imprimen en la cotización)
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Alias de Transferencia
                </label>
                <input
                  type="text"
                  value={form.bankAlias || ''}
                  onChange={e => setForm(prev => ({ ...prev, bankAlias: e.target.value.toUpperCase() }))}
                  placeholder="Ej: PULSESTORE.PAGO"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  CBU o Banco (Opcional)
                </label>
                <input
                  type="text"
                  value={form.bankCbu || ''}
                  onChange={e => setForm(prev => ({ ...prev, bankCbu: e.target.value }))}
                  placeholder="Ej: Santander / Mercado Pago"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <p className="text-[10.5px] text-amber-700 dark:text-amber-400">
              Al emitir un presupuesto VIP o formal, tus clientes verán este Alias para pagar al instante por transferencia.
            </p>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0">
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
              disabled={isSaving}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Check size={16} />
              {isSaving ? 'Guardando...' : 'Guardar y Aplicar Cambios'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
