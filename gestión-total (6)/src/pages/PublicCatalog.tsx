/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShoppingBag, 
  MessageCircle, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  Send,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function PublicCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Cart for ordering via WhatsApp
  const [cart, setCart] = useState<{ product: Product; quantity: number; selectedSize?: string }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await inventoryService.getProducts();
        setProducts(data);
      } catch (e) {
        console.error('Error loading public catalog products:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Group products by description/code
  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product & { totalStock: number; availableSizes: string[] } } = {};
    
    products.forEach(p => {
      const label = p.descripcion || p.codigo || 'Producto';
      const key = `${p.codigo || ''}_${label}_${p.precio}`;
      
      if (!groups[key]) {
        groups[key] = {
          ...p,
          descripcion: label,
          totalStock: 0,
          availableSizes: []
        };
      }
      
      const qty = Number(p.cantidad) || 0;
      groups[key].totalStock += qty;
      
      if (p.talle) {
        const size = p.talle.trim().toUpperCase();
        if (!groups[key].availableSizes.includes(size)) {
          groups[key].availableSizes.push(size);
        }
      }
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          if (v.nombre && !groups[key].availableSizes.includes(v.nombre)) {
            groups[key].availableSizes.push(v.nombre);
          }
        });
      }
    });

    return Object.values(groups).filter(p => {
      const matchSearch = p.descripcion.toLowerCase().includes(search.toLowerCase()) || 
                          (p.codigo || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch && p.totalStock > 0;
    });
  }, [products, search]);

  const addToCart = (product: Product, size?: string) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id && item.selectedSize === size);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        return copy;
      }
      return [...prev, { product, quantity: 1, selectedSize: size }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.precio * item.quantity), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleSendWhatsAppOrder = () => {
    if (cart.length === 0) return;

    let message = `👋 ¡Hola! Me gustaría hacer un pedido desde el catálogo:\n\n`;
    if (clientName.trim()) {
      message += `👤 *Cliente:* ${clientName.trim()}\n\n`;
    }

    message += `📦 *DETALLE DEL PEDIDO:*\n`;
    cart.forEach((item, idx) => {
      const sizeStr = item.selectedSize ? ` (Talle/Var: ${item.selectedSize})` : '';
      message += `${idx + 1}. *${item.product.descripcion}*${sizeStr}\n`;
      message += `   • Cantidad: ${item.quantity} un. x $${item.product.precio.toLocaleString('es-AR')}\n`;
      message += `   • Subtotal: *$${(item.quantity * item.product.precio).toLocaleString('es-AR')}*\n\n`;
    });

    message += `💰 *TOTAL ESTIMADO:* *$${cartTotal.toLocaleString('es-AR')}*\n`;

    if (clientNotes.trim()) {
      message += `\n📝 *Aclaraciones:* ${clientNotes.trim()}\n`;
    }

    message += `\n¿Tienen disponibilidad para coordinar la entrega? ¡Muchas gracias!`;

    // WhatsApp send intent to official PulseStore number: 1160255767 (5491160255767)
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/5491160255767?text=${encoded}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Catálogo Online
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">Productos disponibles en tiempo real</p>
            </div>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <MessageCircle size={18} />
            <span className="hidden sm:inline">Mi Pedido</span>
            {cartItemCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white text-emerald-800 text-[11px] font-black">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Input in Bar */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos por nombre, código o talle..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>
      </header>

      {/* Main Catalog Grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500">Cargando catálogo...</p>
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No encontramos productos con esa búsqueda</h3>
            <p className="text-xs text-slate-400 mt-1">Probá buscando con otro nombre o palabra clave.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {groupedProducts.map(p => (
              <div 
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group"
              >
                <div>
                  <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden mb-3 flex items-center justify-center relative">
                    {p.imagenUrl ? (
                      <img src={p.imagenUrl} alt={p.descripcion} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    )}
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 backdrop-blur-sm">
                      {p.totalStock} disp.
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-2 uppercase mb-1">
                    {p.descripcion}
                  </h3>
                  {p.codigo && (
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">
                      Cód: {p.codigo}
                    </span>
                  )}

                  {p.availableSizes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.availableSizes.slice(0, 3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                          {s}
                        </span>
                      ))}
                      {p.availableSizes.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-bold self-center">+{p.availableSizes.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                  <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">
                    ${p.precio.toLocaleString('es-AR')}
                  </span>
                  <button
                    onClick={() => addToCart(p, p.availableSizes[0])}
                    className="p-2 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Pedir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Slide-over Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col"
            >
              {/* Cart Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">Mi Pedido WhatsApp</h2>
                    <p className="text-[11px] text-slate-500">{cart.length} productos seleccionados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold">Tu carrito de pedidos está vacío</p>
                    <p className="text-[11px] text-slate-400 mt-1">Elegí productos del catálogo para armar tu pedido.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div 
                      key={`${item.product.id}_${idx}`}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-slate-900 dark:text-white block truncate uppercase">
                          {item.product.descripcion}
                        </span>
                        {item.selectedSize && (
                          <span className="text-[11px] text-indigo-600 font-bold block">
                            Talle: {item.selectedSize}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          ${item.product.precio.toLocaleString('es-AR')} c/u
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
                          <button 
                            onClick={() => updateQuantity(idx, -1)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded-lg"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2 font-black text-xs">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(idx, 1)}
                            className="p-1 text-slate-500 hover:text-emerald-600 rounded-lg"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="font-black text-slate-900 dark:text-white min-w-[60px] text-right">
                          ${(item.quantity * item.product.precio).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer & Submit */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Tu Nombre (Opcional):
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Notas / Dirección (Opcional):
                    </label>
                    <input
                      type="text"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Ej: Para retirar por el local o enviar a domicilio..."
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-black uppercase text-slate-500">Total Estimado</span>
                    <span className="text-xl font-black text-emerald-600">
                      ${cartTotal.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <button
                    onClick={handleSendWhatsAppOrder}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <Send size={16} />
                    Enviar Pedido por WhatsApp
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
