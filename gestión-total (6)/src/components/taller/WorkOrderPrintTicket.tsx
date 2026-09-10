/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X, Wrench, CheckCircle, QrCode } from 'lucide-react';
import { Button } from '../ui';
import { WorkOrder } from '../../types';

interface WorkOrderPrintTicketProps {
  order: WorkOrder;
  onClose: () => void;
}

export function WorkOrderPrintTicket({ order, onClose }: WorkOrderPrintTicketProps) {
  const handlePrint = () => {
    window.print();
  };

  const trackingUrl = `${window.location.origin}/seguimiento/${order.id}`;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      {/* Container */}
      <div className="w-full max-w-2xl bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-200">
        
        {/* Modal Action Bar (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-3.5 bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-amber-400" />
            <span className="font-bold text-sm">Comprobante de Taller - {order.numero}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs gap-1.5 rounded-xl"
            >
              <Printer size={14} />
              <span>Imprimir Ficha</span>
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
              <p className="text-xs text-gray-600 font-semibold">Reparaciones, Mantenimiento & Servicios Técnicos</p>
              <p className="text-xs text-gray-500 font-medium">WhatsApp Oficial: 11-6025-5767 • Taller & Reparaciones</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-black text-white font-black text-sm rounded-lg">
                ORDEN {order.numero}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Ingreso: {new Date(order.fechaIngreso).toLocaleDateString('es-AR')}
              </p>
              {order.fechaPrometida && (
                <p className="text-xs font-bold text-gray-700">
                  Prometido: {new Date(order.fechaPrometida).toLocaleDateString('es-AR')}
                </p>
              )}
            </div>
          </div>

          {/* Client & Equipment Row */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">DATOS DEL CLIENTE</span>
              <p className="text-base font-black text-black">{order.clientNombre}</p>
              {order.clientTelefono && (
                <p className="text-xs text-gray-600 font-medium">Tel: {order.clientTelefono}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">DATOS DEL EQUIPO</span>
              <p className="text-base font-black text-black">{order.equipo}</p>
              <p className="text-xs text-gray-600 font-medium">
                {order.marcaModelo && <span>Modelo: {order.marcaModelo} • </span>}
                {order.serieOPatente && <span>N° Serie/Patente: {order.serieOPatente}</span>}
              </p>
            </div>
          </div>

          {/* Symptoms & Diagnosis */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Motivo de Ingreso / Síntoma:</span>
              <p className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium text-gray-800">
                {order.fallaReportada || 'Revisión técnica general.'}
              </p>
            </div>

            {order.diagnostico && (
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Diagnóstico Técnico:</span>
                <p className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium text-gray-800">
                  {order.diagnostico}
                </p>
              </div>
            )}
          </div>

          {/* Breakdown Table */}
          {order.repuestos && order.repuestos.length > 0 && (
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Repuestos & Insumos:</span>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1">Descripción</th>
                    <th className="py-1 text-center w-16">Cant.</th>
                    <th className="py-1 text-right w-24">Precio</th>
                    <th className="py-1 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.repuestos.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-medium">{r.descripcion}</td>
                      <td className="py-1.5 text-center">{r.cantidad}</td>
                      <td className="py-1.5 text-right">${r.precioUnitario.toLocaleString('es-AR')}</td>
                      <td className="py-1.5 text-right font-bold">${r.subtotal.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals Box */}
          <div className="border-t-2 border-gray-200 pt-3 flex items-start justify-between">
            <div className="w-1/2 text-xs text-gray-500 space-y-1">
              <p>• La seña cubre los gastos iniciales de diagnóstico y repuestos.</p>
              <p>• Los equipos no retirados pasados 60 días devengan gastos de depósito.</p>
              <p className="font-bold text-gray-700">Garantía de reparación: 30 días.</p>
            </div>

            <div className="w-1/2 text-right space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Mano de Obra:</span>
                <span className="font-bold">${order.costoManoObra.toLocaleString('es-AR')}</span>
              </div>
              {order.costoRepuestos > 0 && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Repuestos:</span>
                  <span className="font-bold">${order.costoRepuestos.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black border-t border-gray-200 pt-1 text-black">
                <span>TOTAL ESTIMADO:</span>
                <span>${order.total.toLocaleString('es-AR')}</span>
              </div>
              {order.anticipo > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                  <span>Seña Abonada:</span>
                  <span>-${order.anticipo.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-indigo-700 border-t-2 border-black pt-1">
                <span>SALDO PENDIENTE:</span>
                <span>${order.saldoPendiente.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Tear-off slip for the client / Talón de Retiro */}
          <div className="border-t-2 border-dashed border-gray-400 pt-6 mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-black">TALÓN DE RETIRO - TALLER GREGORUTTI</span>
                <p className="text-[11px] text-gray-500">Presentar este talón al momento de retirar su equipo</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black bg-black text-white px-2 py-0.5 rounded">
                  {order.numero}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <p><strong>Cliente:</strong> {order.clientNombre}</p>
                <p><strong>Equipo:</strong> {order.equipo}</p>
              </div>
              <div className="text-right">
                <p><strong>Saldo a Abonar:</strong> ${order.saldoPendiente.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-gray-500">Seguimiento: {trackingUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="border-t border-gray-400 text-center text-[10px] text-gray-500 pt-1">
                Firma Cliente (Recepción)
              </div>
              <div className="border-t border-gray-400 text-center text-[10px] text-gray-500 pt-1">
                Firma Taller Gregorutti
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
