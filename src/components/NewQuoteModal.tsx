/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Package, 
  Clock, 
  FileText, 
  Send, 
  AlertCircle,
  X,
  Calculator,
  Tag,
  PenLine,
  Layers
} from 'lucide-react';
import { Product, Quote, QuoteItem } from '../types';
import { Button, Input } from './ui';
import Modal from './Modal';
import ProductSearch from './ProductSearch';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  clients?: any[]; // Kept optional for backward compatibility
  quoteToEdit?: Quote | null;
  onSaveQuote: (quoteData: Omit<Quote, 'id' | 'fecha' | 'createdBy' | 'numero'> & { numero?: string }) => Promise<Quote | void>;
  onUpdateQuote?: (quoteId: string, quoteData: Partial<Quote>) => Promise<void>;
  onSaveAndOpenReceipt: (quote: Quote) => void;
}

export function NewQuoteModal({
  isOpen,
  onClose,
  products,
  quoteToEdit,
  onSaveQuote,
  onUpdateQuote,
  onSaveAndOpenReceipt
}: NewQuoteModalProps) {
  // Client & metadata - simple optional reference
  const [clientReference, setClientReference] = useState('');
  const [validityDays, setValidityDays] = useState(7);
  const [notes, setNotes] = useState('Presupuesto válido por 7 días. Precios sujetos a confirmación.');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Cart / Items in Quote
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Item entry mode: 'catalog' vs 'manual'
  const [entryMode, setEntryMode] = useState<'catalog' | 'manual'>('catalog');
  const [manualDescription, setManualDescription] = useState('');

  // Price Mode: 'unit' (price per unit) vs 'total' (total price for the batch/item)
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');

  // Item builder state
  const [selectedBaseProduct, setSelectedBaseProduct] = useState<{
    codigo: string;
    descripcion: string;
    procedencia: string;
    originalProducts: Product[];
    representative: Product;
  } | null>(null);

  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    productNombre: string;
    variantId?: string;
    variantNombre?: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }>({
    productId: '',
    productNombre: '',
    cantidad: 1,
    precioUnitario: 0,
    total: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group products by code + description + origin
  const groupedProducts = useMemo(() => {
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

  const representativeProducts = useMemo(() => {
    return groupedProducts.map(g => g.representative);
  }, [groupedProducts]);

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  }, [items]);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  const resetForm = () => {
    setClientReference('');
    setValidityDays(7);
    setNotes('Presupuesto válido por 7 días. Precios sujetos a confirmación.');
    setDiscountAmount(0);
    setItems([]);
    setSelectedBaseProduct(null);
    setPriceMode('unit');
    setEntryMode('catalog');
    setManualDescription('');
    setCurrentItem({
      productId: '',
      productNombre: '',
      cantidad: 1,
      precioUnitario: 0,
      total: 0
    });
  };

  const hasItemsReady = useMemo(() => {
    if (items.length > 0) return true;
    const desc = (entryMode === 'manual' ? manualDescription : currentItem.productNombre).trim();
    const hasProduct = !!currentItem.productId || !!desc;
    const hasPrice = currentItem.total > 0 || currentItem.precioUnitario > 0;
    return hasProduct && hasPrice;
  }, [items, currentItem, entryMode, manualDescription]);

  React.useEffect(() => {
    if (isOpen) {
      if (quoteToEdit) {
        setClientReference(
          quoteToEdit.clientTelefono
            ? `${quoteToEdit.clientNombre} (${quoteToEdit.clientTelefono})`
            : quoteToEdit.clientNombre
        );
        setValidityDays(quoteToEdit.validezDias || 7);
        setNotes(quoteToEdit.notas || '');
        setDiscountAmount(quoteToEdit.descuento || 0);
        setItems(quoteToEdit.items || []);
        setSelectedBaseProduct(null);
      } else {
        resetForm();
      }
    }
  }, [isOpen, quoteToEdit]);

  // Synchronized price handlers
  const handleQuantityChange = (newQty: number) => {
    const qty = Math.max(1, newQty);
    if (priceMode === 'total') {
      // Keep total, recompute unit price
      const newUnit = currentItem.total > 0 ? Math.round(currentItem.total / qty) : 0;
      setCurrentItem({
        ...currentItem,
        cantidad: qty,
        precioUnitario: newUnit
      });
    } else {
      // Keep unit price, recompute total
      setCurrentItem({
        ...currentItem,
        cantidad: qty,
        total: qty * currentItem.precioUnitario
      });
    }
  };

  const handleUnitPriceChange = (unitPrice: number) => {
    const price = Math.max(0, unitPrice);
    setCurrentItem({
      ...currentItem,
      precioUnitario: price,
      total: currentItem.cantidad * price
    });
  };

  const handleTotalPriceChange = (totalPrice: number) => {
    const total = Math.max(0, totalPrice);
    const unitPrice = currentItem.cantidad > 0 ? Math.round(total / currentItem.cantidad) : total;
    setCurrentItem({
      ...currentItem,
      total,
      precioUnitario: unitPrice
    });
  };

  const handleAddItem = () => {
    const itemName = (entryMode === 'manual' 
      ? manualDescription 
      : (currentItem.productNombre || selectedBaseProduct?.representative.descripcion || '')
    ).trim();

    if (!currentItem.productId && !itemName) {
      toast.error(entryMode === 'manual' ? 'Escribe una descripción del artículo o servicio' : 'Selecciona un producto o variante');
      return;
    }
    if (currentItem.cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    if (currentItem.total < 0) {
      toast.error('El precio no puede ser negativo');
      return;
    }

    const calculatedTotal = currentItem.total > 0 
      ? currentItem.total 
      : (currentItem.cantidad * currentItem.precioUnitario);

    const unitPrice = currentItem.cantidad > 0 
      ? Math.round(calculatedTotal / currentItem.cantidad) 
      : currentItem.precioUnitario;

    const newItem: QuoteItem = {
      productId: currentItem.productId || `manual_${Date.now()}`,
      productNombre: itemName || 'Artículo / Servicio',
      variantId: currentItem.variantId,
      variantNombre: currentItem.variantNombre,
      cantidad: currentItem.cantidad > 0 ? currentItem.cantidad : 1,
      precio: unitPrice,
      total: calculatedTotal
    };

    setItems([...items, newItem]);
    setSelectedBaseProduct(null);
    setManualDescription('');
    setCurrentItem({
      productId: '',
      productNombre: '',
      cantidad: 1,
      precioUnitario: 0,
      total: 0
    });
    toast.success('Artículo agregado a la cotización');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const buildQuotePayload = () => {
    let finalItems = [...items];

    // If user typed or picked an item but forgot to click "+ Agregar", automatically include it!
    const activeItemName = (entryMode === 'manual' 
      ? manualDescription 
      : (currentItem.productNombre || selectedBaseProduct?.representative.descripcion || '')
    ).trim();
    const hasValidPrice = currentItem.total > 0 || currentItem.precioUnitario > 0;

    if ((currentItem.productId || activeItemName) && hasValidPrice) {
      const calculatedTotal = currentItem.total > 0 
        ? currentItem.total 
        : (currentItem.cantidad * currentItem.precioUnitario);
      const unitPrice = currentItem.cantidad > 0 
        ? Math.round(calculatedTotal / currentItem.cantidad) 
        : currentItem.precioUnitario;

      finalItems.push({
        productId: currentItem.productId || `manual_${Date.now()}`,
        productNombre: activeItemName || 'Artículo / Servicio',
        variantId: currentItem.variantId,
        variantNombre: currentItem.variantNombre,
        cantidad: currentItem.cantidad > 0 ? currentItem.cantidad : 1,
        precio: unitPrice,
        total: calculatedTotal
      });
    }

    if (finalItems.length === 0) {
      toast.error('Agrega al menos un artículo o servicio a la cotización');
      return null;
    }

    const calculatedSubtotal = finalItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount);
    const displayName = clientReference.trim() || 'Consumidor Final';

    return {
      clientNombre: displayName,
      items: finalItems,
      subtotal: calculatedSubtotal,
      descuento: discountAmount,
      total: calculatedTotal,
      validezDias: Number(validityDays) || 7,
      estado: 'pendiente' as const,
      notas: notes.trim()
    };
  };

  const handleSaveOnly = async () => {
    const payload = buildQuotePayload();
    if (!payload) return;

    setIsSubmitting(true);
    try {
      if (quoteToEdit && onUpdateQuote) {
        await onUpdateQuote(quoteToEdit.id, {
          clientNombre: payload.clientNombre,
          items: payload.items,
          subtotal: payload.subtotal,
          descuento: payload.descuento,
          total: payload.total,
          validezDias: payload.validezDias,
          notas: payload.notas
        });
        toast.success(`Cotización ${quoteToEdit.numero} actualizada con éxito`);
        resetForm();
        onClose();
        return;
      }

      const savedQuote = await onSaveQuote(payload);
      const quoteNum = savedQuote && typeof savedQuote === 'object' && 'numero' in savedQuote ? (savedQuote as Quote).numero : 'emitido';
      toast.success(`Comprobante ${quoteNum} guardado con éxito`);
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error al guardar presupuesto:', error);
      toast.error(error?.message || 'Error al guardar la cotización');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndOpen = async () => {
    const payload = buildQuotePayload();
    if (!payload) return;

    setIsSubmitting(true);
    try {
      if (quoteToEdit && onUpdateQuote) {
        await onUpdateQuote(quoteToEdit.id, {
          clientNombre: payload.clientNombre,
          items: payload.items,
          subtotal: payload.subtotal,
          descuento: payload.descuento,
          total: payload.total,
          validezDias: payload.validezDias,
          notas: payload.notas
        });
        toast.success(`Cotización ${quoteToEdit.numero} actualizada con éxito`);
        const updatedQuote: Quote = {
          ...quoteToEdit,
          ...payload
        };
        onSaveAndOpenReceipt(updatedQuote);
        resetForm();
        onClose();
        return;
      }

      const savedQuote = await onSaveQuote(payload);
      if (savedQuote && typeof savedQuote === 'object') {
        const quoteObj = savedQuote as Quote;
        toast.success(`Comprobante ${quoteObj.numero || 'emitido'} guardado con éxito`);
        onSaveAndOpenReceipt(quoteObj);
      }
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error al generar comprobante:', error);
      toast.error(error?.message || 'Error al generar la cotización');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quoteToEdit ? `Modificar Cotización (${quoteToEdit.numero})` : "Nueva Cotización / Presupuesto"}
      className="max-w-4xl"
    >
      <div className="space-y-5 pb-2">
        
        {/* Banner: Non fiscal notice */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex items-center gap-3">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-700 dark:text-amber-400 shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              DOCUMENTO NO VÁLIDO COMO FACTURA
            </p>
            <p className="text-amber-700 dark:text-amber-400">
              Comprobante comercial e informativo. No descuenta stock de inventario ni genera deuda fiscal.
            </p>
          </div>
        </div>

        {/* Reference & Conditions Section (No complicated client selector) */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-6">
              <Input
                label="Referencia / Nombre (Opcional)"
                placeholder="Ej: Consumidor Final, Juan, o N° de Consulta"
                value={clientReference}
                onChange={(e) => setClientReference(e.target.value)}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block mb-1.5">
                Validez
              </label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={3}>3 días</option>
                <option value={7}>7 días (Estándar)</option>
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <Input
                label="Descuento Global ($)"
                type="number"
                min="0"
                value={discountAmount || ''}
                placeholder="0"
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            <div className="sm:col-span-12">
              <Input
                label="Notas / Condiciones (Opcional)"
                placeholder="Ej: Precios válidos hasta agotar stock, seña del 50%..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Product Selection Section */}
        <div className="p-4 sm:p-5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Agregar Artículos al Presupuesto
              </h4>
            </div>

            {/* Entry Mode Toggle: Catalog vs Manual Service */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setEntryMode('catalog');
                  setManualDescription('');
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  entryMode === 'catalog'
                    ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Layers size={13} />
                <span>Desde Catálogo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode('manual');
                  setSelectedBaseProduct(null);
                  setCurrentItem({
                    productId: '',
                    productNombre: '',
                    cantidad: 1,
                    precioUnitario: 0,
                    total: 0
                  });
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  entryMode === 'manual'
                    ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <PenLine size={13} />
                <span>Concepto Libre / Servicio</span>
              </button>
            </div>
          </div>

          {entryMode === 'catalog' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Base Product Search */}
              <div className="md:col-span-5">
                <ProductSearch 
                  label="Buscar Producto / Código"
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
                      productId: p.id,
                      productNombre: p.descripcion || p.codigo,
                      cantidad: 1,
                      precioUnitario: p.precio || 0,
                      total: p.precio || 0
                    });
                  }}
                />
              </div>

              {/* Variant / Talle selection */}
              {selectedBaseProduct && (
                <div className="md:col-span-7 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                      Seleccionar Variante / Talle:
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedBaseProduct(null)}
                      className="text-xs font-bold text-gray-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                    >
                      <X size={14} /> Cambiar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {selectedBaseProduct.originalProducts.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          const unitPrice = variant.precio || 0;
                          setCurrentItem({
                            ...currentItem,
                            productId: variant.id,
                            productNombre: `${variant.descripcion || variant.codigo} (${variant.talle || 'Único'})`,
                            variantId: variant.id,
                            variantNombre: variant.talle || 'Único',
                            precioUnitario: unitPrice,
                            total: currentItem.cantidad * unitPrice
                          });
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left text-xs transition-all",
                          currentItem.productId === variant.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                        )}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{variant.talle || 'Único'}</span>
                          <span className={cn(
                            "text-[10px]",
                            currentItem.productId === variant.id ? "text-indigo-100" : "text-indigo-600 font-black"
                          )}>
                            ${variant.precio?.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[9px] block",
                          currentItem.productId === variant.id ? "text-indigo-200" : "text-gray-400"
                        )}>
                          Stock: {variant.cantidad}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Descripción del Artículo o Servicio"
                placeholder="Ej: Cambio de pantalla iPhone 13, Mano de obra técnica, Funda personalizada..."
                value={manualDescription}
                onChange={(e) => {
                  const val = e.target.value;
                  setManualDescription(val);
                  setCurrentItem(prev => ({
                    ...prev,
                    productNombre: val
                  }));
                }}
              />
            </div>
          )}

          {/* Pricing Controls: Total Price vs Unit Price option */}
          {(currentItem.productId || (entryMode === 'manual' && manualDescription.trim().length > 0)) && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3 animate-in fade-in duration-200">
              
              {/* Option Selector: Unit Price vs Total Price */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  ¿Cómo querés definir el precio de este artículo?
                </span>
                
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setPriceMode('unit')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      priceMode === 'unit'
                        ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <Tag size={13} />
                    <span>Precio por Unidad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriceMode('total')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      priceMode === 'total'
                        ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <Calculator size={13} />
                    <span>Precio Total del Lote</span>
                  </button>
                </div>
              </div>

              {/* Quantity, Unit Price and Total Price Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <Input
                    label="Cantidad"
                    type="number"
                    min="1"
                    value={currentItem.cantidad}
                    onChange={(e) => handleQuantityChange(Number(e.target.value))}
                  />
                </div>

                <div className="sm:col-span-3">
                  <Input
                    label={priceMode === 'unit' ? '⭐ Precio Unitario ($)' : 'Precio Unitario ($)'}
                    type="number"
                    min="0"
                    step="50"
                    value={currentItem.precioUnitario || ''}
                    placeholder="0"
                    onChange={(e) => handleUnitPriceChange(Number(e.target.value))}
                  />
                </div>

                <div className="sm:col-span-3">
                  <Input
                    label={priceMode === 'total' ? '⭐ Precio Total ($)' : 'Precio Total ($)'}
                    type="number"
                    min="0"
                    step="100"
                    value={currentItem.total || ''}
                    placeholder="0"
                    onChange={(e) => handleTotalPriceChange(Number(e.target.value))}
                  />
                </div>

                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-100 dark:shadow-none"
                  >
                    <Plus size={15} className="mr-1.5" />
                    Agregar
                  </Button>
                </div>
              </div>

              {/* Helpful calculation hint */}
              <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl flex items-center justify-between">
                <span>
                  Detalle calculado: <strong>{currentItem.cantidad} un.</strong> x <strong>${currentItem.precioUnitario.toLocaleString('es-AR')}</strong> c/u
                </span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">
                  Total: ${currentItem.total.toLocaleString('es-AR')}
                </span>
              </div>

            </div>
          )}
        </div>

        {/* Items List in Quote */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Artículos en el Presupuesto ({items.length})
            </h4>
            {items.length > 0 && (
              <span className="text-xs font-bold text-gray-500">
                Subtotal: ${subtotal.toLocaleString('es-AR')}
              </span>
            )}
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden max-h-52 overflow-y-auto bg-white dark:bg-gray-900">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-700 mb-1.5 opacity-60" />
                <p className="text-xs font-bold text-gray-500">Aún no agregaste artículos</p>
                <p className="text-[11px] text-gray-400">Buscá un producto arriba para agregarlo con su precio unitario o total.</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-xs shrink-0">
                      {item.cantidad}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">
                        {item.productNombre}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        ${item.precio.toLocaleString('es-AR')} c/u
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      ${item.total.toLocaleString('es-AR')}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Eliminar artículo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary and Actions */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">
                Total Cotización
              </span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                ${finalTotal.toLocaleString('es-AR')}
              </span>
            </div>
            {discountAmount > 0 && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg">
                Descuento: -${discountAmount.toLocaleString('es-AR')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveOnly}
              disabled={!hasItemsReady || isSubmitting}
              className="rounded-xl font-bold text-xs bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900"
            >
              {isSubmitting ? 'Guardando...' : (quoteToEdit ? 'Guardar Cambios' : 'Guardar Comprobante')}
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndOpen}
              disabled={!hasItemsReady || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-200 dark:shadow-none"
            >
              <Send size={14} className="mr-1.5" />
              {isSubmitting ? 'Guardando...' : (quoteToEdit ? 'Guardar y Ver' : 'Guardar y Ver Comprobante')}
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
