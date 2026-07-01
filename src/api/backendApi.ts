import axios, { 
  InternalAxiosRequestConfig, 
  AxiosResponse, 
  AxiosError, 
  AxiosInstance, 
} from 'axios';
import { showToast } from 'components/EliteUI/EliteToastContainer';

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
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
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
    try {
      console.log({ country, "fetching": "admin articles" })
      const params: Record<string, string | number> = { days };
      if (country) params.country = country;
      const response = await backendApi.get<AdminArticlesResponse>(
        '/api/v1/news/admin/articles',
        { params }
      );
      console.log({ "response": response })
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchAdminArticles error:', e);
      throw e;
    }
  },

  /**
   * Fetch full article detail (content, grammar, keywords).
   * Tries collection=News first; if the API returns 404 automatically
   * retries with collection=Articles as a fallback.
   * GET /api/v1/news/admin/articles/{news_id}?collection=News|Articles
   */
  fetchArticleDetails: async (news_id: string): Promise<ArticleDetail> => {
    const COLLECTIONS = ['News', 'Articles'] as const;

    for (let i = 0; i < COLLECTIONS.length; i++) {
      const collection = COLLECTIONS[i];
      try {
        console.log(`🔍 [NewsService] fetchArticleDetails — trying collection="${collection}" for id: ${news_id}`);
        const response = await backendApi.get<ArticleDetail>(
          `/api/v1/news/admin/articles/${news_id}`,
          { params: { collection } }
        );
        console.log(`✅ [NewsService] fetchArticleDetails — found in collection="${collection}"`);
        return response.data;
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404 && i < COLLECTIONS.length - 1) {
          // Not found in this collection — try the next one
          console.warn(
            `⚠️ [NewsService] fetchArticleDetails — article not found in collection="${collection}" (404). ` +
            `Retrying with collection="${COLLECTIONS[i + 1]}"…`
          );
          continue;
        }
        // Either it's not a 404, or we've exhausted all collections
        console.error(`❌ [NewsService] fetchArticleDetails — failed for ${news_id} in collection="${collection}":`, e);
        throw e;
      }
    }

    // TypeScript requires an explicit throw here (unreachable at runtime)
    throw new Error(`[NewsService] fetchArticleDetails — article ${news_id} not found in any collection.`);
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
};

// ─────────────────────────────────────────────────────────────────────────────
//  📰 MANUAL ARTICLE — Types
// ─────────────────────────────────────────────────────────────────────────────

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
}

export interface ManualArticleResponse {
  detail: string;
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
  voice_minutes: number;
  image_generation: number;
  file_input_token_cap: number;
  default_model_on_limit: string;
}

export type TierName = 'freemium' | 'premium' | 'pro';

export interface TierLimitsResponse {
  source: string;
  limits: Record<TierName, TierLimitsConfig>;
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

  updateTierLimits: async (payload: Partial<Record<TierName, Partial<TierLimitsConfig>>>): Promise<any> => {
    try {
      const response = await backendApi.put<any>('/api/v1/admin/tier-limits', payload);
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
