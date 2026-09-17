/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Modal from './Modal';
import { Button } from './ui';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
      <div className="space-y-6">
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-2xl shrink-0 ${
            variant === 'danger' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
            variant === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
            'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
          }`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className={variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : ''}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
