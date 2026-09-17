/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  User, 
  History,
  Trash2,
  Edit2,
  Loader2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, RefreshButton } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier, Purchase } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'sonner';

export default function Suppliers() {
  const { t, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState<Omit<Supplier, 'id' | 'createdAt' | 'createdBy'>>({
    nombre: '',
    contacto: '',
    email: '',
    telefono: ''
  });

  const [supplierHistory, setSupplierHistory] = useState<Purchase[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await inventoryService.getSuppliers();
        setSuppliers(data);
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
    };
    loadSuppliers();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (viewingHistory) {
        setIsLoadingHistory(true);
        try {
          const history = await inventoryService.getPurchasesBySupplier(viewingHistory.nombre);
          setSupplierHistory(history);
        } catch (error) {
          console.error('Error loading history:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setSupplierHistory([]);
      }
    };
    loadHistory();
  }, [viewingHistory]);

  const filteredSuppliers = suppliers.filter(s => 
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.contacto?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.telefono?.includes(search)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedSupplier) {
        await inventoryService.updateSupplier(selectedSupplier.id, formData);
        toast.success(t('supplier_updated_success') || 'Proveedor actualizado con éxito');
      } else {
        await inventoryService.addSupplier(formData);
        toast.success(t('supplier_added_success') || 'Proveedor agregado con éxito');
      }
      setIsModalOpen(false);
      resetForm();
      await refreshSuppliers();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar proveedor');
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', contacto: '', email: '', telefono: '' });
    setSelectedSupplier(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      nombre: supplier.nombre,
      contacto: supplier.contacto || '',
      email: supplier.email || '',
      telefono: supplier.telefono || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (selectedSupplier) {
      try {
        await inventoryService.deleteSupplier(selectedSupplier.id);
        toast.success(t('supplier_deleted_success') || 'Proveedor eliminado con éxito');
        setIsDeleteModalOpen(false);
        setSelectedSupplier(null);
        await refreshSuppliers();
      } catch (error) {
        console.error(error);
        toast.error('Error al eliminar proveedor');
      }
    }
  };

  const getSupplierHistory = (supplierId: string) => {
    return supplierHistory;
  };

  const refreshSuppliers = async () => {
    try {
      const data = await inventoryService.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error refreshing suppliers:', error);
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
            <Truck className="w-8 h-8 text-indigo-600" />
            {t('suppliers')}
          </h1>
          <p className="text-slate-500">{t('suppliers_desc') || 'Administra tus proveedores de mercadería'}</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton 
            onRefresh={refreshSuppliers}
            label={t('refresh') || 'Actualizar'}
            title="Actualizar datos de proveedores"
          />
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('add_supplier')}
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
        {filteredSuppliers.map(supplier => (
          <motion.div
            layout
            key={supplier.id}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(supplier)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setSelectedSupplier(supplier); setIsDeleteModalOpen(true); }}
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4">{supplier.nombre}</h3>

            <div className="space-y-3 mb-6">
              {supplier.contacto && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <User className="w-4 h-4" />
                  {supplier.contacto}
                </div>
              )}
              {supplier.telefono && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Phone className="w-4 h-4" />
                  {supplier.telefono}
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{supplier.email}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewingHistory(supplier)}
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
        title={selectedSupplier ? t('edit_supplier') : t('add_supplier')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">{t('supplier_name')}</label>
            <input
              type="text"
              required
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">{t('contact_person') || 'Persona de Contacto'}</label>
            <input
              type="text"
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.contacto}
              onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
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
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{t('total_supplied') || 'Total Suministrado'}</p>
                  <p className="text-3xl font-black">${getSupplierHistory(viewingHistory.id).reduce((acc, p) => acc + (Number(p.total) || 0), 0).toLocaleString()}</p>
                  <div className="mt-4 flex gap-4 text-xs font-bold opacity-90">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {getSupplierHistory(viewingHistory.id).length} {t('purchases') || 'Compras'}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">{t('recent_supplies') || 'Suministros Recientes'}</h4>
                {viewingHistory && getSupplierHistory(viewingHistory.id).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>{t('no_history') || 'Sin historial de compras'}</p>
                  </div>
                ) : (
                  viewingHistory && getSupplierHistory(viewingHistory.id).map(purchase => (
                    <div key={purchase.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="font-bold">{purchase.productNombre}</div>
                        <div className="text-xs text-slate-500">{new Date(purchase.fecha?.seconds * 1000 || purchase.fecha).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-indigo-600">${purchase.total.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">{purchase.cantidad} {t('units')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_supplier')}
        message={t('delete_supplier_confirm') || '¿Estás seguro de eliminar este proveedor?'}
      />
    </div>
  );
}
