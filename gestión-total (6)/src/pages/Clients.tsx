/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Sale } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'sonner';

export default function Clients() {
  const { t, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState<Omit<Client, 'id' | 'createdAt' | 'createdBy'>>({
    nombre: '',
    email: '',
    telefono: '',
    direccion: ''
  });

  const [clientHistory, setClientHistory] = useState<Sale[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await inventoryService.getClients();
        setClients(data);
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };
    loadClients();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (viewingHistory) {
        setIsLoadingHistory(true);
        try {
          const history = await inventoryService.getSalesByClient(viewingHistory.id);
          setClientHistory(history);
        } catch (error) {
          console.error('Error loading history:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setClientHistory([]);
      }
    };
    loadHistory();
  }, [viewingHistory]);

  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono?.includes(search)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedClient) {
        await inventoryService.updateClient(selectedClient.id, formData);
        toast.success(t('client_updated_success') || 'Cliente actualizado con éxito');
      } else {
        await inventoryService.addClient(formData);
        toast.success(t('client_added_success') || 'Cliente agregado con éxito');
      }
      setIsModalOpen(false);
      resetForm();
      await refreshClients();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar cliente');
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
        toast.success(t('client_deleted_success') || 'Cliente eliminado con éxito');
        setIsDeleteModalOpen(false);
        if (viewingHistory?.id === selectedClient.id) {
          setViewingHistory(null);
        }
        setSelectedClient(null);
        await refreshClients();
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar cliente');
      }
    }
  };

  const getClientHistory = (clientId: string) => {
    return clientHistory;
  };

  const refreshClients = async () => {
    try {
      const data = await inventoryService.getClients();
      setClients(data);
    } catch (error) {
      console.error('Error refreshing clients:', error);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            {t('clients')}
          </h1>
          <p className="text-slate-500">{t('clients_desc') || 'Administra tu base de datos de clientes'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const data = await inventoryService.getClients();
                setClients(data);
              } catch (error) {
                console.error('Error refreshing clients:', error);
              }
            }}
            className="rounded-xl border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            title="Actualizar datos"
          >
            <Clock className="w-5 h-5 mr-2" />
            {t('refresh') || 'Actualizar'}
          </Button>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('add_client')}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder={t('search_placeholder')}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <motion.div
            layout
            key={client.id}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(client)}
                  title="Editar cliente"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setSelectedClient(client); setIsDeleteModalOpen(true); }}
                  title="Eliminar cliente"
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-rose-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4">{client.nombre}</h3>

            <div className="space-y-3 mb-6">
              {client.telefono && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Phone className="w-4 h-4" />
                  {client.telefono}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.direccion && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{client.direccion}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewingHistory(client)}
              className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <History className="w-4 h-4" />
              {t('view_history') || 'Ver Historial'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedClient ? t('edit_client') : t('add_client')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">{t('client_name')}</label>
            <input
              type="text"
              required
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">{t('phone')}</label>
              <input
                type="tel"
                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">{t('email')}</label>
              <input
                type="email"
                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">{t('address')}</label>
            <input
              type="text"
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
          >
            {t('save')}
          </button>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={!!viewingHistory}
        onClose={() => setViewingHistory(null)}
        title={`${t('history')} - ${viewingHistory?.nombre}`}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading_history') || 'Cargando historial...'}</p>
            </div>
          ) : (
            <>
              {viewingHistory && (
                <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{t('total_spent') || 'Total Gastado'}</p>
                  <p className="text-3xl font-black">${getClientHistory(viewingHistory.id).reduce((acc, s) => acc + (Number(s.total) || 0), 0).toLocaleString()}</p>
                  <div className="mt-4 flex gap-4 text-xs font-bold opacity-90">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {getClientHistory(viewingHistory.id).length} {t('sales') || 'Ventas'}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">{t('recent_purchases') || 'Compras Recientes'}</h4>
                {viewingHistory && getClientHistory(viewingHistory.id).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>{t('no_history') || 'Sin historial de compras'}</p>
                  </div>
                ) : (
                  viewingHistory && getClientHistory(viewingHistory.id).map(sale => (
                    <div key={sale.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="font-bold">{sale.productNombre}</div>
                        <div className="text-xs text-slate-500">{new Date(sale.fecha?.seconds * 1000 || sale.fecha).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-indigo-600">${sale.total.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">{sale.cantidad} {t('units')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingHistory) {
                      setSelectedClient(viewingHistory);
                      setIsDeleteModalOpen(true);
                    }
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('delete_client') || 'Eliminar Cliente'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingHistory(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
                >
                  {t('close') || 'Cerrar'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_client')}
        message={t('delete_client_confirm') || '¿Estás seguro de eliminar este cliente?'}
      />
    </div>
  );
}
