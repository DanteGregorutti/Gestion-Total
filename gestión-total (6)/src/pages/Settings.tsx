/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Settings as SettingsIcon, 
  AlertTriangle, 
  RefreshCw, 
  Loader2, 
  Moon, 
  Sun, 
  Download, 
  Upload, 
  Cloud, 
  CloudUpload, 
  FileText, 
  LayoutGrid, 
  Sparkles, 
  TrendingUp,
  Bot,
  Database,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../utils/cn';
import ConfirmationModal from '../components/ConfirmationModal';
import { TelegramBotModal } from '../components/telegram/TelegramBotModal';
import { telegramBot } from '../services/telegramBotManager';
import { inventoryService } from '../services/inventoryService';
import { SUPABASE_URL } from '../supabase';
import { SUPABASE_SCHEMA_SQL } from '../data/supabaseSchemaSql';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

export default function Settings() {
  const { 
    theme, 
    setTheme, 
    t, 
    loading: settingsLoading 
  } = useSettings();

  const [copiedSql, setCopiedSql] = React.useState(false);
  const [showSqlPreview, setShowSqlPreview] = React.useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = React.useState(false);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      toast.success('¡Script SQL copiado! Pegalo en Supabase SQL Editor');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      toast.error('No se pudo copiar el texto');
    }
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await inventoryService.syncAllToSupabase();
      toast.success(`¡Sincronización completa! Se subieron ${res.productsMigrated} productos, ${res.quotesMigrated} cotizaciones y ${res.warehousesMigrated} almacenes a Supabase.`);
    } catch (err: any) {
      toast.error('Error al sincronizar datos a Supabase: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isCloudBackingUp, setIsCloudBackingUp] = React.useState(false);
  const [cloudBackups, setCloudBackups] = React.useState<any[]>([]);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchBackups = async () => {
      try {
        const data = await inventoryService.getCloudBackups();
        setCloudBackups(data);
      } catch (error) {
        console.error('Error fetching backups:', error);
      }
    };
    fetchBackups();
  }, []);

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      await inventoryService.resetUserData();
      toast.success(t('reset_success'));
      setIsResetModalOpen(false);
    } catch (error) {
      toast.error(t('reset_error'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await inventoryService.createBackup();
      toast.success(t('backup_success'));
    } catch (error) {
      toast.error(t('backup_error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsCloudBackingUp(true);
    try {
      await inventoryService.saveBackupToCloud();
      toast.success(t('cloud_backup_success'));
    } catch (error) {
      toast.error(t('cloud_backup_error'));
    } finally {
      setIsCloudBackingUp(false);
    }
  };

  const handleRestoreFromCloud = async (id: string) => {
    if (!confirm(t('confirm_restore_cloud'))) return;
    setIsRestoring(true);
    try {
      await inventoryService.restoreFromCloud(id);
      toast.success(t('restore_success'));
    } catch (error) {
      toast.error(t('restore_error'));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      await inventoryService.restoreBackup(file);
      toast.success(t('restore_success'));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error(t('restore_error'));
    } finally {
      setIsRestoring(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="text-indigo-600" size={32} />
            {t('settings')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('settings_desc')}</p>
        </div>
      </header>

      {/* Appearance */}
      <section className="bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600 dark:text-amber-400">
            {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('appearance')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "flex flex-col items-center gap-4 p-6 rounded-3xl border-2 transition-all",
              theme === 'light'
                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200 dark:hover:border-gray-600"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Sun size={24} />
            </div>
            <span className="font-bold">{t('light_mode')}</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "flex flex-col items-center gap-4 p-6 rounded-3xl border-2 transition-all",
              theme === 'dark'
                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200 dark:hover:border-gray-600"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-indigo-100 flex items-center justify-center">
              <Moon size={24} />
            </div>
            <span className="font-bold">{t('dark_mode')}</span>
          </button>
        </div>
      </section>

      {/* Telegram Bot Integration */}
      <section className="bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400">
              <Bot size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bot de Telegram</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Conectado
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Registrá ventas y gastos al instante desde el celular enviando un mensaje a Telegram
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Usuario del Bot: <code className="text-sky-600 dark:text-sky-400 font-mono font-bold">@GestionTotalBot</code>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mandale mensajes como: "Venta 2 remeras 15000" o "Gasto 4500 nafta"
            </p>
          </div>

          <Button
            onClick={() => setIsTelegramModalOpen(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-3 rounded-2xl shadow-md shadow-sky-500/20 self-start sm:self-auto"
          >
            <Bot size={18} className="mr-2" />
            Abrir Panel del Bot
          </Button>
        </div>
      </section>

      {/* Supabase Cloud Connection */}
      <section className="bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-sm border border-emerald-100 dark:border-emerald-950/40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Supabase Cloud</h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Base de datos PostgreSQL en la nube y persistencia en tiempo real
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-gray-500 dark:text-gray-400 font-medium">URL de Supabase:</span>
              <code className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold select-all break-all">
                {SUPABASE_URL}
              </code>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Project ID:</span>
              <code className="font-mono text-gray-800 dark:text-gray-200 font-semibold select-all">
                zxempgaqylcbdnasqygs
              </code>
            </div>
          </div>

          {/* Guía paso a paso interactiva */}
          <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-4">
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                ¿Cómo activar las tablas en tu proyecto de Supabase?
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Sigue estos 3 pasos rápidos para que tu base de datos quede lista:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Paso 1: Copiar */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Copia el Script SQL</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Contiene la estructura de productos, ventas, cotizaciones, etc.
                  </p>
                </div>
                <Button
                  onClick={handleCopySql}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-sm"
                >
                  {copiedSql ? <Check size={16} /> : <Copy size={16} />}
                  {copiedSql ? '¡Copiado al portapapeles!' : 'Copiar Script SQL'}
                </Button>
              </div>

              {/* Paso 2: Abrir Supabase */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Abrir SQL Editor</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Abre directamente la página de consulta en tu proyecto de Supabase.
                  </p>
                </div>
                <a
                  href="https://supabase.com/dashboard/project/zxempgaqylcbdnasqygs/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm"
                >
                  <ExternalLink size={16} />
                  Abrir SQL Editor en Supabase
                </a>
              </div>
            </div>

            {/* Paso 3: Pegar y RUN */}
            <div className="p-3 bg-white/70 dark:bg-gray-800/70 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">3</span>
              <span>
                En la pestaña de Supabase que se abre, <strong>pega</strong> el código con <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-mono font-bold">Ctrl + V</kbd> y haz clic en el botón verde <strong>RUN</strong> abajo a la derecha. ¡Listo!
              </span>
            </div>

            {/* Paso 4: Sincronizar productos existentes a Supabase */}
            <div className="p-4 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Subir mis productos actuales a Supabase</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Haz clic aquí para transferir todos los productos, cotizaciones y almacenes que ya tenías cargados hacia tu base de datos de Supabase.
                </p>
              </div>
              <Button
                onClick={handleSyncToSupabase}
                isLoading={isSyncingSupabase}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 shrink-0 self-start sm:self-auto"
              >
                <Upload size={16} className="mr-2" />
                {isSyncingSupabase ? 'Subiendo...' : 'Subir productos ahora'}
              </Button>
            </div>

            {/* Ver código en pantalla opcional */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSqlPreview(!showSqlPreview)}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showSqlPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showSqlPreview ? 'Ocultar código SQL' : 'O ver / seleccionar el código SQL aquí mismo'}
              </button>

              {showSqlPreview && (
                <div className="mt-3 relative">
                  <textarea
                    readOnly
                    value={SUPABASE_SCHEMA_SQL}
                    rows={10}
                    className="w-full font-mono text-xs p-3 rounded-xl bg-gray-900 text-emerald-300 border border-gray-700 focus:outline-none resize-y"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    Haz clic en el cuadro para seleccionar todo el texto.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <RefreshCw size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('backup_restore')}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline"
              onClick={handleBackup}
              isLoading={isBackingUp}
              className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 font-bold"
            >
              <Download size={20} />
              {t('backup')}
            </Button>
            
            <div className="relative">
              <input 
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isRestoring}
              />
              <Button 
                variant="outline"
                isLoading={isRestoring}
                className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 font-bold"
              >
                <Upload size={20} />
                {t('restore')}
              </Button>
            </div>
          </div>

          <Button 
            onClick={handleCloudBackup}
            isLoading={isCloudBackingUp}
            className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20"
          >
            <CloudUpload size={20} />
            {t('backup_cloud')}
          </Button>
        </div>
      </section>

      {/* Cloud Backups List */}
      <section className="bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Cloud size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('cloud_backups')}</h2>
        </div>

        <div className="space-y-3">
          {cloudBackups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
              <Cloud size={40} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_cloud_backups')}</p>
            </div>
          ) : (
            cloudBackups.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-white dark:bg-gray-700 rounded-xl shadow-sm">
                    <FileText size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{backup.nombre || 'Copia de Seguridad'}</p>
                    <p className="text-xs text-gray-500">
                      {backup.fecha?.toDate ? backup.fecha.toDate().toLocaleString() : new Date(backup.fecha).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRestoreFromCloud(backup.id)}
                  disabled={isRestoring}
                  className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold"
                >
                  {t('restore')}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-rose-50/50 dark:bg-rose-900/10 rounded-[32px] p-8 border border-rose-100 dark:border-rose-900/20">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-rose-900 dark:text-rose-100">{t('danger_zone')}</h2>
            <p className="text-sm text-rose-600/70 dark:text-rose-400/70">{t('reset_desc')}</p>
          </div>
        </div>

        <Button 
          variant="outline"
          onClick={() => setIsResetModalOpen(true)}
          className="w-full md:w-auto px-8 py-4 border-2 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-2xl font-bold transition-all"
        >
          {t('reset_btn')}
        </Button>
      </section>

      <ConfirmationModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetData}
        title={t('confirm_reset_title')}
        message={t('confirm_reset_msg')}
        confirmLabel={t('confirm_reset_btn')}
        isLoading={isResetting}
      />

      <TelegramBotModal 
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
}
