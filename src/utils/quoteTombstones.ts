/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Persistent tombstone key for sales quotes
const SALES_QUOTES_TOMBSTONES_KEY = 'deleted_quotes_tombstones_v1';
// Persistent tombstone key for repair quotes
const REPAIR_QUOTES_TOMBSTONES_KEY = 'deleted_repair_quotes_tombstones_v1';

export interface QuoteTombstone {
  id?: string;
  numero?: string;
  deletedAt: number;
}

/**
 * Get all deleted sales quote tombstones. Retains tombstones for 90 days.
 */
export function getDeletedQuoteTombstones(): QuoteTombstone[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SALES_QUOTES_TOMBSTONES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return list.filter(item => item && (item.deletedAt || 0) > cutoff);
    }
  } catch (e) {
    console.warn('Error reading quote tombstones:', e);
  }
  return [];
}

/**
 * Permanently mark a sales quote as deleted.
 */
export function markQuoteAsDeleted(id?: string, numero?: string): void {
  if (!id && !numero) return;
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const current = getDeletedQuoteTombstones();
    const cleanId = id?.trim();
    const cleanNum = numero?.trim();
    const normId = cleanId?.toLowerCase();
    const normNum = cleanNum?.toLowerCase();

    const exists = current.some(t => {
      const tId = t.id?.trim().toLowerCase();
      const tNum = t.numero?.trim().toLowerCase();
      return (
        (normId && (tId === normId || tNum === normId)) ||
        (normNum && (tNum === normNum || tId === normNum))
      );
    });

    if (!exists) {
      current.push({
        id: cleanId,
        numero: cleanNum,
        deletedAt: Date.now()
      });
      localStorage.setItem(SALES_QUOTES_TOMBSTONES_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.warn('Error saving quote tombstone:', e);
  }
}

/**
 * Remove a quote from tombstones (e.g. if freshly created).
 */
export function unmarkQuoteDeleted(id?: string, numero?: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const current = getDeletedQuoteTombstones();
    const cleanId = id?.trim().toLowerCase();
    const cleanNum = numero?.trim().toLowerCase();
    const filtered = current.filter(t => {
      const tId = t.id?.trim().toLowerCase();
      const tNum = t.numero?.trim().toLowerCase();
      if (cleanId && (tId === cleanId || tNum === cleanId)) return false;
      if (cleanNum && (tNum === cleanNum || tId === cleanNum)) return false;
      return true;
    });
    localStorage.setItem(SALES_QUOTES_TOMBSTONES_KEY, JSON.stringify(filtered));
  } catch (e) {}
}

/**
 * Check if a sales quote has been deleted.
 * Concreted / accepted quotes must never be treated as deleted.
 */
export function isQuoteDeleted(id?: string, numero?: string, estado?: string): boolean {
  if (estado === 'aceptada' || estado === 'aprobado') return false;
  if (!id && !numero) return false;
  const tombstones = getDeletedQuoteTombstones();
  if (tombstones.length === 0) return false;

  const normId = id?.trim().toLowerCase();
  const normNum = numero?.trim().toLowerCase();

  return tombstones.some(t => {
    const tId = t.id?.trim().toLowerCase();
    const tNum = t.numero?.trim().toLowerCase();
    if (normId && (tId === normId || tNum === normId)) return true;
    if (normNum && (tNum === normNum || tId === normNum)) return true;
    return false;
  });
}

/**
 * Filter an array of quotes, removing any deleted items.
 */
export function filterOutDeletedQuotes<T extends { id?: string; numero?: string; estado?: string }>(quotes: T[]): T[] {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const tombstones = getDeletedQuoteTombstones();
  if (tombstones.length === 0) return quotes;

  const deletedKeys = new Set<string>();
  tombstones.forEach(t => {
    if (t.id) deletedKeys.add(t.id.trim().toLowerCase());
    if (t.numero) deletedKeys.add(t.numero.trim().toLowerCase());
  });

  return quotes.filter(q => {
    if (!q) return false;
    // Concreted / accepted quotes must never be suppressed by stale conversion tombstones
    if (q.estado === 'aceptada' || q.estado === 'aprobado') return true;

    const qId = q.id?.trim().toLowerCase();
    const qNum = q.numero?.trim().toLowerCase();
    if (qId && deletedKeys.has(qId)) return false;
    if (qNum && deletedKeys.has(qNum)) return false;
    return true;
  });
}

/**
 * Thoroughly scrub a quote from all localStorage keys and caches.
 * CRITICAL: NEVER TOUCH THE TOMBSTONES STORAGE ITSELF!
 */
