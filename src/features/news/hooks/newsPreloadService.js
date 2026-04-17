/**
 * newsPreloadService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Module-level singleton that pre-fetches the News collection in the background
 * as soon as the authenticated Dashboard mounts — BEFORE the user navigates to
 * the /news page.
 *
 * Architecture
 * ────────────
 *   ┌─────────────────────────────────────────────────────┐
 *   │  DashboardLayout mounts  →  startPreload() called   │
 *   │  (fires once, subsequent calls are no-ops)          │
 *   │                                                     │
 *   │  Phase 1: waits IDLE_DELAY ms, then fetches first   │
 *   │           50 docs → notifies subscribers            │
 *   │                                                     │
 *   │  Phase 2: fetches 200-doc chunks in background      │
 *   │           with CHUNK_INTERVAL ms gap between each   │
 *   │           to avoid competing with user interactions │
 *   │                                                     │
 *   │  useNews hook subscribes → gets cache immediately   │
 *   └─────────────────────────────────────────────────────┘
 *
 * Guarantees
 * ──────────
 *  • Zero overhead if the user goes straight to /news (useNews starts its own
 *    fetch which merges with the singleton).
 *  • Zero duplicate requests: if preload is complete, useNews reads from cache
 *    and never touches Firestore.
 *  • No lag: idle delay + chunk intervals keep network bursts away from UI
 *    paint frames. requestIdleCallback is used where available.
 *  • Memory safe: only one Map is ever allocated.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import { getLocalizedStr, toDate } from 'features/news/hooks/useNews';

// ─────────────────────────────────────────────────────────────────────────────
//  Tuning knobs
// ─────────────────────────────────────────────────────────────────────────────
const IDLE_DELAY     = 2000;  // ms to wait before first fetch (let UI paint settle)
const FIRST_PAGE     = 50;    // docs to fetch in the initial burst
const CHUNK_SIZE     = 200;   // background chunk size
const CHUNK_INTERVAL = 100;   // ms between background chunks (breathing room for UI)

// ─────────────────────────────────────────────────────────────────────────────
//  Module-level state  (lives for the lifetime of the browser tab)
// ─────────────────────────────────────────────────────────────────────────────
let _cache       = new Map();   // id → mapped doc
let _started     = false;       // has startPreload() been called?
let _allLoaded   = false;       // has the full collection been fetched?
let _totalLoaded = 0;

/** Stable sorted array — only rebuilt when _notify() is called. */
let _cachedSnapshot = [];

/** Set of subscriber callbacks: () => void */
const _subscribers = new Set();

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
function _mapDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    _headlineDisplay :
      getLocalizedStr(data.headline) || '',
    _sourceNameDisplay :
      getLocalizedStr(data.newsSource?.company) ||
      data.newsSource?.companyName || '',
    _dateDisplay : toDate(data.date),
    _docSnap     : docSnap,
  };
}

const _byDateDesc = (a, b) => {
  const ta = a._dateDisplay?.getTime() ?? 0;
  const tb = b._dateDisplay?.getTime() ?? 0;
  return tb - ta;
};

function _notify() {
  // Rebuild the stable snapshot ONCE per notification, not per render.
  _cachedSnapshot = [..._cache.values()].sort(_byDateDesc);
  _subscribers.forEach(cb => cb());
}

function _idle(ms) {
  return new Promise(resolve => {
    if (typeof requestIdleCallback !== 'undefined') {
      // Native idle callback — runs when the browser has spare cycles
      requestIdleCallback(() => setTimeout(resolve, ms), { timeout: ms + 2000 });
    } else {
      setTimeout(resolve, ms);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kick off the background prefetch.
 * Safe to call multiple times — only the first call has any effect.
 */
export async function startPreload() {
  if (_started) return;
  _started = true;

  // Wait for the initial page paint to fully settle before touching Firestore.
  await _idle(IDLE_DELAY);

  const newsCol = collection(db, 'News');
  let useOrdering = true;
  let firstSnap;

  // ── Phase 1: First page ────────────────────────────────────────────────────
  try {
    const q = query(newsCol, orderBy('date', 'desc'), limit(FIRST_PAGE));
    firstSnap = await getDocs(q);
  } catch (_err) {
    // orderBy failed (index missing) — fall back to unordered
    useOrdering = false;
    try {
      firstSnap = await getDocs(query(newsCol, limit(FIRST_PAGE)));
    } catch (err2) {
      console.warn('[newsPreload] First page error:', err2?.message);
      return; // Give up gracefully — useNews will handle its own fetch
    }
  }

  firstSnap.docs.forEach(d => _cache.set(d.id, _mapDoc(d)));
  _totalLoaded = _cache.size;
  _notify();

  if (firstSnap.docs.length < FIRST_PAGE) {
    _allLoaded = true;
    _notify();
    return;
  }

  // ── Phase 2: Background chunks ─────────────────────────────────────────────
  let lastDocSnap = firstSnap.docs[firstSnap.docs.length - 1];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Yield to the event loop between every chunk
    await _idle(CHUNK_INTERVAL);

    let nextSnap;
    try {
      const q = useOrdering
        ? query(newsCol, orderBy('date', 'desc'), startAfter(lastDocSnap), limit(CHUNK_SIZE))
        : query(newsCol, startAfter(lastDocSnap), limit(CHUNK_SIZE));
      nextSnap = await getDocs(q);
    } catch (err) {
      console.warn('[newsPreload] Chunk error:', err?.message);
      break;
    }

    nextSnap.docs.forEach(d => _cache.set(d.id, _mapDoc(d)));
    _totalLoaded = _cache.size;
    _notify();

    if (nextSnap.docs.length < CHUNK_SIZE) {
      _allLoaded = true;
      _notify();
      break;
    }

    lastDocSnap = nextSnap.docs[nextSnap.docs.length - 1];
  }
}

/**
 * Subscribe to cache updates. Returns an unsubscribe function.
 * Useful for `useSyncExternalStore` pattern used in useNews.
 */
export function subscribe(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

/**
 * Get a stable sorted snapshot of the current cache.
 * This function returns the SAME array reference until the next _notify() call,
 * which is required by useSyncExternalStore to avoid infinite render loops.
 */
export function getSnapshot() {
  return _cachedSnapshot;
}

/**
 * Returns the current cache Map (for O(1) lookups by id).
 */
export function getCacheMap() {
  return _cache;
}

/** Whether all docs have been fetched */
export function isAllLoaded() {
  return _allLoaded;
}

/** Whether the preload has been started */
export function isStarted() {
  return _started;
}

/** Total docs currently in cache */
export function getTotalLoaded() {
  return _totalLoaded;
}

/**
 * Mutate the cache directly (for optimistic delete/approve from useNews).
 * Calls subscribers after.
 */
export function updateCacheDoc(id, patch) {
  const existing = _cache.get(id);
  if (existing) {
    _cache.set(id, { ...existing, ...patch });
    _notify();
  }
}

export function deleteCacheDoc(id) {
  if (_cache.has(id)) {
    _cache.delete(id);
    _totalLoaded = _cache.size;
    _notify();
  }
}
