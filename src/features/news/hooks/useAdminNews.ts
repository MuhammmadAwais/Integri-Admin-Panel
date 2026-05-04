import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NewsService,
  type ArticleSummary,
  type AdminCountriesResponse,
} from 'api/backendApi';

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

  countries: string[];
  countriesLoading: boolean;

  refetch: () => void;
}

export function useAdminNews(): UseAdminNewsReturn {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [total, setTotal]       = useState(0);

  const [days, setDaysRaw]         = useState(7);
  const [country, setCountryRaw]   = useState<string | null>(null);

  // Countries dropdown
  const [countries, setCountries]             = useState<string[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  // Debounce ref for "days" input so we don't fire on every keystroke
  const daysDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Committed days value (after debounce resolves)
  const [committedDays, setCommittedDays] = useState(7);

  // ── Country list (fetched once on mount) ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setCountriesLoading(true);
    NewsService.fetchAdminCountries()
      .then((res: AdminCountriesResponse) => {
        if (cancelled) return;
        const list = Object.keys(res.supported_countries).sort();
        setCountries(list);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Articles fetch — re-runs when committedDays or country changes ────────
  const fetchArticles = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    NewsService.fetchAdminArticles(country, committedDays)
      .then(res => {
        if (cancelled) return;
        setArticles(res.articles);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to fetch articles';
        setError(msg);
        setArticles([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [committedDays, country]);

  useEffect(() => {
    const cleanup = fetchArticles();
    return cleanup;
  }, [fetchArticles]);

  // ── Setters ───────────────────────────────────────────────────────────────

  /** Debounce days by 500 ms — prevents API spam while typing */
  const setDays = useCallback((v: number) => {
    const clamped = Math.max(1, Math.min(90, v));
    setDaysRaw(clamped);
    if (daysDebounceRef.current) clearTimeout(daysDebounceRef.current);
    daysDebounceRef.current = setTimeout(() => {
      setCommittedDays(clamped);
    }, 500);
  }, []);

  const setCountry = useCallback((v: string | null) => {
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
    refetch: fetchArticles,
  };
}
