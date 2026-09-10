/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Warehouses from './pages/Warehouses';
import Settings from './pages/Settings';
import Catalog from './pages/Catalog';
import Finances from './pages/Finances';
import Login from './pages/Login';
import StockUpdate from './pages/StockUpdate';
import PublicCatalog from './pages/PublicCatalog';
import WorkOrders from './pages/WorkOrders';
import WorkOrderTracking from './pages/WorkOrderTracking';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ProductsProvider } from './contexts/ProductsContext';
import { cn } from './utils/cn';

function AppContent() {
  const { user, loading, logout } = useAuth();
  const { theme } = useSettings();

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === 'dark' ? "bg-black" : "bg-white"
      )}>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-indigo-600 font-bold tracking-widest uppercase text-xs">Cargando Gestión Total...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/catalogo-online" element={<PublicCatalog />} />
        <Route path="/stock-update/:productId" element={<StockUpdate />} />
        <Route path="/seguimiento/:orderId" element={<WorkOrderTracking />} />
        <Route path="/seguimiento" element={<WorkOrderTracking />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout user={{ email: user.email!, displayName: user.displayName! }} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/taller" element={<WorkOrders />} />
        <Route path="/ordenes" element={<WorkOrders />} />
        <Route path="/inventario" element={<Inventory />} />
        <Route path="/ventas" element={<Sales />} />
        <Route path="/compras" element={<Purchases />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/proveedores" element={<Suppliers />} />
        <Route path="/almacenes" element={<Warehouses />} />
        <Route path="/cuentas" element={<Finances />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/catalogo-online" element={<PublicCatalog />} />
        <Route path="/configuracion" element={<Settings />} />
        <Route path="/stock-update/:productId" element={<StockUpdate />} />
        <Route path="/seguimiento/:orderId" element={<WorkOrderTracking />} />
        <Route path="/seguimiento" element={<WorkOrderTracking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <ProductsProvider>
            <AppContent />
          </ProductsProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}
