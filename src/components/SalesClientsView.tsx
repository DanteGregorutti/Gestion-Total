/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  ShoppingBag, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  Plus, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  X,
  Sparkles,
  TrendingUp,
  Tag,
  Receipt,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Client, Sale } from '../types';
import { Button, Input } from './ui';
import Modal from './Modal';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import { inventoryService } from '../services/inventoryService';

interface SalesClientsViewProps {
  clients: Client[];
  sales: Sale[];
  onSelectClientForSale: (client: Client) => void;
  onRefresh: () => void;
}

interface ClientPurchasesSummary {
  client: Client;
  totalSalesCount: number;
  totalSpent: number;
  totalUnits: number;
  lastPurchaseDate: Date | null;
  topProducts: { name: string; quantity: number; total: number }[];
  salesList: Sale[];
}

export function SalesClientsView({
  clients,
  sales,
  onSelectClientForSale,
  onRefresh
}: SalesClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_purchases' | 'frequent' | 'no_purchases'>('all');
  const [sortBy, setSortBy] = useState<'purchases' | 'amount' | 'recent' | 'name'>('purchases');
  const [selectedClientDetail, setSelectedClientDetail] = useState<ClientPurchasesSummary | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Helper to parse dates
  const parseDate = (val: any): Date | null => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // General Metrics: Registered clients vs anonymous/final consumer sales
  const generalMetrics = useMemo(() => {
    const anonymousSales = sales.filter(s => !s.clientId || s.clientNombre === 'Consumidor Final');
    const identifiedSales = sales.filter(s => s.clientId && s.clientNombre !== 'Consumidor Final');
    
    const anonymousTotal = anonymousSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const identifiedTotal = identifiedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    return {
      totalSalesCount: sales.length,
      anonymousSalesCount: anonymousSales.length,
      anonymousTotal,
      identifiedSalesCount: identifiedSales.length,
      identifiedTotal,
      totalClientsCount: clients.length
    };
  }, [sales, clients]);

  // Summarize purchases per client
  const clientsSummaryList = useMemo(() => {
    return clients.map(client => {
      // Find all sales corresponding to this client
      const clientSales = sales.filter(s => {
        if (s.clientId && s.clientId === client.id) return true;
        // Fallback matching by name if clientId was omitted but name matches exactly
        if (!s.clientId && s.clientNombre && s.clientNombre.trim().toLowerCase() === client.nombre.trim().toLowerCase()) {
          return true;
        }
        return false;
      });

      // Sort sales by date descending
      clientSales.sort((a, b) => {
        const da = parseDate(a.fecha)?.getTime() || 0;
        const db = parseDate(b.fecha)?.getTime() || 0;
        return db - da;
      });

      let totalSpent = 0;
      let totalUnits = 0;
      const productsMap = new Map<string, { name: string; quantity: number; total: number }>();

      clientSales.forEach(s => {
        totalSpent += Number(s.total) || 0;
        
        if (s.isCombo && s.comboItems?.length) {
          s.comboItems.forEach(ci => {
            totalUnits += ci.cantidad || 1;
            const existing = productsMap.get(ci.productId) || { name: ci.productNombre || 'Producto', quantity: 0, total: 0 };
            existing.quantity += ci.cantidad || 1;
            productsMap.set(ci.productId, existing);
          });
        } else {
          const qty = Number(s.cantidad) || 1;
          totalUnits += qty;
          const key = s.productId || s.productNombre;
          const existing = productsMap.get(key) || { name: s.productNombre || 'Producto', quantity: 0, total: 0 };
          existing.quantity += qty;
          existing.total += Number(s.total) || 0;
          productsMap.set(key, existing);
        }
      });

      const topProducts = Array.from(productsMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const lastPurchaseDate = clientSales.length > 0 ? parseDate(clientSales[0].fecha) : null;

      return {
        client,
        totalSalesCount: clientSales.length,
        totalSpent,
        totalUnits,
        lastPurchaseDate,
        topProducts,
        salesList: clientSales
      } as ClientPurchasesSummary;
    });
  }, [clients, sales]);

  // Filter and Sort clients
  const filteredClients = useMemo(() => {
    let list = clientsSummaryList.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = 
        !q ||
        item.client.nombre.toLowerCase().includes(q) ||
        (item.client.telefono && item.client.telefono.toLowerCase().includes(q)) ||
        (item.client.email && item.client.email.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filterMode === 'with_purchases') return item.totalSalesCount > 0;
      if (filterMode === 'frequent') return item.totalSalesCount >= 3;
      if (filterMode === 'no_purchases') return item.totalSalesCount === 0;

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'purchases') return b.totalSalesCount - a.totalSalesCount;
      if (sortBy === 'amount') return b.totalSpent - a.totalSpent;
      if (sortBy === 'recent') {
        const timeA = a.lastPurchaseDate?.getTime() || 0;
        const timeB = b.lastPurchaseDate?.getTime() || 0;
        return timeB - timeA;
      }
      if (sortBy === 'name') return a.client.nombre.localeCompare(b.client.nombre);
      return 0;
    });

    return list;
  }, [clientsSummaryList, searchTerm, filterMode, sortBy]);

  // Clients with at least 1 purchase
  const activeClientsCount = useMemo(() => {
    return clientsSummaryList.filter(c => c.totalSalesCount > 0).length;
  }, [clientsSummaryList]);

  // Quick Client Creation handler
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error('Ingresá al menos el nombre del cliente');
      return;
    }
    setIsSubmittingClient(true);
    try {
      await inventoryService.addClient({
        nombre: newClientName.trim(),
        telefono: newClientPhone.trim() || undefined,
        email: newClientEmail.trim() || undefined,
        direccion: newClientAddress.trim() || undefined
      });
      toast.success('Cliente registrado correctamente');
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setNewClientAddress('');
      setIsAddClientModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Error adding client:', err);
      toast.error('No se pudo guardar el cliente');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Delete Client handler
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    try {
      await inventoryService.deleteClient(clientToDelete.id);
      toast.success(`Cliente "${clientToDelete.nombre}" eliminado correctamente`);
      if (selectedClientDetail?.client.id === clientToDelete.id) {
        setSelectedClientDetail(null);
      }
      setClientToDelete(null);
      onRefresh();
    } catch (err) {
      console.error('Error deleting client:', err);
      toast.error('No se pudo eliminar el cliente');
    } finally {
      setIsDeletingClient(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Header / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Clientes */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clientes en Catálogo</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{clients.length}</h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">
              {activeClientsCount} con compras registradas
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        {/* Metric 2: Facturado a Clientes */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Compras Identificadas</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              ${generalMetrics.identifiedTotal.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {generalMetrics.identifiedSalesCount} ventas con cliente
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Metric 3: Ventas a Consumidor Final (Opcional) */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Público General (Sin Cliente)</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              {generalMetrics.anonymousSalesCount}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ${generalMetrics.anonymousTotal.toLocaleString()} facturado
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* Metric 4: Tranquilidad del usuario */}
        <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/20 dark:to-gray-900 p-5 rounded-3xl border border-indigo-100/80 dark:border-indigo-900/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Uso Flexible</span>
          </div>
          <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 mt-2 leading-relaxed">
            Asignar un cliente a una venta es <strong>100% opcional</strong>. Podés registrar ventas anónimas o asignarlas rápido a tus clientes más usuales.
          </p>
        </div>
      </div>

      {/* Action Bar: Search, Filters & Add Client Button */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-900 dark:text-white"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterMode === 'all'
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Todos ({clients.length})
            </button>
            <button
              onClick={() => setFilterMode('with_purchases')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterMode === 'with_purchases'
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Con Compras ({activeClientsCount})
            </button>
            <button
              onClick={() => setFilterMode('frequent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterMode === 'frequent'
                  ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Frecuentes (3+)
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="purchases">Más compras realizadas</option>
            <option value="amount">Mayor monto gastado ($)</option>
            <option value="recent">Compra más reciente</option>
            <option value="name">Nombre alfabético (A-Z)</option>
          </select>

          {/* Add Client Button */}
          <Button
            onClick={() => setIsAddClientModalOpen(true)}
            className="rounded-xl shadow-sm text-xs font-bold"
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-400">
            <Users size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No se encontraron clientes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
              {searchTerm 
                ? 'No hay ningún cliente que coincida con tu búsqueda.' 
                : 'Aún no registraste clientes o podés crear uno nuevo con el botón de arriba.'}
            </p>
          </div>
          {searchTerm && (
            <Button variant="outline" size="sm" onClick={() => setSearchTerm('')} className="rounded-xl">
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map(({ client, totalSalesCount, totalSpent, totalUnits, lastPurchaseDate, topProducts, salesList }) => {
            const isFrequent = totalSalesCount >= 3;
            const initials = client.nombre
              .split(' ')
              .map(n => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div 
                key={client.id}
                className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
              >
                <div>
                  {/* Card Header: Avatar, Name & Frequent Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 transition-transform group-hover:scale-105",
                        isFrequent 
                          ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      )}>
                        {initials || 'CL'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate text-base" title={client.nombre}>
                          {client.nombre}
                        </h4>
                        {client.telefono && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <Phone size={12} className="shrink-0" />
                            <span className="truncate">{client.telefono}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isFrequent ? (
                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} />
                          Habitual
                        </span>
                      ) : totalSalesCount > 0 ? (
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl text-[10px] font-black uppercase tracking-wider">
                          Cliente
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl text-[10px] font-bold">
                          Sin compras
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClientToDelete(client);
                        }}
                        title={`Eliminar cliente ${client.nombre}`}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Stats Ribbon */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Compras</p>
                      <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                        {totalSalesCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total $</p>
                      <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        ${totalSpent.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Unidades</p>
                      <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                        {totalUnits}
                      </p>
                    </div>
                  </div>

                  {/* Last Purchase Date */}
                  {lastPurchaseDate && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-3 px-1">
                      <Clock size={12} className="text-gray-400" />
                      <span>Última compra: {lastPurchaseDate.toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Top Products Chips */}
                  {topProducts.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">
                        Artículos comprados:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {topProducts.map((tp, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1"
                          >
                            <Tag size={10} className="text-indigo-500" />
                            <span className="max-w-[120px] truncate">{tp.name}</span>
                            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">x{tp.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions: View History & New Sale */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClientDetail({ client, totalSalesCount, totalSpent, totalUnits, lastPurchaseDate, topProducts, salesList })}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 font-bold px-2 rounded-xl"
                  >
                    <Eye size={14} className="mr-1.5" />
                    Historial ({totalSalesCount})
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => onSelectClientForSale(client)}
                    className="text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <Plus size={14} className="mr-1" />
                    Nueva Venta
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Client Purchase History Detail */}
      {selectedClientDetail && (
        <Modal
          isOpen={Boolean(selectedClientDetail)}
          onClose={() => setSelectedClientDetail(null)}
          title={`Historial de ${selectedClientDetail.client.nombre}`}
          className="max-w-2xl"
        >
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base">
                  {selectedClientDetail.client.nombre}
                </h4>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                  {selectedClientDetail.client.telefono && (
                    <span>Tel: {selectedClientDetail.client.telefono}</span>
                  )}
                  {selectedClientDetail.client.email && (
                    <span>Email: {selectedClientDetail.client.email}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-gray-400 uppercase">Total Comprado</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  ${selectedClientDetail.totalSpent.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 font-bold">
                  {selectedClientDetail.totalSalesCount} compras ({selectedClientDetail.totalUnits} unidades)
                </p>
              </div>
            </div>

            {/* List of Sales */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {selectedClientDetail.salesList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Este cliente aún no tiene ventas registradas a su nombre.
                </p>
              ) : (
                selectedClientDetail.salesList.map((sale, i) => {
                  const saleDate = parseDate(sale.fecha);
                  return (
                    <div 
                      key={sale.id || i}
                      className="p-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-indigo-600 shrink-0" />
                          <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {sale.productNombre || (sale.isCombo ? 'Venta Combo' : 'Producto')}
                          </p>
                          {sale.variantNombre && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-bold text-gray-500">
                              {sale.variantNombre}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span>{saleDate ? saleDate.toLocaleString() : 'Fecha no especificada'}</span>
                          <span>•</span>
                          <span>Cantidad: {sale.cantidad} un.</span>
                          {sale.precio > 0 && (
                            <>
                              <span>•</span>
                              <span>P.U.: ${sale.precio}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base font-black text-gray-900 dark:text-white">
                          ${(Number(sale.total) || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedClientDetail(null)}
                  className="rounded-xl text-xs"
                >
                  Cerrar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setClientToDelete(selectedClientDetail.client)}
                  className="rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Eliminar Cliente
                </Button>
              </div>

              <Button
                onClick={() => {
                  const c = selectedClientDetail.client;
                  setSelectedClientDetail(null);
                  onSelectClientForSale(c);
                }}
                className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-sm"
              >
                <Plus size={16} className="mr-1.5" />
                Nueva Venta a este Cliente
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirm Delete Client */}
      <Modal
        isOpen={Boolean(clientToDelete)}
        onClose={() => !isDeletingClient && setClientToDelete(null)}
        title="¿Eliminar cliente?"
        className="max-w-md"
      >
        {clientToDelete && (
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <p className="font-bold text-rose-800 dark:text-rose-200 text-sm">
                  ¿Estás seguro de que deseas eliminar a <span className="underline">{clientToDelete.nombre}</span>?
                </p>
                <p className="text-rose-700/80 dark:text-rose-300/80 leading-relaxed">
                  Esta acción quitará al cliente de tu catálogo. Las ventas anteriores realizadas seguirán registradas en tu historial de caja para mantener intacta tu contabilidad general.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setClientToDelete(null)}
                disabled={isDeletingClient}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDeleteClient}
                disabled={isDeletingClient}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                {isDeletingClient ? 'Eliminando...' : 'Sí, eliminar cliente'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Add New Client Quickly */}
      <Modal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        title="Registrar Nuevo Cliente"
        className="max-w-md"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input 
            label="Nombre y Apellido *"
            placeholder="Ej: Juan Pérez"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            required
            autoFocus
          />

          <Input 
            label="Teléfono / WhatsApp"
            placeholder="Ej: 3434567890"
            value={newClientPhone}
            onChange={(e) => setNewClientPhone(e.target.value)}
          />

          <Input 
            label="Email"
            type="email"
            placeholder="cliente@ejemplo.com"
            value={newClientEmail}
            onChange={(e) => setNewClientEmail(e.target.value)}
          />

          <Input 
            label="Dirección / Localidad"
            placeholder="Ej: San Martín 123"
            value={newClientAddress}
            onChange={(e) => setNewClientAddress(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddClientModalOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingClient || !newClientName.trim()}
              className="rounded-xl font-bold bg-indigo-600 text-white"
            >
              {isSubmittingClient ? 'Guardando...' : 'Guardar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
