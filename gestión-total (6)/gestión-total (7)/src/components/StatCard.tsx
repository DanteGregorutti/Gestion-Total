/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: React.ReactNode;
  extraBadge?: React.ReactNode;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue';
  variant?: 'default' | 'outline';
  onClick?: () => void;
  titleTooltip?: string;
  description?: string;
}

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subtitle,
  extraBadge,
  className, 
  color = 'indigo', 
  variant = 'default', 
  onClick, 
  titleTooltip,
  description
}: CardProps) {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-6 rounded-3xl transition-all duration-300 group flex flex-col justify-between", 
        variant === 'default' ? "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md" : "bg-transparent border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900/50",
        onClick && "cursor-pointer active:scale-[0.98] hover:border-indigo-300 dark:hover:border-indigo-700",
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", colors[color])}>
            <Icon size={24} />
          </div>
          <div className="flex items-center gap-1.5">
            {extraBadge}
            {trend && (
              <div className={cn(
                "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                trend.isPositive ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
              )}>
                {trend.isPositive ? '+' : '-'}{isNaN(trend.value) ? 0 : Math.abs(trend.value)}%
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest italic truncate" title={titleTooltip}>
              {title}
            </p>
            {onClick && (
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Ver detalle →
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-none tracking-tight truncate">
              {typeof value === 'number' && isNaN(value) ? '0' : String(value ?? 0)}
            </h3>
          </div>
          {subtitle && (
            <div className="mt-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {subtitle}
            </div>
          )}
          {description && (
            <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
