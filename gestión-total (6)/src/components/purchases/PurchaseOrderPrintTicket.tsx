/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Building2, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  MessageCircle,
  Truck,
  Phone,
  Mail
} from 'lucide-react';
import { PurchaseOrder } from '../../types';
import { Button } from '../ui';
import { purchaseOrderService } from '../../services/purchaseOrderService';

interface PurchaseOrderPrintTicketProps {
  order: PurchaseOrder;
  onClose: () => void;
}

export function PurchaseOrderPrintTicket({ order, onClose }: PurchaseOrderPrintTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const url = purchaseOrderService.getWhatsAppMessage(order);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-po-area, #printable-po-area * {
            visibility: visible;
          }
          #printable-po-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Top Control Bar */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg">
              {order.numero}
            </span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Orden de Compra formal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleWhatsApp}
              className="text-xs h-8 px-2.5 text-emerald-600 hover:text-emerald-700 font-bold"
            >
              <MessageCircle size={14} className="mr-1" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              <Printer size={14} className="mr-1" />
              Imprimir
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Paper printable view */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-900" id="printable-po-area" ref={printRef}>
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase text-gray-900">
                PULSESTORE / GESTIÓN TOTAL
              </h1>
              <p className="text-xs text-gray-500 font-medium">Departamento de Compras & Abastecimiento</p>
              <p className="text-xs text-gray-500">Tel / WhatsApp: +54 9 11 6025-5767</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-gray-900 text-white font-black text-xs uppercase tracking-wider rounded">
                ORDEN DE COMPRA
              </span>
              <p className="text-base font-black text-gray-900 mt-1">{order.numero}</p>
              <p className="text-xs text-gray-500">
                Fecha: {new Date(order.fechaEmision).toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Datos del Proveedor
              </span>
              <p className="text-sm font-black text-gray-900">{order.proveedor}</p>
              {order.proveedorTelefono && (
                <p className="text-gray-600 mt-0.5">Tel: {order.proveedorTelefono}</p>
              )}
              {order.proveedorEmail && (
                <p className="text-gray-600 mt-0.5">Email: {order.proveedorEmail}</p>
              )}
            </div>

            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Condiciones del Pedido
              </span>
              <p className="text-gray-900">
                <strong>Condición de Pago:</strong> {order.condicionPago || 'Contado'}
              </p>
              {order.fechaEsperada && (
                <p className="text-gray-900 mt-0.5">
                  <strong>Fecha de Entrega:</strong> {new Date(order.fechaEsperada).toLocaleDateString('es-AR')}
                </p>
              )}
              <p className="text-gray-900 mt-0.5">
                <strong>Estado:</strong> {order.estado.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-900 text-gray-900 font-black uppercase text-[11px]">
                  <th className="py-2 px-2 text-center w-10">#</th>
                  <th className="py-2 px-2">Descripción del Artículo</th>
                  <th className="py-2 px-2 text-center w-20">Cantidad</th>
                  <th className="py-2 px-2 text-right w-28">Costo Unit.</th>
                  <th className="py-2 px-2 text-right w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-2 text-center font-bold text-gray-500">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-bold text-gray-900">
                      {item.codigo && <span className="text-gray-500 font-normal mr-1">[{item.codigo}]</span>}
                      {item.productNombre}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-gray-900">{item.cantidad} un.</td>
                    <td className="py-2.5 px-2 text-right text-gray-700">${item.costoEstimado.toLocaleString('es-AR')}</td>
                    <td className="py-2.5 px-2 text-right font-black text-gray-900">${item.subtotal.toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-between items-start pt-4 border-t-2 border-gray-900">
            <div className="text-xs text-gray-600 max-w-sm">
              {order.notas && (
                <div>
                  <span className="font-bold text-gray-900 block uppercase text-[10px] mb-0.5">
                    Instrucciones & Observaciones:
                  </span>
                  <p className="italic">{order.notas}</p>
                </div>
              )}
            </div>

            <div className="w-60 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal Artículos:</span>
                <span className="font-bold">${order.subtotal.toLocaleString('es-AR')}</span>
              </div>
              {order.flete && order.flete > 0 ? (
                <div className="flex justify-between text-gray-600">
                  <span>Flete / Envío:</span>
                  <span className="font-bold">${order.flete.toLocaleString('es-AR')}</span>
                </div>
              ) : null}
              <div className="border-t border-gray-900 pt-1 flex justify-between items-baseline font-black text-sm">
                <span>TOTAL PEDIDO:</span>
                <span className="text-base font-black text-gray-900">${order.total.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs text-gray-600">
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-900">
                Firma Solicitante / Compras
              </div>
              <p className="text-[10px] text-gray-400">PulseStore Gestión</p>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-900">
                Recepción Conforme / Depósito
              </div>
              <p className="text-[10px] text-gray-400">Fecha y Firma de Recepción</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
