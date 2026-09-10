/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  type: 'major' | 'minor' | 'patch';
  description: string;
  highlights: string[];
}

/**
 * Control central de versiones de Gestión Total / PulseStore.
 * Regla de versionado:
 * - Actualizaciones Mayores (ej: 1.0 -> 2.0): Grandes transformaciones de arquitectura o suites completas nuevas (ej: Taller y Reparaciones).
 * - Actualizaciones Menores (ej: 2.0 -> 2.1): Nuevas herramientas, funcionalidades y módulos complementarios.
 * - Parches / Revisiones (ej: 2.1.1): Optimizaciones, ajustes de diseño o correcciones específicas.
 */
export const APP_VERSION = '2.1.0';
export const APP_VERSION_NAME = 'PulseStore & Taller Pro';
export const APP_VERSION_DATE = 'Septiembre 2026';

export const APP_VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.1.0',
    date: 'Septiembre 2026',
    title: 'Estandarización PulseStore, Presupuestos de Taller y Versiones',
    type: 'minor',
    description: 'Incorporación del panel de versiones del sistema, cotizaciones de reparación modificables y unificación de canales oficiales de WhatsApp.',
    highlights: [
      'Nuevo panel de versión activa e historial de versiones en Configuración',
      'Pestaña dedicada "Cotizar Reparaciones" con cálculo de mano de obra y repuestos',
      'Conversión de cotizaciones de taller en Órdenes de Trabajo activas con 1 clic',
      'Edición completa de cotizaciones existentes en cualquier momento',
      'Estandarización de contacto oficial PulseStore al WhatsApp 11-6025-5767'
    ]
  },
  {
    version: '2.0.0',
    date: 'Septiembre 2026',
    title: 'Actualización Mayor: Módulo Integral de Taller & Reparaciones',
    type: 'major',
    description: 'Salto mayor de arquitectura agregando gestión técnica completa de servicio técnico, portal de clientes y seguimiento en vivo.',
    highlights: [
      'Tablero Kanban interactivo y tabla detallada de Órdenes de Trabajo',
      'Portal web público de Seguimiento en Vivo para clientes (/seguimiento)',
      'Envío del enlace de reparación por WhatsApp con mensaje pre-redactado',
      'Comprobantes e impresión de tickets de recepción y retiro de equipos',
      'Facturación de órdenes con descuento automático de repuestos del stock'
    ]
  },
  {
    version: '1.4.0',
    date: 'Agosto 2026',
    title: 'Catálogo Online Público & Pedidos Directos a WhatsApp',
    type: 'minor',
    description: 'Publicación del catálogo digital web para clientes con carrito de compras y envío directo de pedidos.',
    highlights: [
      'Página pública /catalogo-online con diseño responsive para celulares',
      'Carrito de compras con selector de talles, colores y cantidades',
      'Envío de pedidos armados directo al WhatsApp del negocio',
      'Buscador instantáneo y filtros por categorías de artículos'
    ]
  },
  {
    version: '1.3.0',
    date: 'Agosto 2026',
    title: 'Módulo de Clientes, Cuentas Corrientes y Avisos de Cobro',
    type: 'minor',
    description: 'Control de clientes deudores, saldo a favor y recordatorios automáticos de deuda.',
    highlights: [
      'Fichas de clientes con límite de crédito e historial de compras',
      'Gestión de saldo pendiente y cobros parciales con recibos',
      'Mensaje de recordatorio de cobro enviado a WhatsApp con un toque',
      'Estadísticas de cobranzas y cuentas por cobrar'
    ]
  },
  {
    version: '1.2.0',
    date: 'Julio 2026',
    title: 'Integración Bot de Telegram & Base de Datos Supabase Cloud',
    type: 'minor',
    description: 'Registro de operaciones remotas por mensajería y sincronización en la nube.',
    highlights: [
      'Bot de Telegram (@GestionTotalBot) para registrar ventas y gastos por chat',
      'Conexión y scripts de migración a Supabase PostgreSQL',
      'Comprobantes de ventas y cotizaciones en PDF y tickets térmicos',
      'Sincronización híbrida Firestore / Supabase'
    ]
  },
  {
    version: '1.1.0',
    date: 'Junio 2026',
    title: 'Almacenes Múltiples y Respaldos en la Nube',
    type: 'minor',
    description: 'Control de stock distribuido entre depósitos y respaldos de seguridad.',
    highlights: [
      'Administración de múltiples almacenes y depósitos',
      'Transferencias de mercadería entre sucursales',
      'Copias de seguridad descargables en JSON y respaldos en Cloud'
    ]
  },
  {
    version: '1.0.0',
    date: 'Inicio del Sistema',
    title: 'Lanzamiento Inicial: Núcleo de Gestión Total',
    type: 'major',
    description: 'Fundación del sistema con control de inventario, ventas, compras y finanzas del negocio.',
    highlights: [
      'Inventario con variantes de talle, color, códigos de barras y fotos',
      'Punto de venta y registro de transacciones comerciales',
      'Panel de Finanzas con ingresos, egresos y cálculo de rentabilidad',
      'Dashboard analítico con gráficos interactivos y modo oscuro/claro'
    ]
  }
];
