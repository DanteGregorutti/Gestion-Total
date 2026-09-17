/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Procedencia = 'Legítimo' | 'Genérico' | 'Importado';
export type Estado = 'Nuevo' | 'Usado';
export type MovimientoTipo = 'entrada' | 'salida' | 'venta' | 'compra' | 'ajuste';

export interface ProductVariant {
  id: string;
  nombre: string;
  cantidad: number;
  precio?: number;
  costo?: number;
  codigo?: string;
}

export interface Product {
  id: string;
  codigo: string;
  procedencia: Procedencia;
  estado: Estado;
  cantidad: number;
  descripcion: string;
  ubicacion: string;
  almacenId: string;
  precio: number;
  costo?: number;
  minStock?: number;
  stockMinimo?: number;
  talle?: string;
  genero?: string;
  imagenUrl?: string;
  variants?: ProductVariant[];
  hasVariants?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMovementAt?: string;
}

export interface Warehouse {
  id: string;
  nombre: string;
  descripcion?: string;
  ubicacion?: string;
  createdBy: string;
  createdAt: string;
}

export interface Movement {
  id: string;
  productId: string;
  productNombre: string;
  tipo: MovimientoTipo;
  cantidad: number;
  fecha: string;
  createdBy: string;
  notas?: string;
  transactionId?: string;
}

export interface Client {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  createdAt: string;
  createdBy: string;
}

export interface Supplier {
  id: string;
  nombre: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  createdAt: string;
  createdBy: string;
}

export interface Sale {
  id: string;
  productId: string;
  productNombre: string;
  variantId?: string;
  variantNombre?: string;
  cantidad: number;
  precio: number;
  total: number;
  clientId?: string;
  clientNombre?: string;
  transactionId?: string;
  fecha: any;
  createdBy: string;
  isCombo?: boolean;
  comboItems?: ComboItem[];
  costo?: number;
}

export interface Purchase {
  id: string;
  productId: string;
  productNombre: string;
  variantId?: string;
  variantNombre?: string;
  cantidad: number;
  costo: number;
  total: number;
  supplierId?: string;
  proveedor: string;
  fecha: any;
  createdBy: string;
  numeroComprobante?: string;
}

export type PurchaseOrderStatus = 'borrador' | 'enviada' | 'parcial' | 'recibida' | 'cancelada';
export type PurchaseOrderPaymentStatus = 'pendiente' | 'parcial' | 'pagado';

export interface PurchaseOrderPayment {
  id: string;
  fecha: string;
  monto: number;
  metodo: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro';
  comprobante?: string;
  notas?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  codigo?: string;
  productNombre: string;
  talle?: string;
  genero?: string;
  cantidad: number;
  costoEstimado: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  numero: string; // e.g. OC-1001
  proveedor: string;
  proveedorTelefono?: string;
  proveedorEmail?: string;
  fechaEmision: string;
  fechaEsperada?: string;
  condicionPago?: string;
  estado: PurchaseOrderStatus;
  estadoPago?: PurchaseOrderPaymentStatus;
  montoPagado?: number;
  saldoPendiente?: number;
  fechaVencimientoPago?: string;
  historialPagos?: PurchaseOrderPayment[];
  items: PurchaseOrderItem[];
  subtotal: number;
  total: number;
  flete?: number;
  notas?: string;
  receivedAt?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'warning' | 'error' | 'success' | 'low_stock' | 'inactivity';
  leido: boolean;
  fecha: string;
  userId: string;
  productId?: string;
}

export interface Goal {
  id: string;
  titulo: string;
  tipo: 'ventas_monto' | 'ventas_unidades';
  objetivo: number;
  actual: number;
  mes: string; // YYYY-MM
  createdBy: string;
}

export interface Combo {
  id: string;
  nombre: string;
  precioTotal: number;
  items: ComboItem[];
  createdBy: string;
  createdAt: string;
}

export interface ComboItem {
  productId: string;
  productNombre: string;
  cantidad: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'employee';
  displayName?: string;
  photoURL?: string;
  createdAt?: any;
}

export type FinanceType = 'ingreso' | 'egreso';

