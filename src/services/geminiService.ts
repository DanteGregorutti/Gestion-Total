/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale, Purchase, Movement, Client, Supplier, Warehouse, WorkOrder, RepairQuote } from '../types';

export interface AskAiOptions {
  apiKey?: string;
  model?: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-flash-latest';
  performanceMode?: 'fast' | 'balanced' | 'deep';
  temperature?: number;
  responseStyle?: 'concise' | 'balanced' | 'comprehensive';
  historyDays?: number;
}

export const geminiService = {
  /**
   * Helper to get active Gemini API key from parameters, settings or environment
   */
  getApiKey: (explicitKey?: string): string => {
    if (explicitKey && explicitKey.trim().length > 5) {
      return explicitKey.trim();
    }
    try {
      const local = localStorage.getItem('app_settings');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.geminiApiKey && typeof parsed.geminiApiKey === 'string' && parsed.geminiApiKey.trim()) {
          return parsed.geminiApiKey.trim();
        }
      }
    } catch {}
    
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
    return envKey ? envKey.trim() : '';
  },

  /**
   * Quick connection test to verify API key & measure latency in ms
   */
  testConnection: async (explicitKey?: string, explicitModel?: string): Promise<{
    ok: boolean;
    latencyMs: number;
    source: 'vercel' | 'direct' | 'server';
    model: string;
    message: string;
  }> => {
    const startTime = Date.now();
    const apiKey = geminiService.getApiKey(explicitKey);
    const modelToUse = explicitModel || 'gemini-3.8-flash';

    // 1. Try testing via /api/ai/ask first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(apiKey ? { "x-gemini-key": apiKey } : {})
        },
        body: JSON.stringify({ 
          prompt: "__ping__", 
          apiKey,
          model: modelToUse
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const latency = Date.now() - startTime;
        return {
          ok: true,
          latencyMs: latency,
          source: data.source === 'vercel_serverless' ? 'vercel' : 'server',
          model: modelToUse,
          message: `Conexión exitosa a través del servidor (${latency}ms).`
        };
      }
    } catch (apiErr) {
      console.warn("[geminiService.testConnection] Server endpoint test failed, testing direct client SDK:", apiErr);
    }

    // 2. Direct browser test using @google/genai SDK
    if (!apiKey) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        source: 'direct',
        model: modelToUse,
        message: 'No hay ninguna clave API configurada. Por favor introduce tu GEMINI_API_KEY.'
      };
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: modelToUse,
        contents: "Responde únicamente 'OK'",
        config: {
          temperature: 0.1
        }
      });

      const latency = Date.now() - startTime;
      if (resp.text) {
        return {
          ok: true,
          latencyMs: latency,
          source: 'direct',
          model: modelToUse,
          message: `Conexión directa del navegador exitosa (${latency}ms).`
        };
      }
    } catch (sdkErr: any) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        source: 'direct',
        model: modelToUse,
        message: sdkErr?.message || 'Error al conectar directamente con Google Gemini.'
      };
    }

    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      source: 'direct',
      model: modelToUse,
      message: 'No se pudo establecer conexión con la IA.'
    };
  },

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
    },
    options?: AskAiOptions
  ): Promise<string> => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('es-AR');
      if (typeof date === 'string') return new Date(date).toLocaleDateString('es-AR');
      return date.toString();
    };

    const effectiveApiKey = geminiService.getApiKey(options?.apiKey);
    const effectiveModel = options?.model || 'gemini-3.8-flash';
    const effectiveTemperature = typeof options?.temperature === 'number' ? options?.temperature : 0.3;
    const performanceMode = options?.performanceMode || 'fast';
    const responseStyle = options?.responseStyle || 'balanced';

    // --- SMART HIGH-SIGNAL COMPACT CONTEXT GENERATION ---
    // Avoid sending megabytes of uncompressed history over Vercel serverless!
    const totalInventoryUnits = context.products.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
    const totalInventoryCost = context.products.reduce((acc, p) => acc + ((Number(p.costo) || 0) * (Number(p.cantidad) || 0)), 0);
    const totalInventoryRetail = context.products.reduce((acc, p) => acc + ((Number(p.precio) || 0) * (Number(p.cantidad) || 0)), 0);

    const lowStockItems = context.products.filter(p => (Number(p.cantidad) || 0) <= (Number(p.minStock) || 3));
    
    // Sort products by sales frequency or low stock
    const lowStockPreview = lowStockItems.slice(0, 15).map(p => 
      `- [${p.codigo || 'S/C'}] ${p.descripcion}: Stock actual ${p.cantidad} (Mínimo: ${p.minStock || 3}). Precio: $${p.precio}, Costo: $${p.costo || 0}. Ubic: ${p.ubicacion || 'Principal'}`
    ).join('\n');

    // Workshop Metrics
    const workOrdersList = context.workOrders || [];
    const repairQuotesList = context.repairQuotes || [];
    const activeOrders = workOrdersList.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado');
    const readyOrders = workOrdersList.filter(o => o.estado === 'listo');
    const totalTallerPending = activeOrders.reduce((acc, o) => acc + (Number(o.saldoPendiente) || 0), 0);

    const activeOrdersPreview = activeOrders.slice(0, 15).map(o => 
      `- #${o.numero}: ${o.equipo} (${o.marcaModelo || '-'}) | Cliente: ${o.clientNombre} | Estado: ${o.estado.toUpperCase()} | Falla: ${o.fallaReportada || '-'} | Saldo Pendiente: $${o.saldoPendiente} | Total: $${o.total}`
    ).join('\n');

    // Sales Metrics & Recent Sample (bounded to 25 items max for ultra-low latency)
    const totalSalesRevenue = context.sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const recentSales = context.sales.slice(0, performanceMode === 'deep' ? 35 : 18);
    const recentSalesPreview = recentSales.map(s => 
      `- ${formatDate(s.fecha)}: ${s.productNombre} (x${s.cantidad}) -> $${s.total} [Cliente: ${s.clientNombre || 'Consumidor Final'}]`
    ).join('\n');

    // Top selling products calculation
    const salesCountByProduct: Record<string, { qty: number; total: number; name: string }> = {};
    context.sales.forEach(s => {
      const key = s.productNombre || 'Producto';
      if (!salesCountByProduct[key]) {
        salesCountByProduct[key] = { qty: 0, total: 0, name: key };
      }
      salesCountByProduct[key].qty += (Number(s.cantidad) || 1);
      salesCountByProduct[key].total += (Number(s.total) || 0);
    });

    const topSellers = Object.values(salesCountByProduct)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(t => `- ${t.name}: ${t.qty} unidades vendidas (Recaudación: $${t.total})`)
      .join('\n');

    // Purchases summary
    const totalPurchasesCost = context.purchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const recentPurchases = context.purchases.slice(0, 8).map(p => 
      `- ${formatDate(p.fecha)}: ${p.productNombre} (x${p.cantidad}) de ${p.proveedor} -> Total: $${p.total}`
    ).join('\n');

    const systemInstruction = `
      Eres el Asistente Ejecutivo Inteligente de "Gestión Total" y "PulseStore".
      Brindas respuestas operativas de alta precisión para gestión de inventarios, taller de reparaciones, finanzas y ventas.

      ESTILO DE RESPUESTA REQUERIDO:
      - Tono: Profesional, ejecutivo, ágil y servicial.
      - Idioma: Español.
      ${responseStyle === 'concise' 
        ? '- Sé sumamente breve, directo al grano y conciso, utilizando listas de viñetas cortas.' 
        : responseStyle === 'comprehensive' 
        ? '- Ofrece análisis detallado con tablas comparativas en Markdown y recomendaciones estratégicas.'
        : '- Brinda un equilibrio claro entre resumen numérico y explicaciones prácticas.'}

      RESUMEN FINANCIERO Y OPERATIVO DEL NEGOCIO:
      - Inventario: ${context.products.length} productos registrados (${totalInventoryUnits} unidades en total).
        * Valorización a costo: $${totalInventoryCost.toLocaleString('es-AR')}.
        * Valorización a precio de venta estimado: $${totalInventoryRetail.toLocaleString('es-AR')}.
        * Artículos con stock bajo o agotado: ${lowStockItems.length}.
      - Ventas Totales: ${context.sales.length} operaciones registradas por $${totalSalesRevenue.toLocaleString('es-AR')}.
      - Compras a Proveedores: ${context.purchases.length} operaciones registradas por $${totalPurchasesCost.toLocaleString('es-AR')}.
      - Clientes Registrados: ${context.clients.length}.
      - Proveedores Registrados: ${context.suppliers.length}.
      - Almacenes: ${context.warehouses.map(w => w.nombre).join(', ') || 'Principal'}.
      - Taller Mecánico & Reparaciones:
        * Órdenes totales: ${workOrdersList.length}.
        * Órdenes activas en taller: ${activeOrders.length}.
        * Órdenes listas para entrega al cliente: ${readyOrders.length}.
        * Saldo pendiente de cobro en taller: $${totalTallerPending.toLocaleString('es-AR')}.
        * Cotizaciones de taller pendientes: ${repairQuotesList.filter(q => q.estado === 'pendiente').length}.

      TOP PRODUCTOS MÁS VENDIDOS:
      ${topSellers || 'Sin suficientes datos de ventas aún.'}

      ARTÍCULOS CON STOCK BAJO O CRÍTICO:
      ${lowStockPreview || 'Todos los productos cuentan con stock adecuado por encima del mínimo.'}

      ÓRDENES ACTIVAS EN TALLER:
      ${activeOrdersPreview || 'No hay órdenes activas pendientes en este momento.'}

      ÚLTIMAS VENTAS REGISTRADAS:
      ${recentSalesPreview || 'No hay ventas recientes.'}

      ÚLTIMAS COMPRAS REGISTRADAS:
      ${recentPurchases || 'No hay compras registradas.'}

      REGLAS DE AUDITORÍA:
      - Usa datos exactos de los resúmenes anteriores.
      - Si te preguntan por un repuesto o producto específico que no esté en la lista reducida, indícalo amablemente sugiriendo verificar el buscador de Inventario.
      - Si preguntan sobre salud del negocio, sintetiza margen bruto, saldos por cobrar de taller y alertas de reposición.
    `;

    // Direct Browser Client Fallback routine using modern @google/genai SDK
    const runDirectBrowserAi = async (): Promise<string | null> => {
      if (!effectiveApiKey) return null;

      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

        const modelsToTry = [
          effectiveModel,
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite'
        ];

        for (const m of Array.from(new Set(modelsToTry))) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: prompt,
              config: {
                systemInstruction,
                temperature: effectiveTemperature
              }
            });
            if (resp.text) return resp.text;
          } catch (mErr: any) {
            console.warn(`[Client Direct AI] Model ${m} failed:`, mErr?.message || mErr);
          }
        }
      } catch (sdkInitErr) {
        console.error("[Client Direct AI] SDK Init Error:", sdkInitErr);
      }
      return null;
    };

    // 1. Attempt Vercel Serverless / Express proxy first with tight 14s timeout
    try {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 14000);

      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(effectiveApiKey ? { "x-gemini-key": effectiveApiKey } : {})
        },
        body: JSON.stringify({ 
          prompt, 
          systemInstruction,
          apiKey: effectiveApiKey,
          model: effectiveModel,
          temperature: effectiveTemperature
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok && data.text) {
          return data.text;
        }
        if (data.error) {
          console.warn("[Vercel /api/ai/ask] Server error:", data.error);
          // Try direct fallback
          const directText = await runDirectBrowserAi();
          if (directText) return directText;
          return data.error;
        }
      } else {
        // Non-JSON response (e.g. 504 Gateway Timeout or HTML error from Vercel)
        console.warn("[Vercel /api/ai/ask] Non-JSON response received, switching to direct client AI fallback");
        const directText = await runDirectBrowserAi();
        if (directText) return directText;
      }
    } catch (networkOrTimeoutErr: any) {
      console.warn("[Vercel /api/ai/ask] Request timed out or failed:", networkOrTimeoutErr?.message);
      // Seamlessly execute client-side direct fallback
      const directText = await runDirectBrowserAi();
      if (directText) return directText;
    }

    // If both failed, provide crystal clear resolution steps
    if (!effectiveApiKey) {
      return "⚠️ **Asistente IA no configurado**: Para utilizar la Inteligencia Artificial en Vercel, por favor abre **Configuración -> Inteligencia Artificial** en la aplicación y pega tu clave API de Google AI Studio (GEMINI_API_KEY). ¡Es 100% gratuita y toma 30 segundos activarla!";
    }

    return "⚠️ **Tiempo de espera agotado o error de conexión**: La solicitud de IA no pudo completarse. Por favor verifica tu clave API en **Configuración -> Inteligencia Artificial** y utiliza el botón «Probar Conexión» para comprobar el estado.";
  }
};
