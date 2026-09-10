/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Warehouse, 
  LogOut, 
  Menu, 
  X,
  User,
  Settings,
  Users,
  Truck,
  FileText,
  Zap,
  Building2,
  Smartphone,
  Monitor,
  Wallet,
  Bot,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

import { useSettings } from '../contexts/SettingsContext';
import { NotificationCenter } from './NotificationCenter';
import { ChatAI } from './ChatAI';
import { QuickMode } from './QuickMode';
import { TelegramBotModal } from './telegram/TelegramBotModal';
import { telegramBot } from '../services/telegramBotManager';

interface LayoutProps {
  children: React.ReactNode;
  user?: { email: string; displayName?: string };
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const { t, mobileCompactMode, setMobileCompactMode } = useSettings();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isQuickModeOpen, setIsQuickModeOpen] = React.useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    // Auto start telegram bot listener in background
    telegramBot.start();
  }, []);

  const navItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard },
    { name: 'Taller', path: '/taller', icon: Wrench },
    { name: t('inventory'), path: '/inventario', icon: Package },
    { name: t('sales'), path: '/ventas', icon: TrendingUp },
    { name: t('clients') || 'Clientes', path: '/clientes', icon: Users },
    { name: t('purchases'), path: '/compras', icon: ShoppingCart },
    { name: t('finances'), path: '/cuentas', icon: Wallet },
    { name: t('warehouses'), path: '/almacenes', icon: Warehouse },
    { name: t('catalog'), path: '/catalogo', icon: FileText },
    { name: t('settings'), path: '/configuracion', icon: Settings },
  ];

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 overflow-hidden relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileMenu}
            className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop & Mobile) */}
      <motion.aside
        initial={false}
        animate={{ 
          width: (window.innerWidth <= 1024) ? 260 : (isSidebarOpen ? 260 : 80),
          x: (window.innerWidth <= 1024 && !isMobileMenuOpen) ? -260 : 0
        }}
        className={cn(
          "bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 z-[70] fixed lg:relative h-full shadow-xl lg:shadow-none",
          !isSidebarOpen && "items-center"
        )}
      >
        <div className="p-6 flex items-center justify-between w-full">
          <AnimatePresence mode="wait">
            {(isSidebarOpen || isMobileMenuOpen) ? (
              <motion.h1
                key="logo-text"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-xl font-bold text-indigo-600 dark:text-indigo-400 truncate"
              >
                {t('app_name')}
              </motion.h1>
            ) : (
              <motion.div
                key="logo-icon"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center"
              >
                <Package className="text-white w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => {
              if (window.innerWidth <= 1024) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-90 rounded-lg transition-all lg:block"
          >
            {isSidebarOpen || isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 w-full overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeMobileMenu}
              className={({ isActive }) => cn(
                "flex items-center p-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", (isSidebarOpen || isMobileMenuOpen) && "mr-3")} />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 w-full">
          {user && (isSidebarOpen || isMobileMenuOpen) && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center overflow-hidden">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mr-3 shrink-0">
                <User className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user.displayName || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { onLogout(); closeMobileMenu(); }}
            className={cn(
              "w-full flex items-center p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all duration-200",
              (!isSidebarOpen && !isMobileMenuOpen) && "justify-center"
            )}
          >
            <LogOut className={cn("w-5 h-5 shrink-0", (isSidebarOpen || isMobileMenuOpen) && "mr-3")} />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">{t('logout')}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 mr-4 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-90 rounded-lg transition-all lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white truncate">
              {navItems.find(item => item.path === location.pathname)?.name || t('dashboard')}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition-all border shadow-sm active:scale-95 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50"
              title="Abrir bot de Telegram para mandar ventas"
            >
              <Bot size={15} className="text-sky-500 animate-pulse" />
              <span className="hidden sm:inline">BOT TELEGRAM</span>
            </button>
            <button
              onClick={() => setMobileCompactMode(!mobileCompactMode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition-all border shadow-sm active:scale-95 select-none",
                mobileCompactMode
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
              title={mobileCompactMode ? "Cambiar a Modo Computadora" : "Cambiar a Modo Celular (Optimizado)"}
            >
              {mobileCompactMode ? (
                <>
                  <Smartphone size={14} className="text-emerald-500" />
                  <span>MODO CELULAR</span>
                </>
              ) : (
                <>
                  <Monitor size={14} className="text-gray-400" />
                  <span>MODO PC</span>
                </>
              )}
            </button>
            <NotificationCenter />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Floating Bottom Nav Island for Mobile */}
      <div className="lg:hidden fixed bottom-6 left-4 right-4 z-[55] h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-xl flex items-center justify-around px-3 py-2 select-none">
        {/* Inicio */}
        <button
          onClick={() => { navigate('/'); closeMobileMenu(); }}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            location.pathname === '/' 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <LayoutDashboard size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Inicio</span>
          {location.pathname === '/' && (
            <motion.div layoutId="mobileNavActiveIndicator" className="absolute bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        {/* Stock */}
        <button
          onClick={() => { navigate('/inventario'); closeMobileMenu(); }}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            location.pathname === '/inventario' 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <Package size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Stock</span>
          {location.pathname === '/inventario' && (
            <motion.div layoutId="mobileNavActiveIndicator" className="absolute bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        {/* Venta Rápida Central Pulse Button */}
        <button
          onClick={() => { setIsQuickModeOpen(true); closeMobileMenu(); }}
          className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-full transition-all relative shadow-lg shadow-emerald-500/20 active:scale-90 hover:scale-105 hover:shadow-emerald-500/30 font-black shrink-0 -translate-y-2 border-4 border-gray-50 dark:border-black"
        >
          <Zap size={20} className="text-white animate-pulse" />
          <span className="text-[8px] tracking-tight font-bold uppercase">Vender</span>
        </button>

        {/* Compras */}
        <button
          onClick={() => { navigate('/compras'); closeMobileMenu(); }}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            location.pathname === '/compras' 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <ShoppingCart size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Compras</span>
          {location.pathname === '/compras' && (
            <motion.div layoutId="mobileNavActiveIndicator" className="absolute bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        {/* Menu */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            isMobileMenuOpen 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <Menu size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Menú</span>
          {isMobileMenuOpen && (
            <motion.div layoutId="mobileNavActiveIndicator" className="absolute bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isQuickModeOpen && (
          <QuickMode onClose={() => setIsQuickModeOpen(false)} />
        )}
      </AnimatePresence>

      <TelegramBotModal 
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      <ChatAI />
    </div>
  );
}
