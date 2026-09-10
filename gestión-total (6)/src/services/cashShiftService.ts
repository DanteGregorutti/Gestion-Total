/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CashShift, AccountPayment } from '../types';

const CASH_SHIFTS_KEY = 'gestion_total_cash_shifts';
const ACTIVE_SHIFT_KEY = 'gestion_total_active_shift';
const ACCOUNT_PAYMENTS_KEY = 'gestion_total_account_payments';

export const cashShiftService = {
  // Get active cash shift or null if closed
  getActiveShift(): CashShift | null {
    try {
      const data = localStorage.getItem(ACTIVE_SHIFT_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  // Open cash shift with initial cash amount
  openShift(montoInicial: number, createdBy: string = 'admin'): CashShift {
    const shift: CashShift = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fechaApertura: new Date().toISOString(),
      montoInicial: Math.max(0, montoInicial),
      estado: 'abierta',
      createdBy
    };
    localStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    return shift;
  },

  // Close shift with expected vs real cash
  closeShift(params: {
    efectivoReal: number;
    totalVentasEfectivo: number;
    totalVentasDigital: number;
    totalIngresosExtra: number;
    totalRetirosGastos: number;
    notas?: string;
  }): CashShift {
    const active = this.getActiveShift();
    const montoInicial = active ? active.montoInicial : 0;
    const efectivoEsperado = montoInicial + params.totalVentasEfectivo + params.totalIngresosExtra - params.totalRetirosGastos;
    const diferencia = params.efectivoReal - efectivoEsperado;

    const closedShift: CashShift = {
      id: active ? active.id : `shift_${Date.now()}`,
      fechaApertura: active ? active.fechaApertura : new Date().toISOString(),
      fechaCierre: new Date().toISOString(),
      montoInicial,
      estado: 'cerrada',
      totalVentasEfectivo: params.totalVentasEfectivo,
      totalVentasDigital: params.totalVentasDigital,
      totalIngresosExtra: params.totalIngresosExtra,
      totalRetirosGastos: params.totalRetirosGastos,
      efectivoEsperado,
      efectivoReal: params.efectivoReal,
      diferencia,
      notas: params.notas || '',
      createdBy: active ? active.createdBy : 'admin'
    };

    // Save to historical
    const history = this.getShiftsHistory();
    history.unshift(closedShift);
    localStorage.setItem(CASH_SHIFTS_KEY, JSON.stringify(history.slice(0, 100)));
    localStorage.removeItem(ACTIVE_SHIFT_KEY);

    return closedShift;
  },

  // Get historical closed shifts
  getShiftsHistory(): CashShift[] {
    try {
      const data = localStorage.getItem(CASH_SHIFTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Account Payments (Client or Supplier debt payments)
  getAccountPayments(entityId?: string): AccountPayment[] {
    try {
      const data = localStorage.getItem(ACCOUNT_PAYMENTS_KEY);
      const list: AccountPayment[] = data ? JSON.parse(data) : [];
      if (entityId) {
        return list.filter(p => p.entityId === entityId);
      }
      return list;
    } catch {
      return [];
    }
  },

  addAccountPayment(payment: Omit<AccountPayment, 'id'>): AccountPayment {
    const newPayment: AccountPayment = {
      ...payment,
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    };
    const current = this.getAccountPayments();
    current.unshift(newPayment);
    localStorage.setItem(ACCOUNT_PAYMENTS_KEY, JSON.stringify(current));
    return newPayment;
  }
};
