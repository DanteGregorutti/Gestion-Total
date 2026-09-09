/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Truck,
  ArrowDownRight,
  Calendar,
  Loader2,
  Trash2,
  Filter,
  X,
  Package,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import ProductSearch from '../components/ProductSearch';
import { Purchase, Product } from '../types';
import { cn } from '../utils/cn';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Purchases() {
  const { t, loading: settingsLoading, mobileCompactMode } = useSettings();
  const { products, refreshProducts: refreshAllProducts } = useProducts();
  const navigate = useNavigate();
  const [purchases, setPurchases] = React.useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState({
    dateRange: 'all' as 'all' | '7' | '30' | 'custom',
    customStart: '',
    customEnd: '',
    productId: 'all'
  });

  const [formData, setFormData] = React.useState({
    productId: '',
    productNombre: '',
    cantidad: '' as any,
    costo: '' as any,
    proveedor: ''
  });

  const [selectedBaseProduct, setSelectedBaseProduct] = React.useState<any | null>(null);

  const groupedProducts = React.useMemo(() => {
    const groups: { [key: string]: { 
      codigo: string; 
      descripcion: string; 
      procedencia: string;
      totalCantidad: number;
      minCosto: number;
      maxCosto: number;
      originalProducts: Product[];
      representative: Product;
    } } = {};

    products.forEach(p => {
      const key = `${p.codigo}-${p.descripcion}-${p.procedencia}`;
      if (!groups[key]) {
        groups[key] = {
          codigo: p.codigo,
          descripcion: p.descripcion,
          procedencia: p.procedencia,
          totalCantidad: 0,
          minCosto: p.costo || 0,
          maxCosto: p.costo || 0,
          originalProducts: [],
          representative: p
        };
      }
      groups[key].totalCantidad += p.cantidad;
      groups[key].minCosto = Math.min(groups[key].minCosto, p.costo || 0);
      groups[key].maxCosto = Math.max(groups[key].maxCosto, p.costo || 0);
      groups[key].originalProducts.push(p);
    });

    return Object.values(groups);
  }, [products]);

  const representativeProducts = React.useMemo(() => 
    groupedProducts.map(g => g.representative),
    [groupedProducts]
  );

  React.useEffect(() => {
    const loadAllData = async () => {
      try {
        const pu = await inventoryService.getPurchases(30);
        setPurchases(pu);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading purchases data:', error);
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [pu] = await Promise.all([
        inventoryService.getPurchases(30),
        refreshAllProducts()
      ]);
      setPurchases(pu);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPurchases = React.useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch = (p.productNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filters.productId !== 'all' && p.productId !== filters.productId) return false;

      if (filters.dateRange !== 'all') {
        if (!p.fecha) return false;
        const date = (p.fecha as any).toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
        const now = new Date();
        
        if (filters.dateRange === '7') {
          const limit = new Date();
          limit.setDate(now.getDate() - 7);
          if (date < limit) return false;
        } else if (filters.dateRange === '30') {
          const limit = new Date();
          limit.setDate(now.getDate() - 30);
          if (date < limit) return false;
        } else if (filters.dateRange === 'custom') {
          if (filters.customStart) {
            const start = new Date(filters.customStart);
            if (date < start) return false;
          }
          if (filters.customEnd) {
            const end = new Date(filters.customEnd);
            end.setHours(23, 59, 59, 999);
            if (date > end) return false;
          }
        }
      }

      return true;
    });
  }, [purchases, searchTerm, filters]);

  const totalMonth = purchases
    .filter(p => {
      if (!p.fecha) return false;
      const date = (p.fecha as any).toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
      if (isNaN(date.getTime())) return false;
      return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
    })
    .reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.productId) {
      toast.error(t('select_product_error'));
      return;
    }
    const product = products.find(p => p.id === formData.productId);
    if (!product) return;

    setIsSubmitting(true);
    try {
      await inventoryService.registerPurchase({
        ...formData,
        cantidad: Number(formData.cantidad) || 0,
        costo: Number(formData.costo) || 0,
        productNombre: `${product.descripcion || product.codigo} (${product.talle || 'N/A'} - ${product.genero || 'N/A'})`,
      });
      toast.success(t('purchase_registered_success'));
      setIsAddModalOpen(false);
      setFormData({ productId: '', productNombre: '', cantidad: '', costo: '', proveedor: '' });
    } catch (error) {
      toast.error(t('purchase_registered_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.deletePurchase(purchaseToDelete);
      toast.success(t('purchase_deleted_success'));
      setIsDeleteModalOpen(false);
      setPurchaseToDelete(null);
      await refreshData();
    } catch (error) {
      toast.error(t('purchase_deleted_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPurchaseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const [isBulkModalOpen, setIsBulkModalOpen] = React.useState(false);
  const [bulkItems, setBulkItems] = React.useState<any[]>([]);
  const [bulkProveedor, setBulkProveedor] = React.useState('');

  const handleAddBulkItem = (product: Product) => {
    const existingKey = product.id;
    const existing = bulkItems.find(item => item.productId === existingKey);
    if (existing) {
      toast.info(t('product_already_in_cart'));
      return;
    }
    setBulkItems([...bulkItems, {
      productId: product.id,
      productNombre: `${product.descripcion || product.codigo} (${product.talle || 'N/A'} - ${product.genero || 'N/A'})`,
      cantidad: 1,
      costo: product.costo || 0,
      codigo: product.codigo,
      talle: product.talle,
      genero: product.genero
    }]);
  };

  const removeBulkItem = (productId: string) => {
    setBulkItems(bulkItems.filter(item => item.productId !== productId));
  };

  const updateBulkItem = (productId: string, field: string, value: any) => {
    setBulkItems(bulkItems.map(item => 
      item.productId === productId ? { ...item, [field]: value } : item
    ));
  };

  const handleRegisterBulkPurchase = async () => {
    if (isSubmitting) return;
    if (bulkItems.length === 0) {
      toast.error(t('select_product_error'));
      return;
    }
    if (!bulkProveedor) {
      toast.error(t('enter_supplier_error') || 'Ingrese un proveedor');
      return;
    }

    setIsSubmitting(true);
    try {
      await inventoryService.registerBulkPurchase(bulkItems.map(item => ({
        productId: item.productId,
        productNombre: item.productNombre,
        cantidad: Number(item.cantidad) || 0,
        costo: Number(item.costo) || 0,
        proveedor: bulkProveedor
      })));
      toast.success(t('purchase_registered_success'));
      setIsBulkModalOpen(false);
      setBulkItems([]);
      setBulkProveedor('');
      refreshData();
    } catch (error) {
      toast.error(t('purchase_registered_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading_purchases')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShoppingCart size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-emerald-100">{t('total_purchased_month')}</p>
          <h3 className="text-2xl font-bold mt-1">${totalMonth.toLocaleString()}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl">
              <ArrowDownRight size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('stock_investment')}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {purchases.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0)} {t('units')}
          </h3>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Truck size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('active_suppliers')}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {new Set(purchases.map(p => p.proveedor)).size}
          </h3>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 pointer-events-none" />
            <Input 
              placeholder={t('search_purchases')} 
              className="pl-12" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            onClick={refreshData}
            className="rounded-xl border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            title="Actualizar datos"
          >
            <Clock className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">{t('refresh') || 'Actualizar'}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "rounded-xl border-gray-200 dark:border-gray-800",
              showFilters && "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 text-indigo-600"
            )}
          >
            <Filter className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">{t('filters')}</span>
          </Button>
        </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
            <Plus className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">{t('register_purchase')}</span>
            <span className="sm:hidden">{t('add') || 'Comprar'}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsBulkModalOpen(true)} 
            className="rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10"
          >
            <ShoppingCart className="w-5 h-5 sm:mr-2" />
            <span className="hidden md:inline">{t('bulk_purchase')}</span>
            <span className="md:hidden">Masivo</span>
          </Button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t('date_range')}</label>
                  <select 
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="all">{t('all_time')}</option>
                    <option value="7">{t('last_7_days')}</option>
                    <option value="30">{t('last_30_days')}</option>
                    <option value="custom">{t('custom_range')}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <ProductSearch 
                    label={t('product')}
                    products={products}
                    selectedProductId={filters.productId === 'all' ? undefined : filters.productId}
                    onSelect={(p) => setFilters({ ...filters, productId: p.id })}
                    placeholder={t('all_products')}
                  />
                  {filters.productId !== 'all' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-6 px-2 text-gray-400"
                      onClick={() => setFilters({ ...filters, productId: 'all' })}
                    >
                      {t('clear_product_filter')}
                    </Button>
                  )}
                </div>

                <div className="flex items-end">
                  <Button 
                    variant="ghost" 
                    className="w-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl"
                    onClick={() => setFilters({ dateRange: 'all', customStart: '', customEnd: '', productId: 'all' })}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t('clear_filters')}
                  </Button>
                </div>
              </div>

              {filters.dateRange === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800"
                >
                  <Input 
                    type="date" 
                    label={t('start_date')}
                    value={filters.customStart}
                    onChange={(e) => setFilters({ ...filters, customStart: e.target.value })}
                  />
                  <Input 
                    type="date" 
                    label={t('end_date')}
                    value={filters.customEnd}
                    onChange={(e) => setFilters({ ...filters, customEnd: e.target.value })}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Section (Desktop) / Card Section (Mobile) */}
      <div className={cn("bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden", mobileCompactMode ? "hidden" : "block")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('product')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supplier')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('qty')}</th>
                 <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('unit_cost')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('total')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('no_purchases_found')}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => {
                  let date: Date;
                  try {
                    date = (purchase.fecha as any)?.toDate ? (purchase.fecha as any).toDate() : new Date(purchase.fecha as any);
                    if (isNaN(date.getTime())) date = new Date();
                  } catch (e) {
                    date = new Date();
                  }
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{purchase.productNombre}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{date.toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{purchase.proveedor}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{purchase.cantidad}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">${purchase.costo}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${purchase.total}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          onClick={() => confirmDelete(purchase.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className={cn("space-y-4", mobileCompactMode ? "block" : "hidden")}>
        {filteredPurchases.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400">
            {t('no_purchases_found')}
          </div>
        ) : (
          filteredPurchases.map((purchase) => {
            let date: Date;
            try {
              date = (purchase.fecha as any)?.toDate ? (purchase.fecha as any).toDate() : new Date(purchase.fecha as any);
              if (isNaN(date.getTime())) date = new Date();
            } catch (e) {
              date = new Date();
            }
            return (
              <div key={purchase.id} className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{purchase.productNombre}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{date.toLocaleDateString()} • {purchase.proveedor}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-lg"
                    onClick={() => confirmDelete(purchase.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{t('qty_short')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{purchase.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{t('cost')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">${purchase.costo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{t('total')}</p>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${purchase.total}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('register_new_purchase')}
        className="max-w-3xl"
      >
        <form onSubmit={handleRegisterPurchase} className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedBaseProduct && (
                <div className="md:col-span-2 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900/30 p-6 rounded-[2rem] shadow-sm flex items-start gap-4">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl overflow-hidden shrink-0 border border-emerald-100 dark:border-emerald-800">
                      {selectedBaseProduct.representative.imagenUrl ? (
                        <img src={selectedBaseProduct.representative.imagenUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={32} className="text-emerald-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-600 text-white rounded-lg uppercase tracking-widest">
                          {selectedBaseProduct.representative.codigo}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-lg uppercase tracking-widest">
                          {selectedBaseProduct.representative.procedencia}
                        </span>
                      </div>
                      <h3 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
                        {selectedBaseProduct.representative.descripcion}
                      </h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedBaseProduct(null)}
                      className="rounded-xl hover:bg-rose-50 hover:text-rose-500 text-gray-300"
                    >
                      <X size={20} />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="md:col-span-2">
                <ProductSearch 
                  label={t('product')}
                  products={representativeProducts}
                  selectedProductId={selectedBaseProduct?.representative.id}
                  onSelect={(p) => {
                    const group = groupedProducts.find(g => 
                      g.codigo === p.codigo && 
                      g.descripcion === p.descripcion && 
                      g.procedencia === p.procedencia
                    );
                    setSelectedBaseProduct(group || null);
                    setFormData({
                      ...formData,
                      productId: '',
                    });
                  }}
                />
              </div>

              {selectedBaseProduct && (
                <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block ml-1 mb-3">
                    Seleccionar Variante de Destino
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedBaseProduct.originalProducts.map((variant: any) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            productId: variant.id,
                            costo: variant.costo || 0
                          });
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all text-left",
                          formData.productId === variant.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                            : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-indigo-200"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-black uppercase", formData.productId === variant.id ? "text-white" : "text-gray-900 dark:text-white")}>
                              {variant.talle || 'N/A'}
                            </span>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", formData.productId === variant.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                              {variant.genero || 'U'}
                            </span>
                          </div>
                          <p className={cn("text-[10px] truncate", formData.productId === variant.id ? "text-indigo-100" : "text-gray-400")}>
                            {variant.ubicacion || 'Sin Ubic.'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[11px] font-black", formData.productId === variant.id ? "text-white" : "text-indigo-600")}>
                            Stock Act: {variant.cantidad}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.productId && (
                <>
                  <Input 
                    label={t('supplier')} 
                    placeholder="Ej: Apple Distributor" 
                    className="md:col-span-2 shadow-sm" 
                    required
                    value={formData.proveedor}
                    onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
                  />
                  <div className="md:col-span-1 shadow-sm">
                    <Input 
                      label={t('qty')} 
                      type="number" 
                      placeholder="0" 
                      required
                      value={formData.cantidad}
                      onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-1 shadow-sm">
                    <Input 
                      label={t('unit_cost')} 
                      type="number" 
                      placeholder="0.00" 
                      required
                      value={formData.costo}
                      onChange={(e) => setFormData({...formData, costo: e.target.value})}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {formData.productId && (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] flex items-center justify-between border border-emerald-100 dark:border-emerald-900/30">
              <div>
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1">{t('total_investment')}</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 underline decoration-2 underline-offset-4 decoration-emerald-200">
                  ${(Number(formData.cantidad) * Number(formData.costo)).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-2xl h-12 px-6" type="button" onClick={() => setIsAddModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-2xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 min-w-[160px]">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('confirm_purchase')}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Bulk Purchase Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title={t('bulk_purchase')}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProductSearch 
              label={t('select_product_to_add')}
              products={products}
              onSelect={handleAddBulkItem}
              placeholder={t('search_and_add_product')}
            />
            <Input 
              label={t('supplier')} 
              placeholder="Ej: Distribuidora Central" 
              required
              value={bulkProveedor}
              onChange={(e) => setBulkProveedor(e.target.value)}
            />
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('product')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">{t('qty_short')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">{t('cost')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">{t('total')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {bulkItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400 italic">
                        {t('cart_empty_purchase')}
                      </td>
                    </tr>
                  ) : (
                    bulkItems.map((item) => (
                      <tr key={item.productId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase leading-tight">{item.productNombre}</p>
                          <p className="text-[10px] font-mono text-gray-400">{item.codigo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-indigo-500 text-sm font-bold p-1 outline-none"
                            value={item.cantidad}
                            onChange={(e) => updateBulkItem(item.productId, 'cantidad', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-sm">$</span>
                            <input 
                              type="number"
                              className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-indigo-500 text-sm font-bold p-1 outline-none"
                              value={item.costo}
                              onChange={(e) => updateBulkItem(item.productId, 'costo', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                            ${(item.cantidad * item.costo).toLocaleString()}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            onClick={() => removeBulkItem(item.productId)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">{t('total_investment')}</p>
              <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                ${bulkItems.reduce((acc, item) => acc + (item.cantidad * item.costo), 0).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none h-14 px-8 rounded-2xl border-gray-200 dark:border-gray-800" 
                onClick={() => setIsBulkModalOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button 
                className="flex-1 sm:flex-none h-14 px-12 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none" 
                onClick={handleRegisterBulkPurchase}
                disabled={isSubmitting || bulkItems.length === 0}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('confirm_all')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeletePurchase}
        title={t('delete_purchase')}
        message={t('delete_purchase_confirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        isLoading={isDeleting}
      />
    </div>
  );
}
