/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  Smartphone, 
  Check, 
  HelpCircle,
  TrendingUp,
  MinusCircle,
  Package,
  X
} from 'lucide-react';
import { telegramBot, TelegramBotStatus } from '../../services/telegramBotManager';
import { Button } from '../ui';
import { toast } from 'sonner';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelegramBotModal({ isOpen, onClose }: TelegramBotModalProps) {
  const [status, setStatus] = useState<TelegramBotStatus>(telegramBot.getStatus());
  const [tokenInput, setTokenInput] = useState<string>(telegramBot.getToken());
  const [copied, setCopied] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  useEffect(() => {
    const unsub = telegramBot.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const botLink = `https://t.me/${status.botUsername}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(botLink);
    setCopied(true);
    toast.success('Enlace copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      toast.error('Ingresa un token válido');
      return;
    }
    telegramBot.setToken(tokenInput.trim());
    toast.success('Token actualizado. Reiniciando bot...');
    setShowConfig(false);
  };

  const handleFlushQueue = async () => {
    try {
      await telegramBot.flushQueue();
      toast.success('Cola de mensajes reseteada y sincronizada al instante');
    } catch (e) {
      toast.error('Error al sincronizar cola');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-sky-500 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">Bot de Telegram</h2>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950">
                  <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                  Activo
                </span>
              </div>
              <p className="text-xs text-sky-100">
                @{status.botUsername} • Conectado a tu negocio
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 dark:text-gray-300">
          
          {/* Main Action: Open in Telegram */}
          <div className="p-5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Paso 1: Abrir el chat en tu celular
            </div>
            
            <a
              href={botLink}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-black text-base shadow-lg shadow-sky-500/25 transition-all"
            >
              <Smartphone className="w-5 h-5" />
              <span>Abrir Bot en Telegram</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </a>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>O buscá en Telegram:</span>
              <code className="font-bold text-sky-600 dark:text-sky-400 select-all">@{status.botUsername}</code>
              <button 
                onClick={handleCopyLink}
                className="p-1 hover:text-sky-600 transition-colors"
                title="Copiar enlace"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="space-y-3">
            <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-500" />
              ¿Cómo mandarle mensajes?
            </h3>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black">
                  1
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Para anotar una Venta:</div>
                  <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                    Mandale: <span className="font-semibold text-gray-800 dark:text-gray-200">"Venta 2 remeras 15000"</span> o <span className="font-semibold text-gray-800 dark:text-gray-200">"Vendí 1 aceite a 8500 efectivo"</span>.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-black">
                  2
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Para anotar un Gasto:</div>
                  <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                    Mandale: <span className="font-semibold text-gray-800 dark:text-gray-200">"Gasto 4500 nafta"</span> o <span className="font-semibold text-gray-800 dark:text-gray-200">"Compré comida 8000"</span>.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-black">
                  3
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Para consultar Stock o Dinero:</div>
                  <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                    Mandale simplemente: <span className="font-semibold text-gray-800 dark:text-gray-200">"stock"</span>, <span className="font-semibold text-gray-800 dark:text-gray-200">"medias"</span> o <span className="font-semibold text-gray-800 dark:text-gray-200">"saldo"</span>.
                  </div>
                </div>
              </div>

              {/* Quick direct commands grid */}
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                <div className="font-bold text-indigo-950 dark:text-indigo-200 text-xs flex items-center justify-between mb-2">
                  <span>⚡ Comandos directos del Bot:</span>
                  <span className="text-[10px] bg-indigo-200/60 dark:bg-indigo-800/60 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full font-bold">Nuevos</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /help <span className="text-gray-400 font-sans font-normal">Ayuda y menú</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /medias <span className="text-gray-400 font-sans font-normal">Stock de medias</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /precios <span className="text-gray-400 font-sans font-normal">Lista precios</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /bajo_stock <span className="text-gray-400 font-sans font-normal">Alertas reposición</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /hoy <span className="text-gray-400 font-sans font-normal">Ventas de hoy</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-indigo-100/60 dark:border-gray-800 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    /saldo <span className="text-gray-400 font-sans font-normal">Balance y caja</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry / Live feedback */}
          {status.lastMessage && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs">
              <span className="text-gray-400 font-bold block mb-1">Último mensaje recibido:</span>
              <p className="font-mono text-gray-900 dark:text-white font-medium bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                "{status.lastMessage}"
              </p>
            </div>
          )}

          {/* Bot Maintenance / Token Configuration */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setShowConfig(prev => !prev)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
              >
                {showConfig ? 'Ocultar ajustes del Token' : '⚙️ Cambiar Token (Avanzado)'}
              </button>

              <button
                onClick={handleFlushQueue}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold inline-flex items-center gap-1 hover:underline"
                title="Descarta mensajes viejos encolados en Telegram y sincroniza desde ahora"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronizar / Limpiar cola
              </button>
            </div>

            {showConfig && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Token HTTP API (Telegram):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl"
                  />
                  <Button 
                    onClick={handleSaveToken}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 px-3 rounded-xl"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Escuchando tus mensajes</span>
          </div>

          <Button 
            onClick={onClose}
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 text-xs font-bold py-2 px-5 rounded-xl"
          >
            Listo
          </Button>
        </div>

      </div>
    </div>
  );
}
