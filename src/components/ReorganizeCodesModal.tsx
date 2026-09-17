/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Barcode, 
  Wand2, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Search, 
  Loader2, 
  Layers,
  Settings2,
  CheckCircle2
} from 'lucide-react';
import Modal from './Modal';
import { Button, Input } from './ui';
import { Product } from '../types';
import { inventoryService, isNameInCode } from '../services/inventoryService';
import { toast } from 'sonner';

interface ReorganizeCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSuccess: () => Promise<void> | void;
}

export default function ReorganizeCodesModal({
  isOpen,
  onClose,
  products,
  onSuccess
}: ReorganizeCodesModalProps) {
  const [prefix, setPrefix] = useState('ART');
  const [startNumber, setStartNumber] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Group products logically to simulate the sequential pattern
  const previewGroups = useMemo(() => {
    if (!products || products.length === 0) return [];

    const normalize = (str?: string) => {
      return (str || '')
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const getCleanName = (desc: string, code: string): string => {
      const d = (desc || '').trim();
      const c = (code || '').trim();

      const isGenericDesc = !d || 
        /^producto\s+/i.test(d) || 
        /^art[-_\s]/i.test(d) ||
        d.toLowerCase() === c.toLowerCase();

      let nameToUse = !isGenericDesc ? d : (c || d || 'Producto');
      if (/^producto\s+/i.test(nameToUse) && nameToUse.length > 9) {
        nameToUse = nameToUse.replace(/^producto\s+/i, '').trim();
      }

      if (nameToUse === nameToUse.toLowerCase() || (nameToUse === nameToUse.toUpperCase() && nameToUse.length > 3)) {
        nameToUse = nameToUse
          .split(' ')
          .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
          .join(' ');
      }
      return nameToUse;
    };

    interface PreviewGroup {
      cleanName: string;
      image: string;
      items: Product[];
      previousCodes: Set<string>;
      hadNameInCode: boolean;
      earliestTime: number;
    }

    const groups: PreviewGroup[] = [];

    products.forEach(p => {
      const pCode = normalize(p.codigo);
      const pDesc = normalize(p.descripcion);

      let match = groups.find(g => {
        const gName = normalize(g.cleanName);
        if (pDesc && gName === pDesc) return true;
        if (pCode && g.previousCodes.has(pCode)) return true;
        if (pCode && gName === pCode) return true;
        if (pDesc && g.previousCodes.has(pDesc)) return true;
        return false;
      });

      const pTime = (p.createdAt as any)?.toDate 
        ? (p.createdAt as any).toDate().getTime() 
        : new Date((p.createdAt as any) || 0).getTime();

      const hasName = isNameInCode(p.codigo);

      if (!match) {
        const cleanName = getCleanName(p.descripcion, p.codigo);
        match = {
          cleanName,
          image: p.imagenUrl || '',
          items: [],
          previousCodes: new Set(p.codigo ? [p.codigo] : []),
          hadNameInCode: hasName,
          earliestTime: isNaN(pTime) ? 0 : pTime
        };
        groups.push(match);
      } else {
        if (p.codigo) match.previousCodes.add(p.codigo);
        if (hasName) match.hadNameInCode = true;
        if (!match.image && p.imagenUrl) match.image = p.imagenUrl;
        if (pTime && (match.earliestTime === 0 || pTime < match.earliestTime)) {
          match.earliestTime = pTime;
        }
        if ((!match.cleanName || match.cleanName.startsWith('Producto')) && p.descripcion) {
          match.cleanName = getCleanName(p.descripcion, p.codigo);
        }
      }

      match.items.push(p);
    });

    // Stably sort: earliest created first, then alphabetical
    groups.sort((a, b) => {
      if (a.earliestTime && b.earliestTime && a.earliestTime !== b.earliestTime) {
        return a.earliestTime - b.earliestTime;
      }
      return a.cleanName.localeCompare(b.cleanName);
    });

    const cleanPrefix = (prefix || 'ART').trim().toUpperCase();
    const startNum = Math.max(1, Number(startNumber) || 1);

    return groups.map((g, idx) => {
      const codeNum = startNum + idx;
      const newCode = `${cleanPrefix}-${String(codeNum).padStart(4, '0')}`;
      const talles = Array.from(new Set(g.items.map(i => i.talle).filter(Boolean)));
      return {
        ...g,
        newCode,
        talles,
        oldCodePreview: Array.from(g.previousCodes).join(', ') || 'Sin código'
      };
    });
  }, [products, prefix, startNumber]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return previewGroups;
    const term = searchTerm.toLowerCase();
    return previewGroups.filter(g => 
      g.cleanName.toLowerCase().includes(term) ||
      g.newCode.toLowerCase().includes(term) ||
      g.oldCodePreview.toLowerCase().includes(term) ||
      g.talles.some(t => t?.toLowerCase().includes(term))
    );
  }, [previewGroups, searchTerm]);

  const totalNameInCodeGroups = useMemo(() => {
    return previewGroups.filter(g => g.hadNameInCode).length;
  }, [previewGroups]);

  const handleApply = async () => {
    if (previewGroups.length === 0) return;
    setIsProcessing(true);

    try {
      const cleanPrefix = (prefix || 'ART').trim().toUpperCase();
      const startNum = Math.max(1, Number(startNumber) || 1);

      const result = await inventoryService.reorganizeProductCodes({
        prefix: cleanPrefix,
        startNumber: startNum
      });

      toast.success(
        `¡Códigos reorganizados con éxito! ${result.totalUpdated} variantes asignadas a ${result.groupsCount} códigos correlativos.`
      );

      await onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al reorganizar códigos:', error);
      toast.error(error.message || 'Error al reorganizar los códigos de los productos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Organizador de Códigos Secuenciales"
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-5">
        {/* Info Header Banner */}
        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-start gap-3.5">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 shadow-sm">
            <Barcode size={22} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Patrón Correlativo Automático
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Corrige los artículos donde se ingresó el nombre en el código y les asigna códigos consecutivos siguiendo el formato <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">ART-0001, ART-0002...</span> Todos los talles y variantes del mismo producto compartirán el mismo código.
            </p>
            {totalNameInCodeGroups > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold">
                <AlertTriangle size={13} />
                Se detectaron {totalNameInCodeGroups} productos con nombres en el campo de código listos para corregir.
              </div>
            )}
          </div>
        </div>

        {/* Options / Customization Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5"
          >
            <Settings2 size={14} />
            {showSettings ? 'Ocultar ajustes de formato' : 'Configurar prefijo o número inicial'}
          </button>
          <span className="text-xs text-gray-500 font-medium">
            {previewGroups.length} productos ({products.length} registros/talles en total)
          </span>
        </div>

        {showSettings && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Prefijo de Código
              </label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="Ej: ART"
                className="font-mono uppercase text-xs"
              />
              <p className="text-[10px] text-gray-500">Ejemplo resultante: {prefix || 'ART'}-0001</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Comenzar desde el número
              </label>
              <Input
                type="number"
                min="1"
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-gray-500">Primer código: {prefix || 'ART'}-{String(startNumber).padStart(4, '0')}</p>
            </div>
          </div>
        )}

        {/* Search filter for preview */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar producto en la vista previa..."
            className="pl-9 text-xs"
          />
        </div>

        {/* Preview List */}
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
            Vista previa de la asignación ({filteredGroups.length} productos)
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 border border-gray-100 dark:border-gray-800 rounded-2xl p-2 bg-gray-50/50 dark:bg-gray-900/50">
            {filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No se encontraron productos con el filtro aplicado.
              </div>
            ) : (
              filteredGroups.map((group, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {group.image ? (
                      <img 
                        src={group.image} 
                        alt={group.cleanName} 
                        className="w-10 h-10 object-cover rounded-lg border border-gray-100 shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
                        <Layers size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                          {group.cleanName}
                        </span>
                        {group.hadNameInCode && (
                          <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 rounded text-[9px] font-bold shrink-0">
                            Nombre en código
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{group.items.length} {group.items.length === 1 ? 'talle/variante' : 'talles/variantes'}</span>
                        {group.talles.length > 0 && (
                          <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.2 rounded">
                            {group.talles.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Code Transition */}
                  <div className="flex items-center gap-2.5 shrink-0 text-right">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block line-through truncate max-w-[120px]">
                        {group.oldCodePreview}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-gray-400 shrink-0" />
                    <span className="font-mono font-bold text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 rounded-lg">
                      {group.newCode}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl text-xs font-bold"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={isProcessing || previewGroups.length === 0}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 px-5"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Actualizando {products.length} productos...
              </>
            ) : (
              <>
                <Wand2 size={14} className="mr-2" />
                Aplicar Códigos Secuenciales ({previewGroups.length})
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
