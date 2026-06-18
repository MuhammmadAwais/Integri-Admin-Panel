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

import { useQueries } from '@tanstack/react-query';
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

async function fetchFirebaseProfile(
  uid: string
): Promise<FirebaseProfile | null> {
  if (!uid || uid.includes('@firebase_placeholder')) return null;
  try {
    const snap = await getDoc(doc(db, 'Users', uid));
    if (!snap.exists()) return null;

    const data = snap.data() as Record<string, unknown>;
    return {
      id: uid,
      name: safe(data.name) || 'Guest',
      avatar: resolveAvatar(data),
      country: safe(data.country) || 'Unknown',
    };
  } catch (error) {
    console.error(`❌ [useEnrichedProfiles] Error fetching Firestore profile for ${uid}:`, error);
    return null;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Accepts the UIDs on the current page.
 * Returns a stable Map of uid → FirebaseProfile, an isLoading flag,
 * and a loadingMap for fine-grained row loading states.
 */
export function useEnrichedProfiles(uids: string[]): {
  profileMap: Map<string, FirebaseProfile>;
  isLoading: boolean;
  loadingMap: Map<string, boolean>;
} {
  const results = useQueries({
    queries: uids.map((uid) => ({
      queryKey: ['fbProfile', uid],
      queryFn: () => fetchFirebaseProfile(uid),
      enabled: !!uid && !uid.includes('@firebase_placeholder'),
      staleTime: 10 * 60 * 1000,  // 10 min — profiles rarely change
      gcTime: 30 * 60 * 1000,     // keep in memory 30 min after unmount
    })),
  });

  const profileMap = new Map<string, FirebaseProfile>();
  const loadingMap = new Map<string, boolean>();
  let isLoading = false;

  results.forEach((res, idx) => {
    const uid = uids[idx];
    if (!uid) return;

    const isSearchable = !uid.includes('@firebase_placeholder');
    const isUidLoading = isSearchable && res.isLoading;

    if (isUidLoading) {
      isLoading = true;
      loadingMap.set(uid, true);
    } else {
      loadingMap.set(uid, false);
    }

    if (res.data) {
      profileMap.set(uid, res.data);
    }
  });

  return {
    profileMap,
    isLoading,
    loadingMap,
  };
}
