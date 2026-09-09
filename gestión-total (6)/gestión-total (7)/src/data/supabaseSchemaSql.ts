/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SUPABASE_SCHEMA_SQL = `-- SCHEMA SUPABASE PARA GESTIÓN TOTAL
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run

-- 1. Tabla de Productos
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  codigo TEXT,
  procedencia TEXT DEFAULT 'Genérico',
  estado TEXT DEFAULT 'Nuevo',
  cantidad NUMERIC DEFAULT 0,
  descripcion TEXT,
  ubicacion TEXT,
  "almacenId" TEXT,
  precio NUMERIC DEFAULT 0,
  costo NUMERIC DEFAULT 0,
  "minStock" NUMERIC DEFAULT 0,
  talle TEXT,
  genero TEXT,
  "imagenUrl" TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  "hasVariants" BOOLEAN DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "lastMovementAt" TIMESTAMPTZ
);

-- 2. Tabla de Almacenes
CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  ubicacion TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Movimientos de Stock
CREATE TABLE IF NOT EXISTS public.movements (
  id TEXT PRIMARY KEY,
  "productId" TEXT,
  "productNombre" TEXT,
  tipo TEXT,
  cantidad NUMERIC DEFAULT 1,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT,
  notas TEXT,
  "transactionId" TEXT
);

-- 4. Tabla de Ventas
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  "productId" TEXT,
  "productNombre" TEXT,
  "variantId" TEXT,
  "variantNombre" TEXT,
  cantidad NUMERIC DEFAULT 1,
  precio NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  "clientId" TEXT,
  "clientNombre" TEXT,
  "transactionId" TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT,
  "isCombo" BOOLEAN DEFAULT false,
  "comboItems" JSONB,
  costo NUMERIC DEFAULT 0
);

-- 5. Tabla de Compras
CREATE TABLE IF NOT EXISTS public.purchases (
  id TEXT PRIMARY KEY,
  "productId" TEXT,
  "productNombre" TEXT,
  "variantId" TEXT,
  "variantNombre" TEXT,
  cantidad NUMERIC DEFAULT 1,
  costo NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  "supplierId" TEXT,
  proveedor TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT
);

-- 6. Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  contacto TEXT,
  email TEXT,
  telefono TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  mensaje TEXT,
  tipo TEXT DEFAULT 'info',
  leido BOOLEAN DEFAULT false,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "userId" TEXT,
  "productId" TEXT
);

-- 9. Tabla de Metas / Objetivos
CREATE TABLE IF NOT EXISTS public.goals (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  tipo TEXT,
  objetivo NUMERIC DEFAULT 0,
  actual NUMERIC DEFAULT 0,
  mes TEXT,
  "createdBy" TEXT
);

-- 10. Tabla de Combos
CREATE TABLE IF NOT EXISTS public.combos (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  "precioTotal" NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Tabla de Finanzas (Ingresos / Egresos)
CREATE TABLE IF NOT EXISTS public.finances (
  id TEXT PRIMARY KEY,
  tipo TEXT,
  categoria TEXT,
  concepto TEXT,
  monto NUMERIC DEFAULT 0,
  metodo TEXT DEFAULT 'efectivo',
  fecha TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabla de Arqueo de Caja
CREATE TABLE IF NOT EXISTS public.cash_audits (
  id TEXT PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "totalEfectivo" NUMERIC DEFAULT 0,
  "totalDigital" NUMERIC DEFAULT 0,
  "totalContado" NUMERIC DEFAULT 0,
  "totalEsperado" NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  desglose JSONB DEFAULT '{}'::jsonb,
  notas TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tabla de Cotizaciones / Presupuestos
CREATE TABLE IF NOT EXISTS public.quotes (
  id TEXT PRIMARY KEY,
  numero TEXT,
  "clientId" TEXT,
  "clientNombre" TEXT,
  "clientTelefono" TEXT,
  "clientEmail" TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  descuento NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  "validezDias" NUMERIC DEFAULT 7,
  "validezFecha" TEXT,
  estado TEXT DEFAULT 'pendiente',
  notas TEXT,
  condiciones TEXT,
  "createdBy" TEXT,
  "saleId" TEXT
);

-- 14. Perfiles de Usuario
CREATE TABLE IF NOT EXISTS public.user_profiles (
  uid TEXT PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'admin',
  "displayName" TEXT,
  "photoURL" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas permisivas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_products" ON public.products;
CREATE POLICY "allow_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_warehouses" ON public.warehouses;
CREATE POLICY "allow_all_warehouses" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_movements" ON public.movements;
CREATE POLICY "allow_all_movements" ON public.movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_sales" ON public.sales;
CREATE POLICY "allow_all_sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_purchases" ON public.purchases;
CREATE POLICY "allow_all_purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_clients" ON public.clients;
CREATE POLICY "allow_all_clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_suppliers" ON public.suppliers;
CREATE POLICY "allow_all_suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_notifications" ON public.notifications;
CREATE POLICY "allow_all_notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_goals" ON public.goals;
CREATE POLICY "allow_all_goals" ON public.goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_combos" ON public.combos;
CREATE POLICY "allow_all_combos" ON public.combos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_finances" ON public.finances;
CREATE POLICY "allow_all_finances" ON public.finances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_cash_audits" ON public.cash_audits;
CREATE POLICY "allow_all_cash_audits" ON public.cash_audits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_quotes" ON public.quotes;
CREATE POLICY "allow_all_quotes" ON public.quotes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_user_profiles" ON public.user_profiles;
CREATE POLICY "allow_all_user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
`;
