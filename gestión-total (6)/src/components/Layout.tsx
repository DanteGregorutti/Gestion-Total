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
  Wrench,
  Sparkles,
  Store,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

import { useSettings } from '../contexts/SettingsContext';
import { NotificationCenter } from './NotificationCenter';
import { ChatAI } from './ChatAI';
import { TelegramBotModal } from './telegram/TelegramBotModal';
import { CompanyBrandingModal } from './CompanyBrandingModal';
import { telegramBot } from '../services/telegramBotManager';
import { APP_VERSION } from '../config/version';

interface LayoutProps {
  children: React.ReactNode;
  user?: { email: string; displayName?: string };
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const { t, mobileCompactMode, setMobileCompactMode, companyProfile } = useSettings();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = React.useState(false);
  const navigate = useNavigate();

  const storeName = companyProfile?.name || 'PulseStore';
  const storeLogo = companyProfile?.logoUrl || '';
  const storeSlogan = companyProfile?.slogan || 'Gestión Comercial & Stock';

  React.useEffect(() => {
    // Auto start telegram bot listener in background
    telegramBot.start();
  }, []);

  const operationItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard },
    { name: 'Taller & Servicios', path: '/taller', icon: Wrench },
    { name: t('inventory'), path: '/inventario', icon: Package },
    { name: 'Ventas & Cotizar', path: '/ventas', icon: TrendingUp },
    { name: t('purchases'), path: '/compras', icon: ShoppingCart },
  ];

  const managementItems = [
    { name: t('clients') || 'Clientes', path: '/clientes', icon: Users },
    { name: t('finances'), path: '/cuentas', icon: Wallet },
    { name: t('warehouses'), path: '/almacenes', icon: Warehouse },
    { name: t('catalog'), path: '/catalogo', icon: FileText },
  ];

  const systemItems = [
    { name: t('settings'), path: '/configuracion', icon: Settings },
  ];

  const allNavItems = [...operationItems, ...managementItems, ...systemItems];

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
          width: (window.innerWidth <= 1024) ? 280 : (isSidebarOpen ? 280 : 84),
          x: (window.innerWidth <= 1024 && !isMobileMenuOpen) ? -280 : 0
        }}
        className={cn(
          "bg-white dark:bg-gray-900 border-r border-gray-200/80 dark:border-gray-800 flex flex-col transition-all duration-300 z-[70] fixed lg:relative h-full shadow-2xl lg:shadow-none",
          !isSidebarOpen && "items-center"
        )}
      >
        {/* Sidebar Header with Brand Identity */}
        <div className="p-4 flex items-center justify-between w-full border-b border-gray-100 dark:border-gray-800/80 shrink-0">
          <AnimatePresence mode="wait">
            {(isSidebarOpen || isMobileMenuOpen) ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
                onClick={() => setIsBrandingModalOpen(true)}
                title="Hacer clic para editar marca y logotipo de PulseStore"
              >
                {storeLogo ? (
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 p-1 flex items-center justify-center shrink-0 shadow-sm group-hover:border-indigo-500 group-hover:shadow-md group-hover:shadow-indigo-500/10 transition-all">
                    <img src={storeLogo} alt={storeName} className="w-full h-full object-contain rounded-xl" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-all">
                    <Store size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-black text-gray-900 dark:text-white tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {storeName}
                    </h1>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" title="Sistema online" />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate font-medium flex items-center gap-1">
                    <span>{storeSlogan}</span>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="logo-collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center cursor-pointer shadow-md shadow-indigo-500/20 hover:scale-105 transition-transform"
                title={storeName}
              >
                {storeLogo ? (
                  <img src={storeLogo} alt={storeName} className="w-8 h-8 object-contain rounded-xl p-0.5" />
                ) : (
                  <Store size={20} />
                )}
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
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-90 rounded-xl transition-all shrink-0 ml-1"
            title={isSidebarOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
          >
            {isSidebarOpen || isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Quick Action Button */}
        {(isSidebarOpen || isMobileMenuOpen) ? (
          <div className="px-4 pt-3 pb-1 shrink-0">
            <button
              onClick={() => { navigate('/ventas'); closeMobileMenu(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all group"
              title="Ir a registrar ventas o emitir presupuestos"
            >
              <Plus size={15} className="group-hover:rotate-90 transition-transform duration-200" />
              <span>Nueva Venta / Cotización</span>
            </button>
          </div>
        ) : (
          <div className="py-2 shrink-0">
            <button
              onClick={() => { navigate('/ventas'); }}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 hover:scale-105 transition-all"
              title="Nueva Venta / Cotización"
            >
              <Plus size={18} />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-2 space-y-4 w-full overflow-y-auto custom-scrollbar">
          
          {/* Section: Operaciones */}
          <div className="space-y-1">
            {(isSidebarOpen || isMobileMenuOpen) && (
              <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider px-3 mb-1 block">
                Operaciones
              </span>
            )}
            {operationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) => cn(
                  "flex items-center p-2.5 rounded-xl transition-all duration-200 group text-xs sm:text-sm font-medium relative",
                  isActive 
                    ? "bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs border-l-4 border-indigo-600 dark:border-indigo-400 pl-3" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white"
                )}
                title={item.name}
              >
                <item.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0 group-hover:scale-110 transition-transform", (isSidebarOpen || isMobileMenuOpen) && "mr-3")} />
                {(isSidebarOpen || isMobileMenuOpen) && <span className="truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>

          {/* Section: Gestión */}
          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800/80">
            {(isSidebarOpen || isMobileMenuOpen) && (
              <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider px-3 mb-1 block">
                Gestión & Finanzas
              </span>
            )}
            {managementItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) => cn(
                  "flex items-center p-2.5 rounded-xl transition-all duration-200 group text-xs sm:text-sm font-medium relative",
                  isActive 
                    ? "bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs border-l-4 border-indigo-600 dark:border-indigo-400 pl-3" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white"
                )}
                title={item.name}
              >
                <item.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0 group-hover:scale-110 transition-transform", (isSidebarOpen || isMobileMenuOpen) && "mr-3")} />
                {(isSidebarOpen || isMobileMenuOpen) && <span className="truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>

          {/* Section: Sistema */}
          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800/80">
            {(isSidebarOpen || isMobileMenuOpen) && (
              <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider px-3 mb-1 block">
                Sistema & Config
              </span>
            )}
            {systemItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) => cn(
                  "flex items-center p-2.5 rounded-xl transition-all duration-200 group text-xs sm:text-sm font-medium relative",
                  isActive 
                    ? "bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs border-l-4 border-indigo-600 dark:border-indigo-400 pl-3" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white"
                )}
                title={item.name}
              >
                <item.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0 group-hover:scale-110 transition-transform", (isSidebarOpen || isMobileMenuOpen) && "mr-3")} />
                {(isSidebarOpen || isMobileMenuOpen) && <span className="truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800/80 w-full shrink-0">
          {(isSidebarOpen || isMobileMenuOpen) ? (
            <div className="space-y-2">
              {/* User & Store Card */}
              <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {(user?.displayName || storeName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                      {user?.displayName || storeName}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsBrandingModalOpen(true)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-0.5 shrink-0"
                    title="Editar marca y logo de PulseStore"
                  >
                    <Sparkles size={11} />
                    Marca
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate pl-8">
                  {user?.email || 'Sistema conectado'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { onLogout(); closeMobileMenu(); }}
                  className="flex-1 flex items-center justify-center gap-1.5 p-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
                >
                  <LogOut size={14} />
                  <span>{t('logout')}</span>
                </button>
                <NavLink 
                  to="/configuracion"
                  onClick={closeMobileMenu}
                  className="px-2.5 py-1.5 text-[10px] font-mono font-bold text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Versión del sistema"
                >
                  v{APP_VERSION}
                </NavLink>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { onLogout(); closeMobileMenu(); }}
              className="w-full flex items-center justify-center p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
              title={t('logout')}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200/80 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-90 rounded-lg transition-all lg:hidden"
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                <span>{storeName}</span>
                <ChevronRight size={12} />
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {allNavItems.find(item => item.path === location.pathname)?.name || t('dashboard')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
                {allNavItems.find(item => item.path === location.pathname)?.name || t('dashboard')}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Store Branding Quick Trigger Pill */}
            <button
              onClick={() => setIsBrandingModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100/70 transition-all shadow-xs active:scale-95"
              title="Personalizar logotipo y datos de PulseStore"
            >
              {storeLogo ? (
                <img src={storeLogo} alt={storeName} className="w-4 h-4 object-contain rounded" />
              ) : (
                <Store size={14} className="text-indigo-600 dark:text-indigo-400" />
              )}
              <span className="truncate max-w-[120px]">{storeName}</span>
              <Sparkles size={12} className="text-amber-500" />
            </button>

            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition-all border shadow-xs active:scale-95 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50"
              title="Abrir bot de Telegram para mandar ventas"
            >
              <Bot size={15} className="text-sky-500 animate-pulse" />
              <span className="hidden sm:inline">BOT TELEGRAM</span>
            </button>

            <button
              onClick={() => setMobileCompactMode(!mobileCompactMode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition-all border shadow-xs active:scale-95 select-none",
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

      {/* Embedded Branding Modal */}
      <CompanyBrandingModal
        isOpen={isBrandingModalOpen}
        onClose={() => setIsBrandingModalOpen(false)}
      />

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

        {/* Taller */}
        <button
          onClick={() => { navigate('/taller'); closeMobileMenu(); }}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            location.pathname === '/taller' 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <Wrench size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Taller</span>
          {location.pathname === '/taller' && (
            <motion.div layoutId="mobileNavActiveIndicator" className="absolute bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        {/* Ventas */}
        <button
          onClick={() => { navigate('/ventas'); closeMobileMenu(); }}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative_item",
            location.pathname === '/ventas' 
              ? "text-indigo-600 dark:text-indigo-400 font-bold" 
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          )}
        >
          <TrendingUp size={18} />
          <span className="text-[9px] tracking-tight mt-0.5 uppercase">Ventas</span>
          {location.pathname === '/ventas' && (
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

      <TelegramBotModal 
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      <ChatAI />
    </div>
  );
}
