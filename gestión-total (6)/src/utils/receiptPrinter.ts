/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReceiptItem {
  productId?: string;
  productNombre: string;
  variantNombre?: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface ReceiptData {
  title: string;
  subtitle?: string;
  docNumber: string;
  date: Date;
  isQuote: boolean;
  clientName: string;
  clientPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  validUntilText?: string;
  notas?: string;
  storeName?: string;
}

export type QuoteStyle = 'modern' | 'classic' | 'minimal' | 'technical' | 'automotive' | 'executive_gold' | 'compact_express' | 'ticket';

export interface QuoteStyleOption {
  id: QuoteStyle;
  label: string;
  badge: string;
  description: string;
  icon: string;
  accentColor: string;
}

export const QUOTE_STYLE_OPTIONS: QuoteStyleOption[] = [
  {
    id: 'modern',
    label: 'Moderno Ejecutivo',
    badge: 'Recomendado',
    description: 'Acentos índigo, tipografía contemporánea, tarjetas suaves y totales destacados',
    icon: '🌟',
    accentColor: '#4F46E5'
  },
  {
    id: 'classic',
    label: 'Corporativo Clásico',
    badge: 'Formal',
    description: 'Membrete institucional, bordes dobles, cláusulas legales y casillero de firmas',
    icon: '🏛️',
    accentColor: '#1E293B'
  },
  {
    id: 'automotive',
    label: 'Taller & Mecánica Pro',
    badge: 'Especial Taller',
    description: 'Acentos carmesí/acero, garantía de piezas y mano de obra, casillero de conformidad',
    icon: '🚗',
    accentColor: '#DC2626'
  },
  {
    id: 'executive_gold',
    label: 'Gold VIP / Alta Gama',
    badge: 'Exclusivo',
    description: 'Acentos dorados, datos bancarios (Alias/CBU), condiciones comerciales y membrete premium',
    icon: '👑',
    accentColor: '#B45309'
  },
  {
    id: 'compact_express',
    label: 'Presupuesto Express (A5)',
    badge: 'Ahorro de Tinta',
    description: 'Formato compacto para mostrador rápido, bajo consumo de tinta y despacho ágil',
    icon: '⚡',
    accentColor: '#059669'
  },
  {
    id: 'minimal',
    label: 'Minimalista Nórdico',
    badge: 'Elegante',
    description: 'Líneas ultrafinas, generoso espacio negativo y tipografía sobria de alto contraste',
    icon: '✨',
    accentColor: '#111827'
  },
  {
    id: 'technical',
    label: 'Técnico Industrial',
    badge: 'Taller & Repuestos',
    description: 'Detalle de piezas con referencias técnicas, plazos de garantía y firma técnica',
    icon: '⚙️',
    accentColor: '#0284C7'
  },
  {
    id: 'ticket',
    label: 'Ticket Térmico (80mm)',
    badge: 'Punto de Venta',
    description: 'Formato estrecho optimizado para ticketeras térmicas y mostrador',
    icon: '🧾',
    accentColor: '#374151'
  }
];

/**
 * Generates standalone HTML representation of the receipt for printing.
 * Supports multiple design themes (modern, classic, minimal, technical, ticket).
 */
export function generateReceiptHtml(data: ReceiptData, style: QuoteStyle | 'a4' | 'ticket' = 'modern'): string {
  const store = data.storeName || 'GESTIÓN TOTAL';
  const dateStr = data.date.toLocaleDateString('es-AR');
  const timeStr = data.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const effectiveStyle: QuoteStyle = style === 'a4' ? 'modern' : (style as QuoteStyle);

  // ================= TICKET FORMAT (80MM) =================
  if (effectiveStyle === 'ticket') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm 3mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 72mm;
      margin: 0 auto;
      padding: 6px 2px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .item-desc {
      flex: 1;
      padding-right: 4px;
      word-break: break-word;
    }
    .warning-box {
      border: 1px solid #000;
      padding: 4px;
      font-size: 10px;
      text-align: center;
      margin: 6px 0;
      font-weight: bold;
    }
    @media print {
      body { width: 100%; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">${store.toUpperCase()}</div>
    <div style="font-size: 10px;">Gestión Comercial & Stock</div>
    <div class="divider"></div>
    <div style="font-size: 13px; font-weight: bold;">${data.title.toUpperCase()}</div>
    <div>N°: <strong>${data.docNumber}</strong></div>
    <div>Fecha: ${dateStr} ${timeStr}</div>
    ${data.isQuote && data.validUntilText ? `<div style="font-size: 11px;">Válido hasta: ${data.validUntilText}</div>` : ''}
  </div>

  <div class="divider"></div>
  <div><strong>Cliente:</strong> ${data.clientName}</div>
  ${data.clientPhone ? `<div><strong>Tel:</strong> ${data.clientPhone}</div>` : ''}
  <div><strong>Tipo:</strong> ${data.isQuote ? 'Cotización Comercial' : 'Comprobante de Entrega'}</div>

  <div class="double-divider"></div>
  <div class="item-row font-bold" style="font-size: 11px;">
    <span style="width: 25px;">Cant</span>
    <span class="item-desc">Artículo</span>
    <span style="width: 60px; text-align: right;">Total</span>
  </div>
  <div class="divider"></div>

  ${data.items.map(item => `
    <div class="item-row" style="margin-bottom: 4px;">
      <span style="width: 25px; font-weight: bold;">${item.cantidad}x</span>
      <span class="item-desc">
        ${item.productNombre}
        ${item.variantNombre ? `<br><small style="font-size: 9px;">[${item.variantNombre}]</small>` : ''}
        <br><small style="font-size: 10px; color: #444;">$${item.precio.toLocaleString('es-AR')} c/u</small>
      </span>
      <span style="width: 60px; text-align: right; font-weight: bold;">
        $${item.total.toLocaleString('es-AR')}
      </span>
    </div>
  `).join('')}

  <div class="double-divider"></div>

  ${data.discount > 0 ? `
    <div class="item-row">
      <span>Subtotal:</span>
      <span>$${data.subtotal.toLocaleString('es-AR')}</span>
    </div>
    <div class="item-row">
      <span>Descuento:</span>
      <span>-$${data.discount.toLocaleString('es-AR')}</span>
    </div>
  ` : ''}

  <div class="item-row font-bold" style="font-size: 15px; margin-top: 4px;">
    <span>TOTAL:</span>
    <span>$${data.total.toLocaleString('es-AR')}</span>
  </div>

  ${data.notas ? `
    <div class="divider"></div>
    <div style="font-size: 10px;">
      <strong>Notas:</strong> ${data.notas}
    </div>
  ` : ''}

  <div class="warning-box">
    DOCUMENTO NO VÁLIDO COMO FACTURA<br>
    <span style="font-weight: normal; font-size: 9px;">Uso interno comercial e informativo</span>
  </div>

  <div class="text-center" style="font-size: 10px; margin-top: 6px;">
    ¡Muchas gracias por su preferencia!
  </div>
</body>
</html>`;
  }

  // ================= CLASSIC CORPORATE TEMPLATE =================
  if (effectiveStyle === 'classic') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 13px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      padding: 15px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header-box {
      border-bottom: 3px double #111;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .company-sub { font-size: 11px; color: #444; font-style: italic; }
    .doc-meta { text-align: right; }
    .doc-meta h2 { font-size: 18px; text-transform: uppercase; font-weight: bold; }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #333;
    }
    .info-table td {
      padding: 6px 10px;
      border: 1px solid #ccc;
      font-size: 12px;
    }
    .info-header { background: #f2f2f2; font-weight: bold; width: 25%; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table th {
      background: #e8e8e8;
      border-top: 2px solid #111;
      border-bottom: 2px solid #111;
      padding: 8px 6px;
      font-size: 11px;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
    }
    .items-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #ddd;
    }
    .totals-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .total-box {
      border: 2px solid #111;
      padding: 8px 16px;
      text-align: right;
      min-width: 220px;
    }
    .total-val { font-size: 20px; font-weight: bold; }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
    }
    .signature-line {
      border-top: 1px solid #111;
      padding-top: 6px;
      font-weight: bold;
    }
    .legal-notice {
      border: 1px solid #666;
      padding: 6px;
      font-size: 10px;
      text-align: center;
      margin-top: 20px;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="company-title">${store}</div>
      <div class="company-sub">Comercio, Servicios & Reparaciones Generales</div>
      <div style="font-size: 11px; margin-top: 4px;">Atención personalizada &bull; Tel: +54 9 11 6025-5767</div>
    </div>
    <div class="doc-meta">
      <h2>${data.title}</h2>
      <div><strong>N° de Control:</strong> ${data.docNumber}</div>
      <div><strong>Fecha de Emisión:</strong> ${dateStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="color: #854d0e; font-weight: bold;">Validez: ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <table class="info-table">
    <tr>
      <td class="info-header">Señor(es) / Cliente:</td>
      <td><strong>${data.clientName}</strong></td>
      <td class="info-header">Condición Comercial:</td>
      <td>${data.isQuote ? 'Presupuesto Estimado' : 'Operación de Venta Directa'}</td>
    </tr>
    <tr>
      <td class="info-header">Teléfono de Contacto:</td>
      <td>${data.clientPhone || 'No informado'}</td>
      <td class="info-header">Plazo de Validez:</td>
      <td>${data.isQuote ? (data.validUntilText ? `Hasta ${data.validUntilText}` : '10 días corridos') : 'Entrega Inmediata'}</td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40px; text-align: center;">Ítem</th>
        <th style="width: 50px; text-align: center;">Cant.</th>
        <th style="text-align: left;">Descripción Detallada</th>
        <th style="width: 110px; text-align: right;">Precio Unitario</th>
        <th style="width: 120px; text-align: right;">Importe Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, idx) => `
        <tr>
          <td style="text-align: center; font-family: Arial, sans-serif; font-size: 11px;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold;">${item.cantidad}</td>
          <td>
            <strong>${item.productNombre}</strong>
            ${item.variantNombre ? `<br><span style="font-size: 11px; color: #555;">Variante: ${item.variantNombre}</span>` : ''}
          </td>
          <td style="text-align: right;">$${item.precio.toLocaleString('es-AR')}</td>
          <td style="text-align: right; font-weight: bold;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-area">
    <div style="font-size: 11px; max-width: 400px;">
      ${data.notas ? `<div><strong>Observaciones:</strong> <em>${data.notas}</em></div>` : ''}
      <div style="margin-top: 6px; color: #444;">
        * Los precios cotizados no constituyen reserva de mercadería hasta su efectiva confirmación.
      </div>
    </div>
    <div class="total-box">
      ${data.discount > 0 ? `
        <div style="font-size: 12px; margin-bottom: 2px;">Subtotal: $${data.subtotal.toLocaleString('es-AR')}</div>
        <div style="font-size: 12px; color: #166534; margin-bottom: 4px;">Descuento: -$${data.discount.toLocaleString('es-AR')}</div>
      ` : ''}
      <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">Importe Total:</div>
      <div class="total-val">$${data.total.toLocaleString('es-AR')}</div>
    </div>
  </div>

  <div class="signature-grid">
    <div>
      <div class="signature-line">Firma y Sello Comercial Autorizado</div>
      <div>${store}</div>
    </div>
    <div>
      <div class="signature-line">Conforme y Aceptación de Cotización</div>
      <div>Firma del Cliente o Representante</div>
    </div>
  </div>

  <div class="legal-notice">
    DOCUMENTO NO VÁLIDO COMO FACTURA &bull; Comprobante de uso comercial e informativo interno.
  </div>
</body>
</html>`;
  }

  // ================= MINIMALIST NORDIC TEMPLATE =================
  if (effectiveStyle === 'minimal') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #111827;
      background: #fff;
      padding: 10px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-bottom: 28px;
      border-bottom: 1px solid #111827;
      margin-bottom: 30px;
    }
    .brand { font-size: 16px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
    .doc-num { font-size: 13px; font-weight: 400; color: #6b7280; }
    .meta-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 36px;
      font-size: 12px;
    }
    .client-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
    .client-val { font-size: 15px; font-weight: 600; color: #111827; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 36px;
    }
    .items-table th {
      padding: 10px 4px;
      border-bottom: 1px solid #111827;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      color: #6b7280;
    }
    .items-table td {
      padding: 14px 4px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 12px;
    }
    .summary-area {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 16px;
    }
    .total-display {
      font-size: 24px;
      font-weight: 300;
      letter-spacing: -0.5px;
      color: #111827;
    }
    .footer-note {
      margin-top: 60px;
      padding-top: 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">${store}</div>
    <div class="doc-num">${data.title.toUpperCase()} &bull; ${data.docNumber}</div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="client-title">Destinatario</div>
      <div class="client-val">${data.clientName}</div>
      ${data.clientPhone ? `<div style="color: #6b7280; font-size: 11px;">${data.clientPhone}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div class="client-title">Emisión</div>
      <div>${dateStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="color: #b45309; font-size: 11px; margin-top: 2px;">Válido hasta ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40px;">Cant</th>
        <th style="text-align: left;">Descripción</th>
        <th style="text-align: right; width: 120px;">Unitario</th>
        <th style="text-align: right; width: 120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => `
        <tr>
          <td style="color: #6b7280; font-weight: 500;">${item.cantidad}</td>
          <td>
            <div style="font-weight: 500;">${item.productNombre}</div>
            ${item.variantNombre ? `<div style="font-size: 11px; color: #9ca3af;">${item.variantNombre}</div>` : ''}
          </td>
          <td style="text-align: right; color: #6b7280;">$${item.precio.toLocaleString('es-AR')}</td>
          <td style="text-align: right; font-weight: 600;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-area">
    <div style="font-size: 11px; color: #6b7280; max-width: 360px;">
      ${data.notas ? `<div>${data.notas}</div>` : ''}
    </div>
    <div style="text-align: right;">
      ${data.discount > 0 ? `
        <div style="color: #6b7280; font-size: 11px;">Subtotal: $${data.subtotal.toLocaleString('es-AR')}</div>
        <div style="color: #059669; font-size: 11px;">Descuento: -$${data.discount.toLocaleString('es-AR')}</div>
      ` : ''}
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-top: 4px;">Total General</div>
      <div class="total-display">$${data.total.toLocaleString('es-AR')}</div>
    </div>
  </div>

  <div class="footer-note">
    Documento comercial informativo sin valor fiscal &bull; ${store}
  </div>
</body>
</html>`;
  }

  // ================= TECHNICAL WORKSHOP & PARTS TEMPLATE =================
  if (effectiveStyle === 'technical') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Consolas', 'Menlo', 'Monaco', monospace, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #0f172a;
      background: #fff;
      padding: 10px;
      max-width: 800px;
      margin: 0 auto;
    }
    .tech-header {
      border: 2px solid #0284c7;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      background: #f0f9ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tech-badge {
      background: #0284c7;
      color: #fff;
      padding: 3px 8px;
      font-weight: bold;
      font-size: 11px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .tech-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 11px;
    }
    .tech-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      background: #f8fafc;
    }
    .tech-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #0284c7;
      font-size: 11px;
    }
    .tech-table th {
      background: #0284c7;
      color: #fff;
      padding: 7px 6px;
      text-align: left;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .tech-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tech-totals {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .tech-disclaimer {
      border: 1px dashed #64748b;
      padding: 8px;
      font-size: 10px;
      color: #475569;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .tech-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      text-align: center;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="tech-header">
    <div>
      <span class="tech-badge">FICHA TÉCNICA / COTIZACIÓN</span>
      <h1 style="font-size: 16px; font-weight: 900; color: #0369a1; text-transform: uppercase;">${store} &bull; SERVICIO TÉCNICO</h1>
      <p style="font-size: 10px; color: #475569;">Presupuesto de Repuestos, Insumos y Mano de Obra</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 14px; font-weight: bold; color: #0284c7;">${data.docNumber}</div>
      <div style="font-size: 10px;">FECHA: ${dateStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="font-size: 10px; color: #b45309; font-weight: bold;">VALIDEZ: ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <div class="tech-grid">
    <div class="tech-card">
      <div style="font-weight: bold; color: #0369a1; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">
        [01] DATOS DEL CLIENTE / EQUIPO
      </div>
      <div><strong>Cliente:</strong> ${data.clientName}</div>
      ${data.clientPhone ? `<div><strong>Contacto:</strong> ${data.clientPhone}</div>` : ''}
      <div><strong>Condición:</strong> ${data.isQuote ? 'Cotización Preliminar' : 'Entrega Inmediata'}</div>
    </div>
    <div class="tech-card">
      <div style="font-weight: bold; color: #0369a1; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">
        [02] CONDICIONES DE SERVICIO
      </div>
      <div><strong>Tipo:</strong> Materiales, Partes & Repuestos</div>
      <div><strong>Garantía Estándar:</strong> 90 días en piezas nuevas</div>
      <div><strong>Validez Estimada:</strong> ${data.validUntilText || '10 días'}</div>
    </div>
  </div>

  <table class="tech-table">
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th style="width: 50px; text-align: center;">CANT</th>
        <th>DESCRIPCIÓN DE LA PIEZA / COMPONENTE</th>
        <th style="width: 100px; text-align: right;">UNIT. (ARS)</th>
        <th style="width: 110px; text-align: right;">SUBTOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, idx) => `
        <tr>
          <td style="text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold;">${item.cantidad}x</td>
          <td>
            <strong>${item.productNombre}</strong>
            ${item.variantNombre ? `<span style="color: #64748b; font-size: 10px;"> [${item.variantNombre}]</span>` : ''}
          </td>
          <td style="text-align: right;">$${item.precio.toLocaleString('es-AR')}</td>
          <td style="text-align: right; font-weight: bold;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="tech-totals">
    <div style="font-size: 11px; max-width: 420px;">
      ${data.notas ? `<div><strong>NOTAS TÉCNICAS:</strong> ${data.notas}</div>` : ''}
    </div>
    <div style="text-align: right; min-width: 200px;">
      ${data.discount > 0 ? `
        <div style="font-size: 11px;">SUBTOTAL: $${data.subtotal.toLocaleString('es-AR')}</div>
        <div style="font-size: 11px; color: #16a34a;">DESCUENTO: -$${data.discount.toLocaleString('es-AR')}</div>
      ` : ''}
      <div style="font-size: 11px; color: #64748b;">TOTAL ESTIMADO:</div>
      <div style="font-size: 18px; font-weight: bold; color: #0284c7;">$${data.total.toLocaleString('es-AR')}</div>
    </div>
  </div>

  <div class="tech-disclaimer">
    <strong>CONDICIONES TÉCNICAS:</strong> Los valores cotizados contemplan repuestos de primera calidad y mano de obra especializada. El presente documento carece de validez fiscal y se emite como propuesta comercial e informativa.
  </div>

  <div class="tech-signatures">
    <div>
      <div style="border-top: 1px solid #64748b; padding-top: 4px; font-weight: bold;">RESPONSABLE DE TALLER / TÉCNICO</div>
      <div>Control de calidad e inspección</div>
    </div>
    <div>
      <div style="border-top: 1px solid #64748b; padding-top: 4px; font-weight: bold;">CONFORMIDAD DEL CLIENTE</div>
      <div>Firma para aprobación de presupuesto</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ================= AUTOMOTIVE & TALLER MECÁNICO TEMPLATE =================
  if (effectiveStyle === 'automotive') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #1e293b;
      background: #fff;
      padding: 10px;
      max-width: 820px;
      margin: 0 auto;
    }
    .racing-stripe {
      height: 6px;
      background: linear-gradient(90deg, #dc2626 0%, #b91c1c 70%, #1e293b 100%);
      border-radius: 3px;
      margin-bottom: 14px;
    }
    .auto-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 14px;
    }
    .auto-brand h1 {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .auto-brand .badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 3px;
      text-transform: uppercase;
    }
    .auto-meta { text-align: right; }
    .auto-number {
      font-size: 17px;
      font-weight: 900;
      color: #dc2626;
      font-family: monospace;
    }
    .client-vehicle-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .info-card h4 {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .parts-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .parts-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .parts-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .parts-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .total-box {
      margin-left: auto;
      width: 280px;
      background: #f8fafc;
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }
    .grand-total {
      border-top: 2px solid #0f172a;
      padding-top: 6px;
      margin-top: 6px;
      font-size: 16px;
      font-weight: 900;
      color: #dc2626;
    }
    .warranty-banner {
      background: #fff1f2;
      border-left: 4px solid #dc2626;
      padding: 8px 12px;
      font-size: 10.5px;
      color: #881337;
      margin-bottom: 18px;
      border-radius: 0 6px 6px 0;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 20px;
      text-align: center;
      font-size: 10.5px;
      color: #475569;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-weight: 800;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="racing-stripe"></div>
  <div class="auto-header">
    <div class="auto-brand">
      <h1>${store}</h1>
      <span class="badge">⚙️ TALLER MECÁNICO & AUTOPARTES</span>
      <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Servicio Mecánico Integral • Diagnóstico & Repuestos</p>
    </div>
    <div class="auto-meta">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">${data.title}</div>
      <div class="auto-number">${data.docNumber}</div>
      <div style="font-size: 11px; color: #64748b;">Fecha: ${dateStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="font-size: 11px; font-weight: bold; color: #dc2626;">Validez: ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <div class="client-vehicle-grid">
    <div class="info-card">
      <h4>Datos del Cliente</h4>
      <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${data.clientName}</div>
      ${data.clientPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Teléfono: <strong>${data.clientPhone}</strong></div>` : ''}
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Tipo: ${data.isQuote ? 'Presupuesto de Taller' : 'Comprobante de Entrega'}</div>
    </div>
    <div class="info-card">
      <h4>Términos de Servicio</h4>
      <div style="font-size: 11px; color: #334155;"><strong>Plazo de Entrega:</strong> A coordinar con el cliente</div>
      <div style="font-size: 11px; color: #334155;"><strong>Condición:</strong> Contado / Transferencia</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Doc. no válido como factura fiscal</div>
    </div>
  </div>

  <table class="parts-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 60px; text-align: center;">Cant</th>
        <th>Descripción de Repuesto / Servicio</th>
        <th style="width: 100px; text-align: right;">Unitario</th>
        <th style="width: 110px; text-align: right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, idx) => `
        <tr>
          <td style="text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
          <td style="text-align: center; font-weight: 800;">${item.cantidad}</td>
          <td>
            <strong>${item.productNombre}</strong>
            ${item.variantNombre ? `<span style="font-size: 11px; color: #64748b;"> [${item.variantNombre}]</span>` : ''}
          </td>
          <td style="text-align: right;">$${item.precio.toLocaleString('es-AR')}</td>
          <td style="text-align: right; font-weight: 800;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div style="max-width: 460px;">
      ${data.notas ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 11px;">
          <strong>Notas del Taller:</strong> <em>${data.notas}</em>
        </div>
      ` : ''}
      <div class="warranty-banner">
        <strong>🛡️ GARANTÍA DE TALLER:</strong> Todos los repuestos y trabajos cuentan con garantía de funcionamiento por 90 días corridos presentando este comprobante.
      </div>
    </div>

    <div class="total-box">
      ${data.discount > 0 ? `
        <div class="total-row"><span>Subtotal:</span><span>$${data.subtotal.toLocaleString('es-AR')}</span></div>
        <div class="total-row" style="color: #16a34a; font-weight: bold;"><span>Descuento:</span><span>-$${data.discount.toLocaleString('es-AR')}</span></div>
      ` : ''}
      <div class="total-row grand-total">
        <span>TOTAL PRESUPUESTO:</span>
        <span>$${data.total.toLocaleString('es-AR')}</span>
      </div>
    </div>
  </div>

  <div class="signatures">
    <div>
      <div class="sign-line">TALLER & ASESOR TÉCNICO</div>
      <div>Responsable de Diagnóstico y Presupuesto</div>
    </div>
    <div>
      <div class="sign-line">CONFORMIDAD DEL CLIENTE</div>
      <div>Firma y Aclaración de Aprobación</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ================= EXECUTIVE GOLD / ALTA GAMA TEMPLATE =================
  if (effectiveStyle === 'executive_gold') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1e293b;
      background: #fff;
      padding: 10px;
      max-width: 820px;
      margin: 0 auto;
    }
    .gold-frame {
      border: 1px solid #e2e8f0;
      border-top: 4px solid #b45309;
      border-radius: 12px;
      padding: 18px 22px;
    }
    .header-gold {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 16px;
    }
    .brand-gold h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .brand-gold .tagline {
      font-size: 11px;
      color: #b45309;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .meta-gold { text-align: right; }
    .doc-pill {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .grid-gold {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }
    .card-gold {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .card-gold h5 {
      font-size: 10px;
      font-weight: 800;
      color: #78716c;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .table-gold {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .table-gold th {
      background: #fef3c7;
      color: #78350f;
      padding: 9px 10px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #fde68a;
    }
    .table-gold td {
      padding: 9px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    .bank-box {
      background: #fdfbf7;
      border: 1px dashed #d97706;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
      color: #78350f;
    }
    .totals-gold {
      width: 270px;
      margin-left: auto;
      background: #fef3c7;
      border-radius: 10px;
      padding: 14px;
      color: #78350f;
    }
    .totals-gold .main-total {
      font-size: 18px;
      font-weight: 900;
      color: #78350f;
      border-top: 1px solid #fde68a;
      padding-top: 8px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="gold-frame">
    <div class="header-gold">
      <div class="brand-gold">
        <h1>${store}</h1>
        <div class="tagline">💎 Propuesta Comercial & Servicios Premium</div>
        <p style="font-size: 11px; color: #64748b; margin-top: 3px;">Atención Exclusiva • Tel: +54 9 11 6025-5767</p>
      </div>
      <div class="meta-gold">
        <div class="doc-pill">${data.title}</div>
        <div style="font-size: 15px; font-weight: 900; color: #0f172a; font-family: monospace;">N° ${data.docNumber}</div>
        <div style="font-size: 11px; color: #64748b;">Emisión: ${dateStr}</div>
        ${data.isQuote && data.validUntilText ? `<div style="font-size: 11px; font-weight: bold; color: #b45309;">Válido hasta: ${data.validUntilText}</div>` : ''}
      </div>
    </div>

    <div class="grid-gold">
      <div class="card-gold">
        <h5>Cliente / Destinatario</h5>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${data.clientName}</div>
        ${data.clientPhone ? `<div style="font-size: 11px; color: #44403c; margin-top: 3px;">Contacto: <strong>${data.clientPhone}</strong></div>` : ''}
        <div style="font-size: 11px; color: #78716c; margin-top: 3px;">Tipo: ${data.isQuote ? 'Cotización Presupuestaria' : 'Comprobante de Operación'}</div>
      </div>
      <div class="card-gold">
        <h5>Condiciones Comerciales</h5>
        <div style="font-size: 11px; color: #44403c;"><strong>Forma de Pago:</strong> Transferencia / Tarjeta / Efectivo</div>
        <div style="font-size: 11px; color: #44403c;"><strong>Entrega:</strong> Inmediata según stock</div>
        <div style="font-size: 10px; color: #a8a29e; margin-top: 3px;">Documento informativo sin valor fiscal</div>
      </div>
    </div>

    <table class="table-gold">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">Ítem</th>
          <th style="width: 60px; text-align: center;">Cant.</th>
          <th>Detalle de Productos / Servicios</th>
          <th style="width: 100px; text-align: right;">Unitario</th>
          <th style="width: 110px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, idx) => `
          <tr>
            <td style="text-align: center; color: #a8a29e; font-weight: bold;">${idx + 1}</td>
            <td style="text-align: center; font-weight: 800; color: #0f172a;">${item.cantidad}</td>
            <td>
              <strong>${item.productNombre}</strong>
              ${item.variantNombre ? `<span style="font-size: 11px; color: #78716c;"> [${item.variantNombre}]</span>` : ''}
            </td>
            <td style="text-align: right;">$${item.precio.toLocaleString('es-AR')}</td>
            <td style="text-align: right; font-weight: 800; color: #0f172a;">$${item.total.toLocaleString('es-AR')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
      <div style="max-width: 460px;">
        <div class="bank-box">
          <strong>🏦 DATOS BANCARIOS PARA TRANSFERENCIA:</strong><br>
          <span>Banco Santander / Galicia • Alias: <strong>TALLER.GREGORUTTI</strong></span><br>
          <span style="font-size: 10px; color: #92400e;">Enviar comprobante por WhatsApp para acreditar el pago inmediatamente.</span>
        </div>
        ${data.notas ? `
          <div style="font-size: 11px; color: #57534e; margin-top: 8px;">
            <strong>Observaciones:</strong> <em>${data.notas}</em>
          </div>
        ` : ''}
      </div>

      <div class="totals-gold">
        ${data.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span>Subtotal:</span><span>$${data.subtotal.toLocaleString('es-AR')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #15803d; font-weight: bold; margin-bottom: 4px;">
            <span>Bonificación:</span><span>-$${data.discount.toLocaleString('es-AR')}</span>
          </div>
        ` : ''}
        <div class="main-total">
          <span>TOTAL:</span>
          <span>$${data.total.toLocaleString('es-AR')}</span>
        </div>
      </div>
    </div>

    <div style="text-align: center; font-size: 10.5px; color: #a8a29e; border-top: 1px solid #f1f5f9; padding-top: 12px;">
      Documento emitido para fines informativos y de gestión comercial. ¡Agradecemos su confianza!
    </div>
  </div>
</body>
</html>`;
  }

  // ================= COMPACT EXPRESS (A5 / HALF-SHEET) TEMPLATE =================
  if (effectiveStyle === 'compact_express') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page { size: A5 landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #0f172a;
      background: #fff;
      padding: 6px;
      max-width: 780px;
      margin: 0 auto;
    }
    .express-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #059669;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .express-title {
      font-size: 16px;
      font-weight: 900;
      color: #059669;
      text-transform: uppercase;
    }
    .express-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .express-table th {
      background: #f0fdf4;
      color: #166534;
      padding: 5px 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      border-bottom: 1px solid #bbf7d0;
    }
    .express-table td {
      padding: 5px 6px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
    }
    .express-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
    }
  </style>
</head>
<body>
  <div class="express-header">
    <div>
      <span class="express-title">${store}</span>
      <span style="font-size: 10px; color: #64748b; margin-left: 8px;">⚡ PRESUPUESTO EXPRESS</span>
    </div>
    <div style="text-align: right; font-size: 11px;">
      <strong>N° ${data.docNumber}</strong> • ${dateStr}
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; padding: 4px 6px; background: #f8fafc; border-radius: 4px;">
    <div><strong>Cliente:</strong> ${data.clientName} ${data.clientPhone ? `(${data.clientPhone})` : ''}</div>
    <div>${data.isQuote && data.validUntilText ? `<strong>Válido:</strong> ${data.validUntilText}` : 'Entrega Inmediata'}</div>
  </div>

  <table class="express-table">
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th style="width: 45px; text-align: center;">Cant</th>
        <th>Artículo</th>
        <th style="width: 80px; text-align: right;">Unitario</th>
        <th style="width: 90px; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, idx) => `
        <tr>
          <td style="text-align: center; color: #94a3b8;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold;">${item.cantidad}</td>
          <td><strong>${item.productNombre}</strong>${item.variantNombre ? ` [${item.variantNombre}]` : ''}</td>
          <td style="text-align: right;">$${item.precio.toLocaleString('es-AR')}</td>
          <td style="text-align: right; font-weight: bold;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="express-footer">
    <div style="font-size: 9.5px; color: #64748b;">
      DOCUMENTO NO VÁLIDO COMO FACTURA • Emisión rápida de mostrador
      ${data.notas ? `<div><em>Nota: ${data.notas}</em></div>` : ''}
    </div>
    <div style="text-align: right;">
      ${data.discount > 0 ? `<span style="font-size: 10px; color: #16a34a; margin-right: 8px;">Desc: -$${data.discount.toLocaleString('es-AR')}</span>` : ''}
      <span style="font-size: 14px; font-weight: 900; color: #059669;">TOTAL: $${data.total.toLocaleString('es-AR')}</span>
    </div>
  </div>
</body>
</html>`;
  }

  // ================= MODERN EXECUTIVE TEMPLATE (DEFAULT) =================
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${data.title} - ${data.docNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111827;
      background: #ffffff;
      padding: 10px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .store-title {
      font-size: 20px;
      font-weight: 900;
      color: #111827;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .store-subtitle {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    .doc-info {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #f3f4f6;
      color: #1f2937;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .doc-number {
      font-size: 15px;
      font-weight: 900;
      color: #4f46e5;
    }
    .doc-date {
      font-size: 11px;
      color: #6b7280;
    }
    .alert-banner {
      margin: 14px 0;
      padding: 8px 12px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 8px;
      font-size: 10px;
      color: #92400e;
    }
    .alert-banner strong {
      display: block;
      font-size: 10.5px;
      letter-spacing: 0.5px;
    }
    .client-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 12px 14px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .client-label {
      font-size: 10px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .client-val {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }
    .table-container {
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    thead th {
      padding: 8px 6px;
      background: #f3f4f6;
      color: #4b5563;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb;
    }
    tbody td {
      padding: 9px 6px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 11.5px;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .qty-col {
      width: 45px;
      text-align: center;
      font-weight: 700;
    }
    .price-col {
      width: 110px;
      text-align: right;
      color: #4b5563;
    }
    .total-col {
      width: 120px;
      text-align: right;
      font-weight: 800;
      color: #111827;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-top: 14px;
      border-top: 2px solid #e5e7eb;
    }
    .notes-box {
      max-width: 380px;
      font-size: 11px;
      color: #4b5563;
    }
    .totals-box {
      width: 240px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .totals-row.final {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      font-weight: 900;
      color: #111827;
    }
    .final-amount {
      color: #4f46e5;
      font-size: 16px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #f3f4f6;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="store-title">${store}</div>
      <div class="store-subtitle">Gestión Comercial &bull; Inventario &bull; Servicio</div>
    </div>
    <div class="doc-info">
      <span class="doc-badge">${data.title}</span>
      <div class="doc-number">N° ${data.docNumber}</div>
      <div class="doc-date">Fecha: ${dateStr} ${timeStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="font-size: 10.5px; font-weight: bold; color: #b45309; margin-top: 2px;">Válido hasta: ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <div class="alert-banner">
    <strong>DOCUMENTO NO VÁLIDO COMO FACTURA</strong>
    ${data.isQuote 
      ? 'Presupuesto comercial informativo con precios estimados y sujetos a disponibilidad de stock.' 
      : 'Constancia comercial interna de entrega de mercadería y control de ventas.'}
  </div>

  <div class="client-card">
    <div>
      <div class="client-label">Datos del Cliente</div>
      <div class="client-val">${data.clientName}</div>
      ${data.clientPhone ? `<div style="font-size: 11px; color: #4b5563; margin-top: 2px;">Tel: ${data.clientPhone}</div>` : ''}
    </div>
    <div>
      <div class="client-label">Condición / Operación</div>
      <div class="client-val">${data.isQuote ? 'Cotización Preliminar' : 'Venta Registrada'}</div>
      <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
        ${data.isQuote ? 'Sujeta a confirmación del cliente' : 'Entrega Inmediata'}
      </div>
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="qty-col">Cant</th>
          <th>Descripción del Artículo</th>
          <th>Variante / Talle</th>
          <th class="price-col">Precio Unit.</th>
          <th class="total-col">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td class="qty-col">${item.cantidad}</td>
            <td><strong>${item.productNombre}</strong></td>
            <td style="color: #6b7280;">${item.variantNombre || '-'}</td>
            <td class="price-col">$${item.precio.toLocaleString('es-AR')}</td>
            <td class="total-col">$${item.total.toLocaleString('es-AR')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="summary-section">
    <div class="notes-box">
      ${data.notas ? `
        <div style="margin-bottom: 6px;">
          <strong style="color: #111827; font-size: 10px; text-transform: uppercase;">Notas:</strong>
          <p style="font-style: italic; margin-top: 2px;">${data.notas}</p>
        </div>
      ` : ''}
      <p style="font-size: 10px; color: #9ca3af;">* Los precios reflejados en este comprobante corresponden a moneda de curso legal (ARS).</p>
    </div>

    <div class="totals-box">
      ${data.discount > 0 ? `
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${data.subtotal.toLocaleString('es-AR')}</span>
        </div>
        <div class="totals-row" style="color: #059669; font-weight: 600;">
          <span>Descuento:</span>
          <span>-$${data.discount.toLocaleString('es-AR')}</span>
        </div>
      ` : ''}
      <div class="totals-row final">
        <span>TOTAL:</span>
        <span class="final-amount">$${data.total.toLocaleString('es-AR')}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <p><strong>DOCUMENTO NO VÁLIDO COMO FACTURA</strong> &bull; Constancia comercial emitida para fines administrativos y de control interno.</p>
  </div>
</body>
</html>`;
}

/**
 * Robust print function: Creates an isolated hidden iframe containing ONLY
 * the receipt HTML and triggers native print. This completely bypasses modal
 * containers, dark theme, overflow clipping, and page scroll limits.
 */
export function printReceipt(data: ReceiptData, style: QuoteStyle | 'a4' | 'ticket' = 'modern'): Promise<void> {
  return new Promise((resolve) => {
    try {
      const html = generateReceiptHtml(data, style);

      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', `${data.title} - ${data.docNumber}`);
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const cleanup = () => {
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          } catch (_) {}
        }, 2500);
        resolve();
      };

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        // Fallback: try printing current window
        window.print();
        cleanup();
        return;
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      let hasPrinted = false;
      const doPrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print():', err);
          window.print();
        }
        cleanup();
      };

      // Delay to ensure document styling and layout are rendered
      setTimeout(doPrint, 350);
    } catch (error) {
      console.error('Error in printReceipt:', error);
      window.print();
      resolve();
    }
  });
}

/**
 * Generates and downloads a clean, branded PDF file using jsPDF and autoTable.
 * Supports style customization (modern, classic, minimal, technical).
 */
export function downloadReceiptPdf(data: ReceiptData, style: QuoteStyle = 'modern'): void {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let primaryColor = [79, 70, 229]; // Modern Indigo #4F46E5
    if (style === 'classic') primaryColor = [30, 41, 59]; // Slate 800
    if (style === 'minimal') primaryColor = [17, 24, 39]; // Charcoal
    if (style === 'technical') primaryColor = [2, 132, 199]; // Sky 600
    if (style === 'automotive') primaryColor = [220, 38, 38]; // Crimson Red 600
    if (style === 'executive_gold') primaryColor = [180, 83, 9]; // Gold Amber 700
    if (style === 'compact_express') primaryColor = [5, 150, 105]; // Emerald Green 600

    const darkTextColor = [17, 24, 39]; // Gray 900
    const lightGray = [243, 244, 246]; // Gray 100
    const mutedText = [107, 114, 128]; // Gray 500

    // 1. Header: Store Name & Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(data.storeName || 'GESTIÓN TOTAL', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    
    let subheaderText = 'Gestión Comercial, Inventario & Ventas';
    if (style === 'technical') subheaderText = 'Servicio Técnico & Repuestos Oficiales';
    if (style === 'automotive') subheaderText = 'Taller Mecánico Especializado & Autopartes';
    if (style === 'executive_gold') subheaderText = 'Propuesta Comercial & Servicios de Alta Gama';
    if (style === 'compact_express') subheaderText = 'Comprobante Express de Mostrador';
    
    doc.text(subheaderText, 14, 23);
    doc.text('Comprobante de uso comercial e informativo interno', 14, 27);

    // Right side: Document Type & Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(data.title.toUpperCase(), 196, 18, { align: 'right' });

    doc.setFontSize(10.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`N°: ${data.docNumber}`, 196, 23, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(`Fecha: ${data.date.toLocaleDateString('es-AR')}`, 196, 28, { align: 'right' });

    if (data.isQuote && data.validUntilText) {
      doc.setTextColor(180, 83, 9); // Amber
      doc.text(`Validez: hasta ${data.validUntilText}`, 196, 33, { align: 'right' });
    }

    // Divider line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(14, 37, 196, 37);

    // 2. Non-Fiscal Notice Box
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(251, 191, 36); // Amber 400
    doc.roundedRect(14, 41, 182, 11, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', 18, 45.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(
      data.isQuote 
        ? 'Presupuesto comercial informativo con valores estimados sujetos a confirmación y stock.' 
        : 'Constancia comercial interna de entrega de mercadería y control de ventas sin validez fiscal.',
      18,
      49.5
    );

    // 3. Client & Details Box
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(14, 55, 182, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('DATOS DEL CLIENTE', 18, 60);
    doc.text('CONDICIÓN / TIPO', 115, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(data.clientName || 'Consumidor Final', 18, 65.5);

    const conditionText = data.isQuote ? 'Cotización Preliminar' : 'Venta Registrada / Entrega Inmediata';
    doc.text(conditionText, 115, 65.5);

    if (data.clientPhone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text(`Tel: ${data.clientPhone}`, 18, 69.5);
    }

    // 4. AutoTable with Items
    const tableRows = data.items.map((item, index) => [
      (index + 1).toString(),
      item.cantidad.toString(),
      item.productNombre + (item.variantNombre ? ` [${item.variantNombre}]` : ''),
      `$${item.precio.toLocaleString('es-AR')}`,
      `$${item.total.toLocaleString('es-AR')}`
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['#', 'Cant', 'Descripción del Artículo', 'Precio Unit.', 'Subtotal']],
      body: tableRows,
      theme: style === 'classic' ? 'grid' : 'striped',
      headStyles: {
        fillColor: primaryColor as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        cellPadding: 2.2
      },
      styles: {
        fontSize: 8,
        textColor: [31, 41, 55],
        cellPadding: 2.2,
        lineColor: [229, 231, 235],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 15 },
        2: { cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' }
      }
    });

    // 5. Totals section
    const finalY = (doc as any).lastAutoTable?.finalY || 110;
    const totalsBoxX = 122;
    const totalsBoxW = 74;
    let currentY = finalY + 5;

    if (data.discount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text('Subtotal:', totalsBoxX, currentY);
      doc.text(`$${data.subtotal.toLocaleString('es-AR')}`, 196, currentY, { align: 'right' });
      currentY += 4.5;

      doc.setTextColor(5, 150, 105); // Emerald
      doc.text('Descuento:', totalsBoxX, currentY);
      doc.text(`-$${data.discount.toLocaleString('es-AR')} ${data.discount > 0 ? '' : ''}`, 196, currentY, { align: 'right' });
      currentY += 4.5;
    }

    // Total Box
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(totalsBoxX - 2, currentY, totalsBoxW, 10, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text('TOTAL:', totalsBoxX + 2, currentY + 6.5);

    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`$${data.total.toLocaleString('es-AR')}`, 194, currentY + 7, { align: 'right' });

    // Notes if available (left side)
    if (data.notas) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text('OBSERVACIONES / NOTAS:', 14, finalY + 6);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
      const splitNotes = doc.splitTextToSize(data.notas, 95);
      doc.text(splitNotes, 14, finalY + 10);
    }

    // Classic & Technical Signatures block
    if (style === 'classic' || style === 'technical') {
      const sigY = Math.max(currentY + 25, 235);
      doc.setDrawColor(156, 163, 175);
      doc.setLineWidth(0.3);
      doc.line(20, sigY, 90, sigY);
      doc.line(120, sigY, 190, sigY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
      doc.text(style === 'technical' ? 'RESPONSABLE TÉCNICO' : 'FIRMA AUTORIZADA', 55, sigY + 4, { align: 'center' });
      doc.text(style === 'technical' ? 'CONFORMIDAD CLIENTE' : 'CONFORME CLIENTE', 155, sigY + 4, { align: 'center' });
    }

    // Bottom footer watermark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA - USO COMERCIAL INTERNO', 105, 287, { align: 'center' });

    const safeFilename = `${data.isQuote ? 'Cotizacion' : 'Comprobante'}_${style}_${data.docNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    doc.save(safeFilename);
  } catch (error) {
    console.error('Error downloading receipt PDF:', error);
    throw error;
  }
}
