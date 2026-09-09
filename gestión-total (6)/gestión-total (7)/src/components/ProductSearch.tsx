import React from 'react';
import { Search, Package, Check, X } from 'lucide-react';
import { Product } from '../types';
import { cn } from '../utils/cn';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';

interface ProductSearchProps {
  products: Product[];
  onSelect: (product: Product) => void;
  selectedProductId?: string;
  label?: string;
  placeholder?: string;
}

export default function ProductSearch({ 
  products, 
  onSelect, 
  selectedProductId,
  label,
  placeholder 
}: ProductSearchProps) {
  const { t } = useSettings();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedProduct = React.useMemo(() => 
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredProducts = React.useMemo(() => {
    if (!deferredSearchTerm) return products.slice(0, 50);
    const term = deferredSearchTerm.toLowerCase().trim();
    return products.filter(p => 
      p.codigo.toLowerCase().includes(term) || 
      (p.descripcion || '').toLowerCase().includes(term)
    ).slice(0, 50);
  }, [products, deferredSearchTerm]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block ml-1">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-2.5 bg-white dark:bg-gray-900 border rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200",
          isOpen ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedProduct ? (
            <>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                {selectedProduct.imagenUrl ? (
                  <img 
                    src={selectedProduct.imagenUrl} 
                    alt="" 
                    className="w-full h-full object-cover rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {selectedProduct.codigo}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider",
                    selectedProduct.procedencia === 'Legítimo' ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" :
                    selectedProduct.procedencia === 'Importado' ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" :
                    "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                  )}>
                    {selectedProduct.procedencia}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedProduct.descripcion || t('no_description')}
                </span>
              </div>
            </>
          ) : (
            <span className="text-sm text-gray-400">
              {placeholder || t('select_product')}...
            </span>
          )}
        </div>
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]"
          >
            <div className="p-3 border-b border-gray-50 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  autoFocus
                  type="text"
                  placeholder={t('search_products')}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500/40 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">{t('no_products_found')}</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onSelect(product);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 text-left group",
                        selectedProductId === product.id 
                          ? "bg-indigo-50 dark:bg-indigo-900/20" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                        {product.imagenUrl ? (
                          <img 
                            src={product.imagenUrl} 
                            alt="" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {product.codigo}
                            </span>
                            <span className={cn(
                              "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider",
                              product.procedencia === 'Legítimo' ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" :
                              product.procedencia === 'Importado' ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" :
                              "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                            )}>
                              {product.procedencia}
                            </span>
                          </div>
                          {selectedProductId === product.id && (
                            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.descripcion || t('no_description')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider",
                            product.cantidad > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20"
                          )}>
                            {t('stock')}: {product.cantidad}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 uppercase tracking-wider">
                            ${product.precio}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
