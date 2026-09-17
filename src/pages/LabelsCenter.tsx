/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Tag, 
  Search, 
  Plus, 
  Trash2, 
  Sliders, 
  QrCode, 
  Layers, 
  Check, 
  RefreshCw,
  Wrench,
  Grid,
  Maximize2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui';
import { Product, WorkOrder } from '../types';
import { inventoryService } from '../services/inventoryService';
import { workOrderService } from '../services/workOrderService';
import { BarcodeItem } from '../components/etiquetas/BarcodeItem';

type LabelTemplate = 'gondola' | 'mini_repuesto' | 'qr_smart' | 'taller';

interface LabelQueueItem {
  id: string;
  title: string;
  code: string;
  price?: number;
  location?: string;
  secondaryText?: string;
  qrUrl?: string;
  copies: number;
}

export default function LabelsCenter() {
  const [products, setProducts] = useState<Product[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  
  // Printing Queue
  const [queue, setQueue] = useState<LabelQueueItem[]>([]);
  
  // Custom single label creation
  const [customTitle, setCustomTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  // Settings
  const [template, setTemplate] = useState<LabelTemplate>('gondola');
  const [columns, setColumns] = useState<number>(3);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showShopName, setShowShopName] = useState<boolean>(true);

  // Load products & orders
  useEffect(() => {
    inventoryService.getProducts().then(prods => {
      setProducts(prods);
      // Preload first 3 products as a helpful starter preview
      if (prods.length > 0) {
        setQueue(prods.slice(0, 3).map(p => ({
          id: p.id,
          title: p.descripcion,
          code: p.codigo,
          price: p.precio,
          location: p.ubicacion,
          qrUrl: `${window.location.origin}/stock-update/${p.id}`,
          copies: 2
        })));
      }
    }).catch(console.warn);

    workOrderService.getWorkOrders().then(setWorkOrders).catch(console.warn);
  }, []);

  // Add Product to Queue
  const handleAddProduct = (p: Product) => {
    const existing = queue.find(q => q.id === p.id);
    if (existing) {
      setQueue(queue.map(q => q.id === p.id ? { ...q, copies: q.copies + 1 } : q));
    } else {
      setQueue([
        ...queue,
        {
          id: p.id,
          title: p.descripcion,
          code: p.codigo,
          price: p.precio,
          location: p.ubicacion,
          qrUrl: `${window.location.origin}/stock-update/${p.id}`,
          copies: 1
        }
      ]);
    }
  };

  // Add Work Order to Queue
  const handleAddWorkOrder = (order: WorkOrder) => {
    const trackingUrl = `${window.location.origin}/seguimiento/${order.id}`;
    setQueue([
      ...queue,
      {
        id: order.id,
        title: `${order.numero} - ${order.equipo}`,
        code: order.numero,
        price: order.saldoPendiente,
        secondaryText: `Cliente: ${order.clientNombre}`,
        qrUrl: trackingUrl,
        copies: 1
      }
    ]);
  };

  // Add custom item
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    setQueue([
      ...queue,
      {
        id: `custom_${Date.now()}`,
        title: customTitle,
        code: customCode || `COD-${Date.now().toString().slice(-4)}`,
        price: customPrice ? Number(customPrice) : undefined,
        location: customLocation,
        copies: 1
      }
    ]);

    setCustomTitle('');
    setCustomCode('');
    setCustomPrice('');
    setCustomLocation('');
  };

  const updateCopies = (id: string, copies: number) => {
    if (copies < 1) {
      setQueue(queue.filter(q => q.id !== id));
    } else {
      setQueue(queue.map(q => q.id === id ? { ...q, copies } : q));
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue(queue.filter(q => q.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate flat array of labels multiplied by copies
  const allLabels = queue.flatMap(item => 
    Array.from({ length: item.copies }, (_, idx) => ({ ...item, uniqueKey: `${item.id}_${idx}` }))
  );

  const filteredProducts = products.filter(p => 
    p.descripcion.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchProduct.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header (Hidden on print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Centro de Etiquetas & Códigos
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {allLabels.length} para imprimir
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generador e impresor de etiquetas de góndola, mini-etiquetas con código de barras y rótulos QR para el taller
          </p>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <Button
              variant="outline"
              onClick={clearQueue}
              className="rounded-2xl text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              Vaciar Cola
            </Button>
          )}

          <Button
            onClick={handlePrint}
            disabled={allLabels.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-black rounded-2xl font-black text-xs sm:text-sm px-5 py-2.5 shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            <Printer size={16} />
            <span>Imprimir {allLabels.length} Etiquetas</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Selector & Settings (Left) vs Printable Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls Column (Hidden on Print) */}
        <div className="print:hidden lg:col-span-5 space-y-5">
          
          {/* 1. Template Picker */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Layers size={14} className="text-amber-500" />
              1. Formato de Etiqueta
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemplate('gondola')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  template === 'gondola'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xs font-black text-gray-900 dark:text-white block">🏷️ Góndola / Estante</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">Nombre grande, precio y barcode</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate('mini_repuesto')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  template === 'mini_repuesto'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xs font-black text-gray-900 dark:text-white block">📦 Mini Repuesto</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">Compacto para piezas y bolsitas</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate('qr_smart')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  template === 'qr_smart'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xs font-black text-gray-900 dark:text-white block">📱 QR Inteligente</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">Escanear p/ actualizar stock</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate('taller')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  template === 'taller'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xs font-black text-gray-900 dark:text-white block">🛠️ Rótulo de Taller</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">Pegar en equipo con OT y QR</span>
              </button>
            </div>

            {/* Layout options */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-600 dark:text-gray-400">Columnas:</span>
                {[2, 3, 4].map(c => (
                  <button
                    key={c}
                    onClick={() => setColumns(c)}
                    className={`w-7 h-7 rounded-lg font-black text-xs transition-colors ${
                      columns === c
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 font-bold text-gray-600 dark:text-gray-400">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded"
                  />
                  <span>Precio</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLocation}
                    onChange={(e) => setShowLocation(e.target.checked)}
                    className="rounded"
                  />
                  <span>Ubicación</span>
                </label>
              </div>
            </div>
          </div>

          {/* 2. Add from Inventory or Taller Orders */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Search size={14} className="text-amber-500" />
              2. Agregar Productos del Inventario
            </h3>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Buscar repuesto, código, descripción..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:border-amber-300 transition-colors text-xs"
                >
                  <div className="truncate mr-2">
                    <span className="font-bold text-gray-900 dark:text-white block truncate">{p.descripcion}</span>
                    <span className="text-[10px] text-gray-400">Cod: {p.codigo} • ${p.precio.toLocaleString('es-AR')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold shrink-0 text-[11px]"
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>

            {/* Quick add from Work Orders */}
            {workOrders.length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                  Rótulos de Órdenes de Taller Recientes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {workOrders.slice(0, 4).map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleAddWorkOrder(o)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 hover:bg-indigo-100"
                    >
                      <Wrench size={11} />
                      <span>{o.numero} ({o.equipo.slice(0, 14)}...)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Items in Queue */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>3. Cola de Impresión ({queue.length} modelos)</span>
              <span className="text-amber-600 font-bold">{allLabels.length} copias en total</span>
            </h3>

            {queue.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No hay etiquetas seleccionadas.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs"
                  >
                    <div className="truncate mr-2">
                      <span className="font-bold text-gray-900 dark:text-white block truncate">{item.title}</span>
                      <span className="text-[10px] text-gray-500">Cód: {item.code}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateCopies(item.id, item.copies - 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-gray-500 hover:text-black"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-black">{item.copies}</span>
                        <button
                          type="button"
                          onClick={() => updateCopies(item.id, item.copies + 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-gray-500 hover:text-black"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeQueueItem(item.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Printable Preview Column (This remains on print!) */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm overflow-hidden">
          
          <div className="print:hidden flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-6">
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">
                Vista Previa de Impresión
              </h2>
              <p className="text-xs text-gray-400">
                Así se imprimirán en tu impresora de etiquetas o en hoja estándar A4
              </p>
            </div>
            <Button
              onClick={handlePrint}
              disabled={allLabels.length === 0}
              className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black font-black text-xs gap-1.5 rounded-xl"
            >
              <Printer size={14} />
              <span>Imprimir</span>
            </Button>
          </div>

          {/* Printable Labels Canvas */}
          <div 
            id="labels-print-area"
            className={`grid gap-3 ${
              columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3'
            } print:grid-cols-3 print:gap-2 print:p-0`}
          >
            {allLabels.length === 0 ? (
              <div className="col-span-full text-center py-16 text-gray-400">
                <Tag size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="font-bold text-xs">No hay etiquetas en la cola</p>
                <p className="text-[11px] text-gray-400 mt-1">Seleccioná artículos a la izquierda para armar la plancha</p>
              </div>
            ) : (
              allLabels.map((lbl) => {
                if (template === 'gondola') {
                  return (
                    <div
                      key={lbl.uniqueKey}
                      className="border-2 border-black rounded-xl p-2.5 bg-white text-black flex flex-col justify-between h-36 shadow-sm print:shadow-none print:break-inside-avoid"
                    >
                      <div>
                        {showShopName && (
                          <div className="text-[8px] font-black uppercase tracking-wider text-gray-600 border-b border-gray-300 pb-0.5 mb-1 flex justify-between">
                            <span>TALLER GREGORUTTI</span>
                            {showLocation && lbl.location && <span>UBIC: {lbl.location}</span>}
                          </div>
                        )}
                        <h4 className="text-xs font-black leading-tight line-clamp-2 text-black">
                          {lbl.title}
                        </h4>
                      </div>

                      {/* Barcode & Price */}
                      <div className="space-y-1">
                        <BarcodeItem
                          value={lbl.code}
                          height={28}
                          width={1.2}
                          fontSize={9}
                        />
                        {showPrice && lbl.price !== undefined && (
                          <div className="flex items-baseline justify-between border-t border-black pt-1">
                            <span className="text-[9px] font-bold text-gray-700">PRECIO:</span>
                            <span className="text-base font-black text-black">
                              ${lbl.price.toLocaleString('es-AR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (template === 'mini_repuesto') {
                  return (
                    <div
                      key={lbl.uniqueKey}
                      className="border border-black rounded-lg p-2 bg-white text-black flex flex-col justify-between h-24 print:break-inside-avoid text-center"
                    >
                      <span className="text-[10px] font-black truncate block text-black">
                        {lbl.title}
                      </span>
                      <BarcodeItem
                        value={lbl.code}
                        height={22}
                        width={1.1}
                        fontSize={8}
                      />
                      {showPrice && lbl.price !== undefined && (
                        <span className="text-xs font-black text-black block">
                          ${lbl.price.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  );
                }

                if (template === 'qr_smart') {
                  return (
                    <div
                      key={lbl.uniqueKey}
                      className="border-2 border-black rounded-xl p-2.5 bg-white text-black flex items-center gap-2.5 h-32 print:break-inside-avoid"
                    >
                      <div className="shrink-0 bg-white p-1 border border-gray-300 rounded-lg">
                        <QRCodeSVG
                          value={lbl.qrUrl || `${window.location.origin}/stock-update/${lbl.id}`}
                          size={70}
                          level="M"
                        />
                      </div>
                      <div className="flex flex-col justify-between h-full overflow-hidden">
                        <div>
                          <span className="text-[8px] font-black uppercase text-gray-500 block">
                            ESCANEAR STOCK
                          </span>
                          <h4 className="text-[11px] font-black leading-tight text-black line-clamp-2">
                            {lbl.title}
                          </h4>
                          <span className="text-[9px] font-mono text-gray-600 block mt-0.5">
                            {lbl.code}
                          </span>
                        </div>
                        {showPrice && lbl.price !== undefined && (
                          <span className="text-sm font-black text-black">
                            ${lbl.price.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // 'taller' template
                return (
                  <div
                    key={lbl.uniqueKey}
                    className="border-2 border-black rounded-xl p-2.5 bg-white text-black flex flex-col justify-between h-36 print:break-inside-avoid"
                  >
                    <div className="border-b border-black pb-1 flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase">TALLER GREGORUTTI</span>
                      <span className="text-[10px] font-black bg-black text-white px-1.5 rounded">
                        {lbl.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 my-1">
                      <div className="shrink-0">
                        <QRCodeSVG
                          value={lbl.qrUrl || `${window.location.origin}/seguimiento/${lbl.id}`}
                          size={52}
                          level="M"
                        />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-black leading-tight truncate">{lbl.title}</h4>
                        {lbl.secondaryText && (
                          <p className="text-[10px] text-gray-700 font-bold truncate mt-0.5">
                            {lbl.secondaryText}
                          </p>
                        )}
                        <span className="text-[8px] text-gray-500 block mt-0.5">Escanear p/ seguimiento</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-300 pt-1 flex justify-between items-center text-[9px]">
                      <span className="font-bold text-gray-700">Saldo Pendiente:</span>
                      <span className="font-black text-xs text-black">
                        ${(lbl.price || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
