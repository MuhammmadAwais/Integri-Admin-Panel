import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

// Singleton prefetch service — started in DashboardLayout
import {
  subscribe       as preloadSubscribe,
  getSnapshot     as preloadSnapshot,
  isAllLoaded,
  isStarted,
  getTotalLoaded  as preloadTotal,
  startPreload,
  updateCacheDoc,
  deleteCacheDoc,
} from './newsPreloadService';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS  (re-exported so NewsDetailPage / NewsEditorPage can reuse them)
// ─────────────────────────────────────────────────────────────────────────────

export function getLocalizedStr(field, fallback = '') {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field['en'] ?? field['ar'] ?? Object.values(field)[0] ?? fallback;
  }
  return fallback;
}

export function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  try { return new Date(value); } catch (_) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
//  useNews — subscribes to the singleton newsPreloadService cache
//
//  Flow:
//  1. Mount → read current snapshot immediately (may already have data)
//  2. Subscribe → every time the service fetches a new chunk, we get notified
//                 and update local state
//  3. If service hasn't started (edge case), kick startPreload() now
//  4. All CRUD goes through the service's cache → instant optimistic UI
// ══════════════════════════════════════════════════════════════════════════════
export function useNews() {
  // Seed from whatever the singleton already has (may be non-empty if
  // DashboardLayout triggered preload before user navigated here)
  const [news, setNews]               = useState(() => preloadSnapshot());
  const [loading, setLoading]         = useState(() => preloadSnapshot().length === 0);
  const [loadingMore, setLoadingMore] = useState(() => isStarted() && !isAllLoaded());
  const [allLoaded, setAllLoaded]     = useState(() => isAllLoaded());
  const [totalLoaded, setTotalLoaded] = useState(() => preloadTotal());
  const [searchTerm, setSearchTerm]   = useState('');

  // ── Subscribe to preload updates ──────────────────────────────────────────
  useEffect(() => {
    // If somehow the preload wasn't kicked yet, start it now as a fallback
    if (!isStarted()) {
      startPreload();
    }

    const unsub = preloadSubscribe(() => {
      const snap  = preloadSnapshot();
      const count = preloadTotal();
      const done  = isAllLoaded();

      setNews(snap);
      setTotalLoaded(count);

      if (count > 0)   setLoading(false);
      if (done) {
        setAllLoaded(true);
        setLoadingMore(false);
      } else if (count > 0) {
        setLoadingMore(true);
      }
    });

    // Also sync immediately in case preload progressed while we weren't mounted
    const snap  = preloadSnapshot();
    const count = preloadTotal();
    const done  = isAllLoaded();

    if (snap.length > 0) {
      setNews(snap);
      setTotalLoaded(count);
      setLoading(false);
    }
    if (done) {
      setAllLoaded(true);
      setLoadingMore(false);
    } else if (count > 0) {
      setLoadingMore(true);
    }

    return unsub;
  }, []);

  // ── CRUD — optimistic via singleton cache ─────────────────────────────────

  const deleteNews = useCallback(async (id) => {
    deleteCacheDoc(id); // removes from cache + notifies all subscribers instantly
    try {
      await deleteDoc(doc(db, 'News', id));
    } catch (error) {
      console.error('[useNews] deleteNews error:', error);
      throw error;
    }
  }, []);

  const updateStatus = useCallback(async (id, newStatus) => {
    updateCacheDoc(id, { status: newStatus }); // optimistic update
    try {
      await updateDoc(doc(db, 'News', id), { status: newStatus });
    } catch (error) {
      console.error('[useNews] updateStatus error:', error);
      throw error;
    }
  }, []);

  const approveNews = useCallback(async (id) => {
    return updateStatus(id, 'Approved');
  }, [updateStatus]);

  // ── Tab filtering (mirrors Flutter: General / Others / Pending) ───────────
  const filterByTab = useCallback((tab) => {
    switch (tab) {
      case 'General':
        return news.filter(n => n.addToGeneralTopic === true);
      case 'Others':
        return news.filter(n => n.addToGeneralTopic === false);
      case 'Pending':
        return news.filter(n => n.status === 'Pending');
      case 'All':
      default:
        return news;
    }
  }, [news]);

  // ── Instant client-side search across all cached docs ────────────────────
  const filterBySearch = useCallback((items) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(n => {
      const headline  = (n._headlineDisplay   || '').toLowerCase();
      const topic     = (n.topic              || '').toLowerCase();
      const source    = (n._sourceNameDisplay || '').toLowerCase();
      const tags      = (n.tags      || []).some(t => t.toLowerCase().includes(q));
      const countries = (n.forCountries || []).some(c => c.toLowerCase().includes(q));
      return headline.includes(q) || topic.includes(q) || source.includes(q) || tags || countries;
    });
  }, [searchTerm]);

  return {
    allNews: news,
    loading,
    loadingMore,
    totalLoaded,
    allLoaded,
    searchTerm,
    setSearchTerm,
    filterByTab,
    filterBySearch,
    deleteNews,
    updateStatus,
    approveNews,
    getLocalizedStr,
    toDate,
  };
}
