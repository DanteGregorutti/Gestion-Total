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


