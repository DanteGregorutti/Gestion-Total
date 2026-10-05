/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  CloudUpload, 
  Download, 
  Upload, 
  RefreshCw, 
  Database, 
  Bot, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  FileText 
} from 'lucide-react';
import { Button } from '../ui';
import { TelegramBotModal } from '../telegram/TelegramBotModal';
import { inventoryService } from '../../services/inventoryService';
import { SUPABASE_URL } from '../../supabase';
import { SUPABASE_SCHEMA_SQL } from '../../data/supabaseSchemaSql';
import { toast } from 'sonner';
import { useSettings } from '../../contexts/SettingsContext';
import TotalVercelSyncModal from '../TotalVercelSyncModal';

export function CloudBackupSettingsSection() {
  const { t } = useSettings();
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchBackups = async () => {
      try {
        const data = await inventoryService.getCloudBackups();
        setCloudBackups(data || []);
      } catch (error) {
        console.error('Error fetching backups:', error);
      }
    };
    fetchBackups();
  }, []);

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
      toast.success(`¡Sincronización completa! Se subieron ${res.productsMigrated} productos, ${res.quotesMigrated} cotizaciones, ${res.clientsMigrated || 0} clientes y ${res.warehousesMigrated} almacenes a Supabase.`);
    } catch (err: any) {
      toast.error('Error al sincronizar datos a Supabase: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await inventoryService.createBackup();
      toast.success(t('backup_success') || 'Copia de seguridad descargada');
    } catch (error) {
      toast.error(t('backup_error') || 'Error al generar copia de seguridad');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsCloudBackingUp(true);
    try {
      await inventoryService.saveBackupToCloud();
      toast.success(t('cloud_backup_success') || 'Copia guardada en la nube');
      const data = await inventoryService.getCloudBackups();
      setCloudBackups(data || []);
    } catch (error) {
      toast.error(t('cloud_backup_error') || 'Error al guardar en la nube');
    } finally {
      setIsCloudBackingUp(false);
    }
  };

  const handleRestoreFromCloud = async (id: string) => {
    if (!confirm('¿Restaurar esta copia de seguridad? Se reemplazarán los datos locales con esta versión.')) return;
    setIsRestoring(true);
    try {
      await inventoryService.restoreFromCloud(id);
      toast.success('Datos restaurados con éxito');
    } catch (error) {
      toast.error('Error al restaurar copia');
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
      toast.success('Copia restaurada correctamente');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error('Error al restaurar archivo');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Telegram Bot Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400">
              <Bot size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bot de Telegram</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Conectado
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Registra ventas y gastos rápidamente desde tu teléfono vía chat
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Usuario: <code className="text-sky-600 dark:text-sky-400 font-mono font-bold">@GestionTotalBot</code>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prueba mandándole: "Venta 2 remeras 15000" o "Gasto 4500 combustible"
            </p>
          </div>

          <Button
            onClick={() => setIsTelegramModalOpen(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-sky-500/20 shrink-0"
          >
            <Bot size={16} className="mr-2" />
            Configurar Bot
          </Button>
        </div>
      </div>

      {/* Supabase PostgreSQL Cloud */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100 dark:border-emerald-950/40 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Supabase Cloud</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Base de datos SQL remota para respaldo permanente
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 space-y-1.5 text-xs sm:text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Servidor Supabase:</span>
            <code className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold select-all break-all">
              {SUPABASE_URL}
            </code>
          </div>
        </div>

        {/* Guía y sincronización */}
        <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Sincronizar Stock y Cotizaciones a Supabase
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sube una réplica actualizada de tus productos, órdenes y cotizaciones a la nube.
              </p>
            </div>
            <Button
              onClick={handleSyncToSupabase}
              isLoading={isSyncingSupabase}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm shrink-0"
            >
              <Upload size={14} className="mr-1.5" />
              {isSyncingSupabase ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </Button>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopySql}
              className="text-xs font-bold rounded-xl"
            >
              {copiedSql ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
              {copiedSql ? '¡Script Copiado!' : 'Copiar Script SQL'}
            </Button>

            <a
              href="https://supabase.com/dashboard/project/zxempgaqylcbdnasqygs/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-xl"
            >
              <ExternalLink size={14} />
              Abrir SQL Editor
            </a>
          </div>
        </div>
      </div>

      {/* Local & Cloud Backups */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <RefreshCw size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Copias de Seguridad (Backup)</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Descarga un archivo JSON de respaldo o restaura información previa
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={handleBackup}
            isLoading={isBackingUp}
            className="flex items-center justify-center gap-2 p-5 rounded-2xl border-2 font-bold"
          >
            <Download size={18} />
            Descargar Backup Local (.json)
          </Button>

          <div className="relative">
            <input 
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleRestore}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isRestoring}
            />
            <Button 
              variant="outline"
              isLoading={isRestoring}
              className="w-full flex items-center justify-center gap-2 p-5 rounded-2xl border-2 font-bold"
            >
              <Upload size={18} />
              Restaurar desde Archivo (.json)
            </Button>
          </div>
        </div>

        <div>
          <Button 
            onClick={handleCloudBackup}
            isLoading={isCloudBackingUp}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20"
          >
            <CloudUpload size={18} />
            Crear Respaldo en la Nube (Firestore)
          </Button>
        </div>

        {/* Backups list */}
        {cloudBackups.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Copias en la nube disponibles ({cloudBackups.length})
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {cloudBackups.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/80 dark:border-gray-800 text-xs">
                  <div className="flex items-center gap-2.5">
                    <FileText size={16} className="text-indigo-500" />
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-200">{b.nombre || 'Copia de seguridad'}</p>
                      <p className="text-[10px] text-gray-400">
                        {b.fecha?.toDate ? b.fecha.toDate().toLocaleString() : new Date(b.fecha).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestoreFromCloud(b.id)}
                    disabled={isRestoring}
                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Vercel Data Migration Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-amber-200 dark:border-amber-900/40 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400">
            <Cloud size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Sincronización con Vercel</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                1 Clic
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Trae clientes, órdenes o respaldos guardados en el navegador de tu dominio en Vercel
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="font-bold text-gray-900 dark:text-white">
              ¿Por qué no se comparten automáticamente los datos de Vercel?
            </div>
            <p>
              Por la seguridad de los navegadores (Same-Origin), cada dominio tiene su almacenamiento aislado. Usa este asistente para importar tus clientes a la nube compartida en 1 segundo.
            </p>
          </div>
          <Button
            onClick={() => setIsVercelModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-amber-600/20 text-xs shrink-0"
          >
            <Cloud size={15} className="mr-1.5" />
            Asistente de Vercel
          </Button>
        </div>
      </div>

      <TelegramBotModal 
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      <TotalVercelSyncModal
        isOpen={isVercelModalOpen}
        onClose={() => setIsVercelModalOpen(false)}
      />
    </div>
  );
}
