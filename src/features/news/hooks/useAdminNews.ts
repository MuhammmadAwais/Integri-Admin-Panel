import { useCallback, useRef, useState, useEffect } from 'react';
import {
  NewsService,
  type ArticleSummary,
  type AdminCountriesResponse,
  type CountryDetails,
} from 'api/backendApi';
import useSWR, { mutate } from 'swr';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safely extract the English string from a LocalizedString map or plain string */
export function getLocalizedStr(
  field: Record<string, string | undefined> | string | undefined | null,
  fallback = ''
): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  return field['en'] ?? field['de'] ?? Object.values(field)[0] ?? fallback;
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

  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Persistence — Module-level state survives route changes within the same session
// ─────────────────────────────────────────────────────────────────────────────
let PERSISTENT_DAYS = 7;
let PERSISTENT_COUNTRY: string | null = null;

export function useAdminNews(): UseAdminNewsReturn {
  const [days, setDaysRaw] = useState(PERSISTENT_DAYS);
  const [country, setCountryRaw] = useState<string | null>(PERSISTENT_COUNTRY);
  const [committedDays, setCommittedDays] = useState(PERSISTENT_DAYS);
  const daysDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Countries list (fetched via standard React lifecycle) ────────────────
  const [countries, setCountries] = useState<Record<string, CountryDetails>>({});
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    NewsService.fetchAdminCountries()
      .then((res) => {
        if (!cancelled) setCountries(res.supported_countries || {});
      })
      .catch((err) => {
        console.error('Failed to load admin countries:', err);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Articles list (cached globally by SWR) ───────────────────────────────
  const cacheKey = ['admin-articles', country, committedDays];
  const {
    data: articlesData,
    error: swrError,
    isValidating: loading,
    mutate: mutateArticles
  } = useSWR(cacheKey, () => NewsService.fetchAdminArticles(country, committedDays), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false, // This is key: don't refetch on mount if we have data
  });

  const articles = articlesData?.articles || [];
  const total = articlesData?.total || 0;
  const error = swrError ? (swrError.message || 'Failed to fetch articles') : null;

  // ── Setters ───────────────────────────────────────────────────────────────

  const setDays = useCallback((v: number) => {
    const clamped = Math.max(1, Math.min(90, v));
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
    loading,
    error,
    total,
    days,
    setDays,
    country,
    setCountry,
    countries,
    countriesLoading,
    refetch: () => mutateArticles(),
  };
}
