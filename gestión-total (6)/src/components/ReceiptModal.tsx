/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  MessageCircle, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  Clock, 
  Send, 
  Sparkles, 
  ArrowRight, 
  Download, 
  Receipt, 
  Loader2,
  Palette,
  ShieldCheck,
  Wrench,
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import { Quote, Sale } from '../types';
import { Button } from './ui';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { 
  printReceipt, 
  downloadReceiptPdf, 
  ReceiptData, 
  ReceiptItem,
  QuoteStyle,
  QUOTE_STYLE_OPTIONS
} from '../utils/receiptPrinter';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote?: Quote | null;
  sale?: Sale | null;
  salesGroup?: Sale[] | null;
  onConvertToSale?: (quote: Quote) => Promise<void>;
}

export function ReceiptModal({ 
  isOpen, 
  onClose, 
  quote, 
  sale, 
  salesGroup,
  onConvertToSale 
}: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<QuoteStyle>('modern');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!isOpen || (!quote && !sale && (!salesGroup || salesGroup.length === 0))) {
    return null;
  }

  const isQuote = !!quote;
  const title = isQuote ? 'Presupuesto / Cotización' : 'Comprobante de Venta';
  const subtitle = isQuote ? 'Propuesta comercial para cliente' : 'Constancia de entrega y venta';
  
  const rawDate = isQuote ? quote.fecha : (sale?.fecha || salesGroup?.[0]?.fecha);
  let emissionDate: Date;
  try {
    emissionDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || Date.now());
    if (isNaN(emissionDate.getTime())) emissionDate = new Date();
  } catch (e) {
    emissionDate = new Date();
  }

  const clientName = isQuote 
    ? (quote.clientNombre || 'Cliente General')
    : (sale?.clientNombre || salesGroup?.[0]?.clientNombre || 'Consumidor Final');

  const clientPhone = isQuote ? quote.clientTelefono : undefined;

  const docNumber = isQuote 
    ? (quote.numero || 'COT-001')
    : `VTA-${(sale?.id || salesGroup?.[0]?.id || '001').slice(-5).toUpperCase()}`;

  const items: ReceiptItem[] = isQuote 
    ? quote.items.map(item => ({
        productId: item.productId,
        productNombre: item.productNombre,
        variantNombre: item.variantNombre,
        cantidad: item.cantidad,
        precio: item.precio,
        total: item.total
      }))
    : (salesGroup && salesGroup.length > 0)
      ? salesGroup.map(s => ({
          productId: s.productId,
          productNombre: s.productNombre,
          variantNombre: s.variantNombre,
          cantidad: s.cantidad,
          precio: s.precio,
          total: s.total
        }))
      : sale 
        ? [{
            productId: sale.productId,
            productNombre: sale.productNombre,
            variantNombre: sale.variantNombre,
            cantidad: sale.cantidad,
            precio: sale.precio,
            total: sale.total
          }]
        : [];

  const subtotal = isQuote 
    ? (quote.subtotal || quote.total)
    : items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);

  const discount = isQuote ? (quote.descuento || 0) : 0;
  const finalTotal = isQuote ? quote.total : subtotal;

  let validUntilText = '';
  if (isQuote && quote.validezFecha) {
    try {
      const valDate = new Date(quote.validezFecha);
      validUntilText = valDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {}
  }

  const receiptData: ReceiptData = {
    title,
    subtitle,
    docNumber,
    date: emissionDate,
    isQuote,
    clientName,
    clientPhone,
    items,
    subtotal,
    discount,
    total: finalTotal,
    validUntilText,
    notas: isQuote ? quote.notas : undefined,
    storeName: 'Gestión Total'
  };

  const generateMessageText = () => {
    let msg = `*${title.toUpperCase()}*\n`;
    msg += `📄 *N°:* ${docNumber}\n`;
    msg += `📅 *Fecha:* ${emissionDate.toLocaleDateString('es-AR')}\n`;
    msg += `👤 *Cliente:* ${clientName}\n`;
    if (isQuote && validUntilText) {
      msg += `⏳ *Válido hasta:* ${validUntilText} (${quote.validezDias || 7} días)\n`;
    }
    msg += `--------------------------------\n`;
    msg += `*DETALLE DE ARTÍCULOS:*\n`;

    items.forEach((item, index) => {
      const variantStr = item.variantNombre ? ` [${item.variantNombre}]` : '';
      msg += `${index + 1}. *${item.productNombre}${variantStr}*\n`;
      msg += `   ${item.cantidad} un. x $${item.precio.toLocaleString('es-AR')} = *$${item.total.toLocaleString('es-AR')}*\n`;
    });

    msg += `--------------------------------\n`;
    if (discount > 0) {
      msg += `Subtotal: $${subtotal.toLocaleString('es-AR')}\n`;
      msg += `Descuento: -$${discount.toLocaleString('es-AR')}\n`;
    }
    msg += `💰 *TOTAL: $${finalTotal.toLocaleString('es-AR')}*\n\n`;

    if (isQuote && quote.notas) {
      msg += `📝 *Observaciones:* ${quote.notas}\n\n`;
    }

    msg += `⚠️ _DOCUMENTO NO VÁLIDO COMO FACTURA_\n`;
    msg += `_Comprobante de uso comercial e informativo interno._\n`;
    msg += `¡Muchas gracias por tu consulta!`;

    return msg;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateMessageText());
      setCopied(true);
      toast.success('Detalle copiado al portapapeles');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error('No se pudo copiar el texto');
    }
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateMessageText());
    let url = `https://api.whatsapp.com/send?text=${text}`;
    if (clientPhone) {
      const cleanPhone = clientPhone.replace(/\D/g, '');
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    }
    window.open(url, '_blank');
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const option = QUOTE_STYLE_OPTIONS.find(o => o.id === selectedStyle);
      toast.info(`Preparando impresión (${option?.label || 'Estándar'})...`);
      await printReceipt(receiptData, selectedStyle);
    } catch (err) {
      console.error('Error al imprimir comprobante:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      downloadReceiptPdf(receiptData, selectedStyle);
      toast.success('¡Comprobante PDF descargado exitosamente!');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      toast.error('No se pudo generar el archivo PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleConvert = async () => {
    if (!quote || !onConvertToSale) return;
    setIsConverting(true);
    try {
      await onConvertToSale(quote);
      toast.success('¡Cotización convertida en Venta y stock actualizado!');
      onClose();
    } catch (error) {
      toast.error('Error al convertir en venta');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto receipt-modal-backdrop">
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 dark:border-gray-800 flex flex-col max-h-[92vh] receipt-modal-card">
        
        {/* Modal Top Bar (Screen Only) */}
        <div className="p-4 sm:px-6 sm:py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Style Selector Toolbar (Screen Only) */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1.5">
              <Palette size={14} className="text-indigo-600 dark:text-indigo-400" />
              Estilo Visual de Cotización ({QUOTE_STYLE_OPTIONS.length})
            </span>
            <span className="text-[11px] text-gray-400">
              Selecciona el diseño con el que se imprimirá y descargará en PDF
            </span>
          </div>

          {/* Style pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {QUOTE_STYLE_OPTIONS.map(opt => {
              const isSelected = selectedStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedStyle(opt.id)}
                  className={cn(
                    "p-2 rounded-xl text-left border transition-all flex flex-col justify-between relative group",
                    isSelected
                      ? "bg-white dark:bg-gray-800 border-indigo-600 dark:border-indigo-400 shadow-sm ring-2 ring-indigo-600/20"
                      : "bg-white/60 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600 opacity-80 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-base">{opt.icon}</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-1.5 py-0.2 rounded",
                      isSelected
                        ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                    )}>
                      {opt.badge}
                    </span>
                  </div>
                  <div>
                    <p className={cn(
                      "text-xs font-bold leading-tight",
                      isSelected ? "text-indigo-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Toolbar (Screen Only) */}
        <div className="px-4 sm:px-6 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 flex flex-wrap items-center justify-between gap-2.5 no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {docNumber}
            </span>
            {isQuote && quote.estado && (
              <span className={cn(
                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                quote.estado === 'pendiente' && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                quote.estado === 'aceptada' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                quote.estado === 'rechazada' && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
              )}>
                {quote.estado === 'pendiente' ? 'Pendiente' : quote.estado === 'aceptada' ? 'Venta Concretada' : 'Rechazada'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs rounded-xl h-8 px-2.5 font-bold"
            >
              {copied ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="text-xs rounded-xl h-8 px-2.5 font-bold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              {isDownloadingPdf ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Download size={14} className="mr-1" />
              )}
              PDF ({QUOTE_STYLE_OPTIONS.find(o => o.id === selectedStyle)?.label.split(' ')[0]})
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-8 px-3 font-bold shadow-sm"
            >
              {isPrinting ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Printer size={14} className="mr-1" />
              )}
              Imprimir
            </Button>
            <Button
              size="sm"
              onClick={handleSendWhatsApp}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-3 font-black shadow-sm"
            >
              <MessageCircle size={14} className="mr-1 fill-current" />
              WhatsApp
            </Button>
          </div>
        </div>

        {/* Printable Paper View Content */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-900" id="printable-receipt">
          
          {selectedStyle === 'ticket' ? (
            /* ================= TICKET 80MM PREVIEW ================= */
            <div className="max-w-[340px] mx-auto p-4 bg-white border border-gray-300 rounded-xl shadow-sm font-mono text-xs text-gray-900 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-base font-black tracking-wider uppercase">GESTIÓN TOTAL</p>
                <p className="text-[10px] text-gray-500">Gestión Comercial & Stock</p>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <p className="text-xs font-black uppercase">{title}</p>
                <p className="text-[11px] font-bold">N°: {docNumber}</p>
                <p className="text-[10px] text-gray-600">Fecha: {emissionDate.toLocaleDateString('es-AR')} {emissionDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                {isQuote && validUntilText && (
                  <p className="text-[10px] font-bold text-amber-700">Validez: hasta {validUntilText}</p>
                )}
              </div>

              <div className="border-t border-dashed border-gray-400" />
              <div className="text-[11px] space-y-0.5">
                <p><span className="font-bold">Cliente:</span> {clientName}</p>
                {clientPhone && <p><span className="font-bold">Tel:</span> {clientPhone}</p>}
                <p><span className="font-bold">Tipo:</span> {isQuote ? 'Cotización Comercial' : 'Comprobante de Entrega'}</p>
              </div>

              <div className="border-t-2 border-gray-800" />
              <div className="flex justify-between font-black text-[11px]">
                <span className="w-8">Cant</span>
                <span className="flex-1">Artículo</span>
                <span className="w-16 text-right">Total</span>
              </div>
              <div className="border-t border-dashed border-gray-400" />

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px]">
                    <span className="w-8 font-bold">{item.cantidad}x</span>
                    <div className="flex-1 pr-2">
                      <p className="font-bold">{item.productNombre}</p>
                      {item.variantNombre && <p className="text-[10px] text-gray-600">[{item.variantNombre}]</p>}
                      <p className="text-[10px] text-gray-500">${item.precio.toLocaleString('es-AR')} c/u</p>
                    </div>
                    <span className="w-16 text-right font-black">${item.total.toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-gray-800 pt-2 space-y-1">
                {discount > 0 && (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span>Subtotal:</span>
                      <span>${subtotal.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
                      <span>Descuento:</span>
                      <span>-${discount.toLocaleString('es-AR')}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-baseline font-black text-sm pt-1">
                  <span>TOTAL:</span>
                  <span className="text-base font-black text-gray-900">${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {isQuote && quote.notas && (
                <div className="border-t border-dashed border-gray-400 pt-2 text-[10px] text-gray-600">
                  <p className="font-bold">Notas:</p>
                  <p className="italic">{quote.notas}</p>
                </div>
              )}

              <div className="border border-gray-400 p-2 text-center text-[10px] font-bold text-gray-700 uppercase my-2">
                DOCUMENTO NO VÁLIDO COMO FACTURA<br />
                <span className="text-[9px] font-normal normal-case">Uso interno comercial e informativo</span>
              </div>

              <p className="text-center text-[10px] text-gray-500 pt-1">¡Muchas gracias por su preferencia!</p>
            </div>
          ) : selectedStyle === 'classic' ? (
            /* ================= CLASSIC CORPORATE PREVIEW ================= */
            <div className="space-y-6 font-serif text-gray-900">
              <div className="border-b-4 border-double border-gray-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold uppercase tracking-wide">GESTIÓN TOTAL</h1>
                  <p className="text-xs italic text-gray-600 font-sans">Comercio, Servicios & Reparaciones Generales</p>
                  <p className="text-xs text-gray-500 font-sans mt-1">Atención personalizada &bull; Tel: +54 9 11 6025-5767</p>
                </div>
                <div className="text-right font-sans">
                  <h2 className="text-lg font-bold uppercase text-gray-900">{title}</h2>
                  <p className="text-sm font-bold">N° Control: {docNumber}</p>
                  <p className="text-xs text-gray-600">Fecha: {emissionDate.toLocaleDateString('es-AR')}</p>
                  {isQuote && validUntilText && (
                    <p className="text-xs font-bold text-amber-800">Validez: {validUntilText}</p>
                  )}
                </div>
              </div>

              <table className="w-full text-xs border border-gray-800 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="w-1/4 bg-gray-100 p-2 font-bold font-sans">Señor(es) / Cliente:</td>
                    <td className="p-2 font-bold">{clientName}</td>
                    <td className="w-1/4 bg-gray-100 p-2 font-bold font-sans">Condición Comercial:</td>
                    <td className="p-2">{isQuote ? 'Presupuesto Estimado' : 'Venta Directa'}</td>
                  </tr>
                  <tr>
                    <td className="w-1/4 bg-gray-100 p-2 font-bold font-sans">Teléfono de Contacto:</td>
                    <td className="p-2">{clientPhone || 'No informado'}</td>
                    <td className="w-1/4 bg-gray-100 p-2 font-bold font-sans">Plazo de Validez:</td>
                    <td className="p-2">{isQuote ? (validUntilText ? `Hasta ${validUntilText}` : '10 días corridos') : 'Entrega Inmediata'}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-y-2 border-gray-900 bg-gray-100 font-sans font-bold uppercase text-[10px]">
                    <th className="py-2 px-2 text-center w-10">Ítem</th>
                    <th className="py-2 px-2 text-center w-12">Cant.</th>
                    <th className="py-2 px-2 text-left">Descripción Detallada</th>
                    <th className="py-2 px-2 text-right w-28">Precio Unit.</th>
                    <th className="py-2 px-2 text-right w-28">Importe Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 text-center font-sans text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-2 text-center font-bold">{item.cantidad}</td>
                      <td className="py-2.5 px-2">
                        <strong>{item.productNombre}</strong>
                        {item.variantNombre && <span className="text-gray-600 font-sans text-[11px]"> [{item.variantNombre}]</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-2.5 px-2 text-right font-bold">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start pt-2">
                <div className="text-xs font-sans text-gray-600 max-w-sm space-y-1">
                  {isQuote && quote.notas && (
                    <p><strong>Observaciones:</strong> <em>{quote.notas}</em></p>
                  )}
                  <p className="text-[11px] text-gray-400">* Precios cotizados no constituyen reserva hasta su confirmación.</p>
                </div>

                <div className="border-2 border-gray-900 p-3 w-60 text-right font-sans">
                  {discount > 0 && (
                    <div className="text-xs space-y-0.5 mb-1 pb-1 border-b border-gray-300">
                      <div>Subtotal: ${subtotal.toLocaleString('es-AR')}</div>
                      <div className="text-emerald-700 font-bold">Descuento: -${discount.toLocaleString('es-AR')}</div>
                    </div>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-600">Importe Total:</span>
                  <span className="text-xl font-bold font-serif">${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Signatures block */}
              <div className="grid grid-cols-2 gap-12 pt-8 text-center text-xs font-sans text-gray-700">
                <div>
                  <div className="border-t border-gray-900 pt-2 font-bold">Firma y Sello Comercial Autorizado</div>
                  <p className="text-[10px] text-gray-400">Gestión Total</p>
                </div>
                <div>
                  <div className="border-t border-gray-900 pt-2 font-bold">Conforme y Aceptación de Cotización</div>
                  <p className="text-[10px] text-gray-400">Firma del Cliente</p>
                </div>
              </div>
            </div>
          ) : selectedStyle === 'minimal' ? (
            /* ================= MINIMALIST NORDIC PREVIEW ================= */
            <div className="space-y-8 font-sans text-gray-900">
              <div className="flex justify-between items-baseline border-b border-gray-900 pb-6">
                <h1 className="text-base font-black tracking-[2px] uppercase">GESTIÓN TOTAL</h1>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{title} &bull; {docNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Destinatario</span>
                  <p className="text-base font-bold text-gray-900">{clientName}</p>
                  {clientPhone && <p className="text-gray-500 mt-0.5">{clientPhone}</p>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Emisión</span>
                  <p className="font-medium text-gray-900">{emissionDate.toLocaleDateString('es-AR')}</p>
                  {isQuote && validUntilText && (
                    <p className="text-amber-700 font-medium text-[11px] mt-0.5">Válido hasta {validUntilText}</p>
                  )}
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-900 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                    <th className="py-2.5 px-1 w-10">Cant</th>
                    <th className="py-2.5 px-2">Descripción</th>
                    <th className="py-2.5 px-2 text-right w-28">Unitario</th>
                    <th className="py-2.5 px-2 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-1 text-gray-400 font-medium">{item.cantidad}</td>
                      <td className="py-3 px-2">
                        <span className="font-semibold text-gray-900">{item.productNombre}</span>
                        {item.variantNombre && <span className="text-gray-400 text-[11px] block">{item.variantNombre}</span>}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-3 px-2 text-right font-bold text-gray-900">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-baseline pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-400 max-w-sm">
                  {isQuote && quote.notas && <p className="italic">{quote.notas}</p>}
                </div>
                <div className="text-right">
                  {discount > 0 && (
                    <div className="text-xs space-y-0.5 mb-1 text-gray-500">
                      <div>Subtotal: ${subtotal.toLocaleString('es-AR')}</div>
                      <div className="text-emerald-700 font-semibold">Descuento: -${discount.toLocaleString('es-AR')}</div>
                    </div>
                  )}
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Total General</span>
                  <span className="text-3xl font-light text-gray-900">${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          ) : selectedStyle === 'technical' ? (
            /* ================= TECHNICAL INDUSTRIAL PREVIEW ================= */
            <div className="space-y-6 font-mono text-xs text-gray-900">
              <div className="border-2 border-sky-600 rounded-2xl p-4 bg-sky-50 flex justify-between items-center">
                <div>
                  <span className="bg-sky-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                    Ficha Técnica / Cotización
                  </span>
                  <h1 className="text-base font-black text-sky-900 mt-1 uppercase">GESTIÓN TOTAL &bull; SERVICIO TÉCNICO</h1>
                  <p className="text-[10px] text-gray-500">Presupuesto de Repuestos, Insumos y Mano de Obra</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-sky-700 block">{docNumber}</span>
                  <span className="text-[10px] text-gray-500">FECHA: {emissionDate.toLocaleDateString('es-AR')}</span>
                  {isQuote && validUntilText && (
                    <span className="text-[10px] font-bold text-amber-700 block">VALIDEZ: {validUntilText}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                  <div className="font-bold text-sky-800 border-b border-slate-200 pb-1 mb-2">
                    [01] DATOS DEL CLIENTE / EQUIPO
                  </div>
                  <div><strong>Cliente:</strong> {clientName}</div>
                  {clientPhone && <div><strong>Contacto:</strong> {clientPhone}</div>}
                  <div><strong>Condición:</strong> {isQuote ? 'Cotización Preliminar' : 'Entrega Inmediata'}</div>
                </div>

                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                  <div className="font-bold text-sky-800 border-b border-slate-200 pb-1 mb-2">
                    [02] CONDICIONES DE SERVICIO
                  </div>
                  <div><strong>Tipo:</strong> Partes, Repuestos & Mantenimiento</div>
                  <div><strong>Garantía:</strong> 90 días en repuestos oficiales</div>
                  <div><strong>Validez:</strong> {validUntilText || '10 días corridos'}</div>
                </div>
              </div>

              <table className="w-full border border-sky-600 border-collapse text-[11px]">
                <thead>
                  <tr className="bg-sky-600 text-white font-bold uppercase text-[10px]">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2 text-center w-12">CANT</th>
                    <th className="py-2 px-2 text-left">DESCRIPCIÓN DE LA PIEZA / COMPONENTE</th>
                    <th className="py-2 px-2 text-right w-24">UNITARIO</th>
                    <th className="py-2 px-2 text-right w-24">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-2 text-center font-bold">{item.cantidad}x</td>
                      <td className="py-2.5 px-2">
                        <strong>{item.productNombre}</strong>
                        {item.variantNombre && <span className="text-slate-500 text-[10px]"> [{item.variantNombre}]</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-2.5 px-2 text-right font-bold">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start border border-slate-300 rounded-xl p-3 bg-slate-50">
                <div className="text-[11px] max-w-sm space-y-1">
                  {isQuote && quote.notas && <div><strong>NOTAS TÉCNICAS:</strong> {quote.notas}</div>}
                  <p className="text-[10px] text-slate-500">Valores sujetos a revisión técnica final previa a instalación.</p>
                </div>
                <div className="text-right w-56">
                  {discount > 0 && (
                    <div className="text-[11px] space-y-0.5 mb-1 pb-1 border-b border-slate-200">
                      <div>SUBTOTAL: ${subtotal.toLocaleString('es-AR')}</div>
                      <div className="text-emerald-700 font-bold">DESCUENTO: -${discount.toLocaleString('es-AR')}</div>
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 block">TOTAL ESTIMADO:</span>
                  <span className="text-xl font-black text-sky-700">${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Technical Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-4 text-center text-[10px]">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold">RESPONSABLE TÉCNICO DE TALLER</div>
                  <p className="text-slate-400">Control de calidad y diagnósticos</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold">CONFORMIDAD DEL CLIENTE</div>
                  <p className="text-slate-400">Aprobación de presupuesto y repuestos</p>
                </div>
              </div>
            </div>
          ) : selectedStyle === 'automotive' ? (
            /* ================= AUTOMOTIVE & TALLER MECÁNICO PREVIEW ================= */
            <div className="space-y-5 font-sans text-gray-900">
              <div className="h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-slate-900 rounded-full" />
              
              <div className="flex justify-between items-start border-b-2 border-gray-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-gray-900 uppercase">GESTIÓN TOTAL</h1>
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                      ⚙️ TALLER MECÁNICO & AUTOPARTES
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Servicio Mecánico Especializado & Repuestos Oficiales</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-400 uppercase block">{title}</span>
                  <span className="text-lg font-black text-red-600 font-mono block">{docNumber}</span>
                  <span className="text-xs text-gray-500">Fecha: {emissionDate.toLocaleDateString('es-AR')}</span>
                  {isQuote && validUntilText && (
                    <span className="text-xs font-bold text-red-600 block">Validez: {validUntilText}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cliente & Contacto</span>
                  <p className="font-bold text-slate-900 text-sm">{clientName}</p>
                  {clientPhone && <p className="text-slate-600 mt-0.5">Tel: <strong>{clientPhone}</strong></p>}
                  <p className="text-slate-500 text-[11px] mt-0.5">Condición: {isQuote ? 'Presupuesto Estimado' : 'Entrega Inmediata'}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Garantía & Plazo</span>
                  <p className="text-slate-700 font-medium"><strong>Garantía:</strong> 90 días en piezas y trabajo</p>
                  <p className="text-slate-700 font-medium mt-0.5"><strong>Plazo:</strong> Según disponibilidad de stock</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Documento comercial sin valor fiscal</p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3 text-center w-14">Cant</th>
                    <th className="py-2.5 px-3 text-left">Repuesto / Servicio Solicitado</th>
                    <th className="py-2.5 px-3 text-right w-24">Unitario</th>
                    <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : ""}>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-center font-black">{item.cantidad}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{item.productNombre}</span>
                        {item.variantNombre && <span className="text-slate-500 text-[11px] ml-1.5">[{item.variantNombre}]</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start pt-2">
                <div className="max-w-sm space-y-2">
                  {isQuote && quote.notas && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                      <strong>Notas de Taller:</strong> <em>{quote.notas}</em>
                    </div>
                  )}
                  <div className="bg-red-50 border-l-4 border-red-600 p-2.5 text-xs text-red-900 rounded-r-lg">
                    <strong>🛡️ GARANTÍA DE SERVICIO:</strong> Reparaciones y autopartes respaldadas por garantía directa.
                  </div>
                </div>

                <div className="w-64 bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-xs">
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Subtotal:</span><span>${subtotal.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold mb-1">
                        <span>Bonificación:</span><span>-${discount.toLocaleString('es-AR')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 text-red-600 font-black text-base">
                    <span className="text-xs uppercase text-slate-900">TOTAL:</span>
                    <span>${finalTotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4 text-center text-[10px]">
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-900">RESPONSABLE TÉCNICO</div>
                  <p className="text-slate-400">Inspección de calidad & taller</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-900">CONFORMIDAD DEL CLIENTE</div>
                  <p className="text-slate-400">Aprobación expresa de presupuesto</p>
                </div>
              </div>
            </div>
          ) : selectedStyle === 'executive_gold' ? (
            /* ================= EXECUTIVE GOLD / ALTA GAMA PREVIEW ================= */
            <div className="space-y-5 text-gray-900 border border-amber-200/80 rounded-2xl p-5 bg-gradient-to-b from-amber-50/30 to-white shadow-sm">
              <div className="flex justify-between items-start border-b border-amber-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">GESTIÓN TOTAL</h1>
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-300">
                      💎 ALTA GAMA
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-800 mt-1">Propuesta Comercial & Servicios Exclusivos</p>
                  <p className="text-[11px] text-gray-400">Atención personalizada • Tel: +54 9 11 6025-5767</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-800 uppercase block">{title}</span>
                  <span className="text-lg font-black text-slate-900 font-mono block">N° {docNumber}</span>
                  <span className="text-xs text-gray-500">Emisión: {emissionDate.toLocaleDateString('es-AR')}</span>
                  {isQuote && validUntilText && (
                    <span className="text-xs font-bold text-amber-700 block">Válido hasta: {validUntilText}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block mb-1">Cliente Destinatario</span>
                  <p className="font-bold text-slate-900 text-sm">{clientName}</p>
                  {clientPhone && <p className="text-slate-600 mt-0.5">Contacto: <strong>{clientPhone}</strong></p>}
                  <p className="text-slate-500 text-[11px] mt-0.5">{isQuote ? 'Cotización Formal' : 'Venta Registrada'}</p>
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block mb-1">Términos Comerciales</span>
                  <p className="text-slate-700 font-medium"><strong>Pago:</strong> Transferencia, Tarjeta o Efectivo</p>
                  <p className="text-slate-700 font-medium mt-0.5"><strong>Validez:</strong> {validUntilText || '7 días hábiles'}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Sin validez como comprobante fiscal</p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-100/80 text-amber-900 border-y border-amber-200 font-black uppercase text-[10px]">
                    <th className="py-2.5 px-3 text-center w-10">Ítem</th>
                    <th className="py-2.5 px-3 text-center w-14">Cant</th>
                    <th className="py-2.5 px-3 text-left">Detalle del Producto o Servicio</th>
                    <th className="py-2.5 px-3 text-right w-24">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right w-28">Importe Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40">
                      <td className="py-2.5 px-3 text-center text-amber-800 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-center font-black text-slate-900">{item.cantidad}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{item.productNombre}</span>
                        {item.variantNombre && <span className="text-slate-500 text-[11px] ml-1.5">[{item.variantNombre}]</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start pt-2">
                <div className="max-w-sm space-y-2">
                  <div className="bg-amber-50 border border-dashed border-amber-300 rounded-xl p-3 text-xs text-amber-900">
                    <strong>🏦 DATOS BANCARIOS:</strong><br />
                    <span>Banco Galicia / Santander &bull; Alias: <strong>TALLER.GREGORUTTI</strong></span>
                  </div>
                  {isQuote && quote.notas && (
                    <div className="text-xs text-stone-600">
                      <strong>Observaciones:</strong> <em>{quote.notas}</em>
                    </div>
                  )}
                </div>

                <div className="w-64 bg-amber-100/60 border border-amber-300 rounded-xl p-3 text-xs text-amber-950">
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between mb-1 text-slate-600">
                        <span>Subtotal:</span><span>${subtotal.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between mb-1 text-emerald-800 font-bold">
                        <span>Descuento:</span><span>-${discount.toLocaleString('es-AR')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-amber-300 text-amber-950 font-black text-base">
                    <span className="text-xs uppercase">TOTAL NETO:</span>
                    <span>${finalTotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedStyle === 'compact_express' ? (
            /* ================= COMPACT EXPRESS PREVIEW ================= */
            <div className="space-y-3 font-sans text-gray-900 border border-emerald-200 rounded-xl p-4 bg-emerald-50/20">
              <div className="flex justify-between items-center border-b-2 border-emerald-600 pb-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-emerald-800 uppercase">GESTIÓN TOTAL</h1>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    ⚡ EXPRESS
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-mono font-bold text-slate-900">N° {docNumber}</span> &bull; {emissionDate.toLocaleDateString('es-AR')}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs bg-white border border-gray-200 rounded-lg p-2">
                <div><strong>Cliente:</strong> {clientName} {clientPhone ? `(${clientPhone})` : ''}</div>
                <div>{isQuote && validUntilText ? <span><strong>Válido:</strong> {validUntilText}</span> : 'Entrega Inmediata'}</div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-100/60 text-emerald-900 border-b border-emerald-200 font-bold uppercase text-[10px]">
                    <th className="py-1.5 px-2 text-center w-8">#</th>
                    <th className="py-1.5 px-2 text-center w-12">Cant</th>
                    <th className="py-1.5 px-2 text-left">Artículo</th>
                    <th className="py-1.5 px-2 text-right w-20">Unitario</th>
                    <th className="py-1.5 px-2 text-right w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="py-1.5 px-2 text-center text-gray-400">{idx + 1}</td>
                      <td className="py-1.5 px-2 text-center font-bold">{item.cantidad}</td>
                      <td className="py-1.5 px-2">
                        <span className="font-semibold">{item.productNombre}</span>
                        {item.variantNombre && <span className="text-gray-500 text-[11px] ml-1">[{item.variantNombre}]</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-500">${item.precio.toLocaleString('es-AR')}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-gray-900">${item.total.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-white border border-gray-200 rounded-lg p-2.5 text-xs">
                <div className="text-[10px] text-gray-500">
                  DOC. NO VÁLIDO COMO FACTURA &bull; Comprobante ágil de mostrador
                  {isQuote && quote.notas && <div><em>Nota: {quote.notas}</em></div>}
                </div>
                <div className="text-right flex items-center gap-3">
                  {discount > 0 && <span className="text-emerald-700 font-bold">Desc: -${discount.toLocaleString('es-AR')}</span>}
                  <span className="text-base font-black text-emerald-700">TOTAL: ${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          ) : (
            /* ================= MODERN EXECUTIVE PREVIEW (DEFAULT) ================= */
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b-2 border-gray-200 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-gray-900 tracking-tight uppercase">
                      GESTIÓN TOTAL
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Gestión Comercial & Ventas</p>
                  <p className="text-xs text-gray-400">Atención personalizada y control de inventario</p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="inline-block px-3 py-1 bg-gray-100 text-gray-900 rounded-lg text-xs font-black tracking-wider uppercase mb-1">
                    {title}
                  </div>
                  <p className="text-sm font-black text-gray-900 tracking-tight">N°: {docNumber}</p>
                  <p className="text-xs text-gray-500">Fecha: {emissionDate.toLocaleDateString('es-AR')}</p>
                  {isQuote && validUntilText && (
                    <p className="text-xs font-bold text-amber-700 mt-1">
                      ⏳ Validez: hasta {validUntilText}
                    </p>
                  )}
                </div>
              </div>

              {/* OFFICIAL NON-FISCAL NOTICE BANNER */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <div className="text-xs leading-snug">
                  <p className="font-black text-amber-900 uppercase tracking-wide">
                    DOCUMENTO NO VÁLIDO COMO FACTURA
                  </p>
                  <p className="text-amber-700">
                    {isQuote 
                      ? 'Este presupuesto comercial es informativo y describe precios y cantidades estimadas sujetas a confirmación.' 
                      : 'Comprobante interno de venta / entrega de mercadería sin validez fiscal.'}
                  </p>
                </div>
              </div>

              {/* Client & Document Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Datos del Cliente
                  </span>
                  <p className="text-sm font-black text-gray-900">{clientName}</p>
                  {clientPhone && (
                    <p className="text-gray-600 font-medium mt-0.5">Tel: {clientPhone}</p>
                  )}
                </div>
                <div>
                  <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Condición / Tipo
                  </span>
                  <p className="text-sm font-black text-gray-900">
                    {isQuote ? 'Cotización Preliminar' : 'Venta Registrada'}
                  </p>
                  <p className="text-gray-600 font-medium mt-0.5">
                    {isQuote ? `Plazo: ${quote.validezDias || 7} días corridos` : 'Entrega Inmediata'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-gray-500 font-black uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-2 text-center w-12">Cant</th>
                      <th className="py-2.5 px-2">Descripción</th>
                      <th className="py-2.5 px-2">Variante / Talle</th>
                      <th className="py-2.5 px-2 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-2 text-center font-bold text-gray-800">
                          {item.cantidad}
                        </td>
                        <td className="py-3 px-2 font-bold text-gray-900">
                          {item.productNombre}
                        </td>
                        <td className="py-3 px-2 text-gray-600 font-medium">
                          {item.variantNombre ? (
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold">
                              {item.variantNombre}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-700 font-medium">
                          ${item.precio.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-gray-900">
                          ${item.total.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t-2 border-gray-200">
                <div className="text-xs text-gray-500 max-w-xs space-y-1">
                  {isQuote && quote.notas && (
                    <div>
                      <span className="font-bold text-gray-700 uppercase tracking-wider block text-[10px]">
                        Notas & Observaciones:
                      </span>
                      <p className="text-gray-600 italic mt-0.5">{quote.notas}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2">
                    * Precios sujetos a confirmación y disponibilidad de stock.
                  </p>
                </div>

                <div className="w-full sm:w-64 space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Subtotal:</span>
                        <span>${subtotal.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-600 font-bold">
                        <span>Descuento aplicado:</span>
                        <span>-${discount.toLocaleString('es-AR')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                    <span className="text-xs font-black uppercase text-gray-800">Total a Pagar:</span>
                    <span className="text-xl font-black text-indigo-700 tracking-tight">
                      ${finalTotal.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer watermark */}
              <div className="pt-6 border-t border-gray-100 text-center text-gray-400 text-[10px] space-y-1">
                <p className="font-bold uppercase tracking-widest text-gray-500">
                  DOCUMENTO NO VÁLIDO COMO FACTURA
                </p>
                <p>Constancia comercial interna emitida por sistema de inventario y cotizaciones.</p>
              </div>
            </>
          )}

        </div>

        {/* Modal Bottom Actions (Screen Only) */}
        <div className="p-4 sm:px-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div>
            {isQuote && quote.estado === 'pendiente' && onConvertToSale && (
              <Button
                onClick={handleConvert}
                disabled={isConverting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
              >
                <CheckCircle2 size={16} className="mr-2" />
                {isConverting ? 'Procesando venta...' : 'Aprobar y Registrar Venta'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
            >
              <Download size={14} className="mr-1.5" />
              Descargar PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <Printer size={14} className="mr-1.5" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              Cerrar
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
