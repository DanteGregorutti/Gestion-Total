/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Share2, 
  Download, 
  Image as ImageIcon, 
  Copy,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  ShoppingBag,
  Grid,
  List as ListIcon,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProducts } from '../contexts/ProductsContext';
import { useSettings } from '../contexts/SettingsContext';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { Product, Warehouse } from '../types';

export default function Catalog() {
  const { products } = useProducts();
  const { t, theme } = useSettings();
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [showStock, setShowStock] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copied, setCopied] = useState(false);
  const [isShareMode, setIsShareMode] = useState(false);

    // Robust function to get the product name
  const getProductLabel = (p: any): string => {
    if (!p) return 'Producto sin nombre';
    // We prioritize description, then name, then code
    return (
      p.descripcion || 
      p.nombre || 
      p.name || 
      p.productNombre || 
      p.codigo || 
      'Producto sin nombre'
    ).toString();
  };

  React.useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.getWarehouses();
        setWarehouses(data);
      } catch (error) {
        console.error("Error fetching warehouses in catalog:", error);
      }
    };
    fetchWarehouses();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    // First, let's group products by their identity (description, price, image)
    // so we don't show the same item multiple times if it's in different locations
    const groups: { [key: string]: Product & { totalStock: number, availableSizes: string[], sizeStock: { [size: string]: number }, availableGenders: string[] } } = {};
    
    products.forEach(p => {
      const label = getProductLabel(p);
      // We group by code (if available), name, and price to avoid cluttering the catalog
      const key = `${p.codigo || ''}_${label}_${p.precio}`;
      
      if (!groups[key]) {
        groups[key] = {
          ...p,
          descripcion: label, // Ensure we use the detected label
          totalStock: 0,
          availableSizes: [],
          sizeStock: {},
          availableGenders: []
        };
      }
      const qty = (p.cantidad || 0);
      groups[key].totalStock += qty;

      if (p.talle) {
        const sizeKey = p.talle.trim().toUpperCase();
        if (!groups[key].availableSizes.includes(sizeKey)) {
          groups[key].availableSizes.push(sizeKey);
        }
        groups[key].sizeStock[sizeKey] = (groups[key].sizeStock[sizeKey] || 0) + qty;
      }

      if (p.genero && !groups[key].availableGenders.includes(p.genero)) {
        groups[key].availableGenders.push(p.genero);
      }
    });

    return Object.values(groups).filter(p => {
      const matchesSearch = p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWarehouse = selectedWarehouse === 'all' || p.almacenId === selectedWarehouse;
      const matchesStock = !inStockOnly || p.totalStock > 0;
      return matchesSearch && matchesWarehouse && matchesStock;
    });
  }, [products, searchTerm, selectedWarehouse, inStockOnly]);

  const copyToClipboard = () => {
    const text = filteredProducts.map(p => {
      const name = p.descripcion.toUpperCase();
      let line = `🔹 *${name}*`;
      if (showPrices) line += ` - $${p.precio.toLocaleString()}`;
      if (showStock) line += ` (${(p as any).totalStock} disp.)`;
      
      const sizes = Object.entries((p as any).sizeStock);
      if (sizes.length > 0) {
        const sizeInfo = sizes.map(([s, q]) => `${s} (${q})`).join(', ');
        line += `\n   📏 Talles: ${sizeInfo}`;
      }
      
      const genders = (p as any).availableGenders;
      if (genders && genders.length > 0) {
        line += `\n   👤 Género: ${genders.join(', ')}`;
      }
      
      return line;
    }).join('\n\n');
    
    const header = `📦 *CATÁLOGO DE PRODUCTOS - GESTIÓN TOTAL*\n\n`;
    const footer = `\n\n_Generado automáticamente desde Gestión Total_`;
    
    try {
      navigator.clipboard.writeText(header + text + footer);
      setCopied(true);
      toast.success('Catálogo completo copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar al portapapeles');
    }
  };

  const copySingleProduct = (p: Product) => {
    const name = p.descripcion.toUpperCase();
    let text = `🔹 *${name}*\n`;
    if (showPrices) text += `💰 Precio: $${p.precio.toLocaleString()}\n`;
    if (showStock) text += `📦 Stock: ${(p as any).totalStock} unidades\n`;
    
    const sizes = Object.entries((p as any).sizeStock);
    if (sizes.length > 0) {
      const sizeInfo = sizes.map(([s, q]) => `${s} (${q})`).join(', ');
      text += `📏 Talles: ${sizeInfo}\n`;
    }
    
    const genders = (p as any).availableGenders;
    if (genders && genders.length > 0) {
      text += `👤 Género: ${genders.join(', ')}\n`;
    }
    
    text += `\n_Consultado en Gestión Total_`;
    
    try {
      navigator.clipboard.writeText(text);
      toast.success(`Info de "${name}" copiada`);
    } catch (err) {
      toast.error('Error al copiar info');
    }
  };

  const handlePrint = () => {
    toast.info('Abriendo menú de impresión...');
    setTimeout(() => {
      window.focus();
      window.print();
    }, 300);
  };

  if (isShareMode) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black z-[200] overflow-y-auto p-4 sm:p-12 print:p-0 print:static print:bg-white print:text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            html, body {
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            body > *:not(.fixed) {
              display: none !important;
            }
            .fixed.inset-0 {
              position: static !important;
              display: block !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
            }
            .no-print { display: none !important; }
            .print-container { 
              display: block !important; 
              width: 100% !important; 
              margin: 0 !important;
              padding: 0 !important;
            }
            .product-card-print {
              break-inside: avoid-page;
              page-break-inside: avoid;
              margin-bottom: 1.5rem;
              border: 1px solid #eee;
              border-radius: 1rem;
              display: flex !important;
              page-break-after: auto;
            }
          }
        `}} />
        <div className="max-w-5xl mx-auto print-container">
          <div className="flex justify-between items-center mb-10 border-b-2 pb-6 dark:border-gray-800 no-print">
            <div>
              <h1 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight text-center sm:text-left">Catálogo de Productos</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-center sm:text-left">Actualizado al {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button 
                onClick={handlePrint}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                <Download className="w-5 h-5 mr-2" />
                DESCARGAR PDF / IMPRIMIR
              </button>
              <button 
                onClick={() => setIsShareMode(false)}
                className="w-full sm:w-auto px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95 text-gray-700 dark:text-gray-300"
              >
                SALIR
              </button>
            </div>
          </div>

          {/* Header for PRINT only */}
          <div className="hidden print:block mb-8 text-center border-b-2 pb-6">
            <h1 className="text-3xl font-bold">Catálogo de Productos</h1>
            <p className="text-gray-500">Fecha: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1">
            {filteredProducts.map(p => (
              <div key={p.id} className="flex border-2 rounded-[2rem] p-6 bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm product-card-print">
                <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-[1.5rem] flex items-center justify-center mr-6 shrink-0 overflow-hidden border-2 dark:border-gray-700 shadow-inner">
                  {p.imagenUrl ? (
                    <img src={p.imagenUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gray-200 w-12 h-12" />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-xs font-black text-indigo-400 mb-1 tracking-[0.2em] uppercase">{p.codigo}</p>
                  <h3 className="font-black text-3xl mb-4 leading-tight text-gray-900 dark:text-white uppercase tracking-tight">{(p as any).descripcion}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries((p as any).sizeStock).length > 0 && (
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        Talles: {Object.entries((p as any).sizeStock).map(([s, q]) => `${s} (${q})`).join(', ')}
                      </span>
                    )}
                    {(p as any).availableGenders?.length > 0 && (
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        {(p as any).availableGenders.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {showPrices && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-black text-4xl">
                        ${p.precio.toLocaleString()}
                      </span>
                    )}
                    {showStock && (
                      <span className="text-[16px] px-5 py-2.5 bg-white dark:bg-gray-800 border-[3px] dark:border-gray-700 rounded-2xl text-indigo-500 dark:text-indigo-400 font-black shadow-sm">
                        {(p as any).totalStock} {t('units')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <footer className="mt-16 pt-8 border-t-2 dark:border-gray-800 text-center text-sm font-bold text-gray-400 no-print">
            Gestión Total - {new Date().getFullYear()}
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('catalog')}</h1>
          <p className="text-gray-500 dark:text-gray-400">Genera vistas representativas de tu stock para compartir</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/catalogo-online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 font-bold text-sm"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Abrir Catálogo Web de Clientes
          </a>
          <button
            onClick={copyToClipboard}
            className="flex items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all font-medium text-sm"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? '¡Copiado!' : 'Copiar Texto para WhatsApp'}
          </button>
          <button
            onClick={() => setIsShareMode(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-medium text-sm"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Vista de Publicación
          </button>
        </div>
      </div>

      {/* Direct WhatsApp Ordering Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-6 sm:p-7 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5 mb-2">
              <MessageCircle size={14} />
              Pedidos Directos a tu WhatsApp Oficial 11-6025-5767
            </span>
            <h2 className="text-xl sm:text-2xl font-black leading-tight">
              Tus Clientes Pueden Comprar y Pedirte Directo por WhatsApp
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mt-1 leading-relaxed">
              Comparte el enlace web del Catálogo Online en tus redes sociales o estados de WhatsApp. Tus clientes eligen productos, talles y envían su pedido armado directamente a tu WhatsApp oficial con 1 clic.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/catalogo-online"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-white text-gray-900 hover:bg-gray-100 rounded-2xl font-black text-xs transition-all shadow-md flex items-center gap-2"
            >
              <ExternalLink size={14} />
              <span>Probar Catálogo en Vivo</span>
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm border-b-4 border-b-indigo-500/10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters */}
          <select
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm appearance-none cursor-pointer"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="all">Todos los almacenes</option>
            {warehouses && warehouses.length > 0 && warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.nombre}</option>
            ))}
          </select>

          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Solo con Stock</label>
            <button 
              onClick={() => setInStockOnly(!inStockOnly)}
              className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                inStockOnly ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"
              )}
            >
              <div className={cn(
                "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                inStockOnly && "translate-x-4"
              )} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={() => setShowPrices(!showPrices)}
            className={cn(
              "flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all border",
              showPrices ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "text-gray-500 border-gray-200 dark:border-gray-700"
            )}
          >
            {showPrices ? <Eye className="w-3 h-3 mr-2" /> : <EyeOff className="w-3 h-3 mr-2" />}
            Mostrar Precios
          </button>
          <button 
            onClick={() => setShowStock(!showStock)}
            className={cn(
              "flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all border",
              showStock ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "text-gray-500 border-gray-200 dark:border-gray-700"
            )}
          >
            {showStock ? <Eye className="w-3 h-3 mr-2" /> : <EyeOff className="w-3 h-3 mr-2" />}
            Mostrar Cantidades
          </button>
          
          <div className="flex-1" />

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-gray-500"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-gray-500"
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all group overflow-hidden relative">
                <div className="w-full aspect-square bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 duration-500 relative overflow-hidden border border-gray-100 dark:border-gray-700">
                  {p.imagenUrl ? (
                    <img src={p.imagenUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gray-300 w-12 h-12" />
                  )}
                  {showStock && (
                    <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full text-xs font-black text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-indigo-900/30 shadow-md">
                      {(p as any).totalStock} {t('units')}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full font-mono text-gray-500 uppercase">{p.codigo}</span>
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white line-clamp-2 min-h-[4rem] tracking-tight text-2xl uppercase">{(p as any).descripcion}</h3>
                  
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(p as any).availableSizes?.length > 0 && (
                      <div className="flex items-center px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-md border border-indigo-100 dark:border-indigo-800">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mr-1">Talles:</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{(p as any).availableSizes.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {showPrices && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        ${p.precio.toLocaleString()}
                      </span>
                      <button 
                        onClick={() => copySingleProduct(p)}
                        title="Copiar info de este producto"
                        className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all text-gray-400 hover:text-indigo-600"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700">
                  {p.imagenUrl ? (
                    <img src={p.imagenUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gray-300 w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate uppercase">{(p as any).descripcion}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 uppercase font-mono">{p.codigo}</p>
                    {(p as any).availableSizes?.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 rounded">
                        {(p as any).availableSizes.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                {showStock && (
                  <div className="text-right px-4">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Disponibles</p>
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">{(p as any).totalStock}</p>
                  </div>
                )}
                {showPrices && (
                  <div className="text-right border-l pl-4 dark:border-gray-700">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Precio</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">${p.precio.toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">No hay productos que mostrar</h3>
          <p className="text-gray-500">Ajusta los filtros o busca otro término</p>
        </div>
      )}
    </div>
  );
}
