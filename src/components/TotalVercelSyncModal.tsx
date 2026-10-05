/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Cloud, 
  Copy, 
  Check, 
  Upload, 
  RefreshCw, 
  Terminal, 
  Sparkles, 
  Database, 
  CheckCircle2, 
  ArrowRight,
  Send,
  Layers,
  Users,
  Wrench,
  FileText,
  DollarSign,
  Package
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { vercelSyncService, VercelSyncSummary } from '../services/vercelSyncService';
import { toast } from 'sonner';

interface TotalVercelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
}

export default function TotalVercelSyncModal({
  isOpen,
  onClose,
  onSyncSuccess
}: TotalVercelSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'import_vercel' | 'backup_file' | 'resync_cloud' | 'export_to_vercel'>('import_vercel');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedExportSnippet, setCopiedExportSnippet] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [lastSummary, setLastSummary] = useState<VercelSyncSummary | null>(null);

  const vercelConsoleCommand = vercelSyncService.getVercelExportCommand();

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(vercelConsoleCommand);
    setCopiedSnippet(true);
    toast.success('Comando copiado al portapapeles');
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const handleCopyExportSnippet = () => {
    const cmd = vercelSyncService.getExportToVercelSnippet();
    if (!cmd) {
      toast.error('No hay datos disponibles para exportar');
      return;
    }
    navigator.clipboard.writeText(cmd);
    setCopiedExportSnippet(true);
    toast.success('Código copiado. Pégalo en la consola de tu app de Vercel');
    setTimeout(() => setCopiedExportSnippet(false), 2500);
  };

  const handleImportTotal = async () => {
    if (!pastedJson.trim()) {
      toast.error('Por favor pega el paquete de datos copiado desde Vercel');
      return;
    }

    setIsProcessing(true);
    try {
      const summary = await vercelSyncService.importTotalVercelData(pastedJson.trim());
      setLastSummary(summary);
      toast.success(
        `¡Sincronización Total exitosa! ${summary.totalClients} clientes, ${summary.totalQuotes} cotizaciones, ${summary.totalOrders} órdenes y ${summary.totalSales} ventas actualizadas.`
      );
      setPastedJson('');
      if (onSyncSuccess) onSyncSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error al procesar la sincronización');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const handleImportBackupFile = async () => {
    if (!fileToUpload) {
      toast.error('Selecciona un archivo JSON de respaldo');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await fileToUpload.text();
      const summary = await vercelSyncService.importTotalVercelData(text);
      setLastSummary(summary);
      toast.success(
        `¡Copia procesada con éxito! ${summary.totalClients} clientes, ${summary.totalQuotes} cotizaciones y ${summary.totalSales} ventas integradas.`
      );
      setFileToUpload(null);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al procesar el archivo: ' + (err?.message || 'Archivo inválido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResyncFromCloud = async () => {
    setIsProcessing(true);
    try {
      const res = await vercelSyncService.resyncEverythingFromSupabase();
      toast.success(`¡Nube refrescada! ${res.clients} clientes, ${res.quotes} cotizaciones, ${res.sales} ventas y ${res.products} productos sincronizados.`);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err: any) {
      toast.error('Error al sincronizar con la nube');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronización Total con Vercel (Todo el Sistema)"
    >
      <div className="space-y-5">
        {/* Banner Explicativo */}
        <div className="bg-gradient-to-r from-amber-50 via-indigo-50/50 to-blue-50 dark:from-amber-950/30 dark:via-indigo-950/20 dark:to-blue-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
            <Cloud className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Sincronización Total Bidireccional</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
              General
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Esta herramienta sincroniza <strong>absolutamente todo</strong> de tu aplicación en Vercel con este entorno y la nube de Supabase: Clientes, Órdenes de Taller, Reparaciones, Cotizaciones, Ventas, Stock, Compras y Caja.
          </p>
        </div>

        {/* Resumen del último resultado si hubo */}
        {lastSummary && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>¡Datos sincronizados y respaldados en la nube con éxito!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span><strong>{lastSummary.totalClients}</strong> Clientes</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span><strong>{lastSummary.totalQuotes}</strong> Cotizaciones</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                <span><strong>{lastSummary.totalOrders + lastSummary.totalRepairQuotes}</strong> Taller</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span><strong>{lastSummary.totalSales}</strong> Ventas</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab selector */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('import_vercel')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'import_vercel'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1-Clic desde Vercel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup_file')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'backup_file'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Respaldo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resync_cloud')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'resync_cloud'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar Nube</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_to_vercel')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'export_to_vercel'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Llevar a Vercel</span>
          </button>
        </div>

        {/* Tab 1: Fast 1-Click Console Copy */}
        {activeTab === 'import_vercel' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>En tu pestaña donde tienes abierto el sistema en Vercel:</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Presiona <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px]">F12</kbd> (o Clic Derecho &rarr; Inspeccionar &rarr; pestaña <strong>Consola</strong>), pega este comando y presiona Enter:
              </p>

              <div className="flex items-center gap-2 bg-gray-900 text-emerald-400 p-2.5 rounded-xl font-mono text-xs border border-gray-700 overflow-x-auto justify-between">
                <code className="text-[11px] truncate">{vercelConsoleCommand}</code>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-sans text-xs flex items-center gap-1 shrink-0 transition-all border border-gray-600"
                >
                  {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                *(Copia instantáneamente todos tus clientes, ventas, cotizaciones, órdenes de taller y configuraciones al portapapeles).*
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Pega aquí el contenido copiado de Vercel:</span>
              </label>
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                rows={4}
                placeholder="Pega aquí el resultado..."
                className="w-full text-xs font-mono p-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <Button
              type="button"
              onClick={handleImportTotal}
              disabled={isProcessing || !pastedJson.trim()}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all text-xs sm:text-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Sincronizar Todo Ahora (Clientes, Órdenes, Ventas, Stock)</span>
            </Button>
          </div>
        )}

        {/* Tab 2: Upload Backup */}
        {activeTab === 'backup_file' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Si descargaste una copia de seguridad en tu sistema de Vercel (<code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">backup_sistema_*.json</code>), selecciónala aquí para sincronizar todos sus módulos:
            </p>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="total-backup-file-input"
              />
              <label
                htmlFor="total-backup-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {fileToUpload ? fileToUpload.name : 'Haz clic para seleccionar el archivo .json de respaldo'}
                </div>
                <div className="text-[10px] text-gray-400">Archivos JSON de respaldo completo del sistema</div>
              </label>
            </div>

            <Button
              type="button"
              onClick={handleImportBackupFile}
              disabled={isProcessing || !fileToUpload}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all text-xs sm:text-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Procesar Archivo y Sincronizar Todo el Sistema</span>
            </Button>
          </div>
        )}

        {/* Tab 3: Re-sync Supabase */}
        {activeTab === 'resync_cloud' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Consulta en tiempo real la base de datos Supabase para descargar y actualizar el inventario, ventas, clientes registrados y cotizaciones:
            </p>

            <Button
              type="button"
              onClick={handleResyncFromCloud}
              disabled={isProcessing}
              variant="outline"
              className="w-full rounded-2xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 font-bold py-3 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Descargar y Refrescar Todo desde Supabase</span>
            </Button>
          </div>
        )}

        {/* Tab 4: Export back to Vercel */}
        {activeTab === 'export_to_vercel' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              ¿Quieres transferir todos los cambios realizados aquí hacia tu versión desplegada en Vercel? Copia este comando y pégalo en la consola de tu app de Vercel:
            </p>

            <Button
              type="button"
              onClick={handleCopyExportSnippet}
              className="w-full rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 transition-all text-xs sm:text-sm"
            >
              {copiedExportSnippet ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copiedExportSnippet ? '¡Comando Copiado!' : 'Copiar Código para Actualizar Vercel'}</span>
            </Button>

            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Instrucciones: En tu app de Vercel presiona <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px]">F12</kbd> &rarr; Consola, pega el código y presiona Enter. Se actualizará con todos tus clientes, presupuestos y órdenes de inmediato.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl px-5 text-xs font-semibold"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
