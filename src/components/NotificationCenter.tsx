/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  Trash2,
  Check
} from 'lucide-react';
import { Notification } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import { cn } from '../utils/cn';

export function NotificationCenter() {
  const { t } = useSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await inventoryService.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    fetchNotifications();
  }, [isOpen]); // Refresh when opened

  const unreadCount = notifications.filter(n => !n.leido).length;

  const getIcon = (tipo: Notification['tipo']) => {
    switch (tipo) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatDate = (fecha: any) => {
    try {
      const date = fecha?.toDate ? fecha.toDate() : new Date(fecha);
      if (isNaN(date.getTime())) return '---';
      return date.toLocaleDateString();
    } catch (e) {
      return '---';
    }
  };

  const formatTime = (fecha: any) => {
    try {
      const date = fecha?.toDate ? fecha.toDate() : new Date(fecha);
      if (isNaN(date.getTime())) return '---';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '---';
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors group"
      >
        <Bell className={cn("w-6 h-6 transition-colors", unreadCount > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400")} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-lg shadow-rose-500/20 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-80 sm:w-[420px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border-2 border-slate-50 dark:border-slate-800 z-50 overflow-hidden"
            >
              <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2 text-slate-900 dark:text-white tracking-tight">
                    <Bell className="w-5 h-5 text-indigo-600" />
                    {t('notifications')}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{unreadCount} mensajes sin leer</p>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => inventoryService.clearAllNotifications()}
                      className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 rounded-xl transition-all hover:scale-110 active:scale-90"
                      title={t('clear_all')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-bold">{t('no_notifications')}</p>
                    <p className="text-xs text-slate-300 dark:text-slate-500 mt-1">Todo está al día por aquí</p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-slate-800">
                    {notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className={cn(
                          "p-6 flex gap-4 transition-all relative group",
                          !notification.leido ? "bg-indigo-50/30 dark:bg-indigo-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        {!notification.leido && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full" />
                        )}
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                          notification.tipo === 'warning' ? "bg-amber-100 dark:bg-amber-900/30" :
                          notification.tipo === 'error' ? "bg-rose-100 dark:bg-rose-900/30" :
                          notification.tipo === 'success' ? "bg-emerald-100 dark:bg-emerald-900/30" :
                          "bg-blue-100 dark:bg-blue-900/30"
                        )}>
                          {getIcon(notification.tipo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                              {notification.titulo}
                            </div>
                            {!notification.leido && (
                              <button 
                                onClick={() => inventoryService.markNotificationAsRead(notification.id)}
                                className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title={t('mark_as_read')}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                            {notification.mensaje}
                          </p>
                          <div className="flex items-center gap-3 mt-4">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {formatDate(notification.fecha)}
                              </span>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {formatTime(notification.fecha)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
