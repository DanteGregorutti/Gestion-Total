/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale, Purchase, Movement, Client, Supplier, Warehouse } from '../types';

export const geminiService = {
  askAboutBusiness: async (
    prompt: string, 
    context: { 
      products: Product[], 
      sales: Sale[], 
      purchases: Purchase[], 
      movements: Movement[],
      clients: Client[],
      suppliers: Supplier[],
      warehouses: Warehouse[]
    }
  ) => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (typeof date === 'string') return new Date(date).toLocaleDateString();
      return date.toString();
    };

    const systemInstruction = `
      Eres un asistente experto en gestión de inventarios y analista de negocios estratégico para la aplicación "Gestión Total".
      Tu objetivo es proporcionar análisis profundos, informes financieros y consejos operativos basados en los datos reales del negocio.

      RESUMEN DEL UNIVERSO DE DATOS:
      - Inventario: ${context.products.length} productos registrados.
      - Clientes: ${context.clients.length} registrados.
      - Proveedores: ${context.suppliers.length} registrados.
      - Almacenes: ${context.warehouses.map(w => w.nombre).join(', ') || 'Principal'}.
      - Actividad: ${context.sales.length} ventas, ${context.purchases.length} compras y ${context.movements.length} movimientos de stock registrados.

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
      - Los Clientes compran productos (ver Log de Ventas).
      - Los Proveedores suministran productos (ver Log de Compras).
      - Los Almacenes guardan los productos.

      TAREAS Y RESPONSABILIDADES:
      1. ANALISTA FINANCIERO: Si te preguntan cuánto ganaron, calcula: Sumatoria de (Venta.total - (Venta.costo * Venta.cantidad)).
      2. GESTIÓN DE STOCK: Si el stock total es <= minStock, avisa proactivamente.
      3. RENTABILIDAD: Puedes decir qué producto tiene el mayor margen de ganancia porcentual.
      4. AUDITOR: Puedes ver si hubo discrepancias o ajustes de stock manuales en los movimientos.
      5. ESTRATEGA: Identifica productos que se compran pero no se venden, o viceversa.

      REGLAS DE ORO:
      - Responde SIEMPRE en español.
      - Sé profesional pero cercano.
      - Usa tablas de Markdown para mostrar datos comparativos.
      - No inventes datos. Si no existe un registro, di que no hay datos para esa consulta.
      - Si te preguntan "dime todo", haz un resumen ejecutivo: Ingresos Totales, Costos Totales, Ganancia Neta, y Alertas críticas.
    `;

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemInstruction }),
      });

      const data = await response.json();
      if (data.error) {
        return data.error;
      }
      return data.text;
    } catch (error) {
      console.error("Error calling Gemini API proxy:", error);
      return "Lo siento, hubo un error al procesar tu solicitud con la IA. Por favor, intenta de nuevo más tarde.";
    }
  }
};
