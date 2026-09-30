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

    const exists = current.some(t => 
      (cleanId && t.id === cleanId) || 
      (cleanNum && t.numero === cleanNum)
    );

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
    const cleanId = id?.trim();
    const cleanNum = numero?.trim();
    const filtered = current.filter(t => 
      (!cleanId || t.id !== cleanId) && 
      (!cleanNum || t.numero !== cleanNum)
    );
    localStorage.setItem(SALES_QUOTES_TOMBSTONES_KEY, JSON.stringify(filtered));
  } catch (e) {}
}

/**
 * Check if a sales quote has been deleted.
 */
export function isQuoteDeleted(id?: string, numero?: string): boolean {
  if (!id && !numero) return false;
  const tombstones = getDeletedQuoteTombstones();
  const cleanId = id?.trim();
  const cleanNum = numero?.trim();

  return tombstones.some(t => {
    if (cleanId && t.id && t.id === cleanId) return true;
    if (cleanNum && t.numero && t.numero === cleanNum) return true;
    // Cross match in case id was stored as numero
    if (cleanId && t.numero && t.numero === cleanId) return true;
    if (cleanNum && t.id && t.id === cleanNum) return true;
    return false;
  });
}

/**
 * Filter an array of quotes, removing any deleted items.
 */
export function filterOutDeletedQuotes<T extends { id?: string; numero?: string }>(quotes: T[]): T[] {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const tombstones = getDeletedQuoteTombstones();
  if (tombstones.length === 0) return quotes;

  const deletedIds = new Set<string>();
  const deletedNumeros = new Set<string>();

  tombstones.forEach(t => {
    if (t.id) {
      deletedIds.add(t.id);
      deletedNumeros.add(t.id);
    }
    if (t.numero) {
      deletedNumeros.add(t.numero);
      deletedIds.add(t.numero);
    }
  });

  return quotes.filter(q => {
    if (!q) return false;
    const qId = q.id?.trim();
    const qNum = q.numero?.trim();
    if (qId && (deletedIds.has(qId) || deletedNumeros.has(qId))) return false;
    if (qNum && (deletedNumeros.has(qNum) || deletedIds.has(qNum))) return false;
    return true;
  });
}

/**
 * Thoroughly scrub a quote from all localStorage keys and caches.
 */
export function scrubQuoteFromLocalStorage(id?: string, numero?: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const cleanId = id?.trim();
  const cleanNum = numero?.trim();
  if (!cleanId && !cleanNum) return;

  const isMatch = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const itemId = item.id?.trim?.();
    const itemNum = item.numero?.trim?.();
    if (cleanId && (itemId === cleanId || itemNum === cleanId)) return true;
    if (cleanNum && (itemNum === cleanNum || itemId === cleanNum)) return true;
    return false;
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
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

    const exists = current.some(t => 
      (cleanId && t.id === cleanId) || 
      (cleanNum && t.numero === cleanNum)
    );

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

export function isRepairQuoteDeleted(id?: string, numero?: string): boolean {
  if (!id && !numero) return false;
  const tombstones = getDeletedRepairQuoteTombstones();
  const cleanId = id?.trim();
  const cleanNum = numero?.trim();

  return tombstones.some(t => {
    if (cleanId && t.id && t.id === cleanId) return true;
    if (cleanNum && t.numero && t.numero === cleanNum) return true;
    if (cleanId && t.numero && t.numero === cleanId) return true;
    if (cleanNum && t.id && t.id === cleanNum) return true;
    return false;
  });
}

export function filterOutDeletedRepairQuotes<T extends { id?: string; numero?: string }>(quotes: T[]): T[] {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const tombstones = getDeletedRepairQuoteTombstones();
  if (tombstones.length === 0) return quotes;

  return quotes.filter(q => {
    if (!q) return false;
    return !isRepairQuoteDeleted(q.id, q.numero);
  });
}
