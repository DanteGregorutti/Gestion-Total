/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Minus, 
  ShoppingCart, 
  X, 
  Check, 
  User, 
  ArrowLeft,
  ScanLine
} from 'lucide-react';
import { Product, Client, Sale, Combo } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { cn } from '../utils/cn';
import { toast } from 'sonner';

interface QuickModeProps {
  onClose: () => void;
}

export function QuickMode({ onClose }: QuickModeProps) {
  const { t } = useSettings();
  const { products, refreshProducts } = useProducts();
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [clients, setClients] = useState<Client[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [saleTotalOverride, setSaleTotalOverride] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isSaveComboModalOpen, setIsSaveComboModalOpen] = useState(false);
  const [comboName, setComboName] = useState('');
  const [isComboSale, setIsComboSale] = useState(false);
  const [comboSaleName, setComboSaleName] = useState('');

  const cartTotal = cart.reduce((acc, item) => acc + ((Number(item.product?.precio) || 0) * (Number(item.quantity) || 0)), 0);

  useEffect(() => {
    setSaleTotalOverride(cartTotal);
  }, [cartTotal]);

  useEffect(() => {
    const loadData = async () => {
      const [c, co] = await Promise.all([
        inventoryService.getClients(),
        inventoryService.getCombos()
      ]);
      setClients(c);
      setCombos(co);
    };
    loadData();
  }, []);

  const filteredProducts = products.filter(p => 
    p.descripcion.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          item.product.id === productId 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleSaveCombo = async () => {
    if (cart.length === 0) return;
    if (!comboName.trim()) {
      toast.error(t('combo_name_required'));
      return;
    }

    try {
      const comboItems = cart.map(item => ({
        productId: item.product.id,
        productNombre: item.product.descripcion,
        cantidad: item.quantity
      }));

      await inventoryService.addCombo({
        nombre: comboName,
        precioTotal: saleTotalOverride ?? cartTotal,
        items: comboItems
      });

      toast.success(t('combo_saved_success'));
      setIsSaveComboModalOpen(false);
      setComboName('');
    } catch (error) {
      toast.error(t('error_saving_combo'));
    }
  };

  const handleLoadCombo = (combo: Combo) => {
    const newCart = combo.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      return {
        product,
        quantity: item.cantidad
      };
    }).filter(Boolean) as { product: Product; quantity: number }[];

    setCart(newCart);
    setSaleTotalOverride(combo.precioTotal);
    toast.success(t('combo_loaded_success'));
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const finalTotal = saleTotalOverride ?? cartTotal;

      if (isComboSale) {
        if (!comboSaleName.trim()) {
          toast.error(t('combo_name_required'));
          setIsCheckingOut(false);
          return;
        }

        const comboItems = cart.map(item => ({
          productId: item.product.id,
          productNombre: item.product.descripcion,
          cantidad: item.quantity
        }));

        await inventoryService.registerComboSale({
          nombre: comboSaleName,
          total: finalTotal,
          items: comboItems,
          clientId: selectedClient?.id,
          clientNombre: selectedClient?.nombre
        });
      } else {
        const salesToRegister = cart.map(item => {
          const itemTotal = item.product.precio * item.quantity;
          const proportion = cartTotal > 0 ? itemTotal / cartTotal : 1 / cart.length;
          const distributedTotal = finalTotal * proportion;

          return {
            productId: item.product.id,
            productNombre: item.product.descripcion,
            cantidad: item.quantity,
            precio: distributedTotal / item.quantity,
            total: distributedTotal,
            clientId: selectedClient?.id,
            clientNombre: selectedClient?.nombre
          };
        });

        await inventoryService.registerSale(salesToRegister);
      }

      setCart([]);
      setSelectedClient(null);
      setIsComboSale(false);
      setComboSaleName('');
      toast.success(t('sale_success'));
      await refreshProducts();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(t('sale_error'));
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">{t('quick_mode')}</h2>
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {cart.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}
            </span>
          )}
        </div>
      </div>

      {/* Tab Switcher for mobile devices */}
      <div className="flex border-b border-slate-200 dark:border-slate-850 md:hidden bg-slate-50 dark:bg-slate-900/60 p-1 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 py-2.5 text-xs font-black tracking-widest text-center uppercase rounded-xl transition-all active:scale-95",
            activeTab === 'products'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          )}
        >
          {t('products') || 'Productos'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cart')}
          className={cn(
            "flex-1 py-2.5 text-xs font-black tracking-widest text-center uppercase rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5",
            activeTab === 'cart'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          )}
        >
          <span>{t('cart') || 'Carrito'}</span>
          {cart.length > 0 && (
            <span className={cn(
              "px-2 py-0.5 text-[10px] font-black rounded-full leading-none",
              activeTab === 'cart' ? "bg-white text-blue-600" : "bg-blue-600 text-white"
            )}>
              {cart.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Product List */}
        <div className={cn(
          "flex-1 flex flex-col border-r dark:border-slate-800",
          activeTab !== 'products' && "hidden md:flex"
        )}>
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('search_product')}
                className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-32 md:pb-4">
            {filteredProducts.map(product => {
              const cartItem = cart.find(item => item.product.id === product.id);
              const qtyInCart = cartItem?.quantity || 0;
              return (
                <div
                  key={product.id}
                  className={cn(
                    "p-4 bg-white dark:bg-slate-800 border rounded-2xl text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[148px] shadow-sm hover:shadow-md",
                    qtyInCart > 0 
                      ? "border-blue-500 dark:border-blue-500 bg-blue-50/10 dark:bg-blue-900/10 ring-2 ring-blue-500/10" 
                      : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base mb-1 truncate text-slate-800 dark:text-slate-100">{product.descripcion}</div>
                    <div className="text-blue-600 dark:text-blue-400 font-extrabold text-base">${product.precio.toFixed(2)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Stock: {product.cantidad}</div>
                  </div>
                  
                  {qtyInCart > 0 ? (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-blue-100/30 dark:border-blue-900/30">
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="p-1 px-2.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-bold active:scale-90 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{qtyInCart}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold active:scale-90 transition-transform"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="mt-3 w-full py-1.5 bg-slate-50 dark:bg-slate-900/30 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart / Checkout */}
        <div className={cn(
          "w-full md:w-96 bg-slate-50 dark:bg-slate-900/50 flex flex-col border-t md:border-t-0",
          activeTab !== 'cart' && "hidden md:flex"
        )}>
          <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="font-bold">{t('current_sale')}</h3>
              <div className="flex gap-2 mt-1">
                {combos.length > 0 && (
                  <div className="relative group">
                    <button className="text-[10px] uppercase tracking-wider font-bold text-blue-600 hover:text-blue-700">
                      {t('load_combo')}
                    </button>
                    <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                      <div className="max-h-48 overflow-y-auto">
                        {combos.map(combo => (
                          <button
                            key={combo.id}
                            onClick={() => handleLoadCombo(combo)}
                            className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs"
                          >
                            <div className="font-bold truncate">{combo.nombre}</div>
                            <div className="text-slate-500">${combo.precioTotal.toFixed(2)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setIsSaveComboModalOpen(true)}
                  disabled={cart.length === 0}
                  className="text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  {t('save_as_combo')}
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowClientSelector(true)}
              className="flex items-center gap-2 text-sm text-blue-600 font-medium"
            >
              <User className="w-4 h-4" />
              {selectedClient ? selectedClient.nombre : t('select_client')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>{t('cart_empty')}</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.product.descripcion}</div>
                    <div className="text-sm text-slate-500">${item.product.precio.toFixed(2)} x {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-6 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart(item.product)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-white dark:bg-slate-800 border-t dark:border-slate-700 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <input
                  type="checkbox"
                  id="isComboSaleQuick"
                  checked={isComboSale}
                  onChange={(e) => setIsComboSale(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isComboSaleQuick" className="text-sm font-bold text-blue-900 dark:text-blue-100 cursor-pointer">
                  {t('register_as_combo')}
                </label>
              </div>

              {isComboSale && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    type="text"
                    placeholder={t('combo_sale_name')}
                    value={comboSaleName}
                    onChange={(e) => setComboSaleName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </motion.div>
              )}

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{t('cart_subtotal')}</span>
                <span className="line-through">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-2xl font-black">
                <span>{t('total')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">$</span>
                  <input 
                    type="number"
                    value={saleTotalOverride ?? cartTotal}
                    onChange={(e) => setSaleTotalOverride(Number(e.target.value))}
                    className="w-32 bg-transparent text-blue-600 text-right focus:outline-none border-b-2 border-blue-600/20 focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>
            </div>
            <button
              disabled={cart.length === 0 || isCheckingOut}
              onClick={handleCheckout}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isCheckingOut ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  {isComboSale ? t('confirm_as_combo') : t('complete_sale')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Save Combo Modal */}
      <AnimatePresence>
        {isSaveComboModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveComboModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <h3 className="text-xl font-bold mb-4">{t('save_as_combo')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">{t('combo_name')}</label>
                  <input
                    type="text"
                    value={comboName}
                    onChange={(e) => setComboName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: Combo Desayuno"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsSaveComboModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveCombo}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Selector Modal */}
      <AnimatePresence>
        {showClientSelector && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClientSelector(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{t('select_client')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Opcional — podés dejarlo como Consumidor Final</p>
                </div>
                <button onClick={() => setShowClientSelector(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 border-b dark:border-slate-800">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                />
              </div>
              <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setShowClientSelector(false);
                  }}
                  className={`w-full p-3.5 text-left rounded-2xl border-2 transition-all flex items-center justify-between ${!selectedClient ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <div>
                    <div className="font-bold">{t('anonymous_client')}</div>
                    <div className="text-xs text-slate-400">Venta sin cliente registrado</div>
                  </div>
                  {!selectedClient && <Check className="w-5 h-5 text-blue-600" />}
                </button>
                {clients
                  .filter(c => !clientSearch || c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) || (c.telefono && c.telefono.includes(clientSearch)))
                  .map(client => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientSelector(false);
                    }}
                    className={`w-full p-3.5 text-left rounded-2xl border-2 transition-all flex items-center justify-between ${selectedClient?.id === client.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <div>
                      <div className="font-bold">{client.nombre}</div>
                      <div className="text-sm text-slate-500">{client.telefono || client.email || 'Sin contacto'}</div>
                    </div>
                    {selectedClient?.id === client.id && <Check className="w-5 h-5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
