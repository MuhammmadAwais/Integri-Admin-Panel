import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const FIRST_PAGE_SIZE = 50;   // Shown in < 500ms
const CHUNK_SIZE      = 200;  // Background pages

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS  (exported so NewsDetailPage / NewsEditorPage can reuse them)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely extracts the English (or Arabic fallback) string from a multilingual
 * map field stored in Firestore as {en: "...", ar: "..."}.
 * Also handles legacy plain-string fields.
 */
export function getLocalizedStr(field, fallback = '') {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field['en'] ?? field['ar'] ?? Object.values(field)[0] ?? fallback;
  }
  return fallback;
}

/**
 * Converts a Firestore Timestamp, JS Date, or ISO string to a JS Date.
 */
export function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  try { return new Date(value); } catch (_) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal: map a Firestore DocumentSnapshot to a display-ready object
// ─────────────────────────────────────────────────────────────────────────────
function mapDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    _headlineDisplay:
      getLocalizedStr(data.headline) || '',
    _sourceNameDisplay:
      getLocalizedStr(data.newsSource?.company) ||
      data.newsSource?.companyName || '',
    _dateDisplay: toDate(data.date),
    _docSnap: docSnap, // keep for startAfter cursor
  };
}

// Sort newest-first by _dateDisplay
const byDateDesc = (a, b) => {
  const ta = a._dateDisplay?.getTime() ?? 0;
  const tb = b._dateDisplay?.getTime() ?? 0;
  return tb - ta;
};

// ══════════════════════════════════════════════════════════════════════════════
//  useNews — Progressive paginated load
//
//  Strategy:
//    1. getDocs(limit 50) → render instantly
//    2. Background: getDocs in chunks of 200 using startAfter cursor
//    3. All search / tab-filter / sort is client-side on cached data
//    4. Delete / Approve / UpdateStatus mutate local cache immediately
// ══════════════════════════════════════════════════════════════════════════════
export function useNews() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [news, setNews]           = useState([]);
  const [loading, setLoading]     = useState(true);      // first page loading
  const [loadingMore, setLoadingMore] = useState(false); // bg pages loading
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Internal cache: Map<id, mappedDoc>  — source of truth
  const cacheRef    = useRef(new Map());
  // Cancellation flag for async loops
  const cancelRef   = useRef(false);

  // ── Rebuild the news[] state from the cache (sorted) ──────────────────────
  const rebuildList = useCallback(() => {
    const sorted = [...cacheRef.current.values()].sort(byDateDesc);
    setNews(sorted);
    setTotalLoaded(sorted.length);
  }, []);

  // ── Main load effect ───────────────────────────────────────────────────────
  useEffect(() => {
    cancelRef.current = false;
    cacheRef.current.clear();

    const newsCol = collection(db, 'News');

    const load = async () => {
      // ── Phase 1: First page — show something FAST ──────────────────────────
      let useOrdering = true;
      let firstSnap;

      try {
        const firstQ = query(
          newsCol,
          orderBy('date', 'desc'),
          limit(FIRST_PAGE_SIZE)
        );
        firstSnap = await getDocs(firstQ);
      } catch (indexErr) {
        // Firestore might not have the single-field index yet — fall back to
        // unordered fetch and sort client-side.
        console.warn('[useNews] orderBy("date") failed, falling back to unordered:', indexErr?.message);
        useOrdering = false;
        try {
          const fallbackQ = query(newsCol, limit(FIRST_PAGE_SIZE));
          firstSnap = await getDocs(fallbackQ);
        } catch (err2) {
          console.error('[useNews] First page failed:', err2);
          setLoading(false);
          return;
        }
      }

      if (cancelRef.current) return;

      // Populate cache with first page
      firstSnap.docs.forEach(d => cacheRef.current.set(d.id, mapDoc(d)));
      rebuildList();
      setLoading(false);

      // If the whole collection fits in the first page, we're done
      if (firstSnap.docs.length < FIRST_PAGE_SIZE) {
        setAllLoaded(true);
        return;
      }

      // ── Phase 2: Background — keep fetching until all docs loaded ──────────
      setLoadingMore(true);
      let lastDocSnap = firstSnap.docs[firstSnap.docs.length - 1];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelRef.current) break;

        let nextSnap;
        try {
          let nextQ;
          if (useOrdering) {
            nextQ = query(
              newsCol,
              orderBy('date', 'desc'),
              startAfter(lastDocSnap),
              limit(CHUNK_SIZE)
            );
          } else {
            // Without orderBy, Firestore paginates by document ID (implicit __name__ order)
            nextQ = query(newsCol, startAfter(lastDocSnap), limit(CHUNK_SIZE));
          }
          nextSnap = await getDocs(nextQ);
        } catch (err) {
          console.error('[useNews] Chunk fetch failed:', err);
          break;
        }

        if (cancelRef.current) break;

        nextSnap.docs.forEach(d => cacheRef.current.set(d.id, mapDoc(d)));
        rebuildList();

        // All pages consumed
        if (nextSnap.docs.length < CHUNK_SIZE) {
          setAllLoaded(true);
          setLoadingMore(false);
          break;
        }

        lastDocSnap = nextSnap.docs[nextSnap.docs.length - 1];

        // Yield to the event loop so the UI stays responsive between chunks
        await new Promise(r => setTimeout(r, 30));
      }

      setLoadingMore(false);
    };

    load();

    return () => {
      cancelRef.current = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CRUD — all mutate the local cache immediately, no re-fetch ─────────────

  const deleteNews = useCallback(async (id) => {
    // Optimistic: remove from cache right away
    cacheRef.current.delete(id);
    rebuildList();
    try {
      await deleteDoc(doc(db, 'News', id));
    } catch (error) {
      console.error('[useNews] deleteNews error:', error);
      throw error;
    }
  }, [rebuildList]);

  const updateStatus = useCallback(async (id, newStatus) => {
    // Optimistic update
    const existing = cacheRef.current.get(id);
    if (existing) {
      cacheRef.current.set(id, { ...existing, status: newStatus });
      rebuildList();
    }
    try {
      await updateDoc(doc(db, 'News', id), { status: newStatus });
    } catch (error) {
      console.error('[useNews] updateStatus error:', error);
      // Rollback on failure
      if (existing) { cacheRef.current.set(id, existing); rebuildList(); }
      throw error;
    }
  }, [rebuildList]);

  const approveNews = useCallback(async (id) => {
    return updateStatus(id, 'Approved');
  }, [updateStatus]);

  // ── Tab filtering (mirrors Flutter: General / Others / Pending / All) ──────
  const filterByTab = useCallback((tab) => {
    const now = new Date();
    switch (tab) {
      case 'General':
        return news.filter(n => n.addToGeneralTopic === true);
      case 'Others':
        return news.filter(n => n.addToGeneralTopic === false);
      case 'Pending':
        return news.filter(n => {
          const d = n._dateDisplay;
          return n.status === 'Pending'; // && d && d > now;
        });
      case 'All':
      default:
        return news;
    }
  }, [news]);

  // ── Client-side full-text search ───────────────────────────────────────────
  // Runs on ALL loaded docs — instant because everything is in memory
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

  // ── Exposed API ────────────────────────────────────────────────────────────
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
    // Utilities re-exported for other components
    getLocalizedStr,
    toDate,
  };
}
