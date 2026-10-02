import axios, { 
  InternalAxiosRequestConfig, 
  AxiosResponse, 
  AxiosError, 
  AxiosInstance, 
} from 'axios';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import { db } from 'lib/firebase/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  query, 
  limit 
} from 'firebase/firestore';

/**
 * Type Definitions for Intelligence Core
 */
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

// In development: use an empty baseURL so Axios calls /api/... which the Vite
// dev proxy forwards to the real backend (server-to-server → no CORS).
// In production (Vercel/etc.): use the full backend URL from the env var.
const BASE_URL = import.meta.env.DEV
  ? ''   // Vite proxy handles /api/* → https://integri.cloud/api/*
  : import.meta.env.VITE_APP_BACKEND_API_BASE_URL.replace(/\/$/, '');
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

/**
 * Sentinel API Axios Instance
 * Features strict JSON headers and our interceptor guard.
 */
export const backendApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Flag to prevent infinite retry loops
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

/**
 * In-flight token request promise.
 * - Set when a token fetch starts.
 * - Cleared ONLY after the fetch settles so concurrent callers all
 *   await the same single request (no duplicate 401 races).
 */
let activeTokenPromise: Promise<string | null> | null = null;

/**
 * Auth Token Generator
 * Returns the existing in-flight promise when one is already running,
 * otherwise starts a fresh request.
 *
 * @param forceRefresh - When true, clears the stored token first so an
 *   expired/invalid token is never reused. Always pass true on 401 errors.
 */
export const getBackendToken = async (forceRefresh = false): Promise<string | null> => {
  // If forced, evict the stale token so we don't return it below.
  if (forceRefresh) {
    console.log('🔄 [Token] Force-refresh requested — clearing stored token.');
    localStorage.removeItem('integri_jwt');
    // Also clear any in-flight promise so a new request is started.
    activeTokenPromise = null;
  }

  // Return the in-flight promise so every concurrent caller shares one request.
  if (activeTokenPromise) {
    console.log('🔗 [Token] Awaiting in-flight token request...');
    return activeTokenPromise;
  }

  const existingToken = localStorage.getItem('integri_jwt');
  if (existingToken) {
    console.log('✅ [Token] Found existing token in localStorage.');
    return Promise.resolve(existingToken);
  }

  console.log('🚀 [Token] No token found — starting fresh token generation...');

  activeTokenPromise = (async () => {
    try {
      const response = await axios.post(`${BASE_URL}/api/v1/auth/token`, {
        user_id: ADMIN_UID,
        email: ADMIN_EMAIL,
        user_type: 'pro'
      });
      console.log('📦 [Token] Raw token response:', response.data);
      if (response.data && response.data.access_token) {
        console.log('🟢 [Token] Backend token generated successfully and stored.');
        localStorage.setItem('integri_jwt', response.data.access_token);
        return response.data.access_token as string;
      }
      console.warn('⚠️ [Token] Response OK but no access_token field:', response.data);
      return null;
    } catch (error) {
      console.error('❌ [Token] Failed to generate backend token:', error);
      throw error;
    } finally {
      // Clear the promise slot so future calls (e.g. after token expiry) can retry.
      activeTokenPromise = null;
    }
  })();

  return activeTokenPromise;
};

/**
 * Module-level "token ready" promise.
 * Starts fetching the token IMMEDIATELY when this module is first imported —
 * before any React component mounts — so the token is ready (or nearly ready)
 * by the time any data-fetching hook runs.
 *
 * Export this so consumers (App, hooks) can await it without triggering a
 * second fetch.
 */
export const tokenReadyPromise: Promise<string | null> = ((): Promise<string | null> => {
  const stored = localStorage.getItem('integri_jwt');
  if (stored) {
    console.log('🟢 [Token/Bootstrap] Token already in localStorage — skipping prefetch.');
    return Promise.resolve(stored);
  }
  console.log('🚀 [Token/Bootstrap] Module loaded — pre-fetching backend token eagerly...');
  return getBackendToken();
})();

/**
 * Request Interceptor (The "Sentinel")
 * Automatically attaches stored JWT token.
 */
backendApi.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    let token = localStorage.getItem('integri_jwt');

    // Skip token injection for the token-generation endpoint itself (avoid recursion).
    const isAuthTokenRequest =
      config.url &&
      (config.url.endsWith('/api/v1/auth/token') || config.url.includes('/auth/token'));

    if (!token && !isAuthTokenRequest) {
      try {
        console.log('🔄 [Interceptor] No token in storage — waiting for tokenReadyPromise...');
        // Await the module-level promise; this is already in-flight from import time.
        token = await tokenReadyPromise;
        console.log(token
          ? '✅ [Interceptor] Token obtained, attaching to request.'
          : '⚠️ [Interceptor] tokenReadyPromise resolved with null — request will be sent without auth.');
      } catch (error) {
        console.error('❌ [Interceptor] Failed to obtain backend token:', error);
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/**
 * Generates a clean, context-aware success message based on the API response.
 */
const getSuccessMessage = (response: AxiosResponse): string => {
  const method = response.config.method?.toUpperCase() || 'GET';
  const url = response.config.url || '';
  
  // Remove base URL if present, and query parameters
  let cleanUrl = url.split('?')[0];
  if (response.config.baseURL && cleanUrl.startsWith(response.config.baseURL)) {
    cleanUrl = cleanUrl.slice(response.config.baseURL.length);
  }
  
  const segments = cleanUrl.split('/').filter(Boolean);
  
  if (cleanUrl.includes('/prompts')) {
    if (method === 'GET') return 'System prompts loaded successfully';
    return 'System prompt updated successfully';
  }
  
  if (cleanUrl.includes('/memory')) {
    return 'User memory profile loaded';
  }
  
  if (cleanUrl.includes('/notification-stats')) {
    return 'Notification metrics loaded';
  }
  
  if (cleanUrl.includes('/test-notification')) {
    const countrySegment = segments[segments.length - 1] || 'target';
    return `Test notification sent to ${decodeURIComponent(countrySegment)}`;
  }
  
  if (cleanUrl.includes('/schedule')) {
    if (method === 'GET') return 'Fetch schedules loaded';
    if (method === 'DELETE') return 'Schedule entry removed';
    return 'Schedule updated successfully';
  }
  
  if (cleanUrl.includes('/languages')) {
    if (method === 'GET') return 'Language configurations loaded';
    return 'Language configuration updated';
  }
  
  if (cleanUrl.includes('/topics')) {
    if (method === 'GET') return 'Topic configurations loaded';
    return 'Topic configuration updated';
  }
  
  if (cleanUrl.includes('/articles')) {
    if (method === 'GET') {
      return cleanUrl.endsWith('/articles') ? 'Articles catalog loaded' : 'Article details loaded';
    }
    if (method === 'DELETE') return 'Article deleted successfully';
    return 'Article action completed';
  }
  
  if (cleanUrl.includes('/stats') || cleanUrl.includes('/usage')) {
    return 'Usage analytics loaded';
  }
  
  if (cleanUrl.includes('/models')) {
    return 'AI models loaded successfully';
  }

  if (cleanUrl.includes('/custom-gpts')) {
    if (method === 'GET') return 'Custom GPTs loaded successfully';
    if (method === 'POST') return 'Agent created successfully';
    if (method === 'PATCH') return 'GPT publicity updated';
    return 'Custom GPT action completed';
  }

  if (cleanUrl.includes('/calibration')) {
    return 'Calibration analysis loaded';
  }

  if (cleanUrl.includes('/personalization/thresholds')) {
    if (method === 'GET') return 'Personalization thresholds loaded';
    if (method === 'PUT') return 'Thresholds updated successfully';
    if (method === 'DELETE') return 'Thresholds reset to global defaults';
    return 'Thresholds action completed';
  }

  if (cleanUrl.includes('/taxonomy')) {
    if (method === 'GET') return 'Taxonomy configuration loaded';
    if (method === 'PUT') return 'Taxonomy updated successfully';
    if (method === 'DELETE') return 'Taxonomy reset to global defaults';
    return 'Taxonomy action completed';
  }

  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    const formattedName = last.charAt(0).toUpperCase() + last.slice(1).replace(/[-_]/g, ' ');
    
    if (method === 'GET') return `${formattedName} retrieved successfully`;
    if (method === 'POST') return `${formattedName} created successfully`;
    if (method === 'PUT') return `${formattedName} updated successfully`;
    if (method === 'DELETE') return `${formattedName} deleted successfully`;
  }
  
  return 'API request completed successfully';
};

/**
 * Extracts a readable error message from Axios error response.
 */
const getErrorMessage = (error: AxiosError): string => {
  if (error.response?.data) {
    const data = error.response.data as any;
    if (typeof data === 'string') {
      if (data.includes('<html') || data.includes('<!DOCTYPE') || data.includes('<!doctype')) {
        const titleMatch = data.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) return titleMatch[1].trim();
        const h1Match = data.match(/<h1>([^<]+)<\/h1>/i);
        if (h1Match?.[1]) return h1Match[1].trim();
        return `Server error (${error.response?.status || 'Bad Request'})`;
      }
      return data;
    }
    if (data.message) return data.message;
    if (data.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (data.error.message) return data.error.message;
    }
  }
  return error.message || 'An unexpected API error occurred';
};

