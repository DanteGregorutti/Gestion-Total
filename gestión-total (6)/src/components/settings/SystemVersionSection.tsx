/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  GitBranch, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Info,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { 
  APP_VERSION, 
  APP_VERSION_NAME, 
  APP_VERSION_DATE, 
  APP_VERSION_HISTORY,
  VersionRelease 
} from '../../config/version';

export function SystemVersionSection() {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>(APP_VERSION);

  const currentRelease = APP_VERSION_HISTORY.find(r => r.version === APP_VERSION) || APP_VERSION_HISTORY[0];

  return (
    <section 
      id="system-version-section"
      className="bg-white dark:bg-gray-800 rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <GitBranch size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Versión del Sistema
              </h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Al día
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Control de versiones incremental, hitos de desarrollo y registro de actualizaciones
            </p>
          </div>
        </div>

        {/* Current Version Pill */}
        <div className="flex items-center gap-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 p-2.5 sm:px-4 rounded-2xl self-start sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400 block">
              Versión Activa
            </span>
            <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white font-mono leading-none">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {/* Main Version Hero Box */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-gray-50 dark:from-indigo-950/30 dark:via-gray-800/80 dark:to-gray-900 border border-indigo-100 dark:border-indigo-900/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-sm font-mono">
                v{APP_VERSION}
              </span>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {APP_VERSION_NAME}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              {currentRelease.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium">
            <Calendar size={14} className="text-indigo-500" />
            <span>Actualizado en {APP_VERSION_DATE}</span>
          </div>
        </div>

        {/* Highlights of current version */}
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-400 block mb-2">
            Novedades de esta versión:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {currentRelease.highlights.map((highlight, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60"
              >
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Semantic Versioning Standard Explanation */}
      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 space-y-2">
        <div className="flex items-center gap-2 text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
          <Info size={14} className="text-indigo-500" />
          <span>Esquema de Numeración y Actualizaciones</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
              <span className="px-1.5 py-0.5 rounded font-mono font-black text-[11px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                1.0 → 2.0
              </span>
              <span>Mayores</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Transformaciones de fondo y módulos grandes (ej: la incorporación de la suite de Taller & Reparaciones y Seguimiento en vivo).
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
              <span className="px-1.5 py-0.5 rounded font-mono font-black text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                2.0 → 2.1
              </span>
              <span>Nuevas Funciones</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Nuevas herramientas, presupuestos editables, panel de versiones y unificación de canales oficiales.
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
              <span className="px-1.5 py-0.5 rounded font-mono font-black text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                2.1.0 → 2.1.1
              </span>
              <span>Revisiones</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Ajustes finos de interfaz, optimizaciones de velocidad y mejoras continuas de estabilidad.
            </p>
          </div>
        </div>
      </div>

      {/* History / Changelog Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Historial de Versiones ({APP_VERSION_HISTORY.length} hitos registrados)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFullHistory(!showFullHistory)}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>{showFullHistory ? 'Ocultar historial anterior' : 'Ver historial completo desde v1.0'}</span>
            {showFullHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Timeline List */}
        <div className="space-y-3">
          {(showFullHistory ? APP_VERSION_HISTORY : APP_VERSION_HISTORY.slice(0, 2)).map((release) => {
            const isCurrent = release.version === APP_VERSION;
            const isMajor = release.type === 'major';

            return (
              <div 
                key={release.version}
                className={`p-4 rounded-2xl border transition-all ${
                  isCurrent 
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50' 
                    : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-black ${
                      isCurrent 
                        ? 'bg-indigo-600 text-white' 
                        : isMajor 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      v{release.version}
                    </span>

                    {isCurrent && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        Activa
                      </span>
                    )}

                    {isMajor && !isCurrent && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                        Hito Mayor
                      </span>
                    )}

                    <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                      {release.title}
                    </span>
                  </div>

                  <span className="text-[11px] text-gray-400 font-medium">
                    {release.date}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {release.description}
                </p>

                <ul className="space-y-1 pl-1">
                  {release.highlights.map((h, i) => (
                    <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
