/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Bot, 
  User, 
  Loader2,
  Sparkles,
  ChevronDown,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/geminiService';
import { inventoryService } from '../services/inventoryService';
import { workOrderService } from '../services/workOrderService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Product, Sale, Purchase, Movement, WorkOrder, RepairQuote } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export function ChatAI() {
  const { t } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! Soy tu asistente de Gestión Total. ¿En qué puedo ayudarte hoy?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Fetch data only when needed to save quota
      const [
        currentProducts, 
        currentSales, 
        currentPurchases, 
        currentMovements,
        currentClients,
        currentSuppliers,
        currentWarehouses,
        currentWorkOrders,
        currentRepairQuotes
      ] = await Promise.all([
        inventoryService.getProducts(),
        inventoryService.getSales(1825), // Fetch last 5 years of sales
        inventoryService.getPurchases(1825), // Fetch last 5 years of purchases
        inventoryService.getMovements(1000), // Fetch last 1000 movements
        inventoryService.getClients(),
        inventoryService.getSuppliers(),
        inventoryService.getWarehouses(),
        workOrderService.getWorkOrders().catch(() => []),
        workOrderService.getRepairQuotes().catch(() => [])
      ]);

      const response = await geminiService.askAboutBusiness(input, {
        products: currentProducts,
        sales: currentSales,
        purchases: currentPurchases,
        movements: currentMovements,
        clients: currentClients,
        suppliers: currentSuppliers,
        warehouses: currentWarehouses,
        workOrders: currentWorkOrders,
        repairQuotes: currentRepairQuotes
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response || t('ai_error'),
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: t('ai_error'),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '64px' : '650px',
              width: isMinimized ? (window.innerWidth < 640 ? '320px' : '384px') : (window.innerWidth < 1024 ? '95vw' : '500px')
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border dark:border-slate-800 flex flex-col overflow-hidden fixed bottom-24 right-0 sm:right-6 lg:right-10 origin-bottom-right"
          >
            {/* Header */}
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{t('ai_assistant')}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">En línea</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                  {messages.map(message => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[90%] p-3.5 rounded-2xl text-sm ${
                        message.sender === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-200 dark:shadow-none font-medium' 
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xl shadow-slate-200 dark:shadow-none rounded-tl-none border border-slate-100 dark:border-slate-700/50'
                      }`}>
                        {message.sender === 'ai' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({...props}) => (
                                  <div className="overflow-x-auto my-3 scrollbar-hide">
                                    <table className="w-full text-[11px] border-collapse bg-slate-50/50 dark:bg-slate-900/30 rounded-xl overflow-hidden" {...props} />
                                  </div>
                                ),
                                thead: ({...props}) => <thead className="bg-slate-100 dark:bg-slate-800" {...props} />,
                                th: ({...props}) => <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-wider" {...props} />,
                                td: ({...props}) => <td className="px-3 py-2 border-t border-slate-100 dark:border-slate-800" {...props} />,
                                h1: ({...props}) => <h1 className="text-lg font-black mt-4 mb-2 text-indigo-600 dark:text-indigo-400" {...props} />,
                                h2: ({...props}) => <h2 className="text-base font-black mt-4 mb-2 text-indigo-600 dark:text-indigo-400" {...props} />,
                                h3: ({...props}) => <h3 className="text-sm font-black mt-3 mb-1 text-slate-900 dark:text-white" {...props} />,
                                ul: ({...props}) => <ul className="list-disc list-outside ml-4 space-y-1 my-2" {...props} />,
                                ol: ({...props}) => <ol className="list-decimal list-outside ml-4 space-y-1 my-2" {...props} />,
                                li: ({...props}) => <li className="text-slate-700 dark:text-slate-300" {...props} />,
                                p: ({...props}) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
                                strong: ({...props}) => <strong className="font-bold text-indigo-600 dark:text-indigo-400" {...props} />,
                                blockquote: ({...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-2 italic bg-indigo-50/50 dark:bg-indigo-900/20 rounded-r-lg" {...props} />,
                                code: ({...props}) => <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md font-mono text-[11px] text-indigo-600 dark:text-indigo-400" {...props} />,
                              }}
                            >
                              {message.text}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        )}
                        <div className={`text-[10px] mt-2 font-bold uppercase tracking-widest opacity-40 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm border dark:border-slate-700">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('ask_ai')}
                      className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center relative group"
      >
        <div className="absolute inset-0 bg-indigo-600 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
        {isOpen ? <ChevronDown className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
