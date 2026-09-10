/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { 
  useState, 
  useEffect, 
  useMemo, 
  useCallback, 
  useRef, 
  useDeferredValue 
} from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  PlusCircle, 
  MinusCircle,
  QrCode,
  Package,
  Loader2,
  AlertCircle,
  History,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Database,
  FileText,
  Share2,
  X,
  Upload,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { Button, Input } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import ProductSearch from '../components/ProductSearch';
import BulkUpload from '../components/BulkUpload';
import ImageCropperModal from '../components/ImageCropperModal';
import { StockIntelligence } from '../components/StockIntelligence';
import { Product, Warehouse, Movement, Sale } from '../types';
import { cn } from '../utils/cn';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts } from '../contexts/ProductsContext';

export default function Inventory() {
  const { t, loading: settingsLoading, mobileCompactMode } = useSettings();
  const { products: allProducts, isLoading: productsLoading, refreshProducts: refreshAllProducts } = useProducts();
  const location = useLocation();
  const navigate = useNavigate();
  const [displayLimit, setDisplayLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [productMovements, setProductMovements] = useState<Movement[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [duplicateProducts, setDuplicateProducts] = useState<Product[]>([]);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'inteligencia'>('stock');
  const [showFilters, setShowFilters] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    almacenId: 'all',
    procedencia: 'all',
    estado: 'all'
  });

  // Form state for add/edit
  const [formData, setFormData] = useState({
    codigo: '',
    descripcion: '',
    procedencia: 'Legítimo' as any,
    estado: 'Nuevo' as any,
    cantidad: '' as any,
    precio: '' as any,
    costo: '' as any,
    minStock: '' as any,
    talle: '',
    genero: '',
    ubicacion: '',
    almacenId: '',
    imagenUrl: '',
  });

  const [newVariantData, setNewVariantData] = useState({
    talle: '',
    cantidad: '',
    precio: '',
    costo: '',
    genero: '',
    ubicacion: '',
    almacenId: '',
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [warehousesData, salesData] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getSales()
        ]);
        setWarehouses(warehousesData);
        setSales(salesData);
        if (warehousesData.length > 0 && !formData.almacenId) {
          setFormData(prev => ({ ...prev, almacenId: warehousesData[0].id }));
        }
      } catch (error) {
        console.error('Error fetching inventory data:', error);
      }
    };
    fetchInitialData();
  }, []);

  const loadMore = () => {
    setDisplayLimit(prev => prev + 20);
  };

  const refreshProducts = async () => {
    try {
      await refreshAllProducts();
    } catch (error) {
      console.error('Error refreshing products:', error);
    }
  };

  useEffect(() => {
    const checkCode = async () => {
      if (formData.codigo.length > 2 && isAddModalOpen) {
        setIsCheckingCode(true);
        const existing = await inventoryService.getProductsByCode(formData.codigo);
        setDuplicateProducts(existing);
        setIsCheckingCode(false);
      } else {
        setDuplicateProducts([]);
      }
    };

    const timer = setTimeout(checkCode, 500);
    return () => clearTimeout(timer);
  }, [formData.codigo, isAddModalOpen]);

  const filteredProducts = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    const { almacenId, procedencia, estado } = filters;
    const isLowStockFilter = location.state?.filter === 'low-stock';

    let result = allProducts.filter(p => {
      // Search term filter
      const matchesSearch = !term || 
        p.codigo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term) ||
        (p.talle && p.talle.toLowerCase().includes(term)) ||
        (p.genero && p.genero.toLowerCase().includes(term)) ||
        p.ubicacion.toLowerCase().includes(term);
      
      if (!matchesSearch) return false;

      // Almacen filter
      if (almacenId !== 'all' && p.almacenId !== almacenId) return false;

      // Procedencia filter
      if (procedencia !== 'all' && p.procedencia !== procedencia) return false;

      // Estado filter
      if (estado !== 'all' && p.estado !== estado) return false;

      // Low stock filter
      if (isLowStockFilter && p.cantidad > (p.minStock || 3)) return false;

      return true;
    });

    if (isLowStockFilter) {
      result.sort((a, b) => a.cantidad - b.cantidad);
    }

    return result;
  }, [allProducts, deferredSearchTerm, location.state, filters]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      codigo: string;
      descripcion: string;
      procedencia: string;
      estado: string;
      precio: number;
      costo: number;
      minStock: number;
      almacenId: string;
      totalCantidad: number;
      imagenUrl?: string;
      locations: { id: string, ubicacion: string, cantidad: number, almacenId: string }[];
      originalProducts: Product[];
    }> = {};

    filteredProducts.forEach(p => {
      const groupKey = `${p.codigo}_${p.descripcion}_${p.procedencia}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          codigo: p.codigo,
          descripcion: p.descripcion,
          procedencia: p.procedencia,
          estado: p.estado,
          precio: p.precio,
          costo: p.costo,
          minStock: p.minStock || 3,
          almacenId: p.almacenId,
          totalCantidad: 0,
          imagenUrl: p.imagenUrl,
          locations: [],
          originalProducts: []
        };
      }
      groups[groupKey].totalCantidad += p.cantidad;
      
      // Ensure we don't add duplicate locations for the same doc if filteredProducts somehow has dupes
      if (!groups[groupKey].originalProducts.some(orig => orig.id === p.id)) {
        groups[groupKey].locations.push({ id: p.id, ubicacion: p.ubicacion, cantidad: p.cantidad, almacenId: p.almacenId });
        groups[groupKey].originalProducts.push(p);
      }
    });

    return Object.values(groups);
  }, [filteredProducts]);

  const displayedGroups = useMemo(() => {
    return groupedProducts.slice(0, displayLimit);
  }, [groupedProducts, displayLimit]);

  const hasMore = displayLimit < groupedProducts.length;

  // All filtered product IDs (underlying documents in current filtered view)
  const allFilteredProductIds = useMemo(() => {
    return filteredProducts.map(p => p.id);
  }, [filteredProducts]);

  const isAllSelected = allFilteredProductIds.length > 0 && allFilteredProductIds.every(id => selectedProductIds.has(id));
  const isSomeSelected = selectedProductIds.size > 0;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(allFilteredProductIds));
    }
  };

  const isGroupSelected = useCallback((group: typeof groupedProducts[0]) => {
    if (!group.originalProducts.length) return false;
    return group.originalProducts.every(p => selectedProductIds.has(p.id));
  }, [selectedProductIds]);

  const isGroupPartiallySelected = useCallback((group: typeof groupedProducts[0]) => {
    const someSelected = group.originalProducts.some(p => selectedProductIds.has(p.id));
    return someSelected && !group.originalProducts.every(p => selectedProductIds.has(p.id));
  }, [selectedProductIds]);

  const handleToggleSelectGroup = (group: typeof groupedProducts[0], e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      const groupIds = group.originalProducts.map(p => p.id);
      const allIn = groupIds.every(id => next.has(id));
      if (allIn) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedProductIds);
      await inventoryService.deleteProductsBatch(idsToDelete);
      await refreshAllProducts();
      toast.success(`Se eliminaron ${idsToDelete.length} producto${idsToDelete.length > 1 ? 's' : ''} correctamente.`);
      setSelectedProductIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      toast.error('Error al eliminar los productos seleccionados');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Clean up selected IDs if products are removed from outside
  useEffect(() => {
    if (selectedProductIds.size === 0) return;
    const existingIds = new Set(allProducts.map(p => p.id));
    let changed = false;
    const next = new Set<string>();
    selectedProductIds.forEach(id => {
      if (existingIds.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    });
    if (changed) {
      setSelectedProductIds(next);
    }
  }, [allProducts]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Allowed 2MB for the initial file, then crop will reduce it
        toast.error("La imagen es muy pesada. Redúcela a menos de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent, keepCode: boolean = false) => {
    if (e) e.preventDefault();
    try {
      await inventoryService.addProduct({
        ...formData,
        cantidad: Number(formData.cantidad) || 0,
        precio: Number(formData.precio) || 0,
        costo: Number(formData.costo) || 0,
        minStock: Number(formData.minStock) || 3,
        talle: formData.talle,
        genero: formData.genero,
        imagenUrl: formData.imagenUrl
      });
      await refreshAllProducts();
      toast.success(t('product_added_success'));
      
      if (keepCode) {
        const currentCode = formData.codigo;
        resetForm();
        setFormData(prev => ({ ...prev, codigo: currentCode }));
        toast.info("Datos limpiados. Código mantenido para nueva variante.");
      } else {
        setIsAddModalOpen(false);
        resetForm();
      }
    } catch (error) {
      toast.error(t('product_added_error'));
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const wasInDetailModal = isDetailModalOpen;
    setIsLoading(true);
    try {
      const updatedData = {
        ...formData,
        cantidad: Number(formData.cantidad) || 0,
        precio: Number(formData.precio) || 0,
        costo: Number(formData.costo) || 0,
        minStock: Number(formData.minStock) || 3,
        talle: formData.talle,
        genero: formData.genero,
        imagenUrl: formData.imagenUrl,
      };
      
      await inventoryService.updateProduct(selectedProduct.id, updatedData);
      
      // Update local state immediately for better UX
      setSelectedProduct({ ...selectedProduct, ...updatedData });
      
      // Background refresh
      refreshProducts().catch(console.error);
      
      toast.success(t('product_updated_success'));
      setIsEditModalOpen(false);
      
      // If we want to return to details modal or keep it open
      if (wasInDetailModal) {
        setIsDetailModalOpen(true);
      }
      
      resetForm();
    } catch (error) {
      toast.error(t('product_updated_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.deleteProduct(productToDelete);
      await refreshAllProducts();
      toast.success(t('product_deleted_success'));
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      toast.error(t('product_deleted_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setProductToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleStockChange = async (product: Product, delta: number) => {
    const newQuantity = product.cantidad + delta;
    if (newQuantity < 0) return;
    try {
      await inventoryService.updateProduct(product.id, { cantidad: newQuantity });
      toast.success(`${t('stock_updated')}: ${newQuantity}`);
    } catch (error) {
      toast.error(t('stock_update_error'));
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      descripcion: '',
      procedencia: 'Legítimo',
      estado: 'Nuevo',
      cantidad: '',
      precio: '',
      costo: '',
      minStock: '3',
      talle: '',
      genero: '',
      ubicacion: '',
      almacenId: warehouses.length > 0 ? warehouses[0].id : '',
      imagenUrl: '',
    });
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      codigo: product.codigo || '',
      descripcion: product.descripcion || '',
      procedencia: product.procedencia || 'Legítimo',
      estado: product.estado || 'Nuevo',
      cantidad: (product.cantidad ?? 0).toString(),
      precio: (product.precio ?? 0).toString(),
      costo: (product.costo ?? 0).toString(),
      minStock: (product.minStock ?? 3).toString(),
      talle: product.talle || '',
      genero: product.genero || '',
      ubicacion: product.ubicacion || '',
      almacenId: product.almacenId || '',
      imagenUrl: product.imagenUrl || '',
    });
    setIsEditModalOpen(true);
  };

  const handleAddVariant = async () => {
    if (!selectedProduct) return;
    if (!newVariantData.talle || !newVariantData.cantidad || !newVariantData.genero) {
      toast.error("Por favor completa Talle, Cantidad y Género");
      return;
    }
    try {
      await inventoryService.addProduct({
        codigo: selectedProduct.codigo,
        descripcion: selectedProduct.descripcion,
        procedencia: selectedProduct.procedencia as any,
        estado: 'Nuevo',
        cantidad: Number(newVariantData.cantidad) || 0,
        precio: Number(newVariantData.precio) || Number(selectedProduct.precio) || 0,
        costo: Number(newVariantData.costo) || Number(selectedProduct.costo) || 0,
        minStock: Number(selectedProduct.minStock) || 3,
        talle: newVariantData.talle,
        genero: newVariantData.genero,
        ubicacion: newVariantData.ubicacion,
        almacenId: newVariantData.almacenId || warehouses[0]?.id || '',
      });
      await refreshAllProducts();
      toast.success("Variante agregada correctamente");
      setNewVariantData({
        talle: '',
        cantidad: '',
        precio: '',
        costo: '',
        genero: '',
        ubicacion: '',
        almacenId: warehouses[0]?.id || '',
      });
    } catch (error) {
      toast.error("Error al agregar variante");
    }
  };

  const loadHistory = async (product: Product) => {
    setSelectedProduct(product);
    setIsHistoryModalOpen(true);
    setProductMovements([]);
    try {
      const movements = await inventoryService.getMovementsByProduct(product.id);
      setProductMovements(movements);
    } catch (error) {
      console.error('Error fetching product movements:', error);
    }
  };

  if (settingsLoading || (productsLoading && allProducts.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 pointer-events-none" />
          <Input 
            placeholder={t('search_inventory')} 
            className="pl-12 py-3.5 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800 focus:bg-white dark:focus:bg-gray-950 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-2xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="ghost" 
            onClick={refreshProducts}
            className="h-12 px-4 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
            title="Actualizar inventario"
          >
            <Clock className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </Button>
          <div className="h-8 w-px bg-gray-100 dark:bg-gray-800 mx-1 hidden sm:block" />
          <Button 
            id="btn-inventory-filter-toggle"
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-12 px-5 rounded-xl border-gray-100 dark:border-gray-800 font-bold transition-all",
              showFilters ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none" : "text-gray-600 dark:text-gray-400 hover:border-indigo-200"
            )}
          >
            <Filter className={cn("w-4 h-4 sm:mr-2 transition-transform", showFilters && "rotate-180")} />
            <span className="hidden sm:inline">{t('filters')}</span>
          </Button>

          {/* Select all / Deselect / Bulk delete buttons */}
          {selectedProductIds.size === 0 ? (
            <Button
              id="btn-inventory-select-all"
              variant="outline"
              onClick={handleToggleSelectAll}
              disabled={allFilteredProductIds.length === 0}
              className="h-12 px-4 sm:px-5 rounded-xl border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold hover:border-indigo-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              title="Seleccionar todos los productos"
            >
              <CheckSquare className="w-4 h-4 sm:mr-2 text-indigo-500" />
              <span className="hidden md:inline">Seleccionar Todo</span>
              <span className="md:hidden">Todos</span>
            </Button>
          ) : (
            <>
              <Button
                id="btn-inventory-deselect-all"
                variant="outline"
                onClick={() => setSelectedProductIds(new Set())}
                className="h-12 px-4 sm:px-5 rounded-xl border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold transition-all"
                title="Deseleccionar todo"
              >
                <Square className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Deseleccionar ({selectedProductIds.size})</span>
                <span className="md:hidden">({selectedProductIds.size})</span>
              </Button>
              <Button
                id="btn-inventory-bulk-delete"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="h-12 px-4 sm:px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-200 dark:shadow-none transition-all active:scale-95"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Eliminar ({selectedProductIds.size})</span>
                <span className="sm:hidden">{selectedProductIds.size}</span>
              </Button>
            </>
          )}

          <Button 
            id="btn-inventory-bulk-upload"
            variant="outline" 
            onClick={() => setIsBulkUploadModalOpen(true)}
            className="h-12 px-4 sm:px-5 rounded-xl border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
            title={t('bulk_upload')}
          >
            <Database className="w-4 h-4 sm:mr-2" />
            <span className="hidden md:inline">{t('bulk_upload')}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setInventoryTab(inventoryTab === 'stock' ? 'inteligencia' : 'stock')}
            className={cn(
              "h-12 px-4 sm:px-5 rounded-xl font-bold transition-all",
              inventoryTab === 'inteligencia' 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                : "border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            )}
            title="Inteligencia de Stock ABC & Sugerencias de Reposición"
          >
            <Sparkles className="w-4 h-4 sm:mr-2 text-amber-400" />
            <span className="hidden md:inline">Inteligencia ABC & Reposición</span>
            <span className="md:hidden">ABC</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/catalogo')}
            className="h-12 px-4 sm:px-5 rounded-xl border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
            title={t('catalog')}
          >
            <FileText className="w-4 h-4 sm:mr-2" />
            <span className="hidden md:inline">{t('catalog')}</span>
          </Button>
          <Button 
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="h-12 px-5 sm:px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">{t('new_product')}</span>
            <span className="sm:hidden">{t('add') || 'Crear'}</span>
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-indigo-50/30 dark:bg-indigo-900/5 rounded-[2.5rem] border border-indigo-100/50 dark:border-indigo-800/50 shadow-inner">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-[0.2em] ml-1">{t('warehouse')}</label>
                <select 
                  value={filters.almacenId}
                  onChange={(e) => setFilters({ ...filters, almacenId: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                >
                  <option value="all">{t('all_warehouses')}</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-[0.2em] ml-1">{t('origin')}</label>
                <select 
                  value={filters.procedencia}
                  onChange={(e) => setFilters({ ...filters, procedencia: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                >
                  <option value="all">{t('all_origins')}</option>
                  <option value="Legítimo">{t('legitimate')}</option>
                  <option value="Genérico">{t('generic')}</option>
                  <option value="Importado">{t('imported')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-[0.2em] ml-1">{t('status')}</label>
                <select 
                  value={filters.estado}
                  onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                >
                  <option value="all">{t('all_statuses')}</option>
                  <option value="Nuevo">{t('new')}</option>
                  <option value="Usado">{t('used')}</option>
                  <option value="Reacondicionado">{t('refurbished')}</option>
                </select>
              </div>
              <div className="md:col-span-3 flex justify-center pt-2">
                <Button 
                  variant="ghost" 
                  className="text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl px-8"
                  onClick={() => setFilters({ almacenId: 'all', procedencia: 'all', estado: 'all' })}
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('clear_filters')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {inventoryTab === 'inteligencia' ? (
        <StockIntelligence products={allProducts} sales={sales} />
      ) : (
        <>
          {/* Table Section (Desktop) / Card Section (Mobile) */}
      <div className={cn("bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden", mobileCompactMode ? "hidden" : "block")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-5 w-12 text-center">
                  <input 
                    id="checkbox-select-all-header"
                    type="checkbox"
                    aria-label="Seleccionar todos los productos"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected && !isAllSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 cursor-pointer transition-colors"
                  />
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('code')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('description')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('origin')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('stock')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('location')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('cost')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{t('price')}</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {displayedGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-12 h-12 opacity-20" />
                      <p className="text-sm font-medium">{t('no_products_found')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedGroups.map((group) => {
                  const selected = isGroupSelected(group);
                  return (
                  <tr 
                    key={`${group.codigo}_${group.procedencia}`} 
                    className={cn(
                      "transition-all duration-200 group cursor-pointer",
                      selected 
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/50" 
                        : "hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10"
                    )}
                    onClick={() => {
                      setSelectedProduct(group.originalProducts[0]);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <td className="px-4 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        id={`checkbox-product-${group.codigo}-${group.procedencia}`}
                        type="checkbox"
                        aria-label={`Seleccionar ${group.codigo}`}
                        checked={selected}
                        ref={(el) => {
                          if (el) el.indeterminate = isGroupPartiallySelected(group);
                        }}
                        onChange={(e) => handleToggleSelectGroup(group, e)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 cursor-pointer transition-colors"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg uppercase tracking-wider shadow-sm shadow-indigo-200 dark:shadow-none w-fit">
                          {group.codigo}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 text-[9px] font-bold rounded-md w-fit uppercase tracking-widest border",
                          group.procedencia === 'Legítimo' ? "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400" :
                          group.procedencia === 'Importado' ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                          "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                        )}>
                          {group.procedencia}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl mr-4 flex items-center justify-center text-gray-300 border border-gray-100 dark:border-gray-700 overflow-hidden group-hover:border-indigo-200 dark:group-hover:border-indigo-800 transition-colors">
                            {group.imagenUrl ? (
                              <img 
                                src={group.imagenUrl} 
                                alt={group.descripcion} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${group.codigo}/100/100`;
                                }}
                              />
                            ) : (
                              <Package size={24} className="opacity-50" />
                            )}
                          </div>
                          <div className={cn(
                            "absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm",
                            group.procedencia === 'Legítimo' ? "bg-indigo-500" :
                            group.procedencia === 'Importado' ? "bg-emerald-500" :
                            "bg-amber-500"
                          )} />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className={cn(
                            "text-base font-bold leading-tight",
                            group.descripcion ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500 italic"
                          )}>
                            {group.descripcion || t('no_description')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider border",
                        group.procedencia === 'Legítimo' ? "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400" :
                        group.procedencia === 'Importado' ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                        "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                      )}>
                        {group.procedencia}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <span className={cn(
                          "text-base font-black px-3 py-1 rounded-xl",
                          group.totalCantidad <= (group.minStock || 3) 
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" 
                            : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                        )}>
                          {group.totalCantidad}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(group.locations.map(l => l.ubicacion))).filter(Boolean).map((loc, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded-md uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                            {loc}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-gray-400 dark:text-gray-500 tracking-tight">${group.costo || 0}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tracking-tight">${group.precio}</p>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                          onClick={() => loadHistory(group.originalProducts[0])}
                          title={t('history')}
                        >
                          <History size={18} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                          onClick={() => {
                            setSelectedProduct(group.originalProducts[0]);
                            setIsQRModalOpen(true);
                          }}
                          title="QR"
                        >
                          <QrCode size={18} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                          onClick={() => openEditModal(group.originalProducts[0])}
                          title={t('edit')}
                        >
                          <Edit2 size={18} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                          onClick={() => confirmDelete(group.originalProducts[0].id)}
                          disabled={isDeleting}
                          title={t('delete')}
                        >
                          <Trash2 size={18} />
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
        {displayedGroups.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-[2rem] border border-gray-100 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400 shadow-xl shadow-gray-200/50 dark:shadow-none">
            <div className="flex flex-col items-center gap-3">
              <Package className="w-16 h-16 opacity-10" />
              <p className="text-sm font-bold tracking-tight">{t('no_products_found')}</p>
            </div>
          </div>
        ) : (
          displayedGroups.map((group) => {
            const selected = isGroupSelected(group);
            return (
            <div 
              key={`${group.codigo}_${group.procedencia}`} 
              className={cn(
                "bg-white dark:bg-gray-900 p-6 rounded-[2rem] border shadow-xl shadow-gray-200/50 dark:shadow-none space-y-5 active:scale-[0.98] transition-all",
                selected 
                  ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10" 
                  : "border-gray-100 dark:border-gray-800"
              )}
              onClick={() => {
                setSelectedProduct(group.originalProducts[0]);
                setIsDetailModalOpen(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center mr-3">
                    <input 
                      id={`checkbox-mobile-${group.codigo}-${group.procedencia}`}
                      type="checkbox"
                      aria-label={`Seleccionar ${group.codigo}`}
                      checked={selected}
                      ref={(el) => {
                        if (el) el.indeterminate = isGroupPartiallySelected(group);
                      }}
                      onChange={(e) => handleToggleSelectGroup(group, e)}
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 cursor-pointer transition-colors"
                    />
                  </div>
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl mr-4 flex items-center justify-center text-gray-300 border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {group.imagenUrl ? (
                        <img 
                          src={group.imagenUrl} 
                          alt={group.descripcion} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${group.codigo}/100/100`;
                          }}
                        />
                      ) : (
                        <Package size={28} className="opacity-50" />
                      )}
                    </div>
                    <div className={cn(
                      "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 shadow-sm",
                      group.procedencia === 'Legítimo' ? "bg-indigo-500" :
                      group.procedencia === 'Importado' ? "bg-emerald-500" :
                      "bg-amber-500"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">{group.codigo}</p>
                    <p className={cn(
                      "text-sm font-bold truncate",
                      group.descripcion ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {group.descripcion || t('no_description')}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border shrink-0",
                  group.procedencia === 'Legítimo' ? "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400" :
                  group.procedencia === 'Importado' ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                  "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                )}>
                  {group.procedencia}
                </span>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-gray-50 dark:border-gray-800">
                <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{t('stock')}</span>
                    <span className={cn(
                      "text-lg font-black px-3 py-0.5 rounded-xl w-fit",
                      group.totalCantidad <= (group.minStock || 3) 
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" 
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                    )}>{group.totalCantidad}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{t('location')}</span>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(group.locations.map(l => l.ubicacion))).filter(Boolean).map((loc, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[8px] font-bold rounded-md uppercase tracking-wider">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{t('price')}</p>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">${group.precio}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl"
                  onClick={() => {
                    setSelectedProduct(group.originalProducts[0]);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <Layers size={20} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl"
                  onClick={() => {
                    setSelectedProduct(group.originalProducts[0]);
                    setIsQRModalOpen(true);
                  }}
                >
                  <QrCode size={20} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl"
                  onClick={() => openEditModal(group.originalProducts[0])}
                >
                  <Edit2 size={20} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-11 w-11 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl"
                  onClick={() => confirmDelete(group.originalProducts[0].id)}
                  disabled={isDeleting}
                  title={t('delete')}
                >
                  <Trash2 size={20} />
                </Button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-12 mb-12">
          <Button
            variant="outline"
            onClick={loadMore}
            className="rounded-2xl px-12 py-7 border-2 border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white hover:border-indigo-600 dark:hover:bg-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 shadow-xl shadow-indigo-100 dark:shadow-none group"
          >
            <span className="flex items-center gap-3">
              CARGAR MAS
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </span>
          </Button>
        </div>
      )}
        </>
      )}

      {/* Floating Selection Bar */}
      <AnimatePresence>
        {selectedProductIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 inset-x-4 max-w-xl mx-auto z-40 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white p-4 sm:px-6 sm:py-4 rounded-3xl shadow-2xl border border-gray-700/60 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-600/80 text-white flex items-center justify-center font-black text-xs shadow-inner">
                {selectedProductIds.size}
              </span>
              <div className="flex flex-col">
                <p className="text-xs sm:text-sm font-black tracking-wide">
                  {selectedProductIds.size} {selectedProductIds.size === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                </p>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[10px] text-indigo-300 hover:text-indigo-200 font-bold text-left underline underline-offset-2"
                >
                  {isAllSelected ? 'Deseleccionar todo' : `Seleccionar todos (${allFilteredProductIds.length})`}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProductIds(new Set())}
                className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl text-xs font-bold h-9 px-3"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black h-9 px-4 shadow-lg shadow-rose-900/50 transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Eliminar ({selectedProductIds.size})
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        title={t('bulk_upload')}
      >
        <BulkUpload onComplete={() => setIsBulkUploadModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => { setIsDetailModalOpen(false); setSelectedProduct(null); }}
        title={t('product_details')}
        className="max-w-4xl"
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* Quick Add Variant Section */}
            <div className="bg-indigo-600 dark:bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <Plus size={20} className="text-white" />
                  </div>
                  <div>
                    <h5 className="font-black uppercase tracking-[0.15em] text-sm leading-none">Nueva Variante</h5>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Agregue rápidamente un talle o color</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Talle</label>
                    <input 
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-3 text-xs font-bold placeholder:text-white/30 focus:bg-white/20 focus:outline-none transition-all"
                      placeholder="M, 42, etc"
                      value={newVariantData.talle}
                      onChange={(e) => setNewVariantData({...newVariantData, talle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Cant.</label>
                    <input 
                      type="number"
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-3 text-xs font-bold placeholder:text-white/30 focus:bg-white/20 focus:outline-none transition-all"
                      placeholder="0"
                      value={newVariantData.cantidad}
                      onChange={(e) => setNewVariantData({...newVariantData, cantidad: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Género</label>
                    <select 
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-2 text-[10px] font-bold focus:bg-white/20 focus:outline-none appearance-none cursor-pointer"
                      value={newVariantData.genero}
                      onChange={(e) => setNewVariantData({...newVariantData, genero: e.target.value})}
                    >
                      <option value="" className="text-gray-900">Tipo...</option>
                      <option value="Hombre" className="text-gray-900">Hombre</option>
                      <option value="Mujer" className="text-gray-900">Mujer</option>
                      <option value="Unisex" className="text-gray-900">Unisex</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Precio</label>
                    <input 
                      type="number"
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-3 text-xs font-bold placeholder:text-white/30 focus:bg-white/20 focus:outline-none transition-all"
                      placeholder={selectedProduct.precio.toString()}
                      value={newVariantData.precio}
                      onChange={(e) => setNewVariantData({...newVariantData, precio: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Ubicación</label>
                    <input 
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-3 text-xs font-bold placeholder:text-white/30 focus:bg-white/20 focus:outline-none transition-all"
                      placeholder="E-A1"
                      value={newVariantData.ubicacion}
                      onChange={(e) => setNewVariantData({...newVariantData, ubicacion: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/70 ml-1">Almacén</label>
                    <select 
                      className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-2 text-[10px] font-bold focus:bg-white/20 focus:outline-none appearance-none cursor-pointer"
                      value={newVariantData.almacenId}
                      onChange={(e) => setNewVariantData({...newVariantData, almacenId: e.target.value})}
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id} className="text-gray-900">{w.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleAddVariant}
                      className="w-full h-10 bg-white text-indigo-600 hover:bg-white/90 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95"
                    >
                      Añadir
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 bg-gray-50/50 dark:bg-gray-800/50 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800">
              <div className="w-full md:w-2/5 aspect-[4/5] bg-white dark:bg-gray-900 rounded-[2rem] flex items-center justify-center text-gray-200 overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
                {selectedProduct.imagenUrl ? (
                  <img src={selectedProduct.imagenUrl} alt={selectedProduct.descripcion} className="w-full h-full object-cover" />
                ) : (
                  <Package size={80} className="opacity-20" />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-between py-2">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 dark:shadow-none">
                        {selectedProduct.codigo}
                      </span>
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-[0.2em] border",
                        selectedProduct.procedencia === 'Legítimo' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                        selectedProduct.procedencia === 'Importado' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                        "bg-amber-50 border-amber-100 text-amber-600"
                      )}>
                        {selectedProduct.procedencia}
                      </span>
                    </div>
                    <h4 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">{selectedProduct.descripcion}</h4>
                    <p className="text-emerald-500 font-black text-2xl mt-2 tracking-tight">${selectedProduct.precio}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">{t('total_stock')}</p>
                      <p className={cn(
                        "text-xl font-black",
                        groupedProducts.find(g => g.codigo === selectedProduct.codigo && g.procedencia === selectedProduct.procedencia)?.totalCantidad! <= (selectedProduct.minStock || 3) ? "text-rose-600" : "text-gray-900 dark:text-white"
                      )}>
                        {groupedProducts.find(g => g.codigo === selectedProduct.codigo && g.procedencia === selectedProduct.procedencia)?.totalCantidad}
                        <span className="text-[10px] ml-1 text-gray-400 font-bold">{t('units')}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">{t('cost')}</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">${selectedProduct.costo || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-[11px] uppercase font-black text-gray-500 tracking-[0.2em] mb-4 ml-1 flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" />
                    Variantes y Ubicaciones
                  </p>
                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {groupedProducts.find(g => g.codigo === selectedProduct.codigo && g.descripcion === selectedProduct.descripcion && g.procedencia === selectedProduct.procedencia)?.originalProducts?.map((variant, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 transition-all group/variant hover:shadow-lg hover:shadow-indigo-50 dark:hover:shadow-none">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{variant.talle || 'Sin Talle'}</span>
                            <span className="text-[9px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full font-black uppercase tracking-wider">{variant.genero || 'Unisex'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Ubicación: {variant.ubicacion || 'N/A'}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{warehouses.find(w => w.id === variant.almacenId)?.nombre}</span>
                          </div>
                          {variant.precio !== selectedProduct.precio && <span className="text-[10px] font-black text-emerald-500 uppercase mt-2">$ {variant.precio}</span>}
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2 mb-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg opacity-0 group-hover/variant:opacity-100 transition-all"
                              onClick={() => openEditModal(variant)}
                            >
                              <Edit2 size={12} />
                            </Button>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</span>
                          </div>
                          <span className={cn(
                            "text-lg font-black leading-none",
                            variant.cantidad <= (variant.minStock || 3) ? "text-rose-600" : "text-indigo-600 dark:text-indigo-400"
                          )}>{variant.cantidad}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
              <Button variant="outline" className="rounded-2xl h-12 px-6 font-bold" onClick={() => { setIsDetailModalOpen(false); setSelectedProduct(null); }}>{t('close')}</Button>
              <Button className="rounded-2xl h-12 px-8 font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100" onClick={() => { openEditModal(selectedProduct); }}>{t('edit_product')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isAddModalOpen ? t('new_product') : t('edit_product')}
      >
        <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProduct} className="space-y-6">
          {isEditModalOpen && selectedProduct && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-2xl space-y-4">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('manage_locations') || 'Gestionar Variantes y Ubicaciones'}</p>
              <div className="space-y-2">
                {groupedProducts.find(g => g.codigo === selectedProduct.codigo && g.descripcion === selectedProduct.descripcion && g.procedencia === selectedProduct.procedencia)?.originalProducts?.map((variant, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm group">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-tight">{variant.talle || 'Sin Talle'}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{warehouses.find(w => w.id === variant.almacenId)?.nombre}</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider italic">{variant.ubicacion}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('stock')}</span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{variant.cantidad}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        onClick={() => {
                          setSelectedProduct(variant);
                          setFormData({
                            codigo: variant.codigo,
                            descripcion: variant.descripcion,
                            procedencia: variant.procedencia,
                            estado: variant.estado,
                            cantidad: variant.cantidad.toString(),
                            precio: variant.precio.toString(),
                            costo: (variant.costo || 0).toString(),
                            minStock: (variant.minStock || 3).toString(),
                            talle: variant.talle || '',
                            genero: variant.genero || '',
                            ubicacion: variant.ubicacion,
                            almacenId: variant.almacenId,
                            imagenUrl: variant.imagenUrl || '',
                          });
                        }}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          onClick={() => confirmDelete(variant.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAddModalOpen && duplicateProducts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl space-y-3"
            >
              <div className="flex items-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                <AlertCircle size={18} className="mr-2" />
                {t('product_already_exists')}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-bold">{t('description')}:</span> {duplicateProducts[0].descripcion}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {duplicateProducts.map((p, idx) => (
                    <div key={idx} className="bg-white/50 dark:bg-black/20 p-2 rounded-xl border border-amber-100 dark:border-amber-800/50 flex justify-between items-center">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{warehouses.find(w => w.id === p.almacenId)?.nombre}</span>
                          <span className="text-[10px] px-1 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded font-bold">{p.procedencia}</span>
                        </div>
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-200">{p.ubicacion}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{t('stock')}</span>
                        <p className="text-xs font-black text-amber-800 dark:text-amber-200">{p.cantidad}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                {t('duplicate_warning_info') || 'Puedes agregar este código en una nueva ubicación o editar uno existente.'}
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Input 
                label={t('article_code')} 
                placeholder="Ej: IPH-13-PRO" 
                required
                value={formData.codigo}
                onChange={(e) => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                className={cn(isAddModalOpen && duplicateProducts.length > 0 && "border-amber-500 ring-amber-500/20")}
              />
              {isCheckingCode && (
                <div className="absolute right-3 bottom-3">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block ml-1">{t('origin')}</label>
              <select 
                value={formData.procedencia}
                onChange={(e) => setFormData({...formData, procedencia: e.target.value as any})}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
              >
                <option value="Legítimo">{t('legitimate')}</option>
                <option value="Genérico">{t('generic')}</option>
                <option value="Importado">{t('imported')}</option>
              </select>
            </div>
            <Input 
              label={t('description')} 
              placeholder="Ej: iPhone 13 Pro 256GB" 
              className="md:col-span-2" 
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
            />
            <Input 
              label="Talle" 
              placeholder="Ej: XL, 38, Niño" 
              required
              value={formData.talle}
              onChange={(e) => setFormData({...formData, talle: e.target.value})}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1">Género <span className="text-rose-500">*</span></label>
              <select 
                className="w-full h-12 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                value={formData.genero}
                onChange={(e) => setFormData({...formData, genero: e.target.value})}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            <Input 
              label={t('location')} 
              placeholder="Ej: Estante A-1" 
              value={formData.ubicacion}
              onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
            />
            <Input 
              label={t('cost')} 
              type="number" 
              placeholder="0.00" 
              value={formData.costo}
              onChange={(e) => setFormData({...formData, costo: e.target.value})}
            />
            <Input 
              label={t('price')} 
              type="number" 
              placeholder="0.00" 
              value={formData.precio}
              onChange={(e) => setFormData({...formData, precio: e.target.value})}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1">
                {t('min_stock')}
              </label>
              <Input 
                type="number" 
                placeholder="3" 
                value={formData.minStock}
                onChange={(e) => setFormData({...formData, minStock: e.target.value})}
              />
              <p className="text-[10px] text-gray-400 font-bold ml-1">{t('min_stock_help')}</p>
            </div>
            <Input 
              label={t('qty')} 
              type="number" 
              placeholder="0" 
              value={formData.cantidad}
              onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
            />

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1 mb-1">Imagen del Producto</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative group cursor-pointer border-2 border-dashed rounded-[2rem] transition-all flex flex-col items-center justify-center min-h-[140px] overflow-hidden bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10",
                  formData.imagenUrl ? "border-indigo-500/50" : "border-gray-200 dark:border-gray-800 hover:border-indigo-400"
                )}
              >
                {formData.imagenUrl ? (
                  <>
                    <img 
                      src={formData.imagenUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover absolute inset-0 opacity-80 group-hover:opacity-60 transition-opacity"
                    />
                    <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                      <div className="p-3 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-xl border border-white dark:border-gray-800 text-indigo-600">
                        <Upload size={24} />
                      </div>
                      <span className="mt-2 text-[10px] font-black uppercase text-white drop-shadow-md">Cambiar Foto</span>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData({...formData, imagenUrl: ''});
                      }}
                      className="absolute top-4 right-4 z-20 p-2 bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-gray-400 group-hover:text-indigo-500 transition-colors">
                    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-3xl mb-3 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest">Haz clic para subir imagen</p>
                    <p className="text-[9px] font-medium opacity-60">PNG, JPG hasta 800KB</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              
              <div className="relative mt-4">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="relative z-10 mx-auto block w-fit px-4 bg-white dark:bg-gray-900 text-[9px] font-black text-gray-400 uppercase tracking-widest">O pega una URL</span>
              </div>

              <Input 
                placeholder="https://ejemplo.com/imagen.jpg" 
                value={formData.imagenUrl && !formData.imagenUrl.startsWith('data:') ? formData.imagenUrl : ''}
                onChange={(e) => setFormData({...formData, imagenUrl: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block ml-1">{t('warehouse')}</label>
              <select 
                value={formData.almacenId}
                onChange={(e) => setFormData({...formData, almacenId: e.target.value})}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                required
              >
                <option value="">{t('select_warehouse')}...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>{t('cancel')}</Button>
            <Button type="submit">{t('save_product')}</Button>
          </div>
        </form>
      </Modal>

      {/* QR Modal */}
      <Modal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        title={t('product_qr_code')}
      >
        {selectedProduct && (
          <div className="flex flex-col items-center space-y-6">
            <div className="p-8 bg-white rounded-3xl border-4 border-indigo-50 shadow-xl">
              <QRCodeSVG 
                value={`${window.location.origin}/stock-update/${selectedProduct.id}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="text-center">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProduct.descripcion}</h4>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">{selectedProduct.codigo}</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
              {t('qr_scan_instruction')}
            </p>
            <div className="flex gap-3 w-full pt-4">
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>{t('print')}</Button>
              <Button className="flex-1" onClick={() => setIsQRModalOpen(false)}>{t('close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProduct}
        title={t('delete_product')}
        message={t('delete_product_confirm')}
        confirmLabel={t('delete')}
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Eliminar productos seleccionados"
        message={`¿Estás seguro de que deseas eliminar permanentemente los ${selectedProductIds.size} producto${selectedProductIds.size > 1 ? 's' : ''} seleccionados? Esta acción no se puede deshacer.`}
        confirmLabel={isBulkDeleting ? 'Eliminando...' : `Eliminar ${selectedProductIds.size} producto${selectedProductIds.size > 1 ? 's' : ''}`}
        variant="danger"
        isLoading={isBulkDeleting}
      />

      {/* Movement History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`${t('stock_history')} - ${selectedProduct?.descripcion}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {productMovements.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>{t('no_movements')}</p>
            </div>
          ) : (
            productMovements.map((m) => {
              const date = (m.fecha as any).toDate ? (m.fecha as any).toDate() : new Date(m.fecha as any);
              return (
                <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div className="flex items-center">
                    <div className={cn(
                      "p-2 rounded-xl mr-4",
                      m.tipo === 'venta' || m.tipo === 'salida' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                    )}>
                      {m.tipo === 'venta' || m.tipo === 'salida' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{m.tipo}</p>
                      <p className="text-xs text-slate-500">{date.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-black",
                      m.tipo === 'venta' || m.tipo === 'salida' ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {m.tipo === 'venta' || m.tipo === 'salida' ? '-' : '+'}{m.cantidad}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{t('units')}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {imageToCrop && (
        <ImageCropperModal
          image={imageToCrop}
          onClose={() => setImageToCrop(null)}
          onComplete={(croppedImage) => {
            setFormData(prev => ({ ...prev, imagenUrl: croppedImage }));
            setImageToCrop(null);
            toast.success("Imagen recortada con éxito");
          }}
        />
      )}
    </div>
  );
}
