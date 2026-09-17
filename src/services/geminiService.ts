/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale, Purchase, Movement, Client, Supplier, Warehouse, WorkOrder, RepairQuote } from '../types';

export const geminiService = {
  askAboutBusiness: async (
    prompt: string, 
    context: { 
      products: Product[]; 
      sales: Sale[]; 
      purchases: Purchase[]; 
      movements: Movement[];
      clients: Client[];
      suppliers: Supplier[];
      warehouses: Warehouse[];
      workOrders?: WorkOrder[];
      repairQuotes?: RepairQuote[];
    }
  ) => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (typeof date === 'string') return new Date(date).toLocaleDateString();
      return date.toString();
    };

    const workOrdersList = context.workOrders || [];
    const repairQuotesList = context.repairQuotes || [];
    const activeOrders = workOrdersList.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado');
    const readyOrders = workOrdersList.filter(o => o.estado === 'listo');
    const totalTallerPending = activeOrders.reduce((acc, o) => acc + (o.saldoPendiente || 0), 0);

    const systemInstruction = `
      Eres un asistente experto en gestión de inventarios, taller mecánico de reparaciones y analista de negocios estratégico para la aplicación "Gestión Total" y "PulseStore".
      Tu objetivo es proporcionar análisis profundos, informes financieros, estado del taller y consejos operativos basados en los datos reales del negocio.

      RESUMEN DEL UNIVERSO DE DATOS:
      - Inventario: ${context.products.length} productos registrados.
      - Clientes: ${context.clients.length} registrados.
      - Proveedores: ${context.suppliers.length} registrados.
      - Almacenes: ${context.warehouses.map(w => w.nombre).join(', ') || 'Principal'}.
      - Actividad Comercial: ${context.sales.length} ventas, ${context.purchases.length} compras y ${context.movements.length} movimientos de stock registrados.
      - Taller & Reparaciones: ${workOrdersList.length} órdenes en total (${activeOrders.length} activas, ${readyOrders.length} listas para retirar), ${repairQuotesList.length} cotizaciones de reparación, saldo pendiente por cobrar en taller: $${totalTallerPending.toLocaleString('es-AR')}.

      --- TALLER & ÓRDENES DE TRABAJO ACTIVAS ---
      ${activeOrders.map(o => `- [${o.numero}] ${o.equipo} (${o.marcaModelo || '-'}) - Cliente: ${o.clientNombre} (Tel: ${o.clientTelefono || '-'}). Estado: ${o.estado.toUpperCase()}. Falla: "${o.fallaReportada || '-'}". Total: $${o.total}, Saldo Pendiente: $${o.saldoPendiente}. Prioridad: ${o.prioridad}.`).join('\n')}

      --- COTIZACIONES DE TALLER PENDIENTES ---
      ${repairQuotesList.filter(q => q.estado === 'pendiente').map(q => `- [${q.numero}] ${q.equipo} - Cliente: ${q.clientNombre}. Total Presupuestado: $${q.total}. Estado: Pendiente de aprobación.`).join('\n')}

      --- LISTA COMPLETA DE PRODUCTOS ---
      ${context.products.map(p => {
        const warehouse = context.warehouses.find(w => w.id === p.almacenId)?.nombre || 'Principal';
        return `- [${p.codigo}] ${p.descripcion} (ID: ${p.id}): Precio: $${p.precio}, Costo: $${p.costo || 0}, Stock: ${p.cantidad} ${p.cantidad <= (p.minStock || 3) ? '⚠️ BAJO STOCK' : ''}. Ubicación: ${p.ubicacion}, Almacén: ${warehouse}, Talle/Género: ${p.talle || '-'}/${p.genero || '-'}.`;
      }).join('\n')}

      --- LOG HISTÓRICO DE VENTAS ---
      ${context.sales.map(s => `- ${formatDate(s.fecha)}: ${s.productNombre} (x${s.cantidad}) a ${s.clientNombre || 'Consumidor Final'}. Unit: $${s.precio}, Total: $${s.total}. Costo unitario al vender: $${s.costo || 0}.`).join('\n')}

      --- LOG HISTÓRICO DE COMPRAS ---
      ${context.purchases.map(p => `- ${formatDate(p.fecha)}: ${p.productNombre} (x${p.cantidad}) de ${p.proveedor}. Unit: $${p.costo}, Total: $${p.total}.`).join('\n')}
      
      --- LOG DE MOVIMIENTOS RECIENTES ---
      ${context.movements.map(m => `- ${formatDate(m.fecha)}: ${m.tipo.toUpperCase()} de ${m.productNombre} (${m.cantidad} unidades). Notas: ${m.notas || '-'}`).join('\n')}

      --- RELACIONES ---
      - Los Clientes compran productos y traen equipos al Taller.
      - En el Taller se reparan equipos, se utilizan repuestos del inventario y se cobran saldos.
      - Los Proveedores suministran productos y repuestos.
      - Los Almacenes guardan los productos.

      TAREAS Y RESPONSABILIDADES:
      1. ESTADO DEL TALLER: Si te preguntan por reparaciones u órdenes, detalla cuántas están en diagnóstico, en taller, listas para retirar o si faltan repuestos.
      2. ANALISTA FINANCIERO: Si te preguntan cuánto ganaron o saldos pendientes, calcula ventas netas y suma saldos deudores de clientes y taller.
      3. GESTIÓN DE STOCK: Si el stock total es <= minStock, avisa proactivamente.
      4. RENTABILIDAD: Puedes decir qué producto tiene el mayor margen de ganancia porcentual.
      5. AUDITOR: Puedes ver si hubo discrepancias o ajustes de stock manuales en los movimientos.

      REGLAS DE ORO:
      - Responde SIEMPRE en español con tono servicial, claro y profesional.
      - Usa tablas o listas de Markdown con viñetas para mostrar datos comparativos.
      - No inventes datos. Si no existe un registro, indícalo transparentemente.
      - Si te preguntan "dime todo" o "resumen general", incluye inventario, finanzas y estado del taller.
    `;

    const tryClientFallback = async (): Promise<string | null> => {
      const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!clientApiKey) return null;

      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: clientApiKey });
        const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const model of models) {
          try {
            const resp = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                systemInstruction: systemInstruction || "Eres un asistente experto para Gestión Total y PulseStore.",
              }
            });
            if (resp.text) return resp.text;
          } catch (mErr) {
            console.warn(`[Client AI fallback] Model ${model} failed:`, mErr);
          }
        }
      } catch (err) {
        console.error('[Client AI fallback] Error:', err);
      }
      return null;
    };

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemInstruction }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const textPreview = await response.text();
        console.error("Non-JSON response from /api/ai/ask:", textPreview.slice(0, 200));
        
        // Attempt client fallback if available
        const fallbackAnswer = await tryClientFallback();
        if (fallbackAnswer) return fallbackAnswer;

        return "No se pudo conectar con el endpoint de IA (/api/ai/ask). Si estás en Vercel, asegúrate de haber subido la carpeta `/api` en tu repositorio y haber agregado la variable `GEMINI_API_KEY` en tu panel de Vercel (Settings -> Environment Variables) y realizado un Redeploy.";
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        const fallbackAnswer = await tryClientFallback();
        if (fallbackAnswer) return fallbackAnswer;

        return data.error || `Error del servidor (${response.status}): Por favor intenta de nuevo.`;
      }
      return data.text;
    } catch (error: any) {
      console.error("Error calling Gemini API proxy:", error);

      const fallbackAnswer = await tryClientFallback();
      if (fallbackAnswer) return fallbackAnswer;

      return `Hubo un error de conexión al consultar el asistente IA (${error?.message || 'Error de red'}). Por favor, verifica la configuración de la variable GEMINI_API_KEY en tu panel de Vercel y tu conexión.`;
    }
  }
};
