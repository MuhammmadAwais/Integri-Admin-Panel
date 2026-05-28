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
 * Auth Token Generator
 */
export const getBackendToken = async (): Promise<string | null> => {
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/token`, {
      user_id: ADMIN_UID,
      email: ADMIN_EMAIL,
      user_type: 'freemium'
    });
    
    if (response.data && response.data.access_token) {
      localStorage.setItem('integri_jwt', response.data.access_token);
      return response.data.access_token;
    }
    return null;
  } catch (error) {
    console.error("❌ [API] Failed to generate backend token:", error);
    throw error;
  }
};

/**
 * Request Interceptor (The "Sentinel")
 * Automatically attaches stored JWT token.
 */
backendApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('integri_jwt');
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
    // Show success toast unless skipToast is explicitly set
    if (!customConfig?.skipToast) {
      const successMessage = getSuccessMessage(response);
      showToast(successMessage, 'success');
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; skipToast?: boolean };

    // Format readable error message
    const errorMessage = getErrorMessage(error);

    // Print error details in the console as requested by the user
    console.error(`❌ [API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    console.error(`Error Message: ${errorMessage}`);
    
    if (error.response) {
      console.error("Status Code:", error.response.status);
      console.error("Response Data:", error.response.data);
      console.error("Headers:", error.response.headers);
    } else if (error.request) {
      console.error("No response received. Request details:", error.request);
    } else {
      console.error("Error configuration:", error.message);
    }
    console.error("Full Error Object:", error);

    // Silent 401 token refresh retry check
    const is401Retry = error.response?.status === 401 && !originalRequest?._retry;

    // Trigger error toast unless skipToast is set or this is a silent 401 token refresh
    if (!originalRequest?.skipToast && !is401Retry) {
      showToast(errorMessage, 'error');
    }

    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return backendApi(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await getBackendToken();
        isRefreshing = false;
        processQueue(null, newToken);
        if (newToken) {
          originalRequest.headers.Authorization = 'Bearer ' + newToken;
          return backendApi(originalRequest);
        }
        return Promise.reject(error);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        return Promise.reject(err);
      }
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
      const params: Record<string, string | number> = { days };
      if (country) params.country = country;
      const response = await backendApi.get<AdminArticlesResponse>(
        '/api/v1/news/admin/articles',
        { params }
      );
      return response.data;
    } catch (e) {
      console.error('❌ [NewsService] fetchAdminArticles error:', e);
      throw e;
    }
  },

  /**
   * Fetch full article detail (content, grammar, keywords).
   * GET /api/v1/news/admin/articles/{news_id}?collection=News
   */
  fetchArticleDetails: async (news_id: string): Promise<ArticleDetail> => {
    try {
      const response = await backendApi.get<ArticleDetail>(
        `/api/v1/news/admin/articles/${news_id}`,
        { params: { collection: 'News' } }
      );
      return response.data;
    } catch (e) {
      console.error(`❌ [NewsService] fetchArticleDetails error for ${news_id}:`, e);
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
};

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
      const response = await backendApi.get<UsersUsageResponse>('/api/v1/users/usage', {
        params
      });
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