export type FinanceCategory = 
  | 'venta_extra'
  | 'servicio'
  | 'aporte_capital'
  | 'alquiler'
  | 'servicios_luz_agua'
  | 'sueldos_retiros'
  | 'proveedores_mercaderia'
  | 'herramientas_equipos'
  | 'publicidad_marketing'
  | 'transporte_envios'
  | 'impuestos_tasas'
  | 'mantenimiento'
  | 'otro';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export interface FinanceTransaction {
  id: string;
  tipo: FinanceType;
  categoria: FinanceCategory | string;
  concepto: string;
  monto: number;
  metodo: PaymentMethod;
  fecha: string;
  notas?: string;
  createdBy: string;
  createdAt?: string;
}

export interface CashAudit {
  id: string;
  fecha: string;
  totalEfectivo: number;
  totalDigital: number;
  totalContado: number;
  totalEsperado: number;
  diferencia: number;
  desglose: Record<string, number>;
  notas?: string;
  createdBy: string;
  createdAt?: string;
}

export interface QuoteItem {
  productId: string;
  productNombre: string;
  variantId?: string;
  variantNombre?: string;
  codigo?: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface Quote {
  id: string;
  numero: string;
  clientId?: string;
  clientNombre: string;
  clientTelefono?: string;
  clientEmail?: string;
  items: QuoteItem[];
  subtotal: number;
  descuento?: number;
  total: number;
  fecha: any;
  validezDias: number;
  validezFecha?: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  notas?: string;
  condiciones?: string;
  createdBy: string;
  saleId?: string;
}

// Cash Shift Session (Apertura y Cierre de Caja)
export interface CashShift {
  id: string;
  fechaApertura: string;
  fechaCierre?: string;
  montoInicial: number;
  estado: 'abierta' | 'cerrada';
  totalVentasEfectivo?: number;
  totalVentasDigital?: number;
  totalIngresosExtra?: number;
  totalRetirosGastos?: number;
  efectivoEsperado?: number;
  efectivoReal?: number;
  diferencia?: number;
  notas?: string;
  createdBy: string;
}

// Payment for Client or Supplier Accounts
export interface AccountPayment {
  id: string;
  entityId: string; // clientId or supplierId
  entityType: 'client' | 'supplier';
  monto: number;
  metodo: PaymentMethod;
  fecha: string;
  concepto: string;
  notas?: string;
  createdBy: string;
}

// Work Order / Taller Types
export type WorkOrderStatus = 
  | 'ingresado' 
  | 'en_diagnostico' 
  | 'en_reparacion' 
  | 'esperando_repuestos' 
  | 'listo' 
  | 'entregado' 
  | 'cancelado';

export type WorkOrderPriority = 'baja' | 'normal' | 'urgente';

export interface WorkOrderItem {
  id: string;
  productId?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario?: number;
  subtotal: number;
}

export interface WorkOrder {
  id: string;
  numero: string; // OT-0001
  clientId?: string;
  clientNombre: string;
  clientTelefono?: string;
  clientEmail?: string;
  equipo: string; // Ej: Vehículo, Máquina, Motor, Herramienta, etc.
  marcaModelo?: string;
  serieOPatente?: string;
  fallaReportada: string;
  diagnostico?: string;
  trabajoRealizado?: string;
  repuestos: WorkOrderItem[];
  costoManoObra: number;
  costoRepuestos: number;
  total: number;
  anticipo: number;
  saldoPendiente: number;
  estado: WorkOrderStatus;
  prioridad: WorkOrderPriority;
  fechaIngreso: string;
  fechaPrometida?: string;
  fechaEntrega?: string;
  notasInternas?: string;
  createdBy: string;
  saleId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepairQuote {
  id: string;
  numero: string; // Ej: COT-0001
  clientNombre: string;
  clientTelefono?: string;
  clientEmail?: string;
  equipo: string;
  marcaModelo?: string;
  serieOPatente?: string;
  fallaReportada: string;
  diagnosticoPrevio?: string;
  repuestos: WorkOrderItem[];
  costoManoObra: number;
  costoRepuestos: number;
  total: number;
  validezDias: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  workOrderId?: string;
  notas?: string;
  fecha: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}



