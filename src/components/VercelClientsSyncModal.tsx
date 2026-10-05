/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CloudDownload, 
  Copy, 
  Check, 
  Upload, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Terminal, 
  RefreshCw,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';

interface VercelClientsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export default function VercelClientsSyncModal({
  isOpen,
  onClose,
  onSyncComplete
}: VercelClientsSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'console' | 'backup' | 'rescan' | 'sql'>('console');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const consoleCommand = `copy(localStorage.getItem('clients'))`;

  const sqlSnippet = `-- Ejecutar en Supabase Dashboard -> SQL Editor -> New Query -> Run
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar permisos de lectura y escritura
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public.clients FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(consoleCommand);
    setCopiedSnippet(true);
    toast.success('Comando copiado al portapapeles');
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSnippet);
    setCopiedSql(true);
    toast.success('Script SQL copiado');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleImportPasted = async () => {
    if (!pastedJson.trim()) {
      toast.error('Por favor pega el texto copiado de Vercel');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await inventoryService.importClientsFromVercel(pastedJson.trim());
      toast.success(`¡Éxito! Se sincronizaron ${result.added} nuevos clientes (${result.total} en total) y se guardaron en la nube.`);
      setPastedJson('');
      if (onSyncComplete) onSyncComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error al procesar los datos de clientes');
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
      const result = await inventoryService.importClientsFromVercel(text);
      toast.success(`¡Copia procesada! Se sincronizaron ${result.added} clientes (${result.total} en total).`);
      setFileToUpload(null);
      if (onSyncComplete) onSyncComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al procesar el archivo de respaldo: ' + (err?.message || 'Archivo inválido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRescanSupabase = async () => {
    setIsProcessing(true);
    try {
      const freshClients = await inventoryService.getClients();
      toast.success(`¡Sincronización completa! Se encontraron ${freshClients.length} clientes en el sistema.`);
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      toast.error('Error al re-escanear datos de la nube');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronizar y Traer Clientes desde Vercel"
    >
      <div className="space-y-5">
        {/* Info banner explaining origin separation */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>¿Por qué no estaban aquí directamente tus clientes de Vercel?</span>
          </div>
          <p className="leading-relaxed">
            Por seguridad, los navegadores aíslan los datos locales (<code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">localStorage</code>) entre cada dominio web (<span className="font-semibold underline">tu-app.vercel.app</span> vs <span className="font-semibold underline">este entorno</span>). Además, en tu base de datos Supabase la tabla directa de clientes no estaba creada, guardándose únicamente en tu navegador de Vercel.
          </p>
          <div className="flex items-center gap-2 pt-1 font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>¡Ya auto-recuperamos tus clientes vinculados a ventas y cotizaciones (Arena Pilates, Club de Amigas, etc.)!</span>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'console'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1-Clic desde Vercel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Respaldo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rescan')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'rescan'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-escanear Nube</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'sql'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Supabase</span>
          </button>
        </div>

        {/* Tab 1: Fast 1-Click Console Copy */}
        {activeTab === 'console' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>En tu pestaña de Vercel, copia tus clientes con 1 comando:</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Abre la consola en tu app de Vercel (<kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px]">F12</kbd> o Clic Derecho &rarr; Inspeccionar &rarr; pestaña <strong>Consola</strong>) y ejecuta:
              </p>

              <div className="flex items-center gap-2 bg-gray-900 text-emerald-400 p-2.5 rounded-xl font-mono text-xs border border-gray-700 overflow-x-auto justify-between">
                <code>{consoleCommand}</code>
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
                *(Este comando copia automáticamente toda la lista de clientes al portapapeles).*
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Pega aquí los clientes copiados de Vercel:</span>
              </label>
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                rows={4}
                placeholder='Pega aquí (ej: [{"id": "...", "nombre": "Juan Pérez", "telefono": "..."}])'
                className="w-full text-xs font-mono p-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <Button
              type="button"
              onClick={handleImportPasted}
              disabled={isProcessing || !pastedJson.trim()}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all text-xs sm:text-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Importar y Guardar en la Nube Permanente</span>
            </Button>
          </div>
        )}

        {/* Tab 2: Upload backup file */}
        {activeTab === 'backup' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Si en tu app de Vercel fuiste a <strong>Configuración &rarr; Copia de Seguridad</strong> y descargaste un archivo <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">backup_sistema_*.json</code>, selecciónalo aquí para extraer todos tus clientes y subirlos a la nube:
            </p>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {fileToUpload ? fileToUpload.name : 'Haz clic para seleccionar tu archivo de respaldo (.json)'}
                </div>
                <div className="text-[10px] text-gray-400">Archivos JSON de copia del sistema</div>
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
              <span>Procesar Archivo y Sincronizar Clientes</span>
            </Button>
          </div>
        )}

        {/* Tab 3: Re-scan Supabase Quotes & Sales */}
        {activeTab === 'rescan' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              La app escanea automáticamente todas tus ventas y cotizaciones guardadas en Supabase para registrar cualquier cliente existente. Haz clic para forzar un re-escaneo completo de la nube ahora:
            </p>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Clientes detectados automáticamente en tu base de datos:</span>
              </div>
              <ul className="text-xs text-emerald-700 dark:text-emerald-300 list-disc list-inside space-y-0.5 pl-1">
                <li>Arena Pilates (de Ventas y Cotizaciones)</li>
                <li>Club de Amigas Pilates (de Cotizaciones)</li>
                <li>Cialo Espacio Vital (de Cotizaciones)</li>
                <li>Paraiso By Carmela (de Cotizaciones)</li>
              </ul>
            </div>

            <Button
              type="button"
              onClick={handleRescanSupabase}
              disabled={isProcessing}
              variant="outline"
              className="w-full rounded-2xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 font-bold py-3 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Re-escanear Clientes desde Ventas y Cotizaciones</span>
            </Button>
          </div>
        )}

        {/* Tab 4: SQL for Supabase */}
        {activeTab === 'sql' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Para tener la tabla nativa de clientes en Supabase de forma permanente, puedes copiar y ejecutar este código SQL en tu panel de Supabase:
            </p>

            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-gray-800">
                {sqlSnippet}
              </pre>
              <button
                type="button"
                onClick={handleCopySql}
                className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-sans flex items-center gap-1 border border-gray-700 shadow-sm"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Pasos: Abre tu proyecto en <strong>supabase.com &rarr; SQL Editor &rarr; New Query</strong>, pega el código y presiona <strong>Run</strong>.
            </div>
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
