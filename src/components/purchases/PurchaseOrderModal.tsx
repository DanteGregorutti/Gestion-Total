/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Building2, 
  Calendar, 
  DollarSign, 
  FileText, 
  Clock, 
  Check, 
  Package, 
  CreditCard,
  Truck,
  Phone,
  Mail,
  Search
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Product } from '../../types';
import { Button, Input } from '../ui';
import { useProducts } from '../../contexts/ProductsContext';
import { toast } from 'sonner';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  orderToEdit?: PurchaseOrder | null;
  initialItems?: PurchaseOrderItem[];
  initialSupplier?: string;
  onClose: () => void;
  onSave: (orderData: Partial<PurchaseOrder>) => Promise<void>;
}

export function PurchaseOrderModal({
  isOpen,
  orderToEdit,
  initialItems,
  initialSupplier,
  onClose,
  onSave
}: PurchaseOrderModalProps) {
  const { products } = useProducts();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [proveedor, setProveedor] = useState('');
  const [proveedorTelefono, setProveedorTelefono] = useState('');
  const [proveedorEmail, setProveedorEmail] = useState('');
  const [fechaEsperada, setFechaEsperada] = useState('');
  const [condicionPago, setCondicionPago] = useState('Contado');
  const [notas, setNotas] = useState('');
  const [flete, setFlete] = useState<number | ''>('');
  const [estado, setEstado] = useState<PurchaseOrderStatus>('borrador');

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemCost, setAddItemCost] = useState<number | ''>('');
  const [addItemTotal, setAddItemTotal] = useState<number | ''>('');

  useEffect(() => {
    if (orderToEdit) {
      setProveedor(orderToEdit.proveedor || '');
      setProveedorTelefono(orderToEdit.proveedorTelefono || '');
      setProveedorEmail(orderToEdit.proveedorEmail || '');
      setFechaEsperada(orderToEdit.fechaEsperada || '');
      setCondicionPago(orderToEdit.condicionPago || 'Contado');
      setNotas(orderToEdit.notas || '');
      setFlete(orderToEdit.flete || '');
      setEstado(orderToEdit.estado || 'borrador');
      setItems(orderToEdit.items || []);
    } else if (initialItems && initialItems.length > 0) {
      setProveedor(initialSupplier || '');
      setProveedorTelefono('');
      setProveedorEmail('');
      setFechaEsperada('');
      setCondicionPago('Contado');
      setNotas('Reposición sugerida por bajo nivel de stock.');
      setFlete('');
      setEstado('borrador');
      setItems(initialItems);
    } else {
      setProveedor(initialSupplier || '');
      setProveedorTelefono('');
      setProveedorEmail('');
      setFechaEsperada('');
      setCondicionPago('Contado');
      setNotas('');
      setFlete('');
      setEstado('borrador');
      setItems([]);
    }
  }, [orderToEdit, initialItems, initialSupplier, isOpen]);

  if (!isOpen) return null;

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find(prod => prod.id === prodId);
    if (p) {
      const cost = p.costo || 0;
      setAddItemCost(cost);
      setAddItemTotal(cost ? parseFloat((cost * addItemQty).toFixed(2)) : '');
      setProductSearch(`${p.codigo} - ${p.descripcion}`);
    }
  };

  const handleQtyChange = (val: number) => {
    const qty = Math.max(1, val);
    setAddItemQty(qty);
    if (addItemCost !== '') {
      setAddItemTotal(parseFloat((Number(addItemCost) * qty).toFixed(2)));
    } else if (addItemTotal !== '') {
      setAddItemCost(parseFloat((Number(addItemTotal) / qty).toFixed(2)));
    }
  };

  const handleCostChange = (val: string) => {
    if (val === '') {
      setAddItemCost('');
      setAddItemTotal('');
      return;
    }
    const cost = parseFloat(val);
    setAddItemCost(cost);
    if (!isNaN(cost)) {
      setAddItemTotal(parseFloat((cost * addItemQty).toFixed(2)));
    }
  };

  const handleTotalChange = (val: string) => {
    if (val === '') {
      setAddItemTotal('');
      setAddItemCost('');
      return;
    }
    const tot = parseFloat(val);
    setAddItemTotal(tot);
    if (!isNaN(tot) && addItemQty > 0) {
      setAddItemCost(parseFloat((tot / addItemQty).toFixed(2)));
    }
  };

  const handleAddItem = () => {
    const p = products.find(prod => prod.id === selectedProductId);
    if (!p) {
      toast.error('Selecciona un producto del catálogo');
      return;
    }
    const qty = Number(addItemQty);
    if (qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    const cost = Number(addItemCost) || (addItemTotal !== '' ? Number(addItemTotal) / qty : 0);
    const itemSubtotal = addItemTotal !== '' ? Number(addItemTotal) : qty * cost;

    const existingIndex = items.findIndex(it => it.productId === p.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].cantidad += qty;
      updated[existingIndex].costoEstimado = cost;
      updated[existingIndex].subtotal = updated[existingIndex].cantidad * cost;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: p.id,
          codigo: p.codigo,
          productNombre: `${p.descripcion || p.codigo} (${p.talle || 'N/A'})`,
          talle: p.talle,
          genero: p.genero,
          cantidad: qty,
          costoEstimado: cost,
          subtotal: itemSubtotal
        }
      ]);
    }

    setSelectedProductId('');
    setProductSearch('');
    setAddItemQty(1);
    setAddItemCost('');
    setAddItemTotal('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems(items.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          cantidad: newQty,
          subtotal: newQty * it.costoEstimado
        };
      }
      return it;
    }));
  };

  const handleUpdateItemCost = (index: number, newCost: number) => {
    setItems(items.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          costoEstimado: newCost,
          subtotal: it.cantidad * newCost
        };
      }
      return it;
    }));
  };

  const handleUpdateItemSubtotal = (index: number, newSubtotal: number) => {
    setItems(items.map((it, i) => {
      if (i === index) {
        const qty = it.cantidad || 1;
        const newCost = qty > 0 ? parseFloat((newSubtotal / qty).toFixed(2)) : 0;
        return {
          ...it,
          subtotal: newSubtotal,
          costoEstimado: newCost
        };
      }
      return it;
    }));
  };

  const subtotal = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const total = subtotal + (Number(flete) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedor.trim()) {
      toast.error('Indica el nombre del proveedor');
      return;
    }
    if (items.length === 0) {
      toast.error('Agrega al menos un artículo a la orden de compra');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        proveedor: proveedor.trim(),
        proveedorTelefono: proveedorTelefono.trim(),
        proveedorEmail: proveedorEmail.trim(),
        fechaEsperada: fechaEsperada || undefined,
        condicionPago,
        estado,
        items,
        flete: Number(flete) || 0,
        subtotal,
        total,
        notas: notas.trim()
      });
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar la orden de compra');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products for dropdown
  const filteredCatalog = products.filter(p => 
    productSearch && (
      (p.descripcion || '').toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(productSearch.toLowerCase())
    )
  ).slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                {orderToEdit ? `Editar Orden ${orderToEdit.numero}` : 'Nueva Orden de Compra (OC)'}
              </h3>
              <p className="text-xs text-gray-500">
                Pedido formal a proveedor para abastecimiento de inventario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Supplier details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Proveedor *
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Norte"
                  value={proveedor}
                  onChange={e => setProveedor(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Teléfono / WhatsApp
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Ej: 1145678901"
                  value={proveedorTelefono}
                  onChange={e => setProveedorTelefono(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email de Pedidos
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="pedidos@proveedor.com"
                  value={proveedorEmail}
                  onChange={e => setProveedorEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Delivery & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Fecha Requerida de Entrega
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={fechaEsperada}
                  onChange={e => setFechaEsperada(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Condición de Pago
              </label>
              <select
                value={condicionPago}
                onChange={e => setCondicionPago(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="Contado">Contado / Transferencia Inmediata</option>
                <option value="15 días">15 días fecha factura</option>
                <option value="30 días">30 días fecha factura</option>
                <option value="60 días">60 días fecha factura</option>
                <option value="Cuenta Corriente">Cuenta Corriente habitual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Estado de la Orden
              </label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="borrador">📝 Borrador (Sin enviar)</option>
                <option value="enviada">🚚 Enviada al Proveedor</option>
                <option value="parcial">📦 Recepción Parcial</option>
                <option value="recibida">✅ Recibida en Depósito</option>
                <option value="cancelada">❌ Cancelada</option>
              </select>
            </div>
          </div>

          {/* Add Item Section */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
            <h4 className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-wider">
              Agregar Artículos al Pedido
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 relative">
                <label className="block text-[11px] font-bold text-gray-500 mb-1">
                  Buscar producto en catálogo
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Escribe código o nombre..."
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      setSelectedProductId('');
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                  />
                </div>

                {filteredCatalog.length > 0 && !selectedProductId && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-48 overflow-y-auto">
                    {filteredCatalog.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 last:border-none"
                      >
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">[{p.codigo}]</span> {p.descripcion}
                          <span className="text-gray-400 text-[10px] ml-2">Stock: {p.cantidad}</span>
                        </div>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          ${(p.costo || 0).toLocaleString('es-AR')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-500 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={addItemQty}
                  onChange={e => handleQtyChange(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-center"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-500 mb-1" title="Costo unitario">
                  Costo Unit.
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="$0.00"
                  value={addItemCost}
                  onChange={e => handleCostChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-right"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1" title="Total del producto (calcula costo unitario)">
                  Total Est.
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="$0.00"
                  value={addItemTotal}
                  onChange={e => handleTotalChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold text-right"
                />
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1"
                >
                  <Plus size={14} />
                  Agregar
                </Button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-wider mb-2 flex items-center justify-between">
              <span>Artículos de la Orden ({items.length})</span>
              <span className="text-gray-400 font-normal normal-case text-[11px]">
                Podés ingresar el total o costo unitario directamente en la tabla
              </span>
            </h4>

            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-gray-400 text-xs">
                No has agregado ningún artículo a la orden todavía.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Artículo</th>
                      <th className="py-2.5 px-2 text-center w-24">Cantidad</th>
                      <th className="py-2.5 px-2 text-right w-28">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-right w-32">Total (Subtotal)</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
                          {item.codigo && <span className="text-indigo-600 dark:text-indigo-400 mr-1.5">[{item.codigo}]</span>}
                          {item.productNombre}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={e => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-16 py-1 text-center font-bold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.costoEstimado}
                            onChange={e => handleUpdateItemCost(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 py-1 text-right font-bold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2"
                            title="Costo unitario"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-gray-900 dark:text-white">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.subtotal}
                            onChange={e => handleUpdateItemSubtotal(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 py-1 text-right font-black text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 text-xs px-2"
                            title="Total por este producto (calcula costo unitario automáticamente)"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals and Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Instrucciones de Entrega / Notas para el Proveedor
              </label>
              <textarea
                rows={3}
                placeholder="Ej: Horario de entrega de 8 a 13hs. Entregar en depósito con remito..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal Artículos:</span>
                <span className="font-bold">${subtotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>Flete / Costo de Envío:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="$0.00"
                  value={flete}
                  onChange={e => setFlete(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-24 py-0.5 text-right font-bold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs px-2"
                />
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-baseline font-black">
                <span className="text-gray-900 dark:text-white text-sm">TOTAL ESTIMADO:</span>
                <span className="text-base text-indigo-600 dark:text-indigo-400">
                  ${total.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Action buttons */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-4 shadow-sm"
            >
              {isSubmitting ? 'Guardando...' : orderToEdit ? 'Actualizar Orden' : 'Crear Orden de Compra'}
            </Button>
          </div>

        </form>

      </div>
    </div>
  );
}
