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
  Layers,
  Sparkles,
  Truck,
  User,
  Users,
  Search,
  Phone,
  Mail,
  UserPlus,
  CheckCircle2
} from 'lucide-react';
import { Product, Quote, QuoteItem, Client } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Input } from './ui';
import Modal from './Modal';
import ProductSearch from './ProductSearch';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  clients?: Client[];
  quoteToEdit?: Quote | null;
  onSaveQuote: (quoteData: Omit<Quote, 'id' | 'fecha' | 'createdBy' | 'numero'> & { numero?: string }) => Promise<Quote | void>;
  onUpdateQuote?: (quoteId: string, quoteData: Partial<Quote>) => Promise<void>;
  onSaveAndOpenReceipt: (quote: Quote) => void;
}

export function NewQuoteModal({
  isOpen,
  onClose,
  products,
  clients: propClients = [],
  quoteToEdit,
  onSaveQuote,
  onUpdateQuote,
  onSaveAndOpenReceipt
}: NewQuoteModalProps) {
  const { appSettings } = useSettings();

  // Clients state
  const [clientsList, setClientsList] = useState<Client[]>(propClients);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientNombre, setClientNombre] = useState('');
  const [clientTelefono, setClientTelefono] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Quick new client modal/form state
  const [isQuickNewClientOpen, setIsQuickNewClientOpen] = useState(false);
  const [newQuickName, setNewQuickName] = useState('');
  const [newQuickPhone, setNewQuickPhone] = useState('');
  const [newQuickEmail, setNewQuickEmail] = useState('');
  const [isSavingQuickClient, setIsSavingQuickClient] = useState(false);

  // Metadata & Conditions from Settings
  const [validityDays, setValidityDays] = useState(appSettings?.defaultQuoteValidityDays || 7);
  const [notes, setNotes] = useState(appSettings?.defaultQuoteNotes || 'Presupuesto válido por 7 días. Precios sujetos a confirmación.');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(appSettings?.defaultShippingCost || 0);

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
    customVariantText?: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }>({
    productId: '',
    productNombre: '',
    variantId: '',
    variantNombre: '',
    customVariantText: '',
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

  const finalTotal = Math.max(0, subtotal - discountAmount) + shippingCost;

  const resetForm = () => {
    setSelectedClient(null);
    setClientNombre('');
    setClientTelefono('');
    setClientEmail('');
    setClientSearchTerm('');
    setIsQuickNewClientOpen(false);
    setValidityDays(appSettings?.defaultQuoteValidityDays || 7);
    setNotes(appSettings?.defaultQuoteNotes || 'Presupuesto válido por 7 días. Precios sujetos a confirmación.');
    setDiscountAmount(0);
    setShippingCost(appSettings?.defaultShippingCost || 0);
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

  const handleSelectClient = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setClientNombre(client.nombre);
      setClientTelefono(client.telefono || '');
      setClientEmail(client.email || '');
      setClientSearchTerm('');
    } else {
      setClientNombre('');
      setClientTelefono('');
      setClientEmail('');
    }
  };

  const handleCreateQuickClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newQuickName.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    setIsSavingQuickClient(true);
    try {
      const createdId = await inventoryService.addClient({
        nombre: newQuickName.trim(),
        telefono: newQuickPhone.trim() || undefined,
        email: newQuickEmail.trim() || undefined
      });
      const newClientObj: Client = {
        id: typeof createdId === 'string' && createdId ? createdId : `client_${Date.now()}`,
        nombre: newQuickName.trim(),
        telefono: newQuickPhone.trim() || undefined,
        email: newQuickEmail.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdBy: 'user'
      };
      setClientsList(prev => [newClientObj, ...prev.filter(c => c.id !== newClientObj.id)]);
      handleSelectClient(newClientObj);
      setNewQuickName('');
      setNewQuickPhone('');
      setNewQuickEmail('');
      setIsQuickNewClientOpen(false);
      toast.success(`Cliente ${newClientObj.nombre} guardado y seleccionado`);
    } catch (err: any) {
      console.error('Error al registrar cliente rápido:', err);
      toast.error(err?.message || 'Error al guardar el cliente');
    } finally {
      setIsSavingQuickClient(false);
    }
  };

  const hasItemsReady = useMemo(() => {
    if (items.length > 0) return true;
    const desc = (entryMode === 'manual' ? manualDescription : currentItem.productNombre).trim();
    const hasProduct = !!currentItem.productId || !!desc;
    const hasPrice = currentItem.total > 0 || currentItem.precioUnitario > 0;
    return hasProduct && hasPrice;
  }, [items, currentItem, entryMode, manualDescription]);

  React.useEffect(() => {
    if (propClients && propClients.length > 0) {
      setClientsList(propClients);
    }
  }, [propClients]);

  React.useEffect(() => {
    if (isOpen) {
      // Refresh clients from inventoryService to ensure any newly added clients appear immediately
      inventoryService.getClients()
        .then(c => {
          if (c && c.length > 0) {
            setClientsList(c);
          }
        })
        .catch(console.warn);

      if (quoteToEdit) {
        setClientNombre(quoteToEdit.clientNombre || '');
        setClientTelefono(quoteToEdit.clientTelefono || '');
        setClientEmail(quoteToEdit.clientEmail || '');

        const currentClients = propClients && propClients.length > 0 ? propClients : clientsList;
        const matched = currentClients.find(c => 
          (quoteToEdit.clientId && c.id === quoteToEdit.clientId) || 
          (c.nombre && c.nombre.trim().toLowerCase() === quoteToEdit.clientNombre?.trim().toLowerCase())
        );
        setSelectedClient(matched || null);

        setValidityDays(quoteToEdit.validezDias || 7);
        setNotes(quoteToEdit.notas || '');
        setDiscountAmount(quoteToEdit.descuento || 0);
        setShippingCost(quoteToEdit.costoEnvio || 0);
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

    // Combine base variant and custom chosen variant if specified
    const baseVariant = currentItem.variantNombre && currentItem.variantNombre !== 'Único' ? currentItem.variantNombre : '';
    const customVar = currentItem.customVariantText?.trim() || '';
    let finalVariantNombre = '';
    if (baseVariant && customVar) {
      finalVariantNombre = `${baseVariant} (${customVar})`;
    } else if (customVar) {
      finalVariantNombre = customVar;
    } else if (baseVariant) {
      finalVariantNombre = baseVariant;
    }

    const newItem: QuoteItem = {
      productId: currentItem.productId || `manual_${Date.now()}`,
      productNombre: itemName || 'Artículo / Servicio',
      variantId: currentItem.variantId,
      variantNombre: finalVariantNombre || undefined,
      personalizacion: customVar || undefined,
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
      variantId: '',
      variantNombre: '',
      customVariantText: '',
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

      const baseVariant = currentItem.variantNombre && currentItem.variantNombre !== 'Único' ? currentItem.variantNombre : '';
      const customVar = currentItem.customVariantText?.trim() || '';
      let finalVariantNombre = '';
      if (baseVariant && customVar) {
        finalVariantNombre = `${baseVariant} (${customVar})`;
      } else if (customVar) {
        finalVariantNombre = customVar;
      } else if (baseVariant) {
        finalVariantNombre = baseVariant;
      }

      finalItems.push({
        productId: currentItem.productId || `manual_${Date.now()}`,
        productNombre: activeItemName || 'Artículo / Servicio',
        variantId: currentItem.variantId,
        variantNombre: finalVariantNombre || undefined,
        personalizacion: customVar || undefined,
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
    const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount) + shippingCost;
    const displayName = (clientNombre.trim() || selectedClient?.nombre || 'Consumidor Final');

    return {
      clientId: selectedClient?.id || (quoteToEdit?.clientId ?? undefined),
      clientNombre: displayName,
      clientTelefono: (clientTelefono.trim() || selectedClient?.telefono || undefined),
      clientEmail: (clientEmail.trim() || selectedClient?.email || undefined),
      items: finalItems,
      subtotal: calculatedSubtotal,
      descuento: discountAmount,
      costoEnvio: shippingCost,
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
          clientId: payload.clientId,
          clientNombre: payload.clientNombre,
          clientTelefono: payload.clientTelefono,
          clientEmail: payload.clientEmail,
          items: payload.items,
          subtotal: payload.subtotal,
          descuento: payload.descuento,
          costoEnvio: payload.costoEnvio,
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
          clientId: payload.clientId,
          clientNombre: payload.clientNombre,
          clientTelefono: payload.clientTelefono,
          clientEmail: payload.clientEmail,
          items: payload.items,
          subtotal: payload.subtotal,
          descuento: payload.descuento,
          costoEnvio: payload.costoEnvio,
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

  // Filtered clients based on search query
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return clientsList;
    const term = clientSearchTerm.toLowerCase().trim();
    return clientsList.filter(c => 
      (c.nombre && c.nombre.toLowerCase().includes(term)) ||
      (c.telefono && c.telefono.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  }, [clientsList, clientSearchTerm]);

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

        {/* Client & Conditions Section */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/40 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
          
          {/* Header of Client Section */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200/70 dark:border-gray-700/60">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Cliente / Destinatario
              </h4>
              {selectedClient ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Guardado
                </span>
              ) : (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  ({clientsList.length} clientes guardados)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isQuickNewClientOpen && (
                <button
                  type="button"
                  onClick={() => setIsQuickNewClientOpen(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 hover:underline px-2 py-1 rounded-lg"
                >
                  <UserPlus size={13} />
                  <span>+ Nuevo Cliente</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Create New Client Inline Form */}
          {isQuickNewClientOpen && (
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <UserPlus size={14} /> Registrar y vincular nuevo cliente
                </span>
                <button
                  type="button"
                  onClick={() => setIsQuickNewClientOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  label="Nombre Completo *"
                  placeholder="Ej: Carlos Gómez"
                  value={newQuickName}
                  onChange={(e) => setNewQuickName(e.target.value)}
                  autoFocus
                />
                <Input
                  label="WhatsApp / Teléfono"
                  placeholder="Ej: 3435123456"
                  value={newQuickPhone}
                  onChange={(e) => setNewQuickPhone(e.target.value)}
                />
                <Input
                  label="Email (Opcional)"
                  placeholder="cliente@ejemplo.com"
                  value={newQuickEmail}
                  onChange={(e) => setNewQuickEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsQuickNewClientOpen(false)}
                  disabled={isSavingQuickClient}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateQuickClient}
                  disabled={isSavingQuickClient || !newQuickName.trim()}
                  className="font-bold shadow-sm"
                >
                  {isSavingQuickClient ? 'Guardando...' : 'Guardar y Vincular'}
                </Button>
              </div>
            </div>
          )}

          {/* Selected Client Card OR Selection Controls */}
          {selectedClient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-emerald-50/80 to-indigo-50/60 dark:from-emerald-950/20 dark:to-indigo-950/20 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
                  {selectedClient.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-sm text-gray-900 dark:text-white">
                      {selectedClient.nombre}
                    </p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      Cliente Guardado
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {clientTelefono && (
                      <span className="flex items-center gap-1 font-medium">
                        <Phone size={12} className="text-emerald-600 dark:text-emerald-400" />
                        {clientTelefono}
                      </span>
                    )}
                    {clientEmail && (
                      <span className="flex items-center gap-1 font-medium">
                        <Mail size={12} className="text-indigo-500" />
                        {clientEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectClient(null)}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 rounded-xl"
                >
                  <X size={14} className="mr-1" />
                  Cambiar cliente
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Dropdown to pick from saved clients */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 flex items-center justify-between">
                  <span>Seleccionar de mis Clientes Guardados</span>
                  {clientsList.length > 0 && (
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      {clientsList.length} registrados
                    </span>
                  )}
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedClient?.id || ''}
                    onChange={(e) => {
                      const found = clientsList.find(c => c.id === e.target.value);
                      if (found) {
                        handleSelectClient(found);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-gray-100 shadow-sm"
                  >
                    <option value="">
                      {clientsList.length === 0 
                        ? 'No hay clientes guardados aún (escribe los datos abajo)' 
                        : '👉 Elige un cliente guardado de la lista...'}
                    </option>
                    {(filteredClients.length > 0 ? filteredClients : clientsList).map(c => (
                      <option key={c.id} value={c.id}>
                        👤 {c.nombre} {c.telefono ? `| 📞 ${c.telefono}` : ''} {c.email ? `| ✉️ ${c.email}` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Filter input if there are more than 3 clients */}
                  {clientsList.length > 3 && (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filtrar clientes por nombre o teléfono..."
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      {clientSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setClientSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick frequent client chips if available */}
              {clientsList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] font-bold text-gray-400 mr-1">Rápidos:</span>
                  {(filteredClients.length > 0 ? filteredClients : clientsList).slice(0, appSettings?.quickClientChipsLimit || 5).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-700 dark:text-gray-300 font-medium transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <User size={11} className="text-gray-400" />
                      <span>{c.nombre}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Editable Name & Phone row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-6">
                  <Input
                    label="Nombre / Razón Social"
                    placeholder="Ej: Consumidor Final, Juan Pérez..."
                    value={clientNombre}
                    onChange={(e) => setClientNombre(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    label="Teléfono / WhatsApp"
                    placeholder="Ej: 3435123456"
                    value={clientTelefono}
                    onChange={(e) => setClientTelefono(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    label="Email (Opcional)"
                    placeholder="cliente@ejemplo.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Validity, Discount, Shipping & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-2 border-t border-gray-200/70 dark:border-gray-700/60">
            <div className="sm:col-span-4">
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

            <div className="sm:col-span-4">
              <Input
                label="Descuento ($)"
                type="number"
                min="0"
                value={discountAmount || ''}
                placeholder="0"
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            <div className="sm:col-span-4">
              <Input
                label="🚚 Precio Envío ($)"
                type="number"
                min="0"
                value={shippingCost || ''}
                placeholder="0"
                title="Precio del envío a cargo del cliente (solo visual, no se suma ni resta en billetera)"
                onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {shippingCost > 0 && (
              <div className="sm:col-span-12 -mt-1">
                <div className="flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 px-3 py-2 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
                  <Truck size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Envío a cargo del cliente (+${shippingCost.toLocaleString('es-AR')}):</strong> Se muestra en el comprobante para que el cliente tenga el total completo con flete, <strong>no suma ni resta en tu billetera o caja</strong>.
                  </span>
                </div>
              </div>
            )}

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
              
              {/* Custom Variant / Personalization Selector */}
              {entryMode === 'catalog' && currentItem.productId && (
                <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                      Variante o Personalización (Elegida por vos)
                    </label>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      Opcional: podés agregar este mismo producto varias veces con distintas variantes
                    </span>
                  </div>

                  {/* Quick-choice chips */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {['Sin personalizar', 'Personalizado', 'Con logo', 'Estampado', 'Bordado', 'Sublimado'].map((chip) => {
                      const isSelected = currentItem.customVariantText === chip;
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setCurrentItem(prev => ({
                              ...prev,
                              customVariantText: isSelected ? '' : chip
                            }));
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                          )}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom text field */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="O escribí tu variante personalizada (ej: Personalizados con nombre, Talle especial...)"
                        value={currentItem.customVariantText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentItem(prev => ({
                            ...prev,
                            customVariantText: val
                          }));
                        }}
                        className="text-xs bg-white dark:bg-gray-900"
                      />
                    </div>
                    {currentItem.customVariantText && (
                      <button
                        type="button"
                        onClick={() => setCurrentItem(prev => ({ ...prev, customVariantText: '' }))}
                        className="p-2 text-gray-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Limpiar variante personalizada"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                      {item.variantNombre && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                          Variante: {item.variantNombre}
                        </span>
                      )}
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
          <div className="flex flex-wrap items-center gap-3">
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
            {shippingCost > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-blue-200/50 dark:border-blue-900/40" title="Costo de envío a cargo del cliente (no afecta tu billetera)">
                <Truck size={13} className="shrink-0" />
                Envío: +${shippingCost.toLocaleString('es-AR')}
                <span className="text-[10px] text-blue-500 font-semibold">(visual cliente)</span>
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
