/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  History,
  Trash2,
  Edit2,
  Loader2,
  TrendingUp,
  Clock,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  ShoppingBag,
  ArrowUpRight,
  Share2,
  Sparkles,
  Filter,
  FileText,
  Send,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Sale, PaymentMethod, AccountPayment } from '../types';
import { inventoryService } from '../services/inventoryService';
import { cashShiftService } from '../services/cashShiftService';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

type ClientTab = 'directorio' | 'cuentas_corrientes' | 'historial_ventas' | 'catalogo_online';
type ClientFilter = 'all' | 'deudores' | 'frecuentes' | 'con_compras' | 'sin_compras';
type ClientSort = 'deuda' | 'gastado' | 'compras' | 'reciente' | 'nombre';

export default function Clients() {
  const { t, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();

  // Core data
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [accountPayments, setAccountPayments] = useState<AccountPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<ClientTab>('directorio');

  // Directory filters & search
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<ClientFilter>('all');
  const [sortBy, setSortBy] = useState<ClientSort>('nombre');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewingDetailClient, setViewingDetailClient] = useState<Client | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'compras' | 'pagos'>('compras');

  // Payment / Collection modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<{ id: string; name: string; balance: number; phone?: string } | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [payConcept, setPayConcept] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [recordInFinances, setRecordInFinances] = useState<boolean>(true);

  // Share Catalog modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTargetClient, setShareTargetClient] = useState<Client | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form data for add / edit
  const [formData, setFormData] = useState<Omit<Client, 'id' | 'createdAt' | 'createdBy'>>({
    nombre: '',
    email: '',
    telefono: '',
    direccion: ''
  });

  // Load all required data
  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, salesData] = await Promise.all([
        inventoryService.getClients(),
        inventoryService.getSales()
      ]);
      setClients(clientsData);
      setSales(salesData);
      setAccountPayments(cashShiftService.getAccountPayments());
    } catch (error) {
      console.error('Error loading clients data:', error);
      toast.error('Error al cargar la información de clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats per client
  const clientsWithStats = useMemo(() => {
    return clients.map(client => {
      const clientSales = sales.filter(s => s.clientId === client.id);
      const totalSpent = clientSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalUnits = clientSales.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);

      // Payments made by this client
      const clientPayments = accountPayments.filter(p => p.entityId === client.id && p.entityType === 'client');
      const totalPaid = clientPayments.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

      // Balance: positive means client owes money
      const balance = Math.round((totalSpent - totalPaid) * 100) / 100;

      // Last purchase date
      const sortedSales = [...clientSales].sort((a, b) => {
        const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return dateB.getTime() - dateA.getTime();
      });

      const lastPurchaseDate = sortedSales[0] 
        ? (sortedSales[0].fecha?.toDate ? sortedSales[0].fecha.toDate() : new Date(sortedSales[0].fecha))
        : null;

      return {
        ...client,
        totalSpent,
        totalUnits,
        totalPaid,
        balance,
        salesCount: clientSales.length,
        lastPurchaseDate,
        sales: sortedSales,
        payments: clientPayments
      };
    });
  }, [clients, sales, accountPayments]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalClients = clients.length;
    const totalSpentAll = clientsWithStats.reduce((acc, c) => acc + c.totalSpent, 0);
    const debtors = clientsWithStats.filter(c => c.balance > 0);
    const totalReceivable = debtors.reduce((acc, c) => acc + c.balance, 0);
    const frequentClients = clientsWithStats.filter(c => c.salesCount >= 2);

    return {
      totalClients,
      totalSpentAll,
      debtorsCount: debtors.length,
      totalReceivable,
      frequentCount: frequentClients.length
    };
  }, [clientsWithStats, clients.length]);

  // Filtered & Sorted Clients
  const filteredAndSortedClients = useMemo(() => {
    return clientsWithStats
      .filter(c => {
        // Search filter
        const term = search.toLowerCase();
        const matchesSearch = 
          c.nombre.toLowerCase().includes(term) ||
          (c.telefono && c.telefono.includes(term)) ||
          (c.email && c.email.toLowerCase().includes(term)) ||
          (c.direccion && c.direccion.toLowerCase().includes(term));

        if (!matchesSearch) return false;

        // Mode filter
        if (filterMode === 'deudores') return c.balance > 0;
        if (filterMode === 'frecuentes') return c.salesCount >= 2;
        if (filterMode === 'con_compras') return c.salesCount > 0;
        if (filterMode === 'sin_compras') return c.salesCount === 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deuda') return b.balance - a.balance;
        if (sortBy === 'gastado') return b.totalSpent - a.totalSpent;
        if (sortBy === 'compras') return b.salesCount - a.salesCount;
        if (sortBy === 'reciente') {
          const timeA = a.lastPurchaseDate ? a.lastPurchaseDate.getTime() : 0;
          const timeB = b.lastPurchaseDate ? b.lastPurchaseDate.getTime() : 0;
          return timeB - timeA;
        }
        return a.nombre.localeCompare(b.nombre);
      });
  }, [clientsWithStats, search, filterMode, sortBy]);

  // Submit Add / Edit Client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }

    try {
      if (selectedClient) {
        await inventoryService.updateClient(selectedClient.id, formData);
        toast.success('Cliente actualizado correctamente');
      } else {
        await inventoryService.addClient(formData);
        toast.success('Cliente creado con éxito');
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el cliente');
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', email: '', telefono: '', direccion: '' });
    setSelectedClient(null);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      nombre: client.nombre,
      email: client.email || '',
      telefono: client.telefono || '',
      direccion: client.direccion || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (selectedClient) {
      try {
        await inventoryService.deleteClient(selectedClient.id);
        toast.success('Cliente eliminado correctamente');
        setIsDeleteModalOpen(false);
        if (viewingDetailClient?.id === selectedClient.id) {
          setViewingDetailClient(null);
        }
        setSelectedClient(null);
        loadData();
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar el cliente');
      }
    }
  };

  // Open Payment / Collection Modal
  const openPaymentModal = (client: { id: string; name: string; balance: number; phone?: string }) => {
    setPaymentClient(client);
    setPayAmount(Math.max(0, client.balance).toString());
    setPayConcept(`Cobro de cuenta corriente - ${client.name}`);
    setPayNotes('');
    setPayMethod('efectivo');
    setIsPaymentModalOpen(true);
  };

  // Process Collection / Payment
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentClient) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }

    try {
      // 1. Record payment in cashShiftService
      cashShiftService.addAccountPayment({
        entityId: paymentClient.id,
        entityType: 'client',
        monto: amount,
        metodo: payMethod,
        fecha: new Date().toISOString().split('T')[0],
        concepto: payConcept || `Cobro cuenta corriente - ${paymentClient.name}`,
        notas: payNotes,
        createdBy: 'admin'
      });

      // 2. Optionally record in finances
      if (recordInFinances) {
        await inventoryService.addFinanceTransaction({
          tipo: 'ingreso',
          categoria: 'venta_extra',
          concepto: payConcept || `Cobro Cta Corriente: ${paymentClient.name}`,
          monto: amount,
          metodo: payMethod,
          fecha: new Date().toISOString().split('T')[0],
          notas: `Cobro asentado a ${paymentClient.name}. ${payNotes}`
        });
      }

      toast.success(`¡Cobro de $${amount.toLocaleString()} registrado con éxito!`);
      setIsPaymentModalOpen(false);
      setPaymentClient(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar el cobro');
    }
  };

  // WhatsApp Helpers
  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[^\d]/g, '');
  };

  const sendWhatsAppMessage = (phone?: string, message?: string) => {
    const cleaned = cleanPhone(phone);
    if (!cleaned) {
      toast.error('El cliente no tiene un teléfono válido registrado');
      return;
    }
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message || 'Hola!')}`;
    window.open(url, '_blank');
  };

  const sendDebtReminder = (client: { nombre: string; telefono?: string; balance: number }) => {
    const text = `¡Hola ${client.nombre}! Te escribimos para recordarte que cuentas con un saldo pendiente de $${client.balance.toLocaleString()} en tu cuenta. Por favor avísanos si deseas los datos para transferencia o cómo prefieres coordinarlo. ¡Muchas gracias!`;
    sendWhatsAppMessage(client.telefono, text);
  };

  const catalogUrl = `${window.location.origin}/catalogo-online`;

  const sendCatalogLink = (client?: Client) => {
    const text = client 
      ? `¡Hola ${client.nombre}! Te compartimos nuestro catálogo online con todas las novedades y productos disponibles: ${catalogUrl} \n\nPodés elegir lo que te guste y enviarnos tu pedido directamente por acá. ¡Cualquier duda estamos a tu disposición!`
      : `¡Hola! Te compartimos nuestro catálogo online con productos actualizados: ${catalogUrl}`;
    
    if (client?.telefono) {
      sendWhatsAppMessage(client.telefono, text);
    } else {
      navigator.clipboard.writeText(catalogUrl);
      toast.success('¡Enlace del Catálogo Online copiado al portapapeles!');
    }
  };

  if (settingsLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-bold tracking-wide">Cargando Zona de Clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-sm">
              <Users size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Zona de Clientes
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                Base de datos, cuentas corrientes, cobros, historial y catálogo online en un solo lugar
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setIsShareModalOpen(true)}
            variant="outline"
            className="rounded-xl border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 font-bold hover:bg-emerald-100 transition-all text-xs sm:text-sm"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            <span>Compartir Catálogo Online</span>
          </Button>

          <Button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-95 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Nuevo Cliente</span>
          </Button>
        </div>
      </div>

      {/* Hero KPIs Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Clients */}
        <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 dark:text-gray-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Clientes</span>
            <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              {kpis.totalClients}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {kpis.frequentCount} con 2 o más compras
            </div>
          </div>
        </div>

        {/* Cuentas por Cobrar (Deuda) */}
        <div 
          onClick={() => setActiveTab('cuentas_corrientes')}
          className={`cursor-pointer p-4 sm:p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:scale-[1.01] ${
            kpis.totalReceivable > 0 
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60' 
              : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Por Cobrar (Saldos)</span>
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-200">
              ${kpis.totalReceivable.toLocaleString()}
            </div>
            <div className="text-xs text-amber-700/80 dark:text-amber-400/80 font-bold mt-0.5 flex items-center gap-1">
              <span>{kpis.debtorsCount} clientes con saldo pendiente</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>

        {/* Total Facturado */}
        <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 dark:text-gray-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Ventas Identificadas</span>
            <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              ${kpis.totalSpentAll.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
              Compras registradas a clientes
            </div>
          </div>
        </div>

        {/* Catálogo Online Shortcut */}
        <div 
          onClick={() => setActiveTab('catalogo_online')}
          className="cursor-pointer bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 p-4 sm:p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800/40 shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Catálogo Clientes</span>
            <ExternalLink size={18} />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-1">
              Web & WhatsApp
            </div>
            <div className="text-xs text-indigo-700/80 dark:text-indigo-300/80 font-bold mt-0.5">
              Tus clientes compran directo
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('directorio')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'directorio'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Users size={16} />
          <span>Directorio ({clients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cuentas_corrientes')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cuentas_corrientes'
              ? 'bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <CreditCard size={16} />
          <span>Cuentas Corrientes & Cobros</span>
          {kpis.debtorsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
              {kpis.debtorsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('historial_ventas')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'historial_ventas'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <ShoppingBag size={16} />
          <span>Historial de Compras</span>
        </button>

        <button
          onClick={() => setActiveTab('catalogo_online')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'catalogo_online'
              ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Share2 size={16} />
          <span>Catálogo Online & Difusión</span>
        </button>
      </div>

      {/* TAB 1: DIRECTORIO DE CLIENTES */}
      {activeTab === 'directorio' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre, teléfono, email, dirección..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 rounded-xl text-sm border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    Borrar
                  </button>
                )}
              </div>

              {/* Sorter */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400 font-bold hidden sm:inline">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ClientSort)}
                  className="bg-gray-50 dark:bg-gray-800/80 text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 border-none"
                >
                  <option value="nombre">Alfabético (A-Z)</option>
                  <option value="deuda">Mayor Saldo Deudor</option>
                  <option value="gastado">Mayor Total Comprado</option>
                  <option value="compras">Más Cantidad de Compras</option>
                  <option value="reciente">Última Compra Reciente</option>
                </select>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                Todos ({clients.length})
              </button>
              <button
                onClick={() => setFilterMode('deudores')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterMode === 'deudores'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                }`}
              >
                <span>Con Saldo Deudor</span>
                <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
                  {kpis.debtorsCount}
                </span>
              </button>
              <button
                onClick={() => setFilterMode('frecuentes')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterMode === 'frecuentes'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                Frecuentes (≥2 ventas)
              </button>
              <button
                onClick={() => setFilterMode('con_compras')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterMode === 'con_compras'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                Con Compras Realizadas
              </button>
              <button
                onClick={() => setFilterMode('sin_compras')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterMode === 'sin_compras'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                Sin Compras Aún
              </button>
            </div>
          </div>

          {/* Clients Cards Grid */}
          {filteredAndSortedClients.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">
                No se encontraron clientes
              </h3>
              <p className="text-xs text-gray-500 mb-5">
                {search ? 'Intenta con otro término de búsqueda o cambia los filtros.' : 'Comienza registrando tu primer cliente en el sistema.'}
              </p>
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" />
                Agregar Nuevo Cliente
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedClients.map(client => (
                <motion.div
                  layout
                  key={client.id}
                  className="bg-white dark:bg-gray-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top: Avatar, Name & Edit/Delete */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-base shadow-sm">
                          {client.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                            {client.nombre}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {client.balance > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                ⚠️ Debe ${client.balance.toLocaleString()}
                              </span>
                            ) : client.salesCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                ✅ Al día
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                🆕 Nuevo
                              </span>
                            )}
                            {client.salesCount >= 2 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                ⭐ Frecuente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(client)}
                          title="Editar datos"
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => { setSelectedClient(client); setIsDeleteModalOpen(true); }}
                          title="Eliminar cliente"
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-gray-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 my-3">
                      {client.telefono && (
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="text-gray-400 shrink-0" />
                          <span className="font-semibold">{client.telefono}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.direccion && (
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{client.direccion}</span>
                        </div>
                      )}
                    </div>

                    {/* Mini Stats Pill */}
                    <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-2xl grid grid-cols-2 gap-2 text-center text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-black block">Total Gastado</span>
                        <span className="font-black text-gray-900 dark:text-white">${client.totalSpent.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-black block">Compras</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{client.salesCount} compras</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar inside Card */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="grid grid-cols-2 gap-2">
                      {/* WhatsApp Button */}
                      {client.telefono ? (
                        <button
                          onClick={() => sendWhatsAppMessage(client.telefono, `¡Hola ${client.nombre}!`)}
                          className="py-2 px-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          title="Escribir por WhatsApp"
                        >
                          <MessageCircle size={14} />
                          <span>WhatsApp</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="py-2 px-2.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                        >
                          <MessageCircle size={14} />
                          <span>Sin Celular</span>
                        </button>
                      )}

                      {/* Send Online Catalog Button */}
                      <button
                        onClick={() => sendCatalogLink(client)}
                        className="py-2 px-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Enviar enlace del Catálogo Online por WhatsApp"
                      >
                        <Share2 size={14} />
                        <span>Catálogo</span>
                      </button>
                    </div>

                    {/* If debtor: Cobrar button */}
                    {client.balance > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openPaymentModal({ id: client.id, name: client.nombre, balance: client.balance, phone: client.telefono })}
                          className="py-2 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <CreditCard size={14} />
                          <span>Cobrar Saldo</span>
                        </button>
                        <button
                          onClick={() => sendDebtReminder(client)}
                          className="py-2 px-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          title="Enviar recordatorio de saldo por WhatsApp"
                        >
                          <Send size={13} />
                          <span>Recordar</span>
                        </button>
                      </div>
                    )}

                    {/* Full History & Details Button */}
                    <button
                      onClick={() => {
                        setViewingDetailClient(client);
                        setDetailModalTab('compras');
                      }}
                      className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <History size={14} />
                      <span>Ver Ficha & Compras</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUENTAS CORRIENTES & COBRANZAS */}
      {activeTab === 'cuentas_corrientes' && (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-lg shadow-amber-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-black opacity-80 block mb-1">
                Control de Cuentas por Cobrar
              </span>
              <h2 className="text-3xl sm:text-4xl font-black">
                ${kpis.totalReceivable.toLocaleString()}
              </h2>
              <p className="text-xs sm:text-sm opacity-90 mt-1">
                Saldo total pendiente acumulado entre {kpis.debtorsCount} clientes con deuda.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const debtorsWithPhone = clientsWithStats.filter(c => c.balance > 0 && c.telefono);
                  if (debtorsWithPhone.length === 0) {
                    toast.info('No hay clientes con deuda y teléfono registrado.');
                    return;
                  }
                  toast.success(`Tienes ${debtorsWithPhone.length} clientes a quienes puedes recordar su saldo.`);
                }}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl font-bold text-xs"
              >
                <Clock className="w-4 h-4 mr-1.5" />
                Actualizado al día
              </Button>
            </div>
          </div>

          {/* Debtors List */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Clientes con Saldo Pendiente
                </h3>
                <p className="text-xs text-gray-500">Registra cobros o envía recordatorios de pago directo por WhatsApp</p>
              </div>
            </div>

            {clientsWithStats.filter(c => c.balance > 0).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">¡Todas las cuentas al día!</h4>
                <p className="text-xs text-gray-500">No hay clientes con saldo deudor en este momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {clientsWithStats.filter(c => c.balance > 0).map(client => (
                  <div key={client.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                        {client.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          {client.nombre}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {client.telefono && <span>📞 {client.telefono}</span>}
                          <span>Total comprado: ${client.totalSpent.toLocaleString()}</span>
                          <span>Abonado: ${client.totalPaid.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Debe</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                          ${client.balance.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => openPaymentModal({ id: client.id, name: client.nombre, balance: client.balance, phone: client.telefono })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-2 px-3"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1" />
                          Cobrar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => sendDebtReminder(client)}
                          className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-xs font-bold py-2 px-3"
                          title="Recordar saldo por WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                          Recordar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Collections History */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              Historial de Cobros y Abonos Recientes
            </h3>
            
            {accountPayments.filter(p => p.entityType === 'client').length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No hay registros de cobros asentados todavía.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {accountPayments
                  .filter(p => p.entityType === 'client')
                  .slice(0, 10)
                  .map(payment => {
                    const client = clients.find(c => c.id === payment.entityId);
                    return (
                      <div key={payment.id} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">
                            {client?.nombre || 'Cliente'}
                          </span>
                          <span className="text-gray-500 text-[11px]">
                            {payment.fecha} • Método: {payment.metodo} {payment.concepto ? `• ${payment.concepto}` : ''}
                          </span>
                        </div>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          +${payment.monto.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIAL DE VENTAS POR CLIENTE */}
      {activeTab === 'historial_ventas' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">
              Registro de Ventas a Clientes
            </h3>
            <p className="text-xs text-gray-500 mb-4">Todas las ventas asociadas a clientes registrados en el sistema</p>

            {sales.filter(s => s.clientId).length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aún no hay ventas asociadas a clientes. Al realizar una venta, selecciona el cliente para asociarla a su historial.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Producto / Concepto</th>
                      <th className="py-3 px-3 text-center">Unidades</th>
                      <th className="py-3 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                    {sales
                      .filter(s => s.clientId)
                      .slice(0, 50)
                      .map(sale => {
                        const dateStr = sale.fecha?.toDate 
                          ? sale.fecha.toDate().toLocaleDateString()
                          : new Date(sale.fecha || 0).toLocaleDateString();

                        return (
                          <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-3 px-3 text-gray-500">{dateStr}</td>
                            <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                              {sale.clientNombre || 'Cliente'}
                            </td>
                            <td className="py-3 px-3">{sale.productNombre}</td>
                            <td className="py-3 px-3 text-center text-gray-500">{sale.cantidad}</td>
                            <td className="py-3 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                              ${Number(sale.total).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CATÁLOGO ONLINE & DIFUSIÓN */}
      {activeTab === 'catalogo_online' && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
            <div className="max-w-2xl">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest inline-block mb-3">
                🌐 Tu Tienda / Catálogo en Vivo
              </span>
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Tus Clientes Pueden Comprar y Pedirte Directo por WhatsApp
              </h2>
              <p className="text-xs sm:text-sm opacity-90 mt-2 leading-relaxed">
                El Catálogo Online es una página web moderna diseñada para tus clientes. Muestra tus prendas y productos con fotos, precios y talles en tiempo real, sin mostrar costos internos. Al confirmar su carrito, el pedido se arma solo y te llega listo a tu WhatsApp.
              </p>
            </div>

            {/* Link Box */}
            <div className="bg-black/25 backdrop-blur-md p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-white/10">
              <div className="w-full truncate font-mono text-xs text-white/90">
                {catalogUrl}
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(catalogUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                    toast.success('¡Enlace copiado al portapapeles!');
                  }}
                  className="bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-bold text-xs"
                >
                  {copiedLink ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
                  {copiedLink ? '¡Copiado!' : 'Copiar Link'}
                </Button>
                <Button
                  onClick={() => window.open('/catalogo-online', '_blank')}
                  variant="outline"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 rounded-xl font-bold text-xs"
                >
                  <ExternalLink size={14} className="mr-1" />
                  Abrir
                </Button>
              </div>
            </div>
          </div>

          {/* Step-by-Step Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                1
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Compartes el enlace</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Le envías el enlace del catálogo por WhatsApp o lo pones en tu biografía de Instagram / redes sociales.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                2
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">El cliente elige productos</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Navega desde su celular o computadora, filtra por procedencia, selecciona el talle deseado y añade al carrito.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                3
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Te llega el pedido al WhatsApp</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Al tocar "Enviar Pedido por WhatsApp", se abre el chat contigo con la lista exacta de productos, cantidades y el total listo para confirmar.
              </p>
            </div>
          </div>

          {/* Direct WhatsApp Share to Client */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle size={18} className="text-emerald-500" />
              Enviar Catálogo por WhatsApp a un Cliente
            </h3>
            <p className="text-xs text-gray-500">
              Selecciona cualquier cliente de tu agenda para enviarle la invitación personalizada de inmediato:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {clients.slice(0, 9).map(c => (
                <div key={c.id} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <span className="font-bold text-gray-900 dark:text-white block truncate">{c.nombre}</span>
                    <span className="text-gray-400 text-[11px]">{c.telefono || 'Sin teléfono'}</span>
                  </div>
                  {c.telefono ? (
                    <button
                      onClick={() => sendCatalogLink(c)}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shrink-0"
                      title="Enviar por WhatsApp"
                    >
                      <Send size={13} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">No tel</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CLIENT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Nombre Completo / Razón Social *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Juan Pérez / Tienda Central"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold border-none"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="Ej: +54 9 11 1234-5678"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm border-none"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                placeholder="cliente@ejemplo.com"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm border-none"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Dirección de Entrega / Facturación
            </label>
            <input
              type="text"
              placeholder="Ej: Av. San Martín 1234, Local 5"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm border-none"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20"
            >
              {selectedClient ? 'Guardar Cambios' : 'Registrar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DETAIL & HISTORY OF CLIENT */}
      <Modal
        isOpen={!!viewingDetailClient}
        onClose={() => setViewingDetailClient(null)}
        title={`Ficha de Cliente: ${viewingDetailClient?.nombre || ''}`}
        maxWidth="max-w-3xl"
      >
        {viewingDetailClient && (() => {
          const detail = clientsWithStats.find(c => c.id === viewingDetailClient.id);
          if (!detail) return null;

          return (
            <div className="space-y-6 max-h-[75vh] overflow-y-auto p-1">
              {/* Client Info & Metrics Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black">{detail.nombre}</h3>
                    <div className="flex items-center gap-3 text-xs opacity-90 mt-1">
                      {detail.telefono && <span>📞 {detail.telefono}</span>}
                      {detail.email && <span>✉️ {detail.email}</span>}
                    </div>
                    {detail.direccion && (
                      <div className="text-xs opacity-80 mt-1">📍 {detail.direccion}</div>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold block">
                      Saldo en Cuenta
                    </span>
                    <span className={`text-2xl font-black ${detail.balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {detail.balance > 0 ? `-$${detail.balance.toLocaleString()}` : '$0 (Al día)'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] opacity-75 uppercase font-bold block">Total Gastado</span>
                    <span className="font-black text-sm">${detail.totalSpent.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-75 uppercase font-bold block">Compras</span>
                    <span className="font-black text-sm">{detail.salesCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-75 uppercase font-bold block">Total Pagado</span>
                    <span className="font-black text-sm">${detail.totalPaid.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions for this client */}
              <div className="flex items-center gap-2 flex-wrap">
                {detail.telefono && (
                  <Button
                    onClick={() => sendWhatsAppMessage(detail.telefono, `Hola ${detail.nombre}!`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    <MessageCircle size={14} className="mr-1.5" />
                    WhatsApp
                  </Button>
                )}
                <Button
                  onClick={() => sendCatalogLink(detail)}
                  variant="outline"
                  className="rounded-xl border-indigo-200 text-indigo-600 font-bold text-xs"
                >
                  <Share2 size={14} className="mr-1.5" />
                  Enviar Catálogo Online
                </Button>
                {detail.balance > 0 && (
                  <Button
                    onClick={() => openPaymentModal({ id: detail.id, name: detail.nombre, balance: detail.balance, phone: detail.telefono })}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                  >
                    <CreditCard size={14} className="mr-1.5" />
                    Cobrar Saldo
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setViewingDetailClient(null);
                    navigate('/ventas');
                  }}
                  variant="outline"
                  className="rounded-xl text-xs font-bold"
                >
                  <ShoppingBag size={14} className="mr-1.5" />
                  Nueva Venta
                </Button>
              </div>

              {/* Sub-tabs: Compras vs Pagos */}
              <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <button
                  onClick={() => setDetailModalTab('compras')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    detailModalTab === 'compras'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Historial de Compras ({detail.sales.length})
                </button>
                <button
                  onClick={() => setDetailModalTab('pagos')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    detailModalTab === 'pagos'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Abonos y Cobros ({detail.payments.length})
                </button>
              </div>

              {/* Compras List */}
              {detailModalTab === 'compras' && (
                <div className="space-y-2">
                  {detail.sales.length === 0 ? (
                    <p className="text-center py-8 text-xs text-gray-400">Sin compras registradas para este cliente.</p>
                  ) : (
                    detail.sales.map(s => {
                      const dateStr = s.fecha?.toDate 
                        ? s.fecha.toDate().toLocaleDateString()
                        : new Date(s.fecha || 0).toLocaleDateString();

                      return (
                        <div key={s.id} className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white block">{s.productNombre}</span>
                            <span className="text-gray-400 text-[11px]">{dateStr} • {s.cantidad} unidades</span>
                          </div>
                          <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                            ${Number(s.total).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Pagos List */}
              {detailModalTab === 'pagos' && (
                <div className="space-y-2">
                  {detail.payments.length === 0 ? (
                    <p className="text-center py-8 text-xs text-gray-400">Sin registros de pagos o abonos.</p>
                  ) : (
                    detail.payments.map(p => (
                      <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">{p.concepto || 'Abono'}</span>
                          <span className="text-gray-400 text-[11px]">{p.fecha} • Método: {p.metodo}</span>
                        </div>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          +${p.monto.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* MODAL: PAYMENT / COLLECTION FROM CLIENT */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Cobrar / Asentar Abono de Cliente"
      >
        <form onSubmit={handleRegisterPayment} className="space-y-4 p-2">
          {paymentClient && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                  {paymentClient.name}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  Saldo pendiente actual
                </span>
              </div>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                ${paymentClient.balance.toLocaleString()}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Monto a Cobrar / Abonar *
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder="0.00"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-black text-emerald-600 border-none"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Método de Pago
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold border-none"
            >
              <option value="efectivo">💵 Efectivo</option>
              <option value="transferencia">🏦 Transferencia Bancaria</option>
              <option value="tarjeta_debito">💳 Tarjeta de Débito</option>
              <option value="tarjeta_credito">💳 Tarjeta de Crédito</option>
              <option value="qr">📱 QR / Billetera Virtual</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Concepto
            </label>
            <input
              type="text"
              placeholder="Ej: Cobro de saldo pendiente"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm border-none"
              value={payConcept}
              onChange={(e) => setPayConcept(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Notas Adicionales
            </label>
            <input
              type="text"
              placeholder="Nro de comprobante, observaciones..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm border-none"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={recordInFinances}
              onChange={(e) => setRecordInFinances(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Impactar también como ingreso en Finanzas</span>
          </label>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20"
            >
              Registrar Cobro
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SHARE ONLINE CATALOG */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Compartir Catálogo Online de Clientes"
      >
        <div className="space-y-4 p-2 text-xs">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/40">
            <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1">
              Enlace de tu Catálogo
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-[11px] mb-3">
              Copia este link o envíaselo a tus clientes para que puedan explorar productos y hacer pedidos:
            </p>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-[11px] truncate">
              <span className="truncate flex-1">{catalogUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(catalogUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                  toast.success('¡Enlace copiado!');
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shrink-0 text-xs"
              >
                {copiedLink ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-gray-700 dark:text-gray-300 block">
              O selecciona un cliente para enviárselo con mensaje prearmado:
            </span>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {clients.map(c => (
                <div key={c.id} className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex justify-between items-center">
                  <div className="truncate pr-2">
                    <span className="font-bold block truncate">{c.nombre}</span>
                    <span className="text-gray-400 text-[10px]">{c.telefono || 'Sin teléfono'}</span>
                  </div>
                  {c.telefono ? (
                    <button
                      onClick={() => {
                        sendCatalogLink(c);
                        setIsShareModalOpen(false);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shrink-0"
                    >
                      <Send size={11} />
                      WhatsApp
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400">Sin cel</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION DELETE MODAL */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Cliente"
        message={`¿Estás seguro de que deseas eliminar al cliente "${selectedClient?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
