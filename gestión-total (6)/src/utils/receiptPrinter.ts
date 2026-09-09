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

/**
 * Generates standalone HTML representation of the receipt for printing.
 * Works seamlessly in both A4 sheet format and 80mm thermal ticket format.
 */
export function generateReceiptHtml(data: ReceiptData, format: 'a4' | 'ticket' = 'a4'): string {
  const store = data.storeName || 'GESTIÓN TOTAL';
  const dateStr = data.date.toLocaleDateString('es-AR');
  const timeStr = data.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (format === 'ticket') {
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

  // Default: A4 / Standard Page format
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
    .client-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      font-size: 11px;
    }
    .client-col-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .client-col-name {
      font-size: 13px;
      font-weight: 800;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11.5px;
    }
    th {
      background: #f3f4f6;
      color: #4b5563;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-bottom: 2px solid #e5e7eb;
      text-align: left;
    }
    td {
      padding: 9px 10px;
      border-bottom: 1px solid #f3f4f6;
      color: #1f2937;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-top: 10px;
    }
    .notes-box {
      flex: 1;
      max-width: 400px;
      font-size: 11px;
      color: #4b5563;
    }
    .totals-box {
      width: 240px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 11.5px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      color: #4b5563;
    }
    .totals-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 8px;
      margin-top: 4px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      font-weight: 900;
      color: #111827;
    }
    .totals-amount {
      font-size: 18px;
      font-weight: 900;
      color: #4f46e5;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
      text-align: center;
      font-size: 9.5px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="store-title">${store}</div>
      <div class="store-subtitle">Gestión Comercial, Inventario & Ventas</div>
      <div class="store-subtitle">Atención personalizada y venta minorista/mayorista</div>
    </div>
    <div class="doc-info">
      <div class="doc-badge">${data.title}</div>
      <div class="doc-number">N°: ${data.docNumber}</div>
      <div class="doc-date">Fecha: ${dateStr}</div>
      ${data.isQuote && data.validUntilText ? `<div style="font-size: 10.5px; font-weight: bold; color: #b45309; margin-top: 2px;">⏳ Validez hasta: ${data.validUntilText}</div>` : ''}
    </div>
  </div>

  <div class="alert-banner">
    <strong>DOCUMENTO NO VÁLIDO COMO FACTURA</strong>
    ${data.isQuote 
      ? 'Presupuesto comercial informativo con especificaciones y valores estimados sujetos a disponibilidad.' 
      : 'Constancia comercial interna de entrega de mercadería y control de ventas sin validez fiscal.'}
  </div>

  <div class="client-box">
    <div>
      <div class="client-col-title">Datos del Cliente</div>
      <div class="client-col-name">${data.clientName}</div>
      ${data.clientPhone ? `<div style="color: #4b5563; margin-top: 2px;">Tel: ${data.clientPhone}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div class="client-col-title">Condición / Tipo</div>
      <div class="client-col-name">${data.isQuote ? 'Cotización Preliminar' : 'Venta Registrada'}</div>
      <div style="color: #4b5563; margin-top: 2px;">${data.isQuote ? 'Pendiente de confirmación' : 'Entrega Inmediata'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;" class="text-center">Cant</th>
        <th>Descripción del Artículo</th>
        <th>Variante / Talle</th>
        <th style="width: 100px;" class="text-right">Precio Unit.</th>
        <th style="width: 100px;" class="text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => `
        <tr>
          <td class="text-center" style="font-weight: bold;">${item.cantidad}</td>
          <td style="font-weight: 700; color: #111827;">${item.productNombre}</td>
          <td>${item.variantNombre ? `<span style="display:inline-block; padding: 1px 6px; background:#f3f4f6; border-radius: 4px; font-size: 10px; font-weight: 600;">${item.variantNombre}</span>` : '<span style="color:#9ca3af;">-</span>'}</td>
          <td class="text-right">$${item.precio.toLocaleString('es-AR')}</td>
          <td class="text-right" style="font-weight: 800; color: #111827;">$${item.total.toLocaleString('es-AR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-wrapper">
    <div class="notes-box">
      ${data.notas ? `
        <div style="font-weight: 700; font-size: 10px; text-transform: uppercase; color: #4b5563; margin-bottom: 2px;">Observaciones / Notas:</div>
        <p style="font-style: italic; color: #374151;">${data.notas}</p>
      ` : ''}
      <p style="margin-top: 8px; font-size: 10px; color: #9ca3af;">
        * Los valores expresados están sujetos a variación según disponibilidad de stock.
      </p>
    </div>

    <div class="totals-box">
      ${data.discount > 0 ? `
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${data.subtotal.toLocaleString('es-AR')}</span>
        </div>
        <div class="totals-row" style="color: #059669; font-weight: 700;">
          <span>Descuento:</span>
          <span>-$${data.discount.toLocaleString('es-AR')}</span>
        </div>
      ` : ''}
      <div class="totals-total">
        <span>TOTAL:</span>
        <span class="totals-amount">$${data.total.toLocaleString('es-AR')}</span>
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
export function printReceipt(data: ReceiptData, format: 'a4' | 'ticket' = 'a4'): Promise<void> {
  return new Promise((resolve) => {
    try {
      const html = generateReceiptHtml(data, format);

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
 */
export function downloadReceiptPdf(data: ReceiptData): void {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [79, 70, 229]; // Indigo #4F46E5
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
    doc.text('Gestión Comercial, Inventario & Ventas', 14, 23);
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
      theme: 'grid',
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
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
      doc.text(`-$${data.discount.toLocaleString('es-AR')}`, 196, currentY, { align: 'right' });
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

    // Bottom footer watermark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA - USO COMERCIAL INTERNO', 105, 287, { align: 'center' });

    const safeFilename = `${data.isQuote ? 'Presupuesto' : 'Comprobante'}_${data.docNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    doc.save(safeFilename);
  } catch (error) {
    console.error('Error downloading receipt PDF:', error);
    throw error;
  }
}
