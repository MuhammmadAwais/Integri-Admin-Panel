import { useCallback, useRef, useState, useEffect } from 'react';
import {
  NewsService,
  tokenReadyPromise,
  type ArticleSummary,
  type AdminCountriesResponse,
  type CountryDetails,
} from 'api/backendApi';
import useSWR, { mutate } from 'swr';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getLocalizedStr(
  field: Record<string, string | undefined> | string | undefined | null | any,
  fallback = ''
): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    const candidate = field['en'] ?? field['de'] ?? field['ar'] ?? Object.values(field).find(v => typeof v === 'string');
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = candidate['en'] ?? candidate['de'] ?? candidate['ar'] ?? Object.values(candidate).find(v => typeof v === 'string');
      if (typeof nested === 'string') return nested;
    }
  }
  return fallback;
}

/** Parse an ISO date string to a Date, returning null on failure */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseAdminNewsReturn {
  articles: ArticleSummary[];
  loading: boolean;
  error: string | null;
  total: number;

  days: number;
  setDays: (v: number) => void;
  country: string | null;
  setCountry: (v: string | null) => void;

  countries: Record<string, CountryDetails>;
  countriesLoading: boolean;

  /** 'waiting' | 'ready' | 'failed' — current state of backend auth token */
  tokenStatus: 'waiting' | 'ready' | 'failed';

  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Persistence — Module-level state survives route changes within the same session
// ─────────────────────────────────────────────────────────────────────────────
let PERSISTENT_DAYS = 7;
let PERSISTENT_COUNTRY: string | null = 'Germany';

export function useAdminNews(): UseAdminNewsReturn {
  const [days, setDaysRaw] = useState(PERSISTENT_DAYS);
  const [country, setCountryRaw] = useState<string | null>(PERSISTENT_COUNTRY);
  const [committedDays, setCommittedDays] = useState(PERSISTENT_DAYS);
  const daysDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Token readiness gate ─────────────────────────────────────────────────
  const [tokenStatus, setTokenStatus] = useState<'waiting' | 'ready' | 'failed'>(
    localStorage.getItem('integri_jwt') ? 'ready' : 'waiting'
  );

  useEffect(() => {
    if (tokenStatus === 'ready') {
      console.log('✅ [useAdminNews] Token already present — fetches can start immediately.');
      return;
    }
    console.log('⏳ [useAdminNews] Waiting for backend token before firing news requests...');
    let cancelled = false;
    tokenReadyPromise
      .then((token) => {
        if (cancelled) return;
        if (token) {
          console.log('🟢 [useAdminNews] Token ready — news fetches will now start.', token.slice(0, 24) + '…');
          setTokenStatus('ready');
        } else {
          console.warn('⚠️ [useAdminNews] tokenReadyPromise resolved but returned null.');
          setTokenStatus('failed');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('❌ [useAdminNews] Token generation failed:', err);
        setTokenStatus('failed');
      });
    return () => { cancelled = true; };
  }, []);

  // ── Countries list (fetched via standard React lifecycle) ────────────────
  const [countries, setCountries] = useState<Record<string, CountryDetails>>({});
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    // Wait for token before fetching countries too
    if (tokenStatus !== 'ready') return;
    let cancelled = false;
    console.log('🌍 [useAdminNews] Fetching admin countries...');
    NewsService.fetchAdminCountries()
      .then((res) => {
        if (!cancelled) {
          console.log('🟢 [useAdminNews] Countries loaded:', Object.keys(res.supported_countries || {}).length, 'countries');
          setCountries(res.supported_countries || {});
        }
      })
      .catch((err) => {
        console.error('❌ [useAdminNews] Failed to load admin countries:', err);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => { cancelled = true; };
  }, [tokenStatus]);

  // ── Articles list (cached globally by SWR) ───────────────────────────────
  // IMPORTANT: SWR v2 disables fetching when ANY element of the key array is
  // null/undefined. Since `country` is null when no filter is selected, we
  // use '' as a sentinel for "All Countries" so the key is always valid.
  // The whole key is set to null (disabled) only while the token is not ready.
  const swrCountryKey = country ?? '';
  const cacheKey = tokenStatus === 'ready'
    ? ['admin-articles', swrCountryKey, committedDays]
    : null;

  const {
    data: articlesData,
    error: swrError,
    isValidating: loading,
    mutate: mutateArticles
  } = useSWR(
    cacheKey,
    // Simple closure fetcher — avoids fragile destructured-key patterns.
    // country / committedDays come from the closed-over scope, not from the key.
    async () => {
      console.log(`📰 [SWR] Fetching admin articles — country: ${country ?? 'ALL'}, days: ${committedDays}`);
      const result = await NewsService.fetchAdminArticles(country, committedDays);
      console.log(`✅ [SWR] Articles received — total: ${result.total}, articles in array: ${result.articles?.length ?? 0}`);
      return result;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  const articles = articlesData?.articles || [];
  const total = articlesData?.total || 0;
  const error = swrError ? (swrError.message || 'Failed to fetch articles') : null;

  // ── Prune SWR memory cache on unmount only ────────────────────────────────
  // IMPORTANT: dependency array is intentionally empty so this only runs on
  // unmount. Using cacheKey in deps would wipe data every time the key changes
  // (e.g. token becoming ready), erasing freshly fetched articles.
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;
  useEffect(() => {
    return () => {
      if (cacheKeyRef.current) {
        mutate(cacheKeyRef.current, undefined, { revalidate: false });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Setters ───────────────────────────────────────────────────────────────

  const setDays = useCallback((v: number) => {
    const clamped = Math.max(1, Math.min(3650, v));
    PERSISTENT_DAYS = clamped;
    setDaysRaw(clamped);
    if (daysDebounceRef.current) clearTimeout(daysDebounceRef.current);
    daysDebounceRef.current = setTimeout(() => {
      setCommittedDays(clamped);
    }, 500);
  }, []);

  const setCountry = useCallback((v: string | null) => {
    PERSISTENT_COUNTRY = v;
    setCountryRaw(v);
  }, []);

  return {
    articles,
    loading: loading || tokenStatus === 'waiting',
    error,
    total,
    days,
    setDays,
    country,
    setCountry,
    countries,
    countriesLoading,
    tokenStatus,
    refetch: () => mutateArticles(),
  };
}
