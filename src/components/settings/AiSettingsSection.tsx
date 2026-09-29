/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  Key, 
  Zap, 
  Cpu, 
  Sliders, 
  Check, 
  ExternalLink, 
  Save, 
  Eye, 
  EyeOff, 
  Clock, 
  Gauge, 
  Bot, 
  Activity,
  Layers,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Button, Input } from '../ui';
import { useSettings, AppSettings } from '../../contexts/SettingsContext';
import { geminiService } from '../../services/geminiService';
import { toast } from 'sonner';

export function AiSettingsSection() {
  const { appSettings, updateAppSettings } = useSettings();

  const [form, setForm] = useState({
    geminiApiKey: appSettings.geminiApiKey || '',
    aiModel: appSettings.aiModel || 'gemini-3.8-flash',
    aiPerformanceMode: appSettings.aiPerformanceMode || 'fast',
    aiTemperature: typeof appSettings.aiTemperature === 'number' ? appSettings.aiTemperature : 0.3,
    aiResponseStyle: appSettings.aiResponseStyle || 'balanced',
    aiSalesHistoryDays: appSettings.aiSalesHistoryDays || 30,
    aiAssistantVisible: appSettings.aiAssistantVisible ?? true,
    aiWelcomeMessage: appSettings.aiWelcomeMessage || '¡Hola! Soy tu asistente de negocios inteligente. ¿En qué puedo ayudarte hoy?'
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    source: string;
    model: string;
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setForm({
      geminiApiKey: appSettings.geminiApiKey || '',
      aiModel: appSettings.aiModel || 'gemini-3.8-flash',
      aiPerformanceMode: appSettings.aiPerformanceMode || 'fast',
      aiTemperature: typeof appSettings.aiTemperature === 'number' ? appSettings.aiTemperature : 0.3,
      aiResponseStyle: appSettings.aiResponseStyle || 'balanced',
      aiSalesHistoryDays: appSettings.aiSalesHistoryDays || 30,
      aiAssistantVisible: appSettings.aiAssistantVisible ?? true,
      aiWelcomeMessage: appSettings.aiWelcomeMessage || '¡Hola! Soy tu asistente de negocios inteligente. ¿En qué puedo ayudarte hoy?'
    });
  }, [appSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAppSettings({
        geminiApiKey: form.geminiApiKey.trim(),
        aiModel: form.aiModel,
        aiPerformanceMode: form.aiPerformanceMode,
        aiTemperature: Number(form.aiTemperature),
        aiResponseStyle: form.aiResponseStyle,
        aiSalesHistoryDays: Number(form.aiSalesHistoryDays) || 30,
        aiAssistantVisible: Boolean(form.aiAssistantVisible),
        aiWelcomeMessage: form.aiWelcomeMessage.trim()
      });
      toast.success('¡Configuración de Inteligencia Artificial guardada con éxito!');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar la configuración de IA');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await geminiService.testConnection(form.geminiApiKey, form.aiModel);
      setTestResult(result);
      if (result.ok) {
        toast.success(`⚡ Conexión exitosa: IA respondió en ${result.latencyMs}ms`);
      } else {
        toast.error(`Error en la prueba: ${result.message}`);
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        latencyMs: 0,
        source: 'direct',
        model: form.aiModel,
        message: e?.message || 'Error desconocido al probar conexión'
      });
      toast.error('Error al ejecutar la prueba de conexión');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-violet-50 dark:bg-violet-950/40 rounded-2xl text-violet-600 dark:text-violet-400">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Inteligencia Artificial & Gemini
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                  Vercel & Local
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Optimiza la velocidad, clave API de Google AI Studio, latencia serverless y comportamiento del asistente comercial.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            variant="outline"
            className="flex items-center gap-2 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-xl"
          >
            {isTesting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Midiendo latencia...</span>
              </>
            ) : (
              <>
                <Activity size={16} />
                <span>Probar Conexión & Latencia</span>
              </>
            )}
          </Button>
        </div>

        {/* Live Diagnostics Card if tested */}
        {testResult && (
          <div className={`p-4 rounded-2xl border transition-all ${
            testResult.ok 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200' 
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 font-semibold text-sm">
                <div className={`w-3 h-3 rounded-full ${testResult.ok ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{testResult.ok ? 'Diagnóstico: Conexión Estable y Lista' : 'Diagnóstico: Falló la conexión'}</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                testResult.latencyMs < 1000 
                  ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' 
                  : 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
              }`}>
                ⚡ {testResult.latencyMs} ms
              </span>
            </div>
            <p className="text-xs mt-1.5 opacity-90">{testResult.message}</p>
            <div className="text-[11px] mt-2 flex flex-wrap gap-3 font-mono opacity-80">
              <span>Canal: {testResult.source === 'vercel' ? 'Vercel Serverless Function (/api/ai/ask)' : testResult.source === 'server' ? 'Servidor Node.js' : 'Navegador Directo (SDK)'}</span>
              <span>•</span>
              <span>Modelo: {testResult.model}</span>
            </div>
          </div>
        )}

        {/* API Key Configuration */}
        <div className="bg-gradient-to-br from-violet-50/50 via-white to-indigo-50/30 dark:from-violet-950/20 dark:via-gray-800 dark:to-indigo-950/20 p-5 sm:p-6 rounded-2xl border border-violet-100 dark:border-violet-900/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-violet-600 dark:text-violet-400" />
              <label className="text-sm font-bold text-gray-900 dark:text-white">
                Clave API de Gemini (Google AI Studio)
              </label>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
            >
              <span>Obtener clave gratis en Google AI Studio</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={form.geminiApiKey}
              onChange={e => setForm(prev => ({ ...prev, geminiApiKey: e.target.value }))}
              placeholder="AIzaSy..."
              className="w-full pl-3.5 pr-11 py-2.5 text-sm font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              title={showApiKey ? "Ocultar clave" : "Mostrar clave"}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p>
              <strong>Solución para Vercel:</strong> Al ingresar tu clave aquí, la app la utiliza directamente y también la reenvía como encabezado a tu endpoint <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">/api/ai/ask</code> en Vercel. Si Vercel tiene demora o falla, la aplicación conmuta automáticamente al SDK directo en el navegador para que <strong>nunca se quede esperando</strong>.
            </p>
          </div>
        </div>

        {/* Performance Mode (Crucial for Vercel) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            <label className="text-sm font-bold text-gray-900 dark:text-white">
              Modo de Rendimiento IA (Optimización de Velocidad)
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'fast' as const,
                title: '⚡ Ultra Rápido (Vercel)',
                badge: 'Recomendado',
                desc: 'Resúmenes de alta densidad y métricas clave. Respuesta inmediata (<1s), ideal para evitar timeouts en Vercel Serverless.',
                latency: '~0.8 seg'
              },
              {
                id: 'balanced' as const,
                title: '⚖️ Equilibrado',
                badge: 'Estándar',
                desc: 'Métricas de inventario combinadas con historial comercial de los últimos 30 días.',
                latency: '~1.8 seg'
              },
              {
                id: 'deep' as const,
                title: '🧠 Analítico Profundo',
                badge: 'Auditoría',
                desc: 'Mayor volumen de movimientos, cotizaciones y órdenes de taller para análisis exhaustivo.',
                latency: '~3.2 seg'
              }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, aiPerformanceMode: m.id }))}
                className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                  form.aiPerformanceMode === m.id
                    ? 'bg-violet-50/70 dark:bg-violet-950/40 border-violet-500 dark:border-violet-500 ring-2 ring-violet-500/20'
                    : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700/80 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{m.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.id === 'fast' 
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{m.desc}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Velocidad esperada:</span>
                  <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{m.latency}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Cpu size={16} className="text-indigo-500" />
              <span>Modelo de Inteligencia Artificial</span>
            </label>
            <select
              value={form.aiModel}
              onChange={e => setForm(prev => ({ ...prev, aiModel: e.target.value as any }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recomendado — Inteligente & Rápido)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra Rápido — Mínima Latencia)</option>
              <option value="gemini-flash-latest">Gemini Flash Latest (Estándar)</option>
            </select>
            <p className="text-[11px] text-gray-400">
              Gemini 3.8 Flash brinda razonamiento comercial superior manteniendo tiempos de respuesta bajo 1.5s.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              <span>Ventana de Historial de Ventas a Analizar</span>
            </label>
            <select
              value={form.aiSalesHistoryDays}
              onChange={e => setForm(prev => ({ ...prev, aiSalesHistoryDays: Number(e.target.value) }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value={7}>Últimos 7 días (Ultra veloz)</option>
              <option value={30}>Últimos 30 días (Balance recomendado)</option>
              <option value={90}>Últimos 90 días (Trimestral)</option>
              <option value={180}>Últimos 6 meses (Semestral)</option>
              <option value={365}>Último año (Análisis Anual)</option>
            </select>
            <p className="text-[11px] text-gray-400">
              Limitar a 30 días evita que la base de datos se sature y reduce el tamaño de la consulta a la IA.
            </p>
          </div>
        </div>

        {/* Behavior & Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Sliders size={16} className="text-emerald-500" />
              <span>Estilo de Respuesta</span>
            </label>
            <select
              value={form.aiResponseStyle}
              onChange={e => setForm(prev => ({ ...prev, aiResponseStyle: e.target.value as any }))}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="concise">Conciso y Directo (Puntos clave, lectura rápida)</option>
              <option value="balanced">Equilibrado (Recomendado para mostrador y taller)</option>
              <option value="comprehensive">Analítico Detallado (Tablas Markdown y desglose financiero)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Temperatura / Creatividad
              </label>
              <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                {form.aiTemperature} ({form.aiTemperature <= 0.3 ? 'Preciso / Financiero' : 'Conversacional'})
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.1"
              value={form.aiTemperature}
              onChange={e => setForm(prev => ({ ...prev, aiTemperature: parseFloat(e.target.value) }))}
              className="w-full accent-violet-600 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0.0 (Matemático estricto)</span>
              <span>0.3 (Recomendado)</span>
              <span>0.8 (Creativo)</span>
            </div>
          </div>
        </div>

        {/* UI & Floating Assistant Controls */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Bot size={16} className="text-violet-500" />
                <span>Mostrar botón flotante del Asistente IA</span>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Muestra la burbuja flotante arrastrable en la esquina inferior para acceso inmediato desde cualquier pantalla.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.aiAssistantVisible}
                onChange={e => setForm(prev => ({ ...prev, aiAssistantVisible: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Mensaje de Bienvenida del Asistente
            </label>
            <input
              type="text"
              value={form.aiWelcomeMessage}
              onChange={e => setForm(prev => ({ ...prev, aiWelcomeMessage: e.target.value }))}
              placeholder="¡Hola! Soy tu asistente de negocios inteligente..."
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-md shadow-violet-500/20 font-medium"
          >
            {isSaving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Guardar Configuración de IA</span>
              </>
            )}
          </Button>
        </div>

      </div>
    </form>
  );
}
