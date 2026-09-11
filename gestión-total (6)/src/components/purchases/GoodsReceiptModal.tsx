/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Printer, Package, Building2, Calendar, User } from 'lucide-react';
import { Purchase } from '../../types';
import { Button } from '../ui';

interface GoodsReceiptModalProps {
  purchase: Purchase | null;
  onClose: () => void;
}

export function GoodsReceiptModal({ purchase, onClose }: GoodsReceiptModalProps) {
  if (!purchase) return null;

  const rawDate = purchase.fecha;
  let dateObj: Date;
  try {
    dateObj = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || Date.now());
    if (isNaN(dateObj.getTime())) dateObj = new Date();
  } catch (e) {
    dateObj = new Date();
  }

  const receiptNumber = purchase.numeroComprobante || `REM-${(purchase.id || '001').slice(-6).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt-area, #printable-receipt-area * {
            visibility: visible;
          }
          #printable-receipt-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg">
              {receiptNumber}
            </span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Remito de Ingreso a Depósito
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              <Printer size={14} className="mr-1" />
              Imprimir Remito
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
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-900" id="printable-receipt-area">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4">
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase text-gray-900">
                PULSESTORE / GESTIÓN TOTAL
              </h1>
              <p className="text-xs text-gray-500 font-medium">Control de Stock & Recepción de Mercadería</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[11px] uppercase tracking-wider rounded">
                REMITO DE INGRESO
              </span>
              <p className="text-sm font-black text-gray-900 mt-1">{receiptNumber}</p>
              <p className="text-xs text-gray-500">
                Fecha: {dateObj.toLocaleDateString('es-AR')} {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Proveedor de Origen
              </span>
              <p className="text-sm font-black text-gray-900">{purchase.proveedor || 'Proveedor General'}</p>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Destino / Operación
              </span>
              <p className="font-medium text-gray-800">Ingreso a Depósito / Stock Físico</p>
              <p className="text-gray-500 text-[10px]">Registrado por: {purchase.createdBy || 'Administrador'}</p>
            </div>
          </div>

          {/* Items breakdown */}
          <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Artículo Recibido</th>
                  <th className="py-2 px-2 text-center w-20">Cantidad</th>
                  <th className="py-2 px-2 text-right w-24">Costo Unit.</th>
                  <th className="py-2 px-3 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 px-3 font-bold text-gray-900">
                    {purchase.productNombre}
                    {purchase.variantNombre && (
                      <span className="text-gray-500 text-[11px] block">Variante: {purchase.variantNombre}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center font-black text-emerald-700">
                    +{purchase.cantidad} un.
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700">
                    ${(purchase.costo || 0).toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-gray-900">
                    ${(purchase.total || (purchase.cantidad * purchase.costo)).toLocaleString('es-AR')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs text-gray-600">
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-900">
                Transportista / Repartidor
              </div>
              <p className="text-[10px] text-gray-400">Entregó Mercadería</p>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold text-gray-900">
                Encargado de Depósito
              </div>
              <p className="text-[10px] text-gray-400">Revisó y Dio Conformidad</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
