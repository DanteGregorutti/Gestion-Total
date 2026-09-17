/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Plus, Minus, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { inventoryService } from '../services/inventoryService';
import { Product } from '../types';
import { toast } from 'sonner';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';

export default function StockUpdate() {
  const { t } = useSettings();
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [quantity, setQuantity] = React.useState(1);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDocFromServer(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        } else {
          setProduct(null);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const handleUpdate = async (type: 'add' | 'remove') => {
    if (!product) return;
    setIsUpdating(true);
    const delta = type === 'add' ? quantity : -quantity;
    const newQuantity = product.cantidad + delta;

    if (newQuantity < 0) {
      toast.error(t('insufficient_stock_error'));
      setIsUpdating(false);
      return;
    }

    try {
      await inventoryService.updateProduct(product.id, { cantidad: newQuantity });
      setIsSuccess(true);
      setQuantity(1);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      toast.error(t('stock_update_error'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">{t('loading_product')}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center p-6 text-center">
        <Package className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('product_not_found')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('product_not_found_desc')}</p>
        <Button className="mt-8" onClick={() => navigate('/')}>{t('back_to_dashboard')}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[32px] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
      >
        <div className="p-8 bg-indigo-600 text-white relative">
          <button 
            onClick={() => navigate(-1)}
            className="absolute left-6 top-8 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col items-center text-center pt-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Package size={32} />
            </div>
            <h2 className="text-2xl font-bold">{product.descripcion || t('no_description')}</h2>
            <p className="text-indigo-100 font-medium mt-1">{product.codigo}</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('current_stock')}</p>
            <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-2">{Number(product.cantidad) || 0}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-6">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-90 transition-all"
              >
                <Minus size={24} />
              </button>
              <span className="text-4xl font-bold text-gray-900 dark:text-white w-16 text-center">{Number(quantity) || 0}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 active:scale-90 transition-all"
              >
                <Plus size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button 
                variant="outline" 
                className="h-14 rounded-2xl font-bold border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                onClick={() => handleUpdate('remove')}
                disabled={isUpdating || quantity === 0}
              >
                {t('subtract')}
              </Button>
              <Button 
                className="h-14 rounded-2xl font-bold"
                onClick={() => handleUpdate('add')}
                disabled={isUpdating || quantity === 0}
              >
                {t('add')}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSuccess && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-500 text-white p-4 flex items-center justify-center space-x-2"
            >
              <CheckCircle2 size={20} />
              <span className="font-bold">{t('stock_updated_success')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <p className="mt-8 text-gray-400 dark:text-gray-600 text-sm font-medium">Gestión Total Mobile v1.0</p>
    </div>
  );
}