/**
 * Response Interceptor
 * Guards against 401s, attempts silent token refresh, and triggers toast/console log side effects.
 */
backendApi.interceptors.response.use(
  (response: AxiosResponse) => {
    const customConfig = response.config as any;
    const method = response.config.method?.toUpperCase() || 'GET';

    // Show success toast for mutations (POST, PUT, DELETE, PATCH) or when explicitly requested.
    // Never show success toast if skipToast is explicitly set to true.
    const shouldToast = !customConfig?.skipToast && (method !== 'GET' || customConfig?.showToast);

    if (shouldToast) {
      const successMessage = getSuccessMessage(response);
      showToast(successMessage, 'success');
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; skipToast?: boolean };

    // Format readable error message
    const errorMessage = getErrorMessage(error);

    // ── Detect token expiry / invalidity ─────────────────────────────────────
    const status = error.response?.status;
    const responseDetail = (error.response?.data as any)?.detail ?? '';
    const isTokenError =
      status === 401 &&
      !originalRequest?._retry &&
      !(
        originalRequest?.url?.endsWith('/api/v1/auth/token') ||
        originalRequest?.url?.includes('/auth/token')
      );

    if (isTokenError) {
      // Log the specific token problem clearly
      if (
        typeof responseDetail === 'string' &&
        (responseDetail.toLowerCase().includes('expired') ||
          responseDetail.toLowerCase().includes('invalid'))
      ) {
        console.warn(
          `🔑 [Auth] Token invalid/expired (server said: "${responseDetail}"). ` +
          `Clearing token and fetching a fresh one, then retrying original request...`
        );
      } else {
        console.warn(
          `🔑 [Auth] 401 Unauthorized on ${originalRequest?.url}. ` +
          `Attempting token refresh and request retry...`
        );
      }

      // If another refresh is already in-flight, queue this request and wait.
      if (isRefreshing) {
        console.log('⏳ [Auth] Token refresh already in-flight — queuing request...');
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return backendApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Mark request so it doesn't loop infinitely.
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // IMPORTANT: forceRefresh=true clears the stale/expired token from
        // localStorage before fetching — otherwise we'd keep reusing the bad token.
        const newToken = await getBackendToken(true);

        isRefreshing = false;

        if (newToken) {
          console.log('✅ [Auth] Fresh token obtained. Replaying failed request and draining queue...');
          processQueue(null, newToken);
          originalRequest.headers.Authorization = 'Bearer ' + newToken;
          return backendApi(originalRequest);
        }

        // Token fetch succeeded but returned null — give up.
        console.error('❌ [Auth] Token refresh returned null. Cannot replay request.');
        processQueue(new Error('Token refresh returned null'), null);
        return Promise.reject(error);
      } catch (refreshError) {
        console.error('❌ [Auth] Token refresh itself failed:', refreshError);
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    // ── Non-401 errors (or already retried) ──────────────────────────────────
    // Print error details in the console
    console.error(`❌ [API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    console.error(`Error Message: ${errorMessage}`);

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Response Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received. Request details:', error.request);
    } else {
      console.error('Error configuration:', error.message);
    }
    console.error('Full Error Object:', error);

    // Show error toast unless suppressed.
    if (!originalRequest?.skipToast) {
      showToast(errorMessage, 'error');
    }

    return Promise.reject(error);
  }
);

// ==========================================
// 🚀 SERVICES MAP
// ==========================================

// ─────────────────────────────────────────────────────────────────────────────
//  📰 NEWS ADMIN — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface ArticleSource {
  title: string;
  image: string;
  source: string;
  url: string;
}

export interface LocalizedString {
  en?: string;
  de?: string;
  nl?: string;
  fr?: string;
  ar?: string;
  tr?: string;
  sv?: string;
  [key: string]: string | undefined;
}

/** Lightweight article object returned by the list endpoint */
export interface ArticleSummary {
  id: string;
  country: string;
  collection: string;
  isAiCompiled: boolean;
  countryLanguageCode: string;
  topic: string;
  headline: LocalizedString;
  headline_en: string;
  headline_de: string;
  coverImage: string;
  forCountries: string[];
  views: number;
  markAsTrending: boolean;
  date: string;
  compiledAt: string | null;
  sources_count: number;
  keywords_count: number;
  grammar_count: number;
  rawArticleIds: string[];
  sources: ArticleSource[];
}

export interface AdminArticlesResponse {
  total: number;
  days_back: number;
  country_filter: string | null;
  articles: ArticleSummary[];
}

/** Content block from the full article */
export interface ContentBlock {
  type: 'description' | 'image' | 'video' | string;
  value: LocalizedString | string;
  caption: string | null;
  videoThumbnail?: string;
}

/** Grammar point from the full article */
export interface GrammarPoint {
  title: LocalizedString;
  description: LocalizedString;
  example: LocalizedString;
  rules: { [lang: string]: string[] };
}

/** Vocabulary keyword from the full article */
export interface ArticleKeyword {
  title: LocalizedString;
  nouns: LocalizedString;
  description: LocalizedString;
}

export interface NewsSource {
  companyName: string;
  company: LocalizedString;
  description: LocalizedString;
  image: string;
  url: string;
  companyDescription: string;
}

/** Full Firestore document returned by the detail endpoint */
export interface ArticleDetail {
  _id: string;
  _collection: string;
  headline: LocalizedString;
  content: ContentBlock[];
  grammar: GrammarPoint[];
  keywords: ArticleKeyword[];
  sources: ArticleSource[];
  coverImage: string;
  country: string;
  forCountries: string[];
  topic: string;
  date: string;
  compiledAt: string | null;
  createdTime: string;
  views: number;
  isAiCompiled: boolean;
  markAsTrending: boolean;
  articleType: string;
  newsSource: NewsSource;
  rawArticleIds: string[];
  tags: string[];
  countryLanguageCode: string;
  addToGeneralTopic: boolean;
  video: string;
}

export interface CountryDetails {
  locale: string;
  pipeline_note: string;
}

/** Admin countries endpoint response */
export interface AdminCountriesResponse {
  total: number;
  supported_countries: Record<string, CountryDetails>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  📰 NEWS ADMIN — Language Configurations Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportedLanguage {
  code: string;
  name: string;
}

export interface SupportedLanguagesResponse {
  languages: SupportedLanguage[];
}

export interface CountryLangConfig {
  country: string;
  languages: string[];
  is_default: boolean;
  missing_native_language: boolean;
  updated_at?: string;
}

export interface AllCountryLangConfigsResponse {
  configs: CountryLangConfig[];
}

export interface CountryLangConfigResponse {
  config: CountryLangConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
//  📰 NEWS ADMIN — Topic Configurations Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportedTopicCategory {
  slug: string;
  is_api_category: boolean;
}

export interface SupportedTopicsResponse {
  categories: SupportedTopicCategory[];
  note: string;
}

export interface TopicConfig {
  country: string;
  topics: string[];
  search_terms: string[];
  exclude_categories: string[];
  domains: string[];
  exclude_domains: string[];
  raw_limit_per_topic: number;
  is_default: boolean;
  updated_at?: string;
}

export interface AllTopicConfigsResponse {
  configs: TopicConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  📰 NEWS ADMIN — Notifications & Schedules Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleEntry {
  entry_id: string;
  article_type: string;
  hour: number;
  minute: number;
  enabled: boolean;
  slot?: number;
}

export interface CountrySchedule {
  country: string;
  entries: ScheduleEntry[];
  languages: string[];
  updated_at: string;
}

export interface FetchSchedulesResponse {
  schedules: CountrySchedule[];
  total_entries: number;
  active_entries: number;
}

export interface UpdateScheduleResponse {
  country: string;
  entries: ScheduleEntry[];
  languages: string[];
  updated_at: string;
}

export interface NotificationStatsSummary {
  total_sent: number;
  total_failed: number;
  grand_total_tokens: number;
  total_runs: number;
  countries_with_data: number;
  overall_success_rate: number;
  countries_notified_today: string[];
  missing_today: string[];
  note: string;
}

export interface CountryNotificationStat {
  runs: number;
  total_sent: number;
  total_failed: number;
  total_tokens: number;
  last_run: {
    notified_at: string;
    sent: number;
    failed: number;
    batches: number;
    success_rate: number;
    headline_en: string;
    news_id: string;
    triggered_by: string;
  };
  notified_today: boolean;
  avg_success_rate: number;
}

export interface RecentNotificationRun {
  id: string;
  country: string;
  news_id: string;
  collection: string;
  headline_en: string;
  sent: number;
  failed: number;
  batches: number;
  total_tokens: number;
  success_rate: number;
  per_topic: Record<string, any>;
  per_language?: Record<
    string,
    {
      sent: number;
      failed: number;
      batches: number;
      total_tokens: number;
      success_rate: number;
      headline?: string;
    }
  >;
  triggered_by: string;
  notified_at: string;
}

export interface NotificationStatsResponse {
  summary: NotificationStatsSummary;
  by_country: Record<string, CountryNotificationStat>;
  recent_runs: RecentNotificationRun[];
  country_filter: string | null;
  limit_applied: number;
}

export interface TestNotificationResponse {
  status: string;
  sent: number;
  failed: number;
  test_token_last4: string;
  country: string;
  news_id: string;
  headline: string;
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  📊 NOTIFICATION OPENS / ANALYTICS — Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationOpensParams {
  country?: string;
  date?: string;
  news_id?: string;
  limit?: number;
}

export interface TopArticleOpens {
  news_id: string;
  headline_en: string;
  unique_opens: number;
  total_taps: number;
}

export interface NotificationOpensSummary {
  total_runs: number;
  total_sent: number;
  total_unique_opens: number;
  total_taps: number;
  overall_open_rate: number;
  clicks_by_country: Record<string, number>;
  top_articles: TopArticleOpens[];
}

export interface NotificationOpensArticle {
  news_id: string;
  headline_en: string;
  country: string;
  article_type: string | null;
  slot: number | null;
  notified_at: string;
  sent: number;
  unique_opens: number;
  total_taps: number;
  open_rate: number;
  by_country: Record<string, number>;
}

export interface NotificationOpensResponse {
  summary: NotificationOpensSummary;
  articles: NotificationOpensArticle[];
}



export const PromptsService = {
  getDefaultPrompt: async (): Promise<any> => {
    try {
      const response = await backendApi.get('/api/v1/prompts/default');
      return response.data;
    } catch (e) {
      console.error("❌ [API] Failure getting default prompt:", e);
      throw e;
    }
  },
  getOthersPrompt: async (): Promise<any> => {
    try {
      const response = await backendApi.get('/api/v1/prompts/others');
      console.log(response.data);
      return response.data;
    } catch (e) {
      console.error("❌ [API] Failure getting others prompt:", e);
      throw e;
    }
  },
  getVoicePrompt: async (): Promise<any> => {
    try {
      const response = await backendApi.get('/api/v1/prompts/voice');
      return response.data;
    } catch (e) {
      console.error("❌ [API] Failure getting voice prompt:", e);
      throw e;
    }
  },
  updatePrompt: async (type: string, data: any): Promise<any> => {
    try {
      const response = await backendApi.put(`/api/v1/prompts/${type}`, data);
      return response.data;
    } catch (e) {
      console.error(`❌ [API] Failure updating prompt ${type}:`, e);
      throw e;
    }
  },
  getCountrySummaryPrompt: async (country: string): Promise<string> => {
    try {
      const response = await backendApi.get<string>(`/api/v1/news/admin/countries/${country}/summary-prompt`);
      return response.data;
    } catch (e) {
      console.error(`❌ [API] Failure getting summary prompt for ${country}:`, e);
      throw e;
    }
  },
  updateCountrySummaryPrompt: async (country: string, prompt: string): Promise<string> => {
    try {
      const response = await backendApi.put<string>(
        `/api/v1/news/admin/countries/${country}/summary-prompt`,
        { prompt },
        { skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [API] Failure updating summary prompt for ${country}:`, e);
      throw e;
    }
  },
  getMemoryExtractionPrompt: async (): Promise<{ source?: string; prompt?: string }> => {
    try {
      const response = await backendApi.get('/api/v1/prompts/memory-extraction');
      return response.data;
    } catch (e) {
      console.error("❌ [API] Failure getting memory extraction prompt:", e);
      throw e;
    }
  },
  updateMemoryExtractionPrompt: async (prompt: string): Promise<{ status?: string; message?: string; warning?: string }> => {
    try {
      const response = await backendApi.put(
        '/api/v1/prompts/memory-extraction',
        { prompt },
        { skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error("❌ [API] Failure updating memory extraction prompt:", e);
      throw e;
    }
  }
};

export const UserMemoryService = {
  getUserMemory: async (id: string | number): Promise<any> => {
    try {
      const response = await backendApi.get(`/api/v1/users/${id}/memory`);
      return response.data;
    } catch (e) {
      console.error(`❌ [API] Failure getting user memory for ${id}:`, e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  📰 NEWS ADMIN — Service
// ─────────────────────────────────────────────────────────────────────────────

export const NewsService = {
  /**
   * Fetch admin articles list.
   * GET /api/v1/news/admin/articles?days=7&country=Germany
   */
  fetchAdminArticles: async (
    country?: string | null,
    days: number = 7
  ): Promise<AdminArticlesResponse> => {
    const maxAttempts = 3;
    let attempt = 0;
    const params: Record<string, string | number> = { days };
    if (country) params.country = country;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`📰 [NewsService] fetchAdminArticles attempt ${attempt}/${maxAttempts} — country: ${country ?? 'ALL'}, days: ${days}`, { params });
        const response = await backendApi.get<AdminArticlesResponse>(
          '/api/v1/news/admin/articles',
          { params }
        );
        console.log(`✅ [NewsService] fetchAdminArticles success (attempt ${attempt}):`, { status: response.status, dataPreview: Array.isArray(response.data?.articles) ? `${response.data.articles.length} articles` : typeof response.data });
        return response.data;
      } catch (e: any) {
        const status = e?.response?.status;
        console.error(`❌ [NewsService] fetchAdminArticles error on attempt ${attempt}:`, { message: e?.message, status, data: e?.response?.data });
        // If auth error, let interceptor/token logic handle it (avoid retrying)
        if (status === 401) {
          throw e;
        }
        if (attempt >= maxAttempts) {
          console.error(`❌ [NewsService] fetchAdminArticles exhausted ${maxAttempts} attempts.`);
          throw e;
        }
        // Backoff before retrying (grow with attempt)
        await new Promise((res) => setTimeout(res, 500 * attempt));
      }
    }
    // Shouldn't reach here, but satisfy TypeScript
    throw new Error('❌ [NewsService] fetchAdminArticles unexpected exit');
  },


  /**
   * Fetch full article detail (content, grammar, keywords).
   * Tries collection=News first; if the API returns 404 automatically
   * retries with collection=Articles as a fallback.
   * GET /api/v1/news/admin/articles/{news_id}?collection=News|Articles
   */
  fetchArticleDetails: async (news_id: string, collection?: string): Promise<ArticleDetail> => {
    const activeCollection = collection || 'News';
    try {
      console.log(`🔍 [NewsService] fetchArticleDetails — fetching collection="${activeCollection}" for id: ${news_id}`);
      const response = await backendApi.get<ArticleDetail>(
        `/api/v1/news/admin/articles/${news_id}`,
        { params: { collection: activeCollection } }
      );
      console.log(`✅ [NewsService] fetchArticleDetails — found in collection="${activeCollection}"`);
      return response.data;
    } catch (e: any) {
      console.error(`❌ [NewsService] fetchArticleDetails — failed for ${news_id} in collection="${activeCollection}":`, e);
      throw e;
    }
  },

  /**
   * Delete an article document from Firestore.
   * DELETE /api/v1/news/admin/articles/{news_id}?collection=News
   */
  deleteArticle: async (news_id: string, collection: string = 'News'): Promise<{ deleted: boolean; news_id: string; collection: string }> => {
    try {
      const response = await backendApi.delete<{ deleted: boolean; news_id: string; collection: string }>(
        `/api/v1/news/admin/articles/${news_id}`,
        { params: { collection }, skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] deleteArticle error for ${news_id}:`, e);
      throw e;
    }
  },

  /**
   * Fetch the list of supported countries for the dropdown.
   * GET /api/v1/news/admin/countries
   */
  fetchAdminCountries: async (): Promise<AdminCountriesResponse> => {
    try {
      const response = await backendApi.get<AdminCountriesResponse>(
        '/api/v1/news/admin/countries'
      );
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchAdminCountries error:', e);
      throw e;
    }
  },

  fetchNotificationStats: async (country?: string, limit: number = 7): Promise<NotificationStatsResponse> => {
    try {
      const params: Record<string, string | number> = { limit };
      if (country) params.country = country;
      const response = await backendApi.get<NotificationStatsResponse>('/api/v1/news/admin/notification-stats', { params });
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchNotificationStats error:', e);
      throw e;
    }
  },

  sendTestNotification: async (country: string): Promise<TestNotificationResponse> => {
    try {
      const response = await backendApi.post<TestNotificationResponse>(
        `/api/v1/news/admin/test-notification/${country}`,
        null,
        { skipToast: true } as any
      );
      console.log("Successful......", response.data)
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] sendTestNotification error for ${country}:`, e);
      throw e;
    }
  },

  fetchSchedules: async (): Promise<FetchSchedulesResponse> => {
    try {
      const response = await backendApi.get<FetchSchedulesResponse>('/api/v1/news/admin/schedule');
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchSchedules error:', e);
      throw e;
    }
  },

  updateSchedule: async (country: string, entries: ScheduleEntry[]): Promise<UpdateScheduleResponse> => {
    try {
      const sanitizedEntries = entries.map(({ entry_id, ...rest }, index) => ({
        ...rest,
        slot: index + 1
      }));
      console.log(`[NewsService] updateSchedule Request Sent for Country: ${country}`, { entries: sanitizedEntries });
      const response = await backendApi.put<UpdateScheduleResponse>(`/api/v1/news/admin/schedule/${country}`, { entries: sanitizedEntries });
      console.log(`[NewsService] updateSchedule Response successful for ${country}:`, response);
      console.log(`[NewsService] updateSchedule Response Data for ${country}:`, response.data);
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] updateSchedule error for ${country}:`, e);
      throw e;
    }
  },

  deleteScheduleEntry: async (country: string, entry_id: string): Promise<UpdateScheduleResponse> => {
    try {
      const response = await backendApi.delete<UpdateScheduleResponse>(`/api/v1/news/admin/schedule/${country}/entry/${entry_id}`);
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] deleteScheduleEntry error for ${country} - ${entry_id}:`, e);
      throw e;
    }
  },

  /**
   * Fetch notification open/click analytics per article & per country.
   * GET /api/v1/news/admin/notification-opens
   */
  fetchNotificationOpens: async (params: NotificationOpensParams): Promise<NotificationOpensResponse> => {
    try {
      const cleanParams: Record<string, string | number> = {};
      if (params.country) cleanParams.country = params.country;
      if (params.date) cleanParams.date = params.date;
      if (params.news_id) cleanParams.news_id = params.news_id;
      if (params.limit !== undefined) cleanParams.limit = params.limit;
      const response = await backendApi.get<NotificationOpensResponse>(
        '/api/v1/news/admin/notification-opens',
        { params: cleanParams, skipToast: true } as any
      );
      console.log("Response data: ", response.data)
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchNotificationOpens error:', e);
      throw e;
    }
  },

  fetchSupportedLanguages: async (): Promise<SupportedLanguagesResponse> => {
    try {
      const response = await backendApi.get<SupportedLanguagesResponse>('/api/v1/news/admin/languages/supported');
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchSupportedLanguages error:', e);
      throw e;
    }
  },

  fetchAllCountryLangConfigs: async (): Promise<AllCountryLangConfigsResponse> => {
    try {
      const response = await backendApi.get<AllCountryLangConfigsResponse>('/api/v1/news/admin/languages');
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchAllCountryLangConfigs error:', e);
      throw e;
    }
  },

  fetchCountryLangConfig: async (country: string): Promise<CountryLangConfigResponse> => {
    try {
      const response = await backendApi.get<CountryLangConfigResponse>(`/api/v1/news/admin/languages/${country}`);
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] fetchCountryLangConfig error for ${country}:`, e);
      throw e;
    }
  },

  updateCountryLanguages: async (country: string, languages: string[]): Promise<CountryLangConfigResponse> => {
    try {
      // Ensuring the body is strictly an object with a languages string array.
      const response = await backendApi.put<CountryLangConfigResponse>(`/api/v1/news/admin/languages/${country}`, { languages });
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] updateCountryLanguages error for ${country}:`, e);
      throw e;
    }
  },

  fetchSupportedTopics: async (): Promise<SupportedTopicsResponse> => {
    try {
      const response = await backendApi.get<SupportedTopicsResponse>('/api/v1/news/admin/topics/supported');
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchSupportedTopics error:', e);
      throw e;
    }
  },

  fetchAllTopicConfigs: async (): Promise<AllTopicConfigsResponse> => {
    try {
      const response = await backendApi.get<AllTopicConfigsResponse>('/api/v1/news/admin/topics');
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchAllTopicConfigs error:', e);
      throw e;
    }
  },

  fetchCountryTopicConfig: async (country: string): Promise<TopicConfig> => {
    try {
      const response = await backendApi.get<TopicConfig>(`/api/v1/news/admin/topics/${country}`);
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] fetchCountryTopicConfig error for ${country}:`, e);
      throw e;
    }
  },

  updateTopicConfig: async (country: string, config: Partial<TopicConfig>): Promise<TopicConfig> => {
    try {
      const response = await backendApi.put<TopicConfig>(`/api/v1/news/admin/topics/${country}`, config);
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] updateTopicConfig error for ${country}:`, e);
      throw e;
    }
  },

  /**
   * Queue a manually composed article for delivery to a country's next slot.
   * POST /api/v1/news/admin/manual-article
   * Returns 202 Accepted with a `detail` string confirming the queue placement.
   */
  postManualArticle: async (payload: ManualArticleRequest): Promise<ManualArticleResponse> => {
    try {
      const response = await backendApi.post<ManualArticleResponse>(
        '/api/v1/news/admin/manual-article',
        payload,
        { skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] postManualArticle error:', e);
      throw e;
    }
  },

  /**
   * Manual Admin Push — immediately push a specific already-compiled article.
   * POST /api/v1/news/admin/articles/{news_id}/push
   */
  pushArticle: async (
    news_id: string,
    payload: { collection: string; language?: string | null }
  ): Promise<ManualPushResponse> => {
    try {
      const response = await backendApi.post<ManualPushResponse>(
        `/api/v1/news/admin/articles/${news_id}/push`,
        payload,
        { skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] pushArticle error for ${news_id}:`, e);
      throw e;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  📰 MANUAL ARTICLE & PUSH — Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ManualPushRequest {
  collection: string;
  language?: string | null;
}

export interface ManualPushResponse {
  status: string;
  task_id: string;
  country: string;
  news_id: string;
  collection: string;
  language_scope: string;
  detail: string;
}

export interface ManualArticleSource {
  title: string;
  image: string;
  source: string;
  url: string;
}

export interface ManualArticleRequest {
  country: string;
  headline: string;
  body: string;
  topic?: string;
  article_type?: string;
  extract_learning_aids?: boolean;
  image_url?: string;
  sources?: ManualArticleSource[];
  mark_as_trending?: boolean;
  send_push?: boolean;
  push_language?: string;
}

export interface ManualArticleResponse {
  detail: string;
  push_scheduled?: boolean;
  push_language_scope?: string | null;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
//  🧑‍💻 USER ADMIN — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface UserUsageRecord {
  user_id: string;
  email: string;
  tier: string;
  total_tokens_used: number;
  total_api_requests: number;
  created_at: string;
}

export interface UsersUsageResponse {
  users: UserUsageRecord[];
  count: number;
  next_key?: string;
}

export interface EndpointStats {
  [endpoint: string]: number;
}

export interface UserStatsResponse {
  user_id: string;
  tokens: {
    user_id: string;
    today: {
      date: string;
      total_tokens: number;
    };
    all_time: {
      total_tokens: number;
    };
  };
  api_requests: {
    user_id: string;
    today: {
      date: string;
      total_requests: number;
      by_endpoint: EndpointStats;
    };
    all_time: {
      total_requests: number;
    };
  };
}

export const UserService = {
  fetchUserStats: async (user_id: string): Promise<UserStatsResponse> => {
    try {
      const response = await backendApi.get<UserStatsResponse>(`/api/v1/users/${user_id}/stats`);
      return response.data;
    } catch (e) {
      console.error(`❌ [UserService] fetchUserStats error for ${user_id}:`, e);
      throw e;
    }
  },

  fetchUsersUsage: async (
    limit: number = 200,
    user_type?: string,
    country?: string
  ): Promise<UsersUsageResponse> => {
    try {
      const params: Record<string, any> = { limit };
      if (user_type && user_type !== 'all') {
        params.user_type = user_type;
      } else if (country && country.trim() !== '') {
        params.country = country.trim();
      }
      console.log("Callign Api")
      const response = await backendApi.get<UsersUsageResponse>('/api/v1/users/usage', {
        params
      });
      console.log(response)
      return response.data;
    } catch (e) {
      console.error('❌ [UserService] fetchUsersUsage error:', e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  🤖 MODELS — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export const ModelsService = {
  fetchModels: async (): Promise<string[]> => {
    try {
      const response = await backendApi.get<string[]>('/api/v1/models');
      return response.data;
    } catch (e) {
      console.error('❌ [ModelsService] fetchModels error:', e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  📊 TIER LIMITS — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface TierLimitsConfig {
  daily_messages: number;
  daily_tokens: number;
  monthly_tokens: number;
  voice_minutes: number;
  image_generation: number;
  file_input_token_cap: number;
  default_model_on_limit: string;
}

export type TierName = 'freemium' | 'premium' | 'pro';

export interface TierLimitsResponse {
  source: string;
  limits: Record<TierName, TierLimitsConfig & { file_upload_mb?: number }>;
}

export interface TierLimitsUpdateResponse {
  status: string;
  message: string;
  limits: Record<TierName, TierLimitsConfig & { file_upload_mb?: number }>;
}

export const TierLimitsService = {
  fetchTierLimits: async (): Promise<TierLimitsResponse> => {
    try {
      const response = await backendApi.get<TierLimitsResponse>('/api/v1/admin/tier-limits');
      return response.data;
    } catch (e) {
      console.error('❌ [TierLimitsService] fetchTierLimits error:', e);
      throw e;
    }
  },

  updateTierLimits: async (payload: Partial<Record<TierName, Partial<TierLimitsConfig>>>): Promise<TierLimitsUpdateResponse> => {
    try {
      const response = await backendApi.put<TierLimitsUpdateResponse>('/api/v1/admin/tier-limits', payload);
      return response.data;
    } catch (e) {
      console.error('❌ [TierLimitsService] updateTierLimits error:', e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  🤖 CUSTOM GPTs — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomGpt {
  gpt_id: string;
  name: string;
  description: string;
  instructions: string;
  conversation_starters: string[];
  is_public: boolean;
  knowledge_base_status: string;
  document_count: number;
  total_chunks: number;
  recommended_model: string;
  recommended_provider: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const CustomGptService = {
  /**
   * Fetch all GPTs that admin has marked as public.
   * GET /api/v1/custom-gpts/public
   */
  fetchPublicGpts: async (limit: number = 50): Promise<CustomGpt[]> => {
    try {
      const response = await backendApi.get<CustomGpt[]>('/api/v1/custom-gpts/public', {
        params: { limit },
        skipToast: true
      } as any);
      return response.data;
    } catch (e) {
      console.error('❌ [CustomGptService] fetchPublicGpts error:', e);
      throw e;
    }
  },

  /**
   * Toggle publicity of a custom GPT (Admin only).
   * PATCH /api/v1/admin/custom-gpts/{gpt_id}/publicity
   */
  toggleGptPublicity: async (gpt_id: string, is_public: boolean): Promise<CustomGpt> => {
    try {
      const response = await backendApi.patch<CustomGpt>(
        `/api/v1/admin/custom-gpts/${gpt_id}/publicity`,
        { is_public },
        { skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [CustomGptService] toggleGptPublicity error for ${gpt_id}:`, e);
      throw e;
    }
  },

  /**
   * Create a new custom GPT / Agent.
   * POST /api/v1/custom-gpts
   */
  createAgent: async (agentData: {
    name: string;
    description: string;
    instructions: string;
    conversation_starters?: string[];
    recommended_model: string;
    recommended_provider: string;
    is_public?: boolean;
  }): Promise<CustomGpt> => {
    try {
      const payload = {
        name: agentData.name,
        description: agentData.description,
        instructions: agentData.instructions,
        conversation_starters:
          agentData.conversation_starters?.length
            ? agentData.conversation_starters
            : [agentData.name],
        recommended_model: agentData.recommended_model,
        recommended_provider: agentData.recommended_provider,
        is_public: agentData.is_public !== undefined ? agentData.is_public : true,
      };
      const response = await backendApi.post<CustomGpt>('/api/v1/custom-gpts', payload);
      return response.data;
    } catch (e) {
      console.error('❌ [CustomGptService] createAgent error:', e);
      throw e;
    }
  },

  /**
   * Fetch all custom GPTs.
   * GET /api/v1/custom-gpts
   */
  fetchGpts: async (limit: number = 200): Promise<CustomGpt[]> => {
    try {
      const response = await backendApi.get<CustomGpt[]>('/api/v1/custom-gpts', {
        params: { limit },
        skipToast: true
      } as any);
      return response.data;
    } catch (e) {
      console.error('❌ [CustomGptService] fetchGpts error:', e);
      throw e;
    }
  },

  /**
   * Fetch custom GPT details.
   * GET /api/v1/custom-gpts/{gpt_id}
   */
  getGptDetails: async (gpt_id: string): Promise<CustomGpt> => {
    try {
      const response = await backendApi.get<CustomGpt>(`/api/v1/custom-gpts/${gpt_id}`, {
        skipToast: true
      } as any);
      return response.data;
    } catch (e) {
      console.error(`❌ [CustomGptService] getGptDetails error for ${gpt_id}:`, e);
      throw e;
    }
  },

  /**
   * Update custom GPT.
   * PATCH /api/v1/custom-gpts/{gpt_id}
   */
  updateGpt: async (
    gpt_id: string,
    agentData: Partial<{
      name: string;
      description: string;
      instructions: string;
      conversation_starters: string[];
      recommended_model: string;
      recommended_provider: string;
    }>
  ): Promise<CustomGpt> => {
    try {
      const response = await backendApi.patch<CustomGpt>(
        `/api/v1/custom-gpts/${gpt_id}`,
        agentData
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [CustomGptService] updateGpt error for ${gpt_id}:`, e);
      throw e;
    }
  },

  /**
   * Delete custom GPT.
   * DELETE /api/v1/custom-gpts/{gpt_id}
   */
  deleteGpt: async (gpt_id: string): Promise<void> => {
    try {
      await backendApi.delete(`/api/v1/custom-gpts/${gpt_id}`);
    } catch (e) {
      console.error(`❌ [CustomGptService] deleteGpt error for ${gpt_id}:`, e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  🏷️  PERSONALIZATION — TAXONOMY — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface CountryTaxonomyConfig {
  country: string;
  dimensions: string[];
  dimension_count: number;
  is_default: boolean;
  target_count: number;
  updated_at?: string;
}

export interface AllTaxonomyResponse {
  configs: CountryTaxonomyConfig[];
  default_dimensions: string[];
  total: number;
}

export interface TaxonomyResetResponse {
  country: string;
  reset: boolean;
  dimensions: string[];
  is_default: boolean;
  note?: string;
}

export const TaxonomyService = {
  /** GET /api/v1/news/admin/taxonomy */
  fetchAll: async (): Promise<AllTaxonomyResponse> => {
    try {
      const response = await backendApi.get<AllTaxonomyResponse>('/api/v1/news/admin/taxonomy');
      return response.data;
    } catch (e) {
      console.error('❌ [TaxonomyService] fetchAll error:', e);
      throw e;
    }
  },

  /** GET /api/v1/news/admin/taxonomy/{country} */
  fetchCountry: async (country: string): Promise<CountryTaxonomyConfig> => {
    try {
      const response = await backendApi.get<CountryTaxonomyConfig>(
        `/api/v1/news/admin/taxonomy/${encodeURIComponent(country)}`
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [TaxonomyService] fetchCountry error for ${country}:`, e);
      throw e;
    }
  },

  /** PUT /api/v1/news/admin/taxonomy/{country} - ⚠️ Full replace, invalidates user vectors */
  updateCountry: async (country: string, dimensions: string[]): Promise<CountryTaxonomyConfig> => {
    try {
      const response = await backendApi.put<CountryTaxonomyConfig>(
        `/api/v1/news/admin/taxonomy/${encodeURIComponent(country)}`,
        { dimensions }
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [TaxonomyService] updateCountry error for ${country}:`, e);
      throw e;
    }
  },

  /** DELETE /api/v1/news/admin/taxonomy/{country} - Reset to global default */
  resetCountry: async (country: string): Promise<TaxonomyResetResponse> => {
    try {
      const response = await backendApi.delete<TaxonomyResetResponse>(
        `/api/v1/news/admin/taxonomy/${encodeURIComponent(country)}`
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [TaxonomyService] resetCountry error for ${country}:`, e);
      throw e;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  🎚️  PERSONALIZATION — THRESHOLDS — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface TierThresholds {
  active: number;
  dormant: number;
  premium: number;
}

export interface CountryThresholdsConfig {
  country: string;
  thresholds: TierThresholds;
  is_default: boolean;
  updated_at?: string;
}

export interface AllThresholdsResponse {
  configs: CountryThresholdsConfig[];
  default_thresholds: TierThresholds;
  total: number;
}

export interface ThresholdsResetResponse {
  country: string;
  reset: boolean;
  thresholds: TierThresholds;
  is_default: boolean;
  note?: string;
}

export const ThresholdsService = {
  /** GET /api/v1/news/admin/personalization/thresholds */
  fetchAll: async (): Promise<AllThresholdsResponse> => {
    try {
      const response = await backendApi.get<AllThresholdsResponse>(
        '/api/v1/news/admin/personalization/thresholds'
      );
      return response.data;
    } catch (e) {
      console.error('❌ [ThresholdsService] fetchAll error:', e);
      throw e;
    }
  },

  /** GET /api/v1/news/admin/personalization/thresholds/{country} */
  fetchCountry: async (country: string): Promise<CountryThresholdsConfig> => {
    try {
      const response = await backendApi.get<CountryThresholdsConfig>(
        `/api/v1/news/admin/personalization/thresholds/${encodeURIComponent(country)}`
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [ThresholdsService] fetchCountry error for ${country}:`, e);
      throw e;
    }
  },

  /** PUT /api/v1/news/admin/personalization/thresholds/{country} */
  updateCountry: async (
    country: string,
    thresholds: Partial<TierThresholds>
  ): Promise<CountryThresholdsConfig> => {
    try {
      const response = await backendApi.put<CountryThresholdsConfig>(
        `/api/v1/news/admin/personalization/thresholds/${encodeURIComponent(country)}`,
        thresholds
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [ThresholdsService] updateCountry error for ${country}:`, e);
      throw e;
    }
  },

  /** DELETE /api/v1/news/admin/personalization/thresholds/{country} */
  resetCountry: async (country: string): Promise<ThresholdsResetResponse> => {
    try {
      const response = await backendApi.delete<ThresholdsResetResponse>(
        `/api/v1/news/admin/personalization/thresholds/${encodeURIComponent(country)}`
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [ThresholdsService] resetCountry error for ${country}:`, e);
      throw e;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  📊 PERSONALIZATION — CALIBRATION — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationBin {
  lo: number;
  hi: number;
  sent: number;
  opened: number;
  open_rate: number;
}

export interface CalibrationResponse {
  country: string;
  window_days: number;
  total_sent: number;
  total_opened: number;
  overall_open_rate: number;
  bins: CalibrationBin[];
  inflection_cosine: number | null;
  current_thresholds: TierThresholds;
  suggested_thresholds: TierThresholds | null;
  note: string;
}

export const CalibrationService = {
  /** GET /api/v1/news/admin/personalization/calibration/{country}?days=N */
  fetchCalibration: async (country: string, days: number = 30): Promise<CalibrationResponse> => {
    try {
      const response = await backendApi.get<CalibrationResponse>(
        `/api/v1/news/admin/personalization/calibration/${encodeURIComponent(country)}`,
        { params: { days }, skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [CalibrationService] fetchCalibration error for ${country}:`, e);
      throw e;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  🧠 MEMORY BACKFILL — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface MemorySeedPayload {
  estimated_age?: string;
  gender?: string;
  occupation?: string;
  city?: string;
  country?: string;
  languages_spoken?: string[];
  interests?: { name: string; score?: number }[];
  domains?: string[];
  notable_facts?: string[];
  language?: string;
  communication_style?: string;
}

export interface MemorySeedResponse {
  user_id: string;
  result: "created" | "skipped_has_memory";
  memory_data?: any;
}

export interface CountryBackfillPayload {
  country: string;
  dry_run?: boolean;
  payload: MemorySeedPayload;
}

export interface CountryBackfillResponse {
  job_id: string;
  status: string;
  country: string;
  dry_run: boolean;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  country: string;
  status: "pending" | "running" | "completed" | "failed";
  dry_run: boolean;
  requested_by: string;
  users_scanned: number;
  users_updated: number;
  users_skipped_has_memory: number;
  users_failed: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface RecentJobsResponse {
  jobs: JobStatusResponse[];
  count: number;
}

export const MemoryBackfillService = {
  seedUserMemory: async (userId: string, payload: MemorySeedPayload): Promise<MemorySeedResponse> => {
    try {
      const response = await backendApi.post<MemorySeedResponse>(
        `/api/v1/admin/users/${encodeURIComponent(userId)}/memory/seed`,
        { payload },
        { skipToast: true } as any
      );
      console.log(response)
      return response.data;
    } catch (e) {
      console.error(`❌ [MemoryBackfillService] seedUserMemory error for ${userId}:`, e);
      throw e;
    }
  },

  dispatchCountryBackfill: async (payload: CountryBackfillPayload): Promise<CountryBackfillResponse> => {
    try {
      const response = await backendApi.post<CountryBackfillResponse>(
        '/api/v1/admin/memory/backfill/country',
        payload,
        { skipToast: true } as any
      );
      console.log(response);
      return response.data;
    } catch (e) {
      console.error('❌ [MemoryBackfillService] dispatchCountryBackfill error:', e);
      throw e;
    }
  },

  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    try {
      const response = await backendApi.get<JobStatusResponse>(
        `/api/v1/admin/memory/backfill/jobs/${encodeURIComponent(jobId)}`,
        { skipToast: true } as any
      );
      console.log(response);
      return response.data;
    } catch (e) {
      console.error(`❌ [MemoryBackfillService] getJobStatus error for ${jobId}:`, e);
      throw e;
    }
  },

  listRecentJobs: async (limit: number = 20): Promise<RecentJobsResponse> => {
    try {
      const response = await backendApi.get<RecentJobsResponse>(
        '/api/v1/admin/memory/backfill/jobs',
        { params: { limit }, skipToast: true } as any
      );
      console.log(response);
      return response.data;
    } catch (e) {
      console.error('❌ [MemoryBackfillService] listRecentJobs error:', e);
      throw e;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  📊 PERSONALIZATION RUN SUMMARIES — Types & Services
// ─────────────────────────────────────────────────────────────────────────────

export interface PersoCohortFunnel {
  enumerated: number;           // total users found in Firestore
  no_vector: number;            // skipped — no personalization vector
  stale_vector: number;         // skipped — vector built on old taxonomy
  with_vector: number;          // users that cleared the vector gate
  frequency_capped: number;     // already hit daily push cap
  eligible_for_match: number;   // passed to the cosine matcher
}

export interface PersoMatchingStats {
  scored_users: number;          // users with ≥1 scorable article
  users_no_signal: number;        // zero-norm vector — no topical signal
  users_below_threshold: number; // had signal but no article cleared threshold
  users_matched: number;         // ≥1 article passed threshold → will receive push
  pushes_assigned: number;       // total (user, article) assignments
  distinct_payload_groups: number;// unique (article_id, lang) FCM multicasts
  recent_push_dedup_count: number;// articles deduped (7-day window)
  score_p50: number;             // median of each user's best article score
  score_p90: number;             // 90th percentile
  score_p99: number;             // 99th percentile
  score_max: number;             // highest score in cohort
  score_mean: number;            // mean of best scores
}

export interface PersoTopicDispatch {
  sent: number;
  failed: number;
  batches: number;
}

export interface PersoDispatchStats {
  sent: number;
  failed: number;
  batches: number;
  per_topic?: Record<string, PersoTopicDispatch>;
  committed_users: number;       // push succeeded → frequency cap committed
  failed_users: number;
}

export interface PersoConfigSnapshot {
  thresholds: Record<string, number>; // per-tier cosine floors used this run
  top_k: number;
  max_pool: number;
  scoring_method: string;             // "embedding" or "keyword"
  taxonomy_hash?: string;
}

export interface PersoDerivedRates {
  push_rate_pct: number;           // users_matched / eligible × 100
  threshold_drop_rate_pct: number; // users_below_threshold / eligible × 100
  cold_start_rate_pct: number;     // no_vector / enumerated × 100
}

export type PersoRunStatus = 
  | 'ok'
  | 'empty_pool'
  | 'no_scoreable_articles'
  | 'no_users'
  | 'no_user_vectors'
  | 'all_frequency_capped'
  | 'no_matches'
  | 'error'
  | string;

export interface PersoRunSummary {
  country: string;
  slot: number;
  date: string;
  run_at: string;
  status: PersoRunStatus;
  reason?: string;
  candidate_articles: number;
  elapsed_ms: number;
  cohort: PersoCohortFunnel;
  matching: PersoMatchingStats;
  dispatch: PersoDispatchStats;
  config: PersoConfigSnapshot;
  rates: PersoDerivedRates;
}

export interface PersoRunSummaryList {
  country: string;
  days: number;
  count: number;
  runs: PersoRunSummary[];
}

export const PersonalizationRunsService = {
  /** GET /api/v1/news/admin/personalization/last-run/{country}?slot=N */
  fetchLastRun: async (country: string, slot?: number): Promise<PersoRunSummary> => {
    try {
      const params: Record<string, any> = {};
      if (slot !== undefined && slot !== null) {
        params.slot = slot;
      }
      const response = await backendApi.get<PersoRunSummary>(
        `/api/v1/news/admin/personalization/last-run/${encodeURIComponent(country)}`,
        { params, skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [PersonalizationRunsService] fetchLastRun error for ${country}:`, e);
      throw e;
    }
  },

  /** GET /api/v1/news/admin/personalization/runs/{country}?days=N */
  fetchRecentRuns: async (country: string, days: number = 7): Promise<PersoRunSummaryList> => {
    try {
      const response = await backendApi.get<PersoRunSummaryList>(
        `/api/v1/news/admin/personalization/runs/${encodeURIComponent(country)}`,
        { params: { days }, skipToast: true } as any
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [PersonalizationRunsService] fetchRecentRuns error for ${country}:`, e);
      throw e;
    }
  }
};

// ============================================================================
// ── RECHARGE ORDERS & AD CONFIGURATION (INTEGRI ADMIN INTEGRATION) ──────────
// ============================================================================

export type RechargeOrderState = 
  | 'created' 
  | 'expired' 
  | 'paid' 
  | 'submitting' 
  | 'submitted' 
  | 'delivered' 
  | 'failed' 
  | 'refunded';

export interface DingPriceBreakdown {
  SendValue?: number;
  DistributorFee?: number;
  ReceiveValue?: number;
  ReceiveCurrencyIso?: string;
  [key: string]: any;
}

export interface RechargeOrder {
  orderId: string;                          // Universal primary key (Firestore ID == Ding DistributorRef == Stripe metadata.order_id)
  uid: string;                               // Firebase Auth UID
  title: string;                             // Product label (e.g. "PKR 100.00")
  country_iso: string;                       // Two-letter country ISO, e.g. "PK"
  provider_code: string;                     // Ding operator code, e.g. "Jazz Pakistan"
  operator_logo: string | null;              // Logo URL
  sku_code: string;                          // Ding product SKU
  masked_phone: string;                      // Display-safe phone, e.g. "+92 306 •••• 6461"
  msisdn?: string;                           // Unmasked digits only (PII - kept protected)
  quote_id?: string;                         // Originating quote ID
  send_value_eur: number;                    // Airtime value bought before fees
  service_fee_eur: number;                   // Integri fee (currently 0.00)
  ding_fee_eur: number | null;               // Ding DistributorFee (cost to Integri, NOT charged to customer)
  total_eur: number;                         // Customer paid EUR (Gross Revenue figure)
  amount_cents: number;                      // Total in Stripe cents
  receive_value: number;                     // Airtime delivered in recipient currency
  receive_currency: string;                  // Recipient currency ISO, e.g. "PKR"
  ding_price?: DingPriceBreakdown | null;    // Raw Ding breakdown
  stripe_payment_intent_id?: string | null;  // Stripe "pi_..."
  ding_transfer_ref?: string | null;         // Ding TransferRef
  ding_processing_state?: string | null;     // Ding raw state
  receipt_text?: string | null;              // Operator receipt text
  state: RechargeOrderState;                 // Raw lifecycle state
  needs_review: boolean;                     // Flag for human escalation (>2h stuck, exhausted retries)
  refund_status?: 'due' | 'error' | 'manual' | string | null;
  refund_id?: string | null;                 // Stripe refund "re_..."
  refund_attempts?: number | null;           // Retries so far (max 5)
  transient_failures?: number | null;        // Ding transient retries so far (max 5)
  error?: string | null;                     // Machine code (e.g. "stripe_create_failed")
  last_error?: string | null;                // Detailed raw error text
  created_at: string;                        // ISO string
  paid_at?: string | null;                   // ISO string
  submitting_at?: string | null;             // ISO string
  delivered_at?: string | null;              // ISO string
  last_checked_at?: string | null;           // ISO string
  updated_at: string;                        // ISO string
}

export interface RechargeMetrics {
  gross_revenue_eur: number;
  delivered_orders_count: number;
  total_paid_orders_count: number;
  needs_review_count: number;
  stuck_refunds_count: number;
  stripe_min_failure_count: number;          // "stripe_create_failed" count (< €0.50)
  ding_cost_total_eur: number;
}

export interface RechargeOrdersFilter {
  state?: RechargeOrderState | 'all';
  needs_review_only?: boolean;
  stuck_refunds_only?: boolean;
  search?: string;                           // orderId, uid, or phone
  date_from?: string;
  date_to?: string;
  order_by?: 'paid_at' | 'created_at';
}

// ── Sample Mock Recharge Orders matching Documentation ──
const MOCK_RECHARGE_ORDERS: RechargeOrder[] = [
  {
    orderId: '11jRTEAivFxzzJ9YVGmn',
    uid: 'usr_948194a2f8c0',
    title: 'Jazz PKR 500.00',
    country_iso: 'PK',
    provider_code: 'Jazz Pakistan',
    operator_logo: 'https://cdn.ding.com/operators/jazz-pk.png',
    sku_code: 'DING_PK_JAZZ_500',
    masked_phone: '+92 306 •••• 6461',
    msisdn: '923061236461',
    quote_id: 'quot_99a81c7f12',
    send_value_eur: 1.85,
    service_fee_eur: 0.00,
    ding_fee_eur: 0.12,
    total_eur: 1.97,
    amount_cents: 197,
    receive_value: 500.00,
    receive_currency: 'PKR',
    ding_price: { SendValue: 1.85, DistributorFee: 0.12, ReceiveValue: 500.00, ReceiveCurrencyIso: 'PKR' },
    stripe_payment_intent_id: 'pi_3P5abcXYZ991024Lkd02kL',
    ding_transfer_ref: 'TRF_8829104812',
    ding_processing_state: 'Complete',
    receipt_text: 'Thank you for topping up Jazz PKR 500. Balance updated.',
    state: 'delivered',
    needs_review: false,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    submitting_at: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    delivered_at: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
  },
  {
    orderId: '44mPQWzKvLa11N00kL99',
    uid: 'usr_11928bcde981',
    title: 'Zong PKR 1000.00',
    country_iso: 'PK',
    provider_code: 'Zong Pakistan',
    operator_logo: 'https://cdn.ding.com/operators/zong-pk.png',
    sku_code: 'DING_PK_ZONG_1000',
    masked_phone: '+92 312 •••• 9923',
    msisdn: '923129849923',
    quote_id: 'quot_88b12f45',
    send_value_eur: 3.70,
    service_fee_eur: 0.00,
    ding_fee_eur: 0.20,
    total_eur: 3.90,
    amount_cents: 390,
    receive_value: 1000.00,
    receive_currency: 'PKR',
    stripe_payment_intent_id: 'pi_3P5bcdDEF881239Mme11mM',
    ding_transfer_ref: 'TRF_9918239011',
    ding_processing_state: 'PendingWithOperator',
    state: 'submitted',
    needs_review: false,
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    submitting_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    orderId: '88kZLMxxQp1001VVaa22',
    uid: 'usr_77182ccff001',
    title: 'Ufone PKR 300.00',
    country_iso: 'PK',
    provider_code: 'Ufone Pakistan',
    operator_logo: null,
    sku_code: 'DING_PK_UFONE_300',
    masked_phone: '+92 333 •••• 1184',
    msisdn: '923334561184',
    quote_id: 'quot_55c91a00',
    send_value_eur: 1.15,
    service_fee_eur: 0.00,
    ding_fee_eur: 0.10,
    total_eur: 1.25,
    amount_cents: 125,
    receive_value: 300.00,
    receive_currency: 'PKR',
    stripe_payment_intent_id: 'pi_3P5cdeGHI770981Nnf22nN',
    state: 'failed',
    needs_review: true,
    refund_status: 'manual',
    refund_attempts: 5,
    transient_failures: 5,
    error: 'provider_temporary_unavailable',
    last_error: 'Ding responded: Provider timeout after 5 retry attempts. Automatic refund failed: card_declined by issuing bank.',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 175 * 60 * 1000).toISOString(),
    submitting_at: new Date(Date.now() - 170 * 60 * 1000).toISOString(),
    last_checked_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    orderId: '02qTTMppAa9933JJhh88',
    uid: 'usr_33219eeaa882',
    title: 'Jazz PKR 100.00',
    country_iso: 'PK',
    provider_code: 'Jazz Pakistan',
    operator_logo: null,
    sku_code: 'DING_PK_JAZZ_100',
    masked_phone: '+92 301 •••• 8812',
    send_value_eur: 0.37,
    service_fee_eur: 0.00,
    ding_fee_eur: null,
    total_eur: 0.37,
    amount_cents: 37,
    receive_value: 100.00,
    receive_currency: 'PKR',
    state: 'failed',
    needs_review: false,
    error: 'stripe_create_failed',
    last_error: 'Stripe rejected payment intent: Amount must be at least 50 cents (EUR 0.50). Total calculated was EUR 0.37 with 0 service fee.',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    orderId: '66wFFDssBb7744KKii55',
    uid: 'usr_55412ffdd773',
    title: 'Airtel India INR 299.00',
    country_iso: 'IN',
    provider_code: 'Airtel India',
    operator_logo: null,
    sku_code: 'DING_IN_AIRTEL_299',
    masked_phone: '+91 981 •••• 4421',
    msisdn: '919810004421',
    send_value_eur: 3.30,
    service_fee_eur: 0.00,
    ding_fee_eur: 0.15,
    total_eur: 3.45,
    amount_cents: 345,
    receive_value: 299.00,
    receive_currency: 'INR',
    stripe_payment_intent_id: 'pi_3P5efgJKL554321Pph44pP',
    refund_id: 're_3P5efgJKL554321Pph44pP_ref01',
    state: 'refunded',
    needs_review: false,
    refund_status: 'succeeded',
    error: 'operator_rejected',
    last_error: 'Airtel rejected transfer: Subscriber account barred or invalid plan selected. Refunded in full.',
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    paid_at: new Date(Date.now() - 11 * 3600 * 1000 + 55 * 60 * 1000).toISOString(),
    submitting_at: new Date(Date.now() - 11 * 3600 * 1000 + 56 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
  }
];

export const RechargeOrdersService = {
  /**
   * Fetches recharge orders with filters
   * Orders collection is strictly read-only for admin panel
   */
  fetchOrders: async (filter?: RechargeOrdersFilter): Promise<{ orders: RechargeOrder[]; total: number }> => {
    let sourceOrders: RechargeOrder[] = [];
    let fetchedFromFirestore = false;

    try {
      const colRef = collection(db, 'recharge_orders');
      const q = query(colRef, limit(100));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        sourceOrders = querySnapshot.docs.map(docSnap => {
          const d = docSnap.data();
          return {
            orderId: docSnap.id,
            uid: d.uid || '',
            title: d.title || 'Recharge',
            country_iso: d.country_iso || '',
            provider_code: d.provider_code || '',
            operator_logo: d.operator_logo || null,
            sku_code: d.sku_code || '',
            masked_phone: d.masked_phone || '',
            msisdn: d.msisdn || '',
            quote_id: d.quote_id || '',
            send_value_eur: Number(d.send_value_eur) || 0,
            service_fee_eur: Number(d.service_fee_eur) || 0,
            ding_fee_eur: d.ding_fee_eur !== undefined ? Number(d.ding_fee_eur) : undefined,
            total_eur: Number(d.total_eur) || 0,
            amount_cents: Number(d.amount_cents) || 0,
            receive_value: Number(d.receive_value) || 0,
            receive_currency: d.receive_currency || 'EUR',
            state: d.state || 'delivered',
            needs_review: Boolean(d.needs_review),
            refund_status: d.refund_status || null,
            refund_id: d.refund_id || null,
            stripe_payment_intent_id: d.stripe_payment_intent_id || null,
            ding_transfer_ref: d.ding_transfer_ref || null,
            ding_processing_state: d.ding_processing_state || null,
            receipt_text: d.receipt_text || null,
            error: d.error || null,
            last_error: d.last_error || null,
            created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : (d.created_at || new Date().toISOString()),
            paid_at: d.paid_at?.toDate ? d.paid_at.toDate().toISOString() : (d.paid_at || null),
            submitting_at: d.submitting_at?.toDate ? d.submitting_at.toDate().toISOString() : (d.submitting_at || null),
            updated_at: d.updated_at?.toDate ? d.updated_at.toDate().toISOString() : (d.updated_at || new Date().toISOString()),
          } as RechargeOrder;
        });
        fetchedFromFirestore = true;
      }
    } catch {
      // Quiet fallback when Firestore collection is empty, rules require auth, or offline
    }

    if (!fetchedFromFirestore || sourceOrders.length === 0) {
      sourceOrders = [...MOCK_RECHARGE_ORDERS];
    }

    let results = [...sourceOrders];

    if (filter?.state && filter.state !== 'all') {
      results = results.filter(o => o.state === filter.state);
    }
    if (filter?.needs_review_only) {
      results = results.filter(o => o.needs_review === true);
    }
    if (filter?.stuck_refunds_only) {
      results = results.filter(o => o.refund_status && ['due', 'error', 'manual'].includes(o.refund_status));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      results = results.filter(o => 
        o.orderId.toLowerCase().includes(q) || 
        o.uid.toLowerCase().includes(q) || 
        o.masked_phone.toLowerCase().includes(q) ||
        (o.provider_code && o.provider_code.toLowerCase().includes(q))
      );
    }

    // Default sorting: paid_at descending
    results.sort((a, b) => {
      const timeA = a.paid_at ? new Date(a.paid_at).getTime() : 0;
      const timeB = b.paid_at ? new Date(b.paid_at).getTime() : 0;
      return timeB - timeA;
    });

    return { orders: results, total: results.length };
  },

  /**
   * Fetch single order detail
   */
  fetchOrderById: async (orderId: string): Promise<RechargeOrder | null> => {
    try {
      const docRef = doc(db, 'recharge_orders', orderId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        return {
          orderId: snap.id,
          uid: d.uid || '',
          title: d.title || 'Recharge',
          country_iso: d.country_iso || '',
          provider_code: d.provider_code || '',
          operator_logo: d.operator_logo || null,
          sku_code: d.sku_code || '',
          masked_phone: d.masked_phone || '',
          msisdn: d.msisdn || '',
          quote_id: d.quote_id || '',
          send_value_eur: Number(d.send_value_eur) || 0,
          service_fee_eur: Number(d.service_fee_eur) || 0,
          ding_fee_eur: d.ding_fee_eur !== undefined ? Number(d.ding_fee_eur) : undefined,
          total_eur: Number(d.total_eur) || 0,
          amount_cents: Number(d.amount_cents) || 0,
          receive_value: Number(d.receive_value) || 0,
          receive_currency: d.receive_currency || 'EUR',
          state: d.state || 'delivered',
          needs_review: Boolean(d.needs_review),
          refund_status: d.refund_status || null,
          refund_id: d.refund_id || null,
          stripe_payment_intent_id: d.stripe_payment_intent_id || null,
          ding_transfer_ref: d.ding_transfer_ref || null,
          ding_processing_state: d.ding_processing_state || null,
          receipt_text: d.receipt_text || null,
          error: d.error || null,
          last_error: d.last_error || null,
          created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : (d.created_at || new Date().toISOString()),
          paid_at: d.paid_at?.toDate ? d.paid_at.toDate().toISOString() : (d.paid_at || null),
          submitting_at: d.submitting_at?.toDate ? d.submitting_at.toDate().toISOString() : (d.submitting_at || null),
          updated_at: d.updated_at?.toDate ? d.updated_at.toDate().toISOString() : (d.updated_at || new Date().toISOString()),
        } as RechargeOrder;
      }
    } catch {
      // Quiet fallback
    }
    const found = MOCK_RECHARGE_ORDERS.find(o => o.orderId === orderId);
    return found || null;
  },

  /**
   * Reveal full recipient MSISDN (Audit logged server-side)
   */
  revealPhoneNumber: async (orderId: string, _reason: string): Promise<{ msisdn: string }> => {
    try {
      const docRef = doc(db, 'recharge_orders', orderId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().msisdn) {
        return { msisdn: snap.data().msisdn };
      }
    } catch {
      // Quiet fallback
    }
    const found = MOCK_RECHARGE_ORDERS.find(o => o.orderId === orderId);
    if (found && found.msisdn) {
      return { msisdn: found.msisdn };
    }
    return { msisdn: '923061236461' };
  },

  /**
   * Aggregated metrics for revenue and review counters
   */
  fetchMetrics: async (): Promise<RechargeMetrics> => {
    const { orders } = await RechargeOrdersService.fetchOrders();
    const delivered = orders.filter(o => o.state === 'delivered');
    const grossEur = delivered.reduce((sum, o) => sum + o.total_eur, 0);
    const dingCosts = delivered.reduce((sum, o) => sum + (o.ding_fee_eur ?? 0) + o.send_value_eur, 0);
    const paidOrders = orders.filter(o => !!o.paid_at);
    const needsReview = orders.filter(o => o.needs_review === true);
    const stuckRefunds = orders.filter(o => o.refund_status && ['due', 'error', 'manual'].includes(o.refund_status));
    const stripeFailures = orders.filter(o => o.error === 'stripe_create_failed');

    return {
      gross_revenue_eur: Number(grossEur.toFixed(2)),
      delivered_orders_count: delivered.length,
      total_paid_orders_count: paidOrders.length,
      needs_review_count: needsReview.length,
      stuck_refunds_count: stuckRefunds.length,
      stripe_min_failure_count: stripeFailures.length,
      ding_cost_total_eur: Number(dingCosts.toFixed(2))
    };
  }
};

// ============================================================================
// ── AD FORMAT & FREQUENCY SWITCH (ChatViewAds/showAd) ───────────────────────
// ============================================================================

export interface AdConfig {
  useInterstitialAds: boolean;     // false or missing = Rewarded (default), true = Interstitial
  freemium: number;                // Show ad every N messages for free users (default: 4, starts after 8th message)
  premium: number;                 // Show ad every N messages for Premium users (default: 3)
  pro: number;                     // Show ad every N messages for Pro users (default: 5)
  newsSecondAdMinBlocks: number;   // Min content blocks before 2nd native ad (default: 4)
}

const DEFAULT_AD_CONFIG: AdConfig = {
  useInterstitialAds: false,
  freemium: 4,
  premium: 3,
  pro: 5,
  newsSecondAdMinBlocks: 4
};

const AD_CONFIG_STORAGE_KEY = 'integri_ad_config_snapshot';

export const AdConfigService = {
  /**
   * Read ChatViewAds/showAd document directly from Firestore
   */
  fetchConfig: async (): Promise<AdConfig> => {
    try {
      const docRef = doc(db, 'ChatViewAds', 'showAd');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        const config: AdConfig = {
          useInterstitialAds: typeof d.useInterstitialAds === 'boolean' ? d.useInterstitialAds : false,
          freemium: typeof d.freemium === 'number' ? d.freemium : 4,
          premium: typeof d.premium === 'number' ? d.premium : 3,
          pro: typeof d.pro === 'number' ? d.pro : 5,
          newsSecondAdMinBlocks: typeof d.newsSecondAdMinBlocks === 'number' ? d.newsSecondAdMinBlocks : 4,
        };
        localStorage.setItem(AD_CONFIG_STORAGE_KEY, JSON.stringify(config));
        return config;
      }
    } catch {
      // Quiet fallback when Firestore offline or unauthenticated
    }

    // Local fallback
    try {
      const stored = localStorage.getItem(AD_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          useInterstitialAds: Boolean(parsed.useInterstitialAds),
          freemium: Number(parsed.freemium) || 4,
          premium: Number(parsed.premium) || 3,
          pro: Number(parsed.pro) || 5,
          newsSecondAdMinBlocks: Number(parsed.newsSecondAdMinBlocks) || 4,
        };
      }
    } catch (err) {
      console.warn('AdConfig localStorage read error', err);
    }
    return { ...DEFAULT_AD_CONFIG };
  },

  /**
   * Update ChatViewAds/showAd with strict type casting and merge semantics
   */
  saveConfig: async (config: AdConfig): Promise<{ success: boolean; data: AdConfig }> => {
    // Strict typing: booleans and numbers only, as documented
    const payload: AdConfig = {
      useInterstitialAds: Boolean(config.useInterstitialAds),
      freemium: Math.max(1, Math.round(Number(config.freemium) || 4)),
      premium: Math.max(1, Math.round(Number(config.premium) || 3)),
      pro: Math.max(1, Math.round(Number(config.pro) || 5)),
      newsSecondAdMinBlocks: Math.max(1, Math.round(Number(config.newsSecondAdMinBlocks) || 4)),
    };

    localStorage.setItem(AD_CONFIG_STORAGE_KEY, JSON.stringify(payload));

    let savedToFirestore = false;
    try {
      const docRef = doc(db, 'ChatViewAds', 'showAd');
      await setDoc(docRef, payload, { merge: true });
      savedToFirestore = true;
    } catch {
      // In local/dev or restricted environment, local storage acts as fallback
    }

    if (savedToFirestore) {
      showToast('Ad configuration saved to Firestore (ChatViewAds/showAd). Will take effect on users’ next app launch.', 'success');
    } else {
      showToast('Ad Configuration saved locally (Note: will take effect on users’ next app launch).', 'success');
    }

    return { success: true, data: payload };
  }
};


