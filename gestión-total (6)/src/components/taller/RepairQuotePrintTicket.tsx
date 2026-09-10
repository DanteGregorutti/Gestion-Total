/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X, Wrench, MessageCircle } from 'lucide-react';
import { Button } from '../ui';
import { RepairQuote } from '../../types';

interface RepairQuotePrintTicketProps {
  quote: RepairQuote;
  onClose: () => void;
}

export function RepairQuotePrintTicket({ quote, onClose }: RepairQuotePrintTicketProps) {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(quote.fecha || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-200">
        
        {/* Modal Action Bar (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-3.5 bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-indigo-400" />
            <span className="font-bold text-sm">Presupuesto Técnico - {quote.numero}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5 rounded-xl"
            >
              <Printer size={14} />
              <span>Imprimir / Guardar PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Ticket Area */}
        <div className="p-8 space-y-6 text-sm font-sans" id="print-area">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-black">TALLER GREGORUTTI</h1>
              <p className="text-xs text-gray-600 font-semibold">Reparaciones, Mantenimiento & Servicios Técnicos Especializados</p>
              <p className="text-xs text-gray-500 font-medium">WhatsApp Oficial: 11-6025-5767</p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-black text-white px-3 py-1 font-black text-base rounded-md">
                PRESUPUESTO TÉCNICO
              </div>
              <p className="text-lg font-black text-black mt-1">{quote.numero}</p>
              <p className="text-xs text-gray-500 font-medium">Fecha: {formattedDate}</p>
            </div>
          </div>

          {/* Non-fiscal warning */}
          <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-300 py-1 rounded">
            DOCUMENTO NO VÁLIDO COMO FACTURA • COTIZACIÓN INFORMATIVA
          </div>

          {/* Client & Equipment Row */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            <div>
              <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-wider mb-1">CLIENTE</h3>
              <p className="font-bold text-base text-black">{quote.clientNombre}</p>
              {quote.clientTelefono && (
                <p className="text-gray-600 font-medium">Tel / WhatsApp: {quote.clientTelefono}</p>
              )}
              {quote.clientEmail && (
                <p className="text-gray-600">{quote.clientEmail}</p>
              )}
            </div>

            <div>
              <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-wider mb-1">EQUIPO / MÁQUINA</h3>
              <p className="font-bold text-base text-black">{quote.equipo}</p>
              {quote.marcaModelo && (
                <p className="text-gray-600"><span className="font-semibold">Modelo:</span> {quote.marcaModelo}</p>
              )}
              {quote.serieOPatente && (
                <p className="text-gray-600"><span className="font-semibold">N° Serie/Patente:</span> {quote.serieOPatente}</p>
              )}
            </div>
          </div>

          {/* Fault & Preliminary Diagnosis */}
          <div className="space-y-3 text-xs">
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <h4 className="font-black text-gray-700 uppercase text-[10px] tracking-wider mb-1">MOTIVO / FALLA REPORTADA:</h4>
              <p className="text-gray-800 font-medium">{quote.fallaReportada}</p>
            </div>

            {quote.diagnosticoPrevio && (
              <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                <h4 className="font-black text-indigo-900 uppercase text-[10px] tracking-wider mb-1">DIAGNÓSTICO TÉCNICO PRELIMINAR:</h4>
                <p className="text-indigo-950 font-medium">{quote.diagnosticoPrevio}</p>
              </div>
            )}
          </div>

          {/* Repuestos / Detalle cotizado */}
          {quote.repuestos.length > 0 && (
            <div>
              <h3 className="font-black text-gray-900 text-xs uppercase tracking-wider mb-2">
                DETALLE DE REPUESTOS Y MATERIALES COTIZADOS
              </h3>
              <table className="w-full text-xs text-left">
                <thead className="border-b border-gray-300 font-black text-gray-600 text-[10px]">
                  <tr>
                    <th className="py-1.5">Descripción</th>
                    <th className="py-1.5 text-center">Cant.</th>
                    <th className="py-1.5 text-right">Precio Unit.</th>
                    <th className="py-1.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quote.repuestos.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium">{item.descripcion}</td>
                      <td className="py-2 text-center">{item.cantidad}</td>
                      <td className="py-2 text-right">${item.precioUnitario.toLocaleString('es-AR')}</td>
                      <td className="py-2 text-right font-bold">${item.subtotal.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales & Validez */}
          <div className="border-t-2 border-black pt-4 flex items-end justify-between">
            <div className="text-xs text-gray-600 max-w-sm space-y-1">
              <p className="font-bold text-gray-800">Condiciones:</p>
              <p>• Presupuesto válido por <strong>{quote.validezDias} días corridos</strong> desde su emisión.</p>
              {quote.notas && <p>• {quote.notas}</p>}
              <p className="text-[11px] text-gray-500">Para autorizar la reparación, favor comunicarse al WhatsApp 11-6025-5767 indicando el número {quote.numero}.</p>
            </div>

            <div className="text-right space-y-1 min-w-[200px]">
              {quote.costoRepuestos > 0 && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Repuestos:</span>
                  <span className="font-bold">${quote.costoRepuestos.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-600">
                <span>Mano de Obra:</span>
                <span className="font-bold">${quote.costoManoObra.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-base font-black text-black border-t-2 border-black pt-1 mt-1">
                <span>TOTAL ESTIMADO:</span>
                <span className="text-xl text-indigo-700">${quote.total.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-gray-500 border-t border-dashed border-gray-300">
            <div>
              <div className="border-t border-gray-400 w-36 mx-auto pt-1 mb-1"></div>
              <p className="font-bold text-black">Firma Taller Gregorutti</p>
            </div>
            <div>
              <div className="border-t border-gray-400 w-36 mx-auto pt-1 mb-1"></div>
              <p className="font-bold text-black">Conformidad del Cliente</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
