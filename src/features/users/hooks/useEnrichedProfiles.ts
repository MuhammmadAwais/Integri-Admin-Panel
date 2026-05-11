/**
 * useEnrichedProfiles — Lazy Firebase Profile Enrichment Hook
 *
 * Fetches Firestore `Users/{uid}` documents ONLY for the UIDs passed in,
 * then caches the result in React Query so back-navigation is instant
 * (zero extra Firestore reads for already-visited pages).
 *
 * All strings from Firestore are sanitized with DOMPurify before being
 * returned to prevent XSS from malicious Firestore content.
 */

import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import DOMPurify from 'dompurify';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FirebaseProfile {
  id: string;
  name: string;
  avatar: string | null;
  country: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Sanitize any untrusted string from Firestore. */
const safe = (val: unknown): string =>
  typeof val === 'string' ? DOMPurify.sanitize(val.trim()) : '';

/**
 * Resolve avatar URL from any of the known Firestore field aliases
 * the app may use, then sanitize it.
 */
const resolveAvatar = (data: Record<string, unknown>): string | null => {
  const raw =
    data.avatar ??
    data.profileImage ??
    data.profile_image ??
    data.photoURL ??
    null;
  if (!raw) return null;
  const sanitized = safe(raw);
  // Reject data-URIs (potential XSS vector) and keep only http(s)
  return sanitized.startsWith('http') ? sanitized : null;
};

// ─── Core fetcher (called by React Query) ───────────────────────────────────

async function fetchFirebaseProfiles(
  uids: string[]
): Promise<Map<string, FirebaseProfile>> {
  const settled = await Promise.allSettled(
    uids.map((uid) => getDoc(doc(db, 'Users', uid)))
  );

  const map = new Map<string, FirebaseProfile>();

  settled.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const snap = result.value;
    if (!snap.exists()) return;

    const data = snap.data() as Record<string, unknown>;
    map.set(uids[i], {
      id: uids[i],
      name: safe(data.name) || 'Guest',
      avatar: resolveAvatar(data),
      country: safe(data.country) || 'Unknown',
    });
  });

  return map;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Accepts the 25 UIDs on the current page.
 * Returns a stable Map of uid → FirebaseProfile and an isLoading flag.
 *
 * Cache key is derived from the SORTED uid list so that the same set of
 * users always hits the same cache entry regardless of row order.
 */
export function useEnrichedProfiles(uids: string[]): {
  profileMap: Map<string, FirebaseProfile>;
  isLoading: boolean;
} {
  // Sort UIDs for a stable, order-independent cache key
  const cacheKey = [...uids].sort().join('|');

  const { data, isLoading } = useQuery<Map<string, FirebaseProfile>>({
    queryKey: ['fbProfiles', cacheKey],
    queryFn: () => fetchFirebaseProfiles(uids),
    enabled: uids.length > 0,
    staleTime: 10 * 60 * 1000,  // 10 min — profiles rarely change
    gcTime: 30 * 60 * 1000,     // keep in memory 30 min after unmount
  });

  return {
    profileMap: data ?? new Map<string, FirebaseProfile>(),
    isLoading: uids.length > 0 ? isLoading : false,
  };
}
