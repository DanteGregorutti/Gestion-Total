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
  Loader2
} from 'lucide-react';
import { Quote, Sale } from '../types';
import { Button } from './ui';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { 
  printReceipt, 
  downloadReceiptPdf, 
  ReceiptData, 
  ReceiptItem 
} from '../utils/receiptPrinter';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote?: Quote | null;
  sale?: Sale | null;
  salesGroup?: Sale[] | null; // For sales from the same transaction or grouped
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
  const [printFormat, setPrintFormat] = useState<'a4' | 'ticket'>('a4');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!isOpen || (!quote && !sale && (!salesGroup || salesGroup.length === 0))) {
    return null;
  }

  // Determine mode and items
  const isQuote = !!quote;
  const title = isQuote ? 'Presupuesto / Cotización' : 'Comprobante de Venta';
  const subtitle = isQuote ? 'Propuesta comercial para cliente' : 'Constancia de entrega y venta';
  
  // Format dates
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

  // Build items array
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

  // Format valid until date
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

  // Generate WhatsApp text
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
      toast.info(`Preparando impresión (${printFormat === 'ticket' ? 'Ticket 80mm' : 'Hoja A4'})...`);
      await printReceipt(receiptData, printFormat);
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
      downloadReceiptPdf(receiptData);
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto receipt-modal-backdrop">
      {/* Printable CSS style tag with isolated print rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > #root > *:not(.receipt-modal-backdrop) {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-modal-backdrop {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .receipt-modal-card {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-receipt {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 dark:border-gray-800 flex flex-col max-h-[92vh] receipt-modal-card">
        
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

        {/* Action Toolbar (Screen Only) */}
        <div className="px-4 sm:px-6 py-3 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 flex flex-wrap items-center justify-between gap-2.5 no-print shrink-0">
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

          {/* Format Selector: A4 vs Ticket 80mm */}
          <div className="flex items-center bg-gray-200/80 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setPrintFormat('a4')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                printFormat === 'a4'
                  ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
              title="Formato estándar Hoja A4"
            >
              <FileText size={13} />
              <span>Hoja A4</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('ticket')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                printFormat === 'ticket'
                  ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              )}
              title="Formato para impresora térmica / ticketera (80mm)"
            >
              <Receipt size={13} />
              <span>Ticket 80mm</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs rounded-xl h-8 px-2.5 font-bold"
              title="Copiar texto del comprobante"
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
              title="Descargar comprobante en formato PDF"
            >
              {isDownloadingPdf ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Download size={14} className="mr-1" />
              )}
              Descargar PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-8 px-3 font-bold shadow-sm"
              title="Imprimir comprobante en la impresora seleccionada"
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
              title="Compartir comprobante vía WhatsApp"
            >
              <MessageCircle size={14} className="mr-1 fill-current" />
              WhatsApp
            </Button>
          </div>
        </div>

        {/* Printable Paper View Content */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-900" id="printable-receipt">
          
          {printFormat === 'ticket' ? (
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

              <div className="border-t-2 border-gray-800" />

              {discount > 0 && (
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Descuento:</span>
                    <span>-${discount.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-baseline font-black text-sm pt-1">
                <span>TOTAL:</span>
                <span className="text-base font-black text-indigo-900">${finalTotal.toLocaleString('es-AR')}</span>
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
          ) : (
            /* ================= A4 FULL SHEET PREVIEW ================= */
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
