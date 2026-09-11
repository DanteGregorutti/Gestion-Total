/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Calendar,
  MoreVertical,
  Loader2,
  Trash2,
  Edit2,
  Filter,
  X,
  Package,
  Clock,
  FileText,
  FilePlus,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Users,
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import ProductSearch from '../components/ProductSearch';
import { Sale, Product, Client, Combo, ComboItem, Quote, QuoteItem } from '../types';
import { cn } from '../utils/cn';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptModal } from '../components/ReceiptModal';
import { NewQuoteModal } from '../components/NewQuoteModal';
import { QuotesView } from '../components/QuotesView';

export default function Sales() {
  const { t, loading: settingsLoading, mobileCompactMode } = useSettings();
  const { products, refreshProducts: refreshAllProducts } = useProducts();
  const navigate = useNavigate();
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
  const [editFormData, setEditFormData] = React.useState({
    cantidad: 0,
    precio: 0,
    comboItems: [] as ComboItem[]
  });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [saleToDelete, setSaleToDelete] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [combos, setCombos] = React.useState<Combo[]>([]);
  const [isSaveComboModalOpen, setIsSaveComboModalOpen] = React.useState(false);
  const [comboName, setComboName] = React.useState('');
  const [isComboSale, setIsComboSale] = React.useState(false);
  const [comboSaleName, setComboSaleName] = React.useState('');
  const [filters, setFilters] = React.useState({
    dateRange: 'all' as 'all' | '7' | '14' | '30' | 'custom',
    customStart: '',
    customEnd: '',
    productId: 'all'
  });

  const [cart, setCart] = React.useState<{
    productId: string;
    productNombre: string;
    variantId?: string;
    variantNombre?: string;
    cantidad: number;
    total: number;
  }[]>([]);

  const [salePriceMode, setSalePriceMode] = React.useState<'unit' | 'total'>('unit');
  const [currentItem, setCurrentItem] = React.useState({
    productId: '',
    productNombre: '',
    variantId: '',
    variantNombre: '',
    cantidad: 1,
    precioUnitario: 0,
    total: 0
  });

  const [selectedClient, setSelectedClient] = React.useState<{id: string, nombre: string} | null>(null);
  const [saleTotalOverride, setSaleTotalOverride] = React.useState<number | null>(null);

  // Quotes & Non-Fiscal Receipts State
  const [activeTab, setActiveTab] = React.useState<'ventas' | 'cotizaciones'>('ventas');
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [quoteStatusFilter, setQuoteStatusFilter] = React.useState<'todas' | 'pendiente' | 'aceptada' | 'rechazada'>('todas');
  const [quoteSearchTerm, setQuoteSearchTerm] = React.useState('');
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = React.useState(false);
  const [editingQuote, setEditingQuote] = React.useState<Quote | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = React.useState(false);
  const [selectedReceiptQuote, setSelectedReceiptQuote] = React.useState<Quote | null>(null);
  const [selectedReceiptSale, setSelectedReceiptSale] = React.useState<Sale | null>(null);
  const [quoteToDelete, setQuoteToDelete] = React.useState<string | null>(null);
  const [isDeleteQuoteModalOpen, setIsDeleteQuoteModalOpen] = React.useState(false);

  // Top frequent/usual clients for quick 1-tap selection in sales
  const frequentClients = React.useMemo(() => {
    const counts: Record<string, number> = {};
    sales.forEach(s => {
      if (s.clientId) {
        counts[s.clientId] = (counts[s.clientId] || 0) + 1;
      }
    });
    return [...clients]
      .filter(c => (counts[c.id] || 0) > 0)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .slice(0, 5);
  }, [clients, sales]);

  const groupedProducts = React.useMemo(() => {
    const groups: { [key: string]: { 
      codigo: string; 
      descripcion: string; 
      procedencia: string;
      totalCantidad: number;
      minPrecio: number;
      maxPrecio: number;
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
          minPrecio: p.precio,
          maxPrecio: p.precio,
          originalProducts: [],
          representative: p
        };
      }
      groups[key].totalCantidad += p.cantidad;
      groups[key].minPrecio = Math.min(groups[key].minPrecio, p.precio);
      groups[key].maxPrecio = Math.max(groups[key].maxPrecio, p.precio);
      groups[key].originalProducts.push(p);
    });

    return Object.values(groups);
  }, [products]);

  const representativeProducts = React.useMemo(() => 
    groupedProducts.map(g => g.representative),
    [groupedProducts]
  );

  const [selectedBaseProduct, setSelectedBaseProduct] = React.useState<typeof groupedProducts[0] | null>(null);

  const cartTotal = React.useMemo(() => cart.reduce((acc, item) => acc + item.total, 0), [cart]);

  React.useEffect(() => {
    setSaleTotalOverride(cartTotal);
  }, [cartTotal]);

  React.useEffect(() => {
    const unsubQuotes = inventoryService.subscribeToQuotes((quotesList) => {
      setQuotes(quotesList);
    });
    return () => unsubQuotes();
  }, []);

  React.useEffect(() => {
    const loadAllData = async () => {
      try {
        const [s, c, co, q] = await Promise.all([
          inventoryService.getSales(30),
          inventoryService.getClients(),
          inventoryService.getCombos(),
          inventoryService.getQuotes()
        ]);
        setSales(s);
        setClients(c);
        setCombos(co);
        setQuotes(q);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading sales data:', error);
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [s, c, co, q] = await Promise.all([
        inventoryService.getSales(30),
        inventoryService.getClients(),
        inventoryService.getCombos(),
        inventoryService.getQuotes(),
        refreshAllProducts()
      ]);
      setSales(s);
      setClients(c);
      setCombos(co);
      setQuotes(q);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuote = async (quoteData: any) => {
    try {
      const created = await inventoryService.createQuote(quoteData);
      if (created) {
        setQuotes(prev => [created, ...prev.filter(q => q.id !== created.id)]);
      }
      setActiveTab('cotizaciones');
      refreshData();
      return created;
    } catch (e) {
      console.error('Error saving quote:', e);
      throw e;
    }
  };

  const handleUpdateQuote = async (quoteId: string, quoteData: Partial<Quote>) => {
    try {
      await inventoryService.updateQuote(quoteId, quoteData);
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, ...quoteData } as Quote : q));
      setEditingQuote(null);
      refreshData();
      toast.success('¡Cotización actualizada con éxito!');
    } catch (e) {
      console.error('Error updating quote:', e);
      toast.error('Error al actualizar la cotización');
      throw e;
    }
  };

  const handleConvertToSale = async (quote: Quote) => {
    try {
      await inventoryService.convertQuoteToSale(quote);
      toast.success('¡Cotización aprobada! Stock descontado y venta registrada.');
      await refreshData();
    } catch (error) {
      toast.error('Error al convertir la cotización en venta');
    }
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;
    const idToDelete = quoteToDelete;
    setQuotes(prev => prev.filter(q => q.id !== idToDelete));
    setQuoteToDelete(null);
    setIsDeleteQuoteModalOpen(false);
    try {
      await inventoryService.deleteQuote(idToDelete);
      toast.success('Cotización eliminada');
      await refreshData();
    } catch (error) {
      toast.error('Error al eliminar la cotización');
      await refreshData();
    }
  };

  const handleQuoteFromCart = async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    const finalTotal = saleTotalOverride ?? cartTotal;
    const quoteItems: QuoteItem[] = cart.map(item => ({
      productId: item.productId,
      productNombre: item.productNombre,
      variantId: item.variantId,
      variantNombre: item.variantNombre,
      cantidad: item.cantidad,
      precio: item.total / item.cantidad,
      total: item.total
    }));

    try {
      const newQuote = await inventoryService.createQuote({
        clientId: selectedClient?.id,
        clientNombre: selectedClient?.nombre || 'Consumidor Final',
        items: quoteItems,
        subtotal: cartTotal,
        descuento: Math.max(0, cartTotal - finalTotal),
        total: finalTotal,
        validezDias: 7,
        estado: 'pendiente',
        notas: 'Presupuesto generado desde el carrito de ventas.'
      });

      if (newQuote) {
        setQuotes(prev => [newQuote, ...prev.filter(q => q.id !== newQuote.id)]);
      }
      setActiveTab('cotizaciones');

      setIsAddModalOpen(false);
      setCart([]);
      setSelectedClient(null);
      setCurrentItem({ productId: '', productNombre: '', variantId: '', variantNombre: '', cantidad: 1, precioUnitario: 0, total: 0 });
      
      toast.success(newQuote?.numero ? `Comprobante ${newQuote.numero} guardado con éxito` : 'Cotización guardada exitosamente');
      if (newQuote) {
        setSelectedReceiptQuote(newQuote);
        setSelectedReceiptSale(null);
        setIsReceiptModalOpen(true);
      }
      refreshData();
    } catch (e) {
      toast.error('Error al generar la cotización');
    }
  };

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter(q => {
      if (quoteStatusFilter !== 'todas' && q.estado !== quoteStatusFilter) {
        return false;
      }
      if (quoteSearchTerm) {
        const term = quoteSearchTerm.toLowerCase();
        const matchesClient = (q.clientNombre || '').toLowerCase().includes(term);
        const matchesNumber = (q.numero || '').toLowerCase().includes(term);
        const matchesItems = (q.items || []).some(i => (i.productNombre || '').toLowerCase().includes(term));
        return matchesClient || matchesNumber || matchesItems;
      }
      return true;
    });
  }, [quotes, quoteStatusFilter, quoteSearchTerm]);

  const filteredSales = React.useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = (s.productNombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filters.productId !== 'all' && s.productId !== filters.productId) return false;

      if (filters.dateRange !== 'all') {
        if (!s.fecha) return false;
        const saleDate = (s.fecha as any).toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any);
        const now = new Date();

        if (filters.dateRange === '7') {
          const limit = new Date();
          limit.setDate(now.getDate() - 7);
          if (saleDate < limit) return false;
        } else if (filters.dateRange === '14') {
          const limit = new Date();
          limit.setDate(now.getDate() - 14);
          if (saleDate < limit) return false;
        } else if (filters.dateRange === '30') {
          const limit = new Date();
          limit.setDate(now.getDate() - 30);
          if (saleDate < limit) return false;
        } else if (filters.dateRange === 'custom') {
          if (filters.customStart) {
            const start = new Date(filters.customStart);
            if (saleDate < start) return false;
          }
          if (filters.customEnd) {
            const end = new Date(filters.customEnd);
            end.setHours(23, 59, 59, 999);
            if (saleDate > end) return false;
          }
        }
      }
      return true;
    });
  }, [sales, searchTerm, filters]);

  const totalToday = sales
    .filter(s => {
      if (!s.fecha) return false;
      const date = (s.fecha as any).toDate ? (s.fecha as any).toDate() : new Date(s.fecha as any);
      if (isNaN(date.getTime())) return false;
      return date.toDateString() === new Date().toDateString();
    })
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditFormData({
      cantidad: sale.cantidad,
      precio: sale.precio,
      comboItems: sale.comboItems ? [...sale.comboItems] : []
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    try {
      await inventoryService.updateSale(editingSale.id, {
        cantidad: editFormData.cantidad,
        precio: editFormData.precio,
        comboItems: editFormData.comboItems
      });
      toast.success(t('sale_updated_success') || 'Venta actualizada correctamente');
      setIsEditModalOpen(false);
      setEditingSale(null);
      await refreshData();
    } catch (error) {
      toast.error(t('sale_updated_error') || 'Error al actualizar la venta');
    }
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (cart.length === 0) {
      toast.error(t('cart_empty_error'));
      return;
    }

    if (isComboSale && !comboSaleName.trim()) {
      toast.error(t('combo_name_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const finalTotal = saleTotalOverride ?? cartTotal;

      if (isComboSale) {
        await inventoryService.registerComboSale({
          nombre: comboSaleName,
          items: cart.map(item => ({
            productId: item.productId,
            productNombre: item.productNombre,
            cantidad: item.cantidad
          })),
          total: finalTotal,
          clientId: selectedClient?.id,
          clientNombre: selectedClient?.nombre
        });
      } else {
        const salesToRegister = cart.map(item => {
          // Distribute the final total proportionally
          const proportion = cartTotal > 0 ? item.total / cartTotal : 1 / cart.length;
          const distributedTotal = finalTotal * proportion;
          
          return {
            ...item,
            total: distributedTotal,
            precio: distributedTotal / item.cantidad,
            clientId: selectedClient?.id,
            clientNombre: selectedClient?.nombre
          };
        });

        await inventoryService.registerSale(salesToRegister);
      }

      toast.success(t('sale_registered_success'));
      setIsAddModalOpen(false);
      setCart([]);
      setSelectedClient(null);
      setIsComboSale(false);
      setComboSaleName('');
      setCurrentItem({ productId: '', productNombre: '', variantId: '', variantNombre: '', cantidad: 1, precioUnitario: 0, total: 0 });
      await refreshData();
    } catch (error) {
      toast.error(t('sale_registered_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToCart = () => {
    if (!currentItem.productId) {
      toast.error(t('select_product_error'));
      return;
    }
    const product = products.find(p => p.id === currentItem.productId);
    if (!product) return;

    if (product.hasVariants && !currentItem.variantId) {
      toast.error('Por favor, selecciona una variante (talle/color)');
      return;
    }

    let availableStock = product.cantidad;
    if (currentItem.variantId && product.variants?.length) {
      const variant = product.variants.find(v => v.id === currentItem.variantId);
      if (variant) {
        availableStock = variant.cantidad;
      }
    }

    if (availableStock < currentItem.cantidad) {
      toast.error(t('insufficient_stock_error'));
      return;
    }

    setCart([...cart, { ...currentItem }]);
    setCurrentItem({ productId: '', productNombre: '', variantId: '', variantNombre: '', cantidad: 1, precioUnitario: 0, total: 0 });
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;
    const idToDelete = saleToDelete;
    setIsDeleting(true);
    // Optimistic UI removal
    setSales(prev => prev.filter(s => s.id !== idToDelete));
    setIsDeleteModalOpen(false);
    setSaleToDelete(null);
    try {
      await inventoryService.deleteSale(idToDelete);
      toast.success(t('sale_deleted_success'));
      await refreshData();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error(t('sale_deleted_error'));
      await refreshData();
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setSaleToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleSaveCombo = async () => {
    if (cart.length === 0) {
      toast.error(t('cart_empty_error'));
      return;
    }
    if (!comboName.trim()) {
      toast.error(t('combo_name_required'));
      return;
    }

    try {
      const comboItems = cart.map(item => ({
        productId: item.productId,
        productNombre: item.productNombre,
        cantidad: item.cantidad
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
      return {
        productId: item.productId,
        productNombre: item.productNombre,
        cantidad: item.cantidad,
        total: product ? product.precio * item.cantidad : 0
      };
    });

    setCart(newCart);
    setSaleTotalOverride(combo.precioTotal);
    toast.success(t('combo_loaded_success'));
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
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading_sales')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Tab Navigator & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('ventas')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              activeTab === 'ventas'
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <TrendingUp size={16} className={activeTab === 'ventas' ? 'text-indigo-600 dark:text-indigo-400' : ''} />
            <span>Ventas Realizadas</span>
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black">
              {sales.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cotizaciones')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
              activeTab === 'cotizaciones'
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <FileText size={16} className={activeTab === 'cotizaciones' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
            <span>Cotizaciones & Presupuestos</span>
            {quotes.filter(q => q.estado === 'pendiente').length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black">
                {quotes.filter(q => q.estado === 'pendiente').length} pend.
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsNewQuoteModalOpen(true)}
            variant="outline"
            className="rounded-xl border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold"
          >
            <FilePlus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Nueva Cotización</span>
            <span className="sm:hidden">Cotizar</span>
          </Button>

          <Button 
            onClick={() => {
              setIsAddModalOpen(true);
            }}
            className="rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none font-bold"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('new_sale')}</span>
            <span className="sm:hidden">{t('add') || 'Vender'}</span>
          </Button>
        </div>
      </div>

      {activeTab === 'cotizaciones' ? (
        <QuotesView
          quotes={quotes}
          searchTerm={quoteSearchTerm}
          onSearchTermChange={setQuoteSearchTerm}
          statusFilter={quoteStatusFilter}
          onStatusFilterChange={setQuoteStatusFilter}
          onOpenNewQuote={() => {
            setEditingQuote(null);
            setIsNewQuoteModalOpen(true);
          }}
          onEditQuote={(quote) => {
            setEditingQuote(quote);
            setIsNewQuoteModalOpen(true);
          }}
          onOpenReceipt={(quote) => {
            setSelectedReceiptQuote(quote);
            setSelectedReceiptSale(null);
            setIsReceiptModalOpen(true);
          }}
          onConvertToSale={handleConvertToSale}
          onDeleteQuote={(quoteId) => {
            setQuoteToDelete(quoteId);
            setIsDeleteQuoteModalOpen(true);
          }}
          onRefresh={refreshData}
        />
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-indigo-100">{t('total_sold_today')}</p>
          <h3 className="text-2xl font-bold mt-1">${totalToday.toLocaleString()}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('sales_made')}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{sales.length}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Calendar size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('average_per_sale')}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            ${sales.length > 0 ? (sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0) / sales.length).toFixed(2) : '0.00'}
          </h3>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5" />
            <Input 
              placeholder={t('search_sales')} 
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
        <Button 
          onClick={() => {
            setIsAddModalOpen(true);
          }}
          className="rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5 sm:mr-2" />
          <span className="hidden sm:inline">{t('new_sale')}</span>
          <span className="sm:hidden">{t('add') || 'Vender'}</span>
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
                    <option value="14">{t('last_14_days')}</option>
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
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('qty')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('price')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('total')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('date')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('no_sales_found')}
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  let date: Date;
                  try {
                    date = (sale.fecha as any)?.toDate ? (sale.fecha as any).toDate() : new Date(sale.fecha as any);
                    if (isNaN(date.getTime())) date = new Date();
                  } catch (e) {
                    date = new Date();
                  }
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{sale.productNombre || t('no_name')}</p>
                          {sale.isCombo && (
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                              Combo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{sale.cantidad || 0}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">${sale.precio || 0}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">${sale.total || 0}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{date.toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            onClick={() => {
                              setSelectedReceiptSale(sale);
                              setSelectedReceiptQuote(null);
                              setIsReceiptModalOpen(true);
                            }}
                            title="Ver / Compartir Comprobante (No Fiscal)"
                          >
                            <FileText size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            onClick={() => handleEdit(sale)}
                            disabled={isDeleting}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            onClick={() => confirmDelete(sale.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
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
        {filteredSales.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400">
            {t('no_sales_found')}
          </div>
        ) : (
          filteredSales.map((sale) => {
            let date: Date;
            try {
              date = (sale.fecha as any)?.toDate ? (sale.fecha as any).toDate() : new Date(sale.fecha as any);
              if (isNaN(date.getTime())) date = new Date();
            } catch (e) {
              date = new Date();
            }
            return (
              <div key={sale.id} className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{sale.productNombre || t('no_name')}</p>
                      {sale.isCombo && (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                          Combo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{date.toLocaleDateString()}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      onClick={() => {
                        setSelectedReceiptSale(sale);
                        setSelectedReceiptQuote(null);
                        setIsReceiptModalOpen(true);
                      }}
                      title="Ver / Compartir Comprobante (No Fiscal)"
                    >
                      <FileText size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      onClick={() => handleEdit(sale)}
                      disabled={isDeleting}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      onClick={() => confirmDelete(sale.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('qty')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{sale.cantidad || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('price')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">${sale.precio || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('total')}</p>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">${sale.total || 0}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* Edit Sale Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('edit_sale') || 'Editar Venta'}
      >
        <form onSubmit={handleUpdateSale} className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t('product')}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{editingSale?.productNombre}</p>
          </div>

          {editingSale?.isCombo && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1">{t('combo_contents') || 'Contenido del Combo'}</h4>
              <div className="space-y-2">
                {editFormData.comboItems.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.productNombre}</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          value={item.cantidad}
                          onChange={(e) => {
                            const newItems = [...editFormData.comboItems];
                            newItems[index] = { ...item, cantidad: parseInt(e.target.value) || 0 };
                            setEditFormData({ ...editFormData, comboItems: newItems });
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-widest">un</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t('qty')}</label>
              <input
                type="number"
                min="1"
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                value={editFormData.cantidad}
                onChange={(e) => setEditFormData({ ...editFormData, cantidad: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t('price')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                value={editFormData.precio}
                onChange={(e) => setEditFormData({ ...editFormData, precio: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex justify-between items-center">
            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t('new_total') || 'Nuevo Total'}</p>
            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">${(editFormData.cantidad * editFormData.precio).toLocaleString()}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setIsEditModalOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20"
            >
              {t('save_changes')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Sale Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('new_sale')}
        className="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Client Selection (Optional with Usual/Frequent Clients) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Cliente (Opcional)
                </h4>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {selectedClient ? (
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    Asignado a: {selectedClient.nombre}
                  </span>
                ) : (
                  <span>Venta general sin cliente (Consumidor Final)</span>
                )}
              </span>
            </div>

            {/* Quick Chips: Consumidor Final & Clientes más usuales */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                  !selectedClient
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}
              >
                <span>Consumidor Final</span>
                {!selectedClient && <CheckCircle2 size={12} />}
              </button>

              {frequentClients.length > 0 && (
                <>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 ml-1">
                    Usuales:
                  </span>
                  {frequentClients.map(fc => {
                    const isSelected = selectedClient?.id === fc.id;
                    const count = sales.filter(s => s.clientId === fc.id).length;
                    return (
                      <button
                        key={fc.id}
                        type="button"
                        onClick={() => setSelectedClient(isSelected ? null : { id: fc.id, nombre: fc.nombre })}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                        )}
                      >
                        <span>{fc.nombre}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-black",
                          isSelected ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                        )}>
                          {count}
                        </span>
                        {isSelected && <CheckCircle2 size={12} />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Select Dropdown for all other registered clients */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setSelectedClient(client ? { id: client.id, nombre: client.nombre } : null);
                }}
                className="flex-1 min-w-[200px] px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-800 dark:text-gray-200"
              >
                <option value="">{selectedClient ? '-- Deseleccionar / Consumidor Final --' : 'Elegir otro cliente de la lista...'}</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.telefono ? `(${c.telefono})` : ''}
                  </option>
                ))}
              </select>

              {selectedClient && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                  className="h-8 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2 rounded-lg"
                >
                  <X size={14} className="mr-1" />
                  Quitar cliente
                </Button>
              )}
            </div>
          </div>

          {/* Add Item Section */}
          <div className="p-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t('add_products')}</h4>
              <div className="flex gap-2">
                {combos.length > 0 && (
                  <div className="relative group">
                    <Button variant="outline" size="sm" type="button" className="rounded-xl">
                      {t('load_combo')}
                    </Button>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest p-2 border-b border-gray-50 dark:border-gray-800 mb-2">
                        {t('select_combo')}
                      </p>
                      <div className="max-h-60 overflow-y-auto">
                        {combos.map(combo => (
                          <button
                            key={combo.id}
                            type="button"
                            onClick={() => handleLoadCombo(combo)}
                            className="w-full text-left p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors group/item"
                          >
                            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover/item:text-indigo-600">{combo.nombre}</p>
                            <p className="text-xs text-gray-500">${combo.precioTotal.toLocaleString()}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  type="button" 
                  className="rounded-xl"
                  onClick={() => setIsSaveComboModalOpen(true)}
                  disabled={cart.length === 0}
                >
                  {t('save_as_combo')}
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {selectedBaseProduct && (
                  <div className="md:col-span-12 mb-4 animate-in fade-in slide-in-from-left-2 duration-500">
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-[2rem] shadow-sm flex items-start gap-4 ring-2 ring-indigo-500/20">
                      <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl overflow-hidden shrink-0 border border-indigo-100 dark:border-indigo-800">
                        {selectedBaseProduct.representative.imagenUrl ? (
                          <img src={selectedBaseProduct.representative.imagenUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={32} className="text-indigo-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600 text-white rounded-lg uppercase tracking-widest">
                            {representativeProducts.find(p => p.id === selectedBaseProduct?.representative.id)?.codigo}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg uppercase tracking-widest">
                            {representativeProducts.find(p => p.id === selectedBaseProduct?.representative.id)?.procedencia}
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

                <div className="md:col-span-5">
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
                      setCurrentItem({
                        ...currentItem,
                        productId: '', 
                        productNombre: '',
                        variantId: '',
                        variantNombre: '',
                        total: 0
                      });
                    }}
                  />
                </div>
                
                {selectedBaseProduct && (
                  <div className="md:col-span-7 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block ml-1 mb-3">
                      Seleccionar Variante (Talle / Género / Ubicación)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedBaseProduct.originalProducts.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            const uPrice = variant.precio || 0;
                            setCurrentItem({
                              ...currentItem,
                              productId: variant.id,
                              productNombre: `${variant.descripcion || variant.codigo} (${variant.talle || 'N/A'} - ${variant.genero || 'N/A'})`,
                              variantId: variant.id,
                              variantNombre: variant.talle || 'N/A',
                              precioUnitario: uPrice,
                              total: currentItem.cantidad * uPrice
                            });
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-2xl border transition-all text-left",
                            currentItem.productId === variant.id
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-indigo-200"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-black uppercase", currentItem.productId === variant.id ? "text-white" : "text-gray-900 dark:text-white")}>
                                {variant.talle || 'N/A'}
                              </span>
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", currentItem.productId === variant.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                                {variant.genero || 'U'}
                              </span>
                            </div>
                            <p className={cn("text-[10px] truncate", currentItem.productId === variant.id ? "text-indigo-100" : "text-gray-400")}>
                              {variant.ubicacion || 'Sin Ubic.'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-[11px] font-black", currentItem.productId === variant.id ? "text-white" : "text-indigo-600")}>
                              ${variant.precio}
                            </p>
                            <p className={cn("text-[9px] font-bold", currentItem.productId === variant.id ? "text-white/60" : "text-gray-400")}>
                              Stock: {variant.cantidad}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {currentItem.productId && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-left-2 duration-300">
                  {/* Price Mode Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      Definir precio:
                    </span>
                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSalePriceMode('unit')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                          salePriceMode === 'unit'
                            ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Por Unidad
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalePriceMode('total')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                          salePriceMode === 'total'
                            ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Precio Total
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <Input 
                        label={t('qty')} 
                        type="number"
                        min="1" 
                        value={currentItem.cantidad}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value));
                          if (salePriceMode === 'total') {
                            const unitP = currentItem.total > 0 ? Math.round(currentItem.total / qty) : 0;
                            setCurrentItem({
                              ...currentItem,
                              cantidad: qty,
                              precioUnitario: unitP
                            });
                          } else {
                            setCurrentItem({
                              ...currentItem,
                              cantidad: qty,
                              total: qty * currentItem.precioUnitario
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input 
                        label={salePriceMode === 'unit' ? '⭐ Precio Unit. ($)' : 'Precio Unit. ($)'} 
                        type="number"
                        min="0" 
                        value={currentItem.precioUnitario || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const unitP = Math.max(0, Number(e.target.value));
                          setCurrentItem({
                            ...currentItem,
                            precioUnitario: unitP,
                            total: currentItem.cantidad * unitP
                          });
                        }}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input 
                        label={salePriceMode === 'total' ? '⭐ Total Item ($)' : 'Total Item ($)'} 
                        type="number"
                        min="0" 
                        value={currentItem.total || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const totalVal = Math.max(0, Number(e.target.value));
                          const unitP = currentItem.cantidad > 0 ? Math.round(totalVal / currentItem.cantidad) : totalVal;
                          setCurrentItem({
                            ...currentItem,
                            total: totalVal,
                            precioUnitario: unitP
                          });
                        }}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Button 
                        type="button" 
                        onClick={() => {
                          addToCart();
                          setSelectedBaseProduct(null);
                        }}
                        className="w-full rounded-2xl h-[42px] bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-wider shadow-lg shadow-indigo-100 dark:shadow-none text-xs"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {t('add')}
                      </Button>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-400 bg-gray-50 dark:bg-gray-800/40 px-3 py-1.5 rounded-xl flex items-center justify-between">
                    <span>{currentItem.cantidad} un. x ${currentItem.precioUnitario.toLocaleString('es-AR')}</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Total: ${currentItem.total.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">{t('items_in_sale')}</h4>
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-100 dark:border-gray-800 text-gray-400 text-sm">
                  {t('cart_empty')}
                </div>
              ) : (
                cart.map((item, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg">
                          <Package size={14} className="text-indigo-600" />
                        </div>
                        <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                          {item.productNombre}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-8">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          Cant: {item.cantidad ?? 0}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          Unit: ${(Number(item.cantidad) > 0 ? (Number(item.total) || 0) / Number(item.cantidad) : 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Subtotal</p>
                        <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                          ${item.total.toLocaleString()}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFromCart(idx)}
                        className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Footer Summary */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t('cart_subtotal')}</p>
                  <p className="text-xl font-bold text-gray-400 line-through">
                    ${cartTotal.toLocaleString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="isComboSale"
                    checked={isComboSale}
                    onChange={(e) => setIsComboSale(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isComboSale" className="text-sm font-bold text-indigo-900 dark:text-indigo-100 cursor-pointer">
                    {t('register_as_combo')}
                  </label>
                </div>

                {isComboSale && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Input 
                      label={t('combo_sale_name')}
                      placeholder="Ej: Combo Medias x15"
                      value={comboSaleName}
                      onChange={(e) => setComboSaleName(e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
              <div>
                <Input 
                  label={t('final_sale_total')} 
                  type="number" 
                  value={saleTotalOverride ?? cartTotal}
                  onChange={(e) => setSaleTotalOverride(Number(e.target.value))}
                  className="text-2xl font-black text-indigo-600 dark:text-indigo-400 h-14"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>{t('cancel')}</Button>
              <Button 
                type="button"
                variant="outline"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleQuoteFromCart}
                className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold text-xs"
                title="Generar comprobante de cotización no fiscal sin descontar stock"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Cotizar este Carrito
              </Button>
              <Button 
                onClick={handleRegisterSale}
                disabled={cart.length === 0 || isSubmitting}
                className="shadow-lg shadow-indigo-200 dark:shadow-none min-w-[140px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  isComboSale ? t('confirm_as_combo') : t('confirm_sale')
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isSaveComboModalOpen}
        onClose={() => setIsSaveComboModalOpen(false)}
        title={t('save_as_combo')}
      >
        <div className="space-y-4">
          <Input
            label={t('combo_name')}
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
            placeholder="Ej: Combo Desayuno"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsSaveComboModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveCombo}>
              {t('save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Sales */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteSale}
        title={t('delete_sale')}
        message={t('delete_sale_confirm')}
        confirmLabel={t('delete')}
        isLoading={isDeleting}
      />

      {/* Confirmation Modal for Quotes */}
      <ConfirmationModal 
        isOpen={isDeleteQuoteModalOpen}
        onClose={() => setIsDeleteQuoteModalOpen(false)}
        onConfirm={handleDeleteQuote}
        title="Eliminar Cotización"
        message="¿Estás seguro de que deseas eliminar este presupuesto/cotización? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />

      {/* Receipt Modal (Presupuestos & Comprobantes No Fiscales) */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        quote={selectedReceiptQuote}
        sale={selectedReceiptSale}
        onConvertToSale={handleConvertToSale}
      />

      {/* New / Edit Quote Modal */}
      <NewQuoteModal
        isOpen={isNewQuoteModalOpen}
        onClose={() => {
          setIsNewQuoteModalOpen(false);
          setEditingQuote(null);
        }}
        products={products}
        clients={clients}
        quoteToEdit={editingQuote}
        onSaveQuote={handleSaveQuote}
        onUpdateQuote={handleUpdateQuote}
        onSaveAndOpenReceipt={(q) => {
          setSelectedReceiptQuote(q);
          setSelectedReceiptSale(null);
          setIsReceiptModalOpen(true);
        }}
      />
    </div>
  );
}
