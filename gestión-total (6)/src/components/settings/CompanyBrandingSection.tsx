/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
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
  Store,
  FileCheck,
  Save,
  HelpCircle
} from 'lucide-react';
import { Button } from '../ui';
import { useSettings, CompanyProfile } from '../../contexts/SettingsContext';
import { toast } from 'sonner';

export function CompanyBrandingSection() {
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

  // Sync state if context changes
  React.useEffect(() => {
    setForm({
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
  }, [companyProfile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleccione una imagen válida (PNG, JPG, WebP o SVG)');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2.5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setForm(prev => ({ ...prev, logoUrl: base64 }));
      toast.success('¡Logotipo cargado! Recuerda hacer clic en "Guardar Cambios de Marca".');
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
      toast.success('¡Identidad y datos de ' + (form.name || 'empresa') + ' guardados con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar los datos de empresa');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-[32px] p-6 sm:p-8 shadow-sm border border-indigo-100 dark:border-indigo-950/40 relative overflow-hidden">
      {/* Background Accent glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Store size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Marca & Identidad Comercial
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                PulseStore
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Configura el nombre de tu negocio, tu logotipo, slogan y datos de contacto para la barra lateral y todos los diseños de cotizaciones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-2xl shadow-md shadow-indigo-600/20 text-xs sm:text-sm flex items-center gap-2 shrink-0"
          >
            <Save size={16} />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 relative z-10">
        
        {/* Row 1: Logo & Basic Identity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Logo Card */}
          <div className="lg:col-span-4 bg-gradient-to-b from-gray-50 to-indigo-50/20 dark:from-gray-900/60 dark:to-indigo-950/20 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/80 flex flex-col items-center text-center">
            <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-3">
              Logotipo de Empresa
            </span>

            <div className="w-32 h-32 rounded-2xl bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 p-2 flex items-center justify-center shadow-inner overflow-hidden mb-3 relative group">
              {form.logoUrl ? (
                <>
                  <img 
                    src={form.logoUrl} 
                    alt="Logo Empresa" 
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1"
                    title="Eliminar logo"
                  >
                    <Trash2 size={18} className="text-red-400" />
                    Quitar logo
                  </button>
                </>
              ) : (
                <div className="text-gray-400 dark:text-gray-500 flex flex-col items-center justify-center p-2">
                  <ImageIcon size={32} className="opacity-40 mb-1" />
                  <span className="text-[10px] font-medium leading-tight">Sin logotipo</span>
                </div>
              )}
            </div>

            <div className="flex flex-col w-full gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/png, image/jpeg, image/webp, image/svg+xml" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs font-bold rounded-xl border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700"
              >
                <Upload size={14} className="mr-1.5 text-indigo-600 dark:text-indigo-400" />
                {form.logoUrl ? 'Cambiar Imagen' : 'Subir Logotipo'}
              </Button>

              <div className="text-[10px] text-gray-400 leading-tight">
                Formatos recomendados: PNG transparente o SVG.
              </div>
            </div>
          </div>

          {/* Business Core Info */}
          <div className="lg:col-span-8 space-y-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider block mb-1.5">
                  Nombre Comercial del Negocio *
                </label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: PulseStore"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider block mb-1.5">
                  CUIT / RUT / Identificación Fiscal
                </label>
                <div className="relative">
                  <FileCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    placeholder="Ej: 30-71829384-9"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-wider block mb-1.5">
                Eslogan o Rubro Principal
              </label>
              <div className="relative">
                <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                <input
                  type="text"
                  value={form.slogan}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  placeholder="Ej: Repuestos, Accesorios & Servicio Técnico Especializado"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Aparece debajo del nombre en las cotizaciones y tickets comerciales.
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Contact & Payment Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
              Teléfono de Contacto
            </label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: +54 9 11 6025-5767"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ej: contacto@pulsestore.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
              Dirección Comercial
            </label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: Av. San Martín 1420"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
              Alias Bancario de Cobro
            </label>
            <div className="relative">
              <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
              <input
                type="text"
                value={form.bankAlias}
                onChange={(e) => setForm({ ...form, bankAlias: e.target.value })}
                placeholder="Ej: PULSESTORE.PAGO"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold uppercase text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

      </form>
    </section>
  );
}
