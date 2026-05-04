import axios, { 
  InternalAxiosRequestConfig, 
  AxiosResponse, 
  AxiosError, 
  AxiosInstance, 
} from 'axios';

/**
 * Type Definitions for Intelligence Core
 */
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

const BASE_URL = import.meta.env.VITE_APP_BACKEND_API_BASE_URL.replace(/\/$/, '');
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
      user_type: 'premium'
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
 * Response Interceptor
 * Guards against 401s, attempts silent token refresh.
 */
backendApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
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

/** Admin countries endpoint response */
export interface AdminCountriesResponse {
  total_countries: number;
  supported_countries: Record<string, string>;
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
};
