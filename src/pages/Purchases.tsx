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
  Clock,
  FileText,
  Printer,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Eye,
  SlidersHorizontal,
  Send,
  Download,
  Receipt,
  FileCheck,
  Edit3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, RefreshButton } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import ProductSearch from '../components/ProductSearch';
import { Purchase, Product, PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItem } from '../types';
import { cn } from '../utils/cn';
import { inventoryService } from '../services/inventoryService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { PurchaseOrderModal } from '../components/purchases/PurchaseOrderModal';
import { GoodsReceiptModal } from '../components/purchases/GoodsReceiptModal';
import { PurchaseOrderPrintTicket } from '../components/purchases/PurchaseOrderPrintTicket';
import { RestockAssistant } from '../components/purchases/RestockAssistant';
import { SupplierPayablesTab } from '../components/purchases/SupplierPayablesTab';
import { SupplierPayablesModal } from '../components/purchases/SupplierPayablesModal';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Purchases() {
  const { t, loading: settingsLoading, mobileCompactMode } = useSettings();
  const { products, refreshProducts: refreshAllProducts } = useProducts();
  const navigate = useNavigate();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'purchases' | 'orders' | 'restock' | 'payables' | 'suppliers'>('purchases');

  // Purchases state
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [receiptPurchase, setReceiptPurchase] = useState<Purchase | null>(null);

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<PurchaseOrder | null>(null);
  const [orderInitialItems, setOrderInitialItems] = useState<PurchaseOrderItem[] | undefined>(undefined);
  const [orderInitialSupplier, setOrderInitialSupplier] = useState<string | undefined>(undefined);
  const [orderToPrint, setOrderToPrint] = useState<PurchaseOrder | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | PurchaseOrderStatus>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isDeleteOrderModalOpen, setIsDeleteOrderModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Accounts Payable state
  const [payableOrderToEdit, setPayableOrderToEdit] = useState<PurchaseOrder | null>(null);
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    dateRange: 'all' as 'all' | '7' | '30' | 'custom',
    customStart: '',
    customEnd: '',
    productId: 'all'
  });

  const [formData, setFormData] = useState({
    productId: '',
    productNombre: '',
    cantidad: '' as any,
    costo: '' as any,
    proveedor: ''
  });

  const [selectedBaseProduct, setSelectedBaseProduct] = useState<any | null>(null);

  const groupedProducts = useMemo(() => {
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

  const representativeProducts = useMemo(() => 
    groupedProducts.map(g => g.representative),
    [groupedProducts]
  );

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [pu, po] = await Promise.all([
          inventoryService.getPurchases(50),
          purchaseOrderService.getPurchaseOrders()
        ]);
        setPurchases(pu);
        setPurchaseOrders(po);
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
      const [pu, po] = await Promise.all([
        inventoryService.getPurchases(50),
        purchaseOrderService.getPurchaseOrders(),
        refreshAllProducts()
      ]);
      setPurchases(pu);
      setPurchaseOrders(po);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
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

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(o => {
      const matchesStatus = orderStatusFilter === 'all' || o.estado === orderStatusFilter;
      if (!matchesStatus) return false;

      const term = orderSearchTerm.toLowerCase();
      const matchesSearch = 
        (o.numero || '').toLowerCase().includes(term) ||
        (o.proveedor || '').toLowerCase().includes(term) ||
        (o.items || []).some(it => (it.productNombre || '').toLowerCase().includes(term));

      return matchesSearch;
    });
  }, [purchaseOrders, orderStatusFilter, orderSearchTerm]);

  // Suppliers Directory Summary
  const suppliersDirectory = useMemo(() => {
    const map = new Map<string, {
      name: string;
      totalInvested: number;
      totalUnits: number;
      purchasesCount: number;
      lastDate: Date;
      phone?: string;
    }>();

    purchases.forEach(p => {
      const name = p.proveedor || 'Sin Proveedor';
      let date: Date;
      try {
        date = (p.fecha as any)?.toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
        if (isNaN(date.getTime())) date = new Date();
      } catch (e) {
        date = new Date();
      }

      const existing = map.get(name);
      if (!existing) {
        map.set(name, {
          name,
          totalInvested: Number(p.total) || 0,
          totalUnits: Number(p.cantidad) || 0,
          purchasesCount: 1,
          lastDate: date
        });
      } else {
        existing.totalInvested += Number(p.total) || 0;
        existing.totalUnits += Number(p.cantidad) || 0;
        existing.purchasesCount += 1;
        if (date > existing.lastDate) {
          existing.lastDate = date;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalInvested - a.totalInvested);
  }, [purchases]);

  const totalMonth = purchases
    .filter(p => {
      if (!p.fecha) return false;
      const date = (p.fecha as any).toDate ? (p.fecha as any).toDate() : new Date(p.fecha as any);
      if (isNaN(date.getTime())) return false;
      return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
    })
    .reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  const criticalStockCount = useMemo(() => {
    return products.filter(p => {
      const minStock = p.stockMinimo !== undefined && p.stockMinimo !== null ? p.stockMinimo : 5;
      return p.cantidad <= minStock;
    }).length;
  }, [products]);

  const totalSupplierDebt = useMemo(() => {
    return purchaseOrders.reduce((acc, o) => {
      const tot = Number(o.total) || 0;
      const paid = Number(o.montoPagado) || 0;
      return acc + Math.max(0, tot - paid);
    }, 0);
  }, [purchaseOrders]);

  const handleGeneratePurchaseOrderFromRestock = (items: PurchaseOrderItem[], defaultSupplier?: string) => {
    setOrderToEdit(null);
    setOrderInitialItems(items);
    setOrderInitialSupplier(defaultSupplier);
    setIsOrderModalOpen(true);
  };

  const handleOpenPaymentModal = (order: PurchaseOrder) => {
    setPayableOrderToEdit(order);
    setIsPayableModalOpen(true);
  };

  const handleSaveSupplierPayment = async (orderId: string, updates: Partial<PurchaseOrder>) => {
    try {
      await purchaseOrderService.updatePurchaseOrder(orderId, updates);
      await refreshData();
    } catch (error) {
      console.error('Error updating supplier payment:', error);
      throw error;
    }
  };

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
      await refreshData();
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

  // Save or edit Purchase Order
  const handleSavePurchaseOrder = async (data: Partial<PurchaseOrder>) => {
    try {
      if (orderToEdit) {
        await purchaseOrderService.updatePurchaseOrder(orderToEdit.id, data);
        toast.success('Orden de compra actualizada');
      } else {
        await purchaseOrderService.createPurchaseOrder(data);
        toast.success('¡Orden de compra creada exitosamente!');
      }
      setIsOrderModalOpen(false);
      setOrderToEdit(null);
      await refreshData();
    } catch (error) {
      console.error('Error al guardar orden:', error);
      toast.error('Error al guardar la orden de compra');
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      await purchaseOrderService.deletePurchaseOrder(orderToDelete);
      toast.success('Orden de compra eliminada');
      setIsDeleteOrderModalOpen(false);
      setOrderToDelete(null);
      await refreshData();
    } catch (error) {
      toast.error('Error al eliminar orden de compra');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: PurchaseOrderStatus) => {
    try {
      await purchaseOrderService.updateOrderStatus(orderId, status);
      toast.success(`Estado de orden actualizado a: ${status.toUpperCase()}`);
      await refreshData();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleReceiveGoods = async (order: PurchaseOrder) => {
    try {
      toast.info('Recibiendo mercadería e incrementando stock...');
      const receipts = order.items.map(it => ({
        productId: it.productId,
        cantidadRecibida: it.cantidad
      }));
      await purchaseOrderService.receiveGoods(order.id, receipts, `Recepción completa de OC ${order.numero}`);
      toast.success('¡Mercadería recibida e inventario actualizado!');
      await refreshData();
    } catch (error) {
      console.error('Error al recibir mercadería:', error);
      toast.error('Error al procesar la recepción');
    }
  };

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState<any[]>([]);
  const [bulkProveedor, setBulkProveedor] = useState('');

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
      await refreshData();
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-emerald-600 p-5 rounded-3xl text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShoppingCart size={18} />
            </div>
          </div>
          <p className="text-xs font-medium text-emerald-100">{t('total_purchased_month')}</p>
          <h3 className="text-xl font-black mt-0.5">${totalMonth.toLocaleString()}</h3>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('restock')}
          className={cn(
            "p-5 rounded-3xl border transition-all text-left group",
            activeTab === 'restock'
              ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200 dark:shadow-none"
              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={cn(
              "p-2 rounded-xl",
              activeTab === 'restock' ? "bg-white/20 text-white" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
            )}>
              <AlertCircle size={18} />
            </div>
            {criticalStockCount > 0 && (
              <span className={cn(
                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                activeTab === 'restock' ? "bg-white text-amber-600" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse"
              )}>
                {criticalStockCount} Críticos
              </span>
            )}
          </div>
          <p className={cn("text-xs font-medium", activeTab === 'restock' ? "text-amber-100" : "text-gray-500")}>
            Reposición de Stock
          </p>
          <h3 className={cn("text-xl font-black mt-0.5", activeTab === 'restock' ? "text-white" : "text-amber-600 dark:text-amber-400")}>
            {criticalStockCount} a reponer
          </h3>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payables')}
          className={cn(
            "p-5 rounded-3xl border transition-all text-left group",
            activeTab === 'payables'
              ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200 dark:shadow-none"
              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-rose-300"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={cn(
              "p-2 rounded-xl",
              activeTab === 'payables' ? "bg-white/20 text-white" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600"
            )}>
              <ArrowDownRight size={18} />
            </div>
            {totalSupplierDebt > 0 && (
              <span className={cn(
                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                activeTab === 'payables' ? "bg-white text-rose-600" : "bg-rose-100 text-rose-700"
              )}>
                Saldo Activo
              </span>
            )}
          </div>
          <p className={cn("text-xs font-medium", activeTab === 'payables' ? "text-rose-100" : "text-gray-500")}>
            Cuentas por Pagar
          </p>
          <h3 className={cn("text-xl font-black mt-0.5", activeTab === 'payables' ? "text-white" : "text-rose-600 dark:text-rose-400")}>
            ${totalSupplierDebt.toLocaleString()}
          </h3>
        </button>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText size={18} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Órdenes de Compra</p>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
            {purchaseOrders.length} <span className="text-xs font-normal text-amber-600 font-sans">({purchaseOrders.filter(o => o.estado === 'enviada').length} pend.)</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Proveedores</p>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
            {suppliersDirectory.length} activos
          </h3>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'purchases'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <Package size={16} />
            <span>Entradas de Stock ({filteredPurchases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative",
              activeTab === 'orders'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <FileText size={16} />
            <span>Órdenes de Compra ({purchaseOrders.length})</span>
            {purchaseOrders.filter(o => o.estado === 'enviada').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restock')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative",
              activeTab === 'restock'
                ? "bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <AlertCircle size={16} />
            <span>Reposición Inteligente</span>
            {criticalStockCount > 0 && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                activeTab === 'restock' ? "bg-white text-amber-600" : "bg-rose-500 text-white"
              )}>
                {criticalStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payables')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative",
              activeTab === 'payables'
                ? "bg-rose-600 text-white shadow-md shadow-rose-200 dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <ArrowDownRight size={16} />
            <span>Cuentas por Pagar</span>
            {totalSupplierDebt > 0 && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                activeTab === 'payables' ? "bg-white text-rose-600" : "bg-rose-100 text-rose-700"
              )}>
                ${totalSupplierDebt.toLocaleString('es-AR')}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'suppliers'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <Truck size={16} />
            <span>Directorio de Proveedores ({suppliersDirectory.length})</span>
          </button>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              setOrderToEdit(null);
              setIsOrderModalOpen(true);
            }} 
            className="rounded-xl shadow-sm text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Nueva Orden de Compra</span>
          </Button>

          <Button 
            onClick={() => setIsAddModalOpen(true)} 
            className="rounded-xl shadow-sm text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Entrada Rápida</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setIsBulkModalOpen(true)} 
            className="rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 text-xs font-bold"
          >
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            <span>Entrada Masiva</span>
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PURCHASES / ENTRADAS DE STOCK                     */}
      {/* ========================================================= */}
      {activeTab === 'purchases' && (
        <div className="space-y-6">
          {/* Header Actions & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 pointer-events-none" />
                <Input 
                  placeholder="Buscar por producto o proveedor..." 
                  className="pl-12" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <RefreshButton 
                onRefresh={refreshData}
                isLoading={isLoading}
                label={t('refresh') || 'Actualizar'}
                title="Actualizar datos de compras"
              />
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
                        {t('clear_all_filters')}
                      </Button>
                    </div>
                  </div>
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
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
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
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{purchase.proveedor}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold rounded-lg text-xs">
                              {purchase.cantidad} un.
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">${purchase.costo?.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${purchase.total?.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                                onClick={() => setReceiptPurchase(purchase)}
                                title="Ver / Imprimir Remito de Recepción"
                              >
                                <FileText size={16} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                                onClick={() => confirmDelete(purchase.id)}
                                disabled={isDeleting}
                                title="Eliminar registro"
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
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
                          onClick={() => setReceiptPurchase(purchase)}
                          title="Ver Remito"
                        >
                          <FileText size={16} />
                        </Button>
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
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{t('qty_short')}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{purchase.cantidad}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{t('cost')}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${purchase.costo?.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{t('total')}</p>
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${purchase.total?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PURCHASE ORDERS (ÓRDENES DE COMPRA)               */}
      {/* ========================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Order Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 pointer-events-none" />
                <Input 
                  placeholder="Buscar por N° de orden, proveedor o producto..." 
                  className="pl-12" 
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
              {(['all', 'borrador', 'enviada', 'parcial', 'recibida', 'cancelada'] as const).map(st => {
                const isSelected = orderStatusFilter === st;
                const labelMap: Record<string, string> = {
                  all: 'Todas',
                  borrador: 'Borrador',
                  enviada: 'Enviadas',
                  parcial: 'Parcial',
                  recibida: 'Recibidas',
                  cancelada: 'Canceladas'
                };
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderStatusFilter(st)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                      isSelected
                        ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                  >
                    {labelMap[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orders Grid */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-gray-100 dark:border-gray-800 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <FileText size={28} />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">No se encontraron órdenes de compra</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Crea una orden formal para solicitar stock a tus proveedores y realizar seguimiento hasta su entrega.
                </p>
              </div>
              <Button 
                onClick={() => {
                  setOrderToEdit(null);
                  setIsOrderModalOpen(true);
                }}
                className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus size={16} className="mr-1.5" />
                Crear Primera Orden de Compra
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrders.map(order => {
                const dateStr = new Date(order.fechaEmision).toLocaleDateString('es-AR');
                const totalUnits = (order.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);

                const statusBg: Record<PurchaseOrderStatus, string> = {
                  borrador: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                  enviada: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200',
                  parcial: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200',
                  recibida: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200',
                  cancelada: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                };

                return (
                  <div 
                    key={order.id} 
                    className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                  >
                    <div>
                      {/* Top bar */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                            {order.numero}
                          </span>
                          <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight mt-0.5">
                            {order.proveedor}
                          </h4>
                          <p className="text-[11px] text-gray-400">
                            Emisión: {dateStr}
                            {order.fechaEsperada && ` • Entrega: ${order.fechaEsperada}`}
                          </p>
                        </div>
                        <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded-full", statusBg[order.estado])}>
                          {order.estado}
                        </span>
                      </div>

                      {/* Items list preview */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 my-3 space-y-1.5 border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <span>Artículos ({order.items.length})</span>
                          <span>{totalUnits} un. totales</span>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-24 overflow-y-auto pr-1">
                          {order.items.slice(0, 3).map((it, idx) => (
                            <div key={idx} className="py-1 flex justify-between items-center text-xs">
                              <span className="truncate pr-2 font-medium text-gray-700 dark:text-gray-300">
                                <strong className="text-gray-900 dark:text-white">{it.cantidad}x</strong> {it.productNombre}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                ${(it.subtotal || it.cantidad * it.costoEstimado).toLocaleString()}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <p className="text-[10px] text-gray-400 italic pt-1">
                              + {order.items.length - 3} artículos más...
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Total and condition */}
                      <div className="flex items-baseline justify-between pt-1 mb-4">
                        <span className="text-xs text-gray-400">
                          {order.condicionPago || 'Contado'}
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase">Total Orden</span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            ${order.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderToPrint(order)}
                          className="h-8 px-2 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl"
                          title="Imprimir / Ver Comprobante formal"
                        >
                          <Printer size={14} className="mr-1" />
                          Imprimir
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = purchaseOrderService.getWhatsAppMessage(order);
                            window.open(url, '_blank');
                          }}
                          className="h-8 px-2 text-xs font-bold text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 rounded-xl"
                          title="Enviar Orden a Proveedor por WhatsApp"
                        >
                          <MessageCircle size={14} className="mr-1" />
                          WhatsApp
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        {order.estado !== 'recibida' && (
                          <Button
                            size="sm"
                            onClick={() => handleReceiveGoods(order)}
                            className="h-8 px-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                            title="Recibir e ingresar artículos directamente al inventario"
                          >
                            <FileCheck size={14} className="mr-1" />
                            Recibir
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setOrderToEdit(order);
                            setIsOrderModalOpen(true);
                          }}
                          className="h-8 w-8 text-gray-500 hover:text-indigo-600 rounded-xl"
                          title="Editar orden"
                        >
                          <Edit3 size={15} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setOrderToDelete(order.id);
                            setIsDeleteOrderModalOpen(true);
                          }}
                          className="h-8 w-8 text-gray-400 hover:text-rose-600 rounded-xl"
                          title="Eliminar orden"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SUPPLIERS DIRECTORY (DIRECTORIO DE PROVEEDORES)   */}
      {/* ========================================================= */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Directorio de Proveedores & Métricas</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Historial de compras acumuladas, volumen suministrado y generación directa de nuevas órdenes.
              </p>
            </div>
            <Button
              onClick={() => {
                setOrderToEdit(null);
                setIsOrderModalOpen(true);
              }}
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus size={15} className="mr-1.5" />
              Nueva Orden a Proveedor
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {suppliersDirectory.map(sup => (
              <div 
                key={sup.name}
                className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <Building2 size={22} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
                      {sup.purchasesCount} compras
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                    {sup.name}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Última compra: {sup.lastDate.toLocaleDateString('es-AR')}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Invertido</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ${sup.totalInvested.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Unidades Suministradas</span>
                      <span className="text-base font-bold text-gray-800 dark:text-white">
                        {sup.totalUnits} un.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOrderToEdit({
                        id: '',
                        numero: '',
                        proveedor: sup.name,
                        fechaEmision: new Date().toISOString(),
                        estado: 'borrador',
                        items: [],
                        subtotal: 0,
                        total: 0,
                        createdBy: 'admin'
                      });
                      setIsOrderModalOpen(true);
                    }}
                    className="w-full text-xs font-bold rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus size={14} className="mr-1" />
                    Crear Orden para {sup.name}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: RESTOCK ASSISTANT (REPOSICIÓN INTELIGENTE)        */}
      {/* ========================================================= */}
      {activeTab === 'restock' && (
        <RestockAssistant
          products={products}
          onGeneratePurchaseOrder={handleGeneratePurchaseOrderFromRestock}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 5: SUPPLIER PAYABLES (CUENTAS POR PAGAR PROVEEDORES) */}
      {/* ========================================================= */}
      {activeTab === 'payables' && (
        <SupplierPayablesTab
          orders={purchaseOrders}
          onOpenPaymentModal={handleOpenPaymentModal}
          onViewReceipt={(order) => setOrderToPrint(order)}
        />
      )}

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* Add Single Purchase Modal */}
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
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
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
                    placeholder="Ej: Distribuidora Central" 
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

      {/* Delete Purchase Confirmation Modal */}
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

      {/* Delete Purchase Order Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isDeleteOrderModalOpen}
        onClose={() => setIsDeleteOrderModalOpen(false)}
        onConfirm={handleDeleteOrder}
        title="Eliminar Orden de Compra"
        message="¿Estás seguro de que deseas eliminar esta orden de compra? Esta acción no se puede deshacer."
        confirmLabel="Eliminar Orden"
        cancelLabel="Cancelar"
        isLoading={isDeletingOrder}
      />

      {/* Goods Receipt / Remito Modal */}
      <GoodsReceiptModal 
        purchase={receiptPurchase}
        onClose={() => setReceiptPurchase(null)}
      />

      {/* Purchase Order Create / Edit Modal */}
      <PurchaseOrderModal 
        isOpen={isOrderModalOpen}
        orderToEdit={orderToEdit}
        initialItems={orderInitialItems}
        initialSupplier={orderInitialSupplier}
        onClose={() => {
          setIsOrderModalOpen(false);
          setOrderToEdit(null);
          setOrderInitialItems(undefined);
          setOrderInitialSupplier(undefined);
        }}
        onSave={handleSavePurchaseOrder}
      />

      {/* Supplier Payables Registration Modal */}
      <SupplierPayablesModal
        isOpen={isPayableModalOpen}
        order={payableOrderToEdit}
        onClose={() => {
          setIsPayableModalOpen(false);
          setPayableOrderToEdit(null);
        }}
        onSavePayment={handleSaveSupplierPayment}
      />

      {/* Purchase Order Formal Print Ticket */}
      {orderToPrint && (
        <PurchaseOrderPrintTicket 
          order={orderToPrint}
          onClose={() => setOrderToPrint(null)}
        />
      )}
    </div>
  );
}
