/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Warehouse, 
  Plus, 
  MoreVertical, 
  MapPin, 
  Package,
  ArrowRight,
  Loader2,
  Trash2,
  Clock,
  Edit2
} from 'lucide-react';
import { Button, Input } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { Warehouse as WarehouseType, Product } from '../types';
import { inventoryService } from '../services/inventoryService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

export default function Warehouses() {
  const { t, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = React.useState<WarehouseType[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingWarehouse, setEditingWarehouse] = React.useState<WarehouseType | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [formData, setFormData] = React.useState({
    nombre: '',
    descripcion: '',
    ubicacion: 'Buenos Aires'
  });

  const [editFormData, setEditFormData] = React.useState({
    nombre: '',
    descripcion: '',
    ubicacion: ''
  });

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [w, p] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getProducts()
        ]);
        setWarehouses(w);
        setProducts(p);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading warehouse data:', error);
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [w, p] = await Promise.all([
        inventoryService.getWarehouses(),
        inventoryService.getProducts()
      ]);
      setWarehouses(w);
      setProducts(p);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryService.addWarehouse(formData);
      toast.success(t('warehouse_added_success'));
      setIsAddModalOpen(false);
      setFormData({ nombre: '', descripcion: '', ubicacion: 'Buenos Aires' });
      refreshData();
    } catch (error) {
      toast.error(t('warehouse_added_error'));
    }
  };

  const handleEditWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    try {
      await inventoryService.updateWarehouse(editingWarehouse.id, editFormData);
      toast.success(t('warehouse_updated_success') || 'Almacén actualizado correctamente');
      setIsEditModalOpen(false);
      setEditingWarehouse(null);
      refreshData();
    } catch (error) {
      toast.error(t('warehouse_updated_error') || 'Error al actualizar el almacén');
    }
  };

  const openEditModal = (w: WarehouseType) => {
    setEditingWarehouse(w);
    setEditFormData({
      nombre: w.nombre,
      descripcion: w.descripcion || '',
      ubicacion: w.ubicacion || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteWarehouse = async () => {
    if (!warehouseToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.deleteWarehouse(warehouseToDelete);
      toast.success(t('warehouse_deleted_success'));
      setIsDeleteModalOpen(false);
      setWarehouseToDelete(null);
      await refreshData();
    } catch (error) {
      toast.error(t('warehouse_deleted_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setWarehouseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading_warehouses')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('warehouse_management')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('warehouse_management_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={refreshData}
            className="rounded-xl border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            title="Actualizar datos"
          >
            <Clock className="w-5 h-5 mr-2" />
            {t('refresh') || 'Actualizar'}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            {t('new_warehouse')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <Warehouse className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">{t('no_warehouses_found')}</p>
            <Button variant="ghost" className="mt-4" onClick={() => setIsAddModalOpen(true)}>
              {t('create_first')}
            </Button>
          </div>
        ) : (
          warehouses.map((w) => {
            const warehouseProducts = products.filter(p => p.almacenId === w.id || p.almacenId === w.nombre);
            return (
              <div key={w.id} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 group">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                    <Warehouse size={24} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      onClick={() => openEditModal(w)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      onClick={() => confirmDelete(w.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{w.nombre}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{w.descripcion}</p>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 grid grid-cols-2 gap-4">
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <Package size={16} className="mr-2" />
                    <span className="text-xs font-bold">{warehouseProducts.length} {t('items')}</span>
                  </div>
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <MapPin size={16} className="mr-2" />
                    <span className="text-xs font-bold">{w.ubicacion || t('no_location')}</span>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/inventario')}
                  className="w-full mt-6 py-3 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl transition-colors"
                >
                  {t('view_inventory')}
                  <ArrowRight size={16} className="ml-2" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Warehouse Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('create_new_warehouse')}
      >
        <form onSubmit={handleAddWarehouse} className="space-y-6">
          <Input 
            label={t('warehouse_name')} 
            placeholder="Ej: Depósito Norte" 
            required
            value={formData.nombre}
            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
          />
          <Input 
            label={t('location')} 
            placeholder="Ej: Buenos Aires" 
            value={formData.ubicacion}
            onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block ml-1">{t('description')}</label>
            <textarea 
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
              rows={3}
              placeholder={t('warehouse_desc_placeholder')}
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('create_warehouse')}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Warehouse Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('edit_warehouse') || 'Editar Almacén'}
      >
        <form onSubmit={handleEditWarehouse} className="space-y-6">
          <Input 
            label={t('warehouse_name')} 
            placeholder="Ej: Depósito Norte" 
            required
            value={editFormData.nombre}
            onChange={(e) => setEditFormData({...editFormData, nombre: e.target.value})}
          />
          <Input 
            label={t('location')} 
            placeholder="Ej: Buenos Aires" 
            value={editFormData.ubicacion}
            onChange={(e) => setEditFormData({...editFormData, ubicacion: e.target.value})}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block ml-1">{t('description')}</label>
            <textarea 
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
              rows={3}
              placeholder={t('warehouse_desc_placeholder')}
              value={editFormData.descripcion}
              onChange={(e) => setEditFormData({...editFormData, descripcion: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('save_changes') || 'Guardar Cambios'}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteWarehouse}
        title={t('delete_warehouse')}
        message={t('delete_warehouse_confirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        isLoading={isDeleting}
      />
    </div>
  );
}
