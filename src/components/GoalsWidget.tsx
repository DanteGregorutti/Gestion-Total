/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Trophy,
  X,
  Trash2,
  Lightbulb
} from 'lucide-react';
import { Goal } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useSettings } from '../contexts/SettingsContext';
import Modal from './Modal';

export function GoalsWidget() {
  const { t } = useSettings();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState<Omit<Goal, 'id' | 'createdBy'>>({
    titulo: '',
    tipo: 'ventas_unidades',
    objetivo: 0,
    actual: 0,
    mes: new Date().toISOString().slice(0, 7)
  });

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const data = await inventoryService.getGoals();
        setGoals(data);
      } catch (error) {
        console.error('Error fetching goals:', error);
      }
    };
    fetchGoals();
  }, []);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryService.addGoal(newGoal);
      setIsModalOpen(false);
      setNewGoal({
        titulo: '',
        tipo: 'ventas_unidades',
        objetivo: 0,
        actual: 0,
        mes: new Date().toISOString().slice(0, 7)
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (confirm(t('confirm_delete_goal'))) {
      await inventoryService.deleteGoal(id);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-600" />
          {t('goals')}
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        {goals.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>{t('no_goals_set')}</p>
          </div>
        ) : (
          goals.map(goal => {
            const objetivoNum = Number(goal.objetivo) || 0;
            const actualNum = Number(goal.actual) || 0;
            const progress = objetivoNum > 0 ? Math.min((actualNum / objetivoNum) * 100, 100) : 0;
            const isCompleted = progress >= 100;

            return (
              <div key={goal.id} className="space-y-2 group relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <Trophy className="w-4 h-4 text-amber-500" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="font-bold text-sm">{goal.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      {actualNum} / {objetivoNum}
                    </span>
                    <button 
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full rounded-full ${isCompleted ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                  />
                </div>
                {isCompleted && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t('goal_reached')}
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={t('new_goal')}
      >
        <form onSubmit={handleAddGoal} className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              {t('goal_help')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('goal_title')}</label>
            <input
              type="text"
              required
              className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
              value={newGoal.titulo}
              onChange={(e) => setNewGoal({ ...newGoal, titulo: e.target.value })}
              placeholder="Ej: Vender 50 productos"
            />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('goal_type')}</label>
              <select
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                value={newGoal.tipo}
                onChange={(e) => setNewGoal({ ...newGoal, tipo: e.target.value as any })}
              >
                <option value="ventas_unidades">{t('units_sold')}</option>
                <option value="ventas_monto">{t('total_sales_amount')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('target_value')}</label>
              <input
                type="number"
                required
                min="1"
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                value={newGoal.objetivo || ''}
                onChange={(e) => setNewGoal({ ...newGoal, objetivo: Number(e.target.value) })}
                placeholder="0"
              />
              <p className="mt-2 text-[10px] text-slate-400 font-bold ml-1">{t('goal_target_help')}</p>
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
          >
            {t('create_goal')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