export function scrubQuoteFromLocalStorage(id?: string, numero?: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const cleanId = id?.trim();
  const cleanNum = numero?.trim();
  if (!cleanId && !cleanNum) return;

  const normCleanId = cleanId?.toLowerCase();
  const normCleanNum = cleanNum?.toLowerCase();

  const isMatch = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const itemId = item.id?.trim?.().toLowerCase();
    const itemNum = item.numero?.trim?.().toLowerCase();
    if (normCleanId && (itemId === normCleanId || itemNum === normCleanId)) return true;
    if (normCleanNum && (itemNum === normCleanNum || itemId === normCleanNum)) return true;
    return false;
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // PROTECT TOMBSTONES FROM BEING ERASED
      if (
        key === SALES_QUOTES_TOMBSTONES_KEY || 
        key === REPAIR_QUOTES_TOMBSTONES_KEY ||
        key.includes('tombstone')
      ) {
        continue;
      }

      // Inspect any key that might hold quote data
      if (
        key.includes('quote') || 
        key.includes('cotizac') || 
        key.includes('cached_') || 
        key.startsWith('sb_cache_') ||
        key === 'quotes'
      ) {
        try {
          const val = localStorage.getItem(key);
          if (val && (val.startsWith('[') || val.startsWith('{'))) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              const beforeCount = parsed.length;
              const filtered = parsed.filter(item => !isMatch(item));
              if (filtered.length !== beforeCount) {
                localStorage.setItem(key, JSON.stringify(filtered));
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Error scrubbing quote from local storage:', e);
  }
}

/**
 * --- REPAIR QUOTES (TALLER) ---
 */
export function getDeletedRepairQuoteTombstones(): QuoteTombstone[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(REPAIR_QUOTES_TOMBSTONES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return list.filter(item => item && (item.deletedAt || 0) > cutoff);
    }
  } catch (e) {}
  return [];
}

export function markRepairQuoteAsDeleted(id?: string, numero?: string): void {
  if (!id && !numero) return;
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const current = getDeletedRepairQuoteTombstones();
    const cleanId = id?.trim();
    const cleanNum = numero?.trim();
    const normId = cleanId?.toLowerCase();
    const normNum = cleanNum?.toLowerCase();

    const exists = current.some(t => {
      const tId = t.id?.trim().toLowerCase();
      const tNum = t.numero?.trim().toLowerCase();
      return (
        (normId && (tId === normId || tNum === normId)) ||
        (normNum && (tNum === normNum || tId === normNum))
      );
    });

    if (!exists) {
      current.push({
        id: cleanId,
        numero: cleanNum,
        deletedAt: Date.now()
      });
      localStorage.setItem(REPAIR_QUOTES_TOMBSTONES_KEY, JSON.stringify(current));
    }
  } catch (e) {}
}

export function unmarkRepairQuoteDeleted(id?: string, numero?: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const current = getDeletedRepairQuoteTombstones();
    const cleanId = id?.trim().toLowerCase();
    const cleanNum = numero?.trim().toLowerCase();
    const filtered = current.filter(t => {
      const tId = t.id?.trim().toLowerCase();
      const tNum = t.numero?.trim().toLowerCase();
      if (cleanId && (tId === cleanId || tNum === cleanId)) return false;
      if (cleanNum && (tNum === cleanNum || tId === cleanNum)) return false;
      return true;
    });
    localStorage.setItem(REPAIR_QUOTES_TOMBSTONES_KEY, JSON.stringify(filtered));
  } catch (e) {}
}

export function isRepairQuoteDeleted(id?: string, numero?: string, estado?: string): boolean {
  if (estado === 'aprobado' || estado === 'aceptada') return false;
  if (!id && !numero) return false;
  const tombstones = getDeletedRepairQuoteTombstones();
  if (tombstones.length === 0) return false;

  const normId = id?.trim().toLowerCase();
  const normNum = numero?.trim().toLowerCase();

  return tombstones.some(t => {
    const tId = t.id?.trim().toLowerCase();
    const tNum = t.numero?.trim().toLowerCase();
    if (normId && (tId === normId || tNum === normId)) return true;
    if (normNum && (tNum === normNum || tId === normNum)) return true;
    return false;
  });
}

export function filterOutDeletedRepairQuotes<T extends { id?: string; numero?: string; estado?: string }>(quotes: T[]): T[] {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const tombstones = getDeletedRepairQuoteTombstones();
  if (tombstones.length === 0) return quotes;

  const deletedKeys = new Set<string>();
  tombstones.forEach(t => {
    if (t.id) deletedKeys.add(t.id.trim().toLowerCase());
    if (t.numero) deletedKeys.add(t.numero.trim().toLowerCase());
  });

  return quotes.filter(q => {
    if (!q) return false;
    if (q.estado === 'aprobado' || q.estado === 'aceptada') return true;
    const qId = q.id?.trim().toLowerCase();
    const qNum = q.numero?.trim().toLowerCase();
    if (qId && deletedKeys.has(qId)) return false;
    if (qNum && deletedKeys.has(qNum)) return false;
    return true;
  });
}
