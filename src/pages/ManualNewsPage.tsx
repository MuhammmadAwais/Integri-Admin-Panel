import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, FileText, Link, Plus, Trash2,
  ChevronDown, ChevronRight, Send, TrendingUp, Image, BookOpen, AlertCircle, CheckCircle2
} from 'lucide-react';
import { backendApi, NewsService } from 'api/backendApi';
import type { AdminCountriesResponse } from 'api/backendApi';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import 'features/news/styles/news.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface FieldErrors {
  country?: string;
  headline?: string;
  body?: string;
  image_url?: string;
  [key: string]: string | undefined;
}

interface ManualArticleResponse {
  detail: string;
  [key: string]: unknown;
}

// ── Sub-components (memoised) ─────────────────────────────────────────────────

interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FieldLabel = memo(({ htmlFor, required, children }: LabelProps) => (
  <label
    htmlFor={htmlFor}
    style={{
      display: 'block',
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.9px',
      color: 'var(--news-text-muted)',
      marginBottom: 7,
    }}
  >
    {children}
    {required && <span style={{ color: '#DC143C', marginLeft: 3 }}>*</span>}
  </label>
));

interface FieldErrorProps { message?: string }

const FieldError = memo(({ message }: FieldErrorProps) =>
  message ? (
    <span
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 5,
        fontSize: '0.74rem',
        color: '#DC143C',
        fontWeight: 600,
      }}
    >
      <AlertCircle size={11} />
      {message}
    </span>
  ) : null
);

// ── Source Row ─────────────────────────────────────────────────────────────────

interface SourceRowProps {
  index: number;
  source: ManualArticleSource;
  onChange: (index: number, field: keyof ManualArticleSource, value: string) => void;
  onRemove: (index: number) => void;
}

const SourceRow = memo(({ index, source, onChange, onRemove }: SourceRowProps) => (
  <fieldset
    style={{
      border: '1px solid var(--news-card-border)',
      borderRadius: 4,
      padding: '14px 16px',
      marginBottom: 10,
      background: 'var(--news-panel-bg)',
    }}
    aria-label={`Source ${index + 1}`}
  >
    <legend
      style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        color: 'var(--news-text-muted)',
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Link size={10} style={{ color: '#D4AF37' }} />
      Source {index + 1}
      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label={`Remove source ${index + 1}`}
        style={{
          background: 'transparent',
          border: '1px solid var(--news-card-border)',
          borderRadius: 3,
          padding: '2px 6px',
          color: 'var(--news-text-muted)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC143C';
          (e.currentTarget as HTMLButtonElement).style.color = '#DC143C';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--news-card-border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--news-text-muted)';
        }}
      >
        <Trash2 size={10} /> Remove
      </button>
    </legend>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
      {(['title', 'source', 'url', 'image'] as (keyof ManualArticleSource)[]).map(field => (
        <div key={field} style={field === 'url' || field === 'image' ? { gridColumn: '1 / -1' } : {}}>
          <FieldLabel htmlFor={`src-${index}-${field}`}>
            {field === 'image' ? 'Image URL' : field.charAt(0).toUpperCase() + field.slice(1)}
          </FieldLabel>
          <input
            id={`src-${index}-${field}`}
            type="text"
            value={source[field]}
            onChange={e => onChange(index, field, e.target.value)}
            placeholder={
              field === 'url' ? 'https://source-article.com/…'
              : field === 'image' ? 'https://cdn.example.com/logo.png'
              : field === 'source' ? 'Publisher name'
              : 'Article title'
            }
            style={{
              width: '100%',
              padding: '8px 11px',
              background: 'var(--news-input-bg)',
              border: '1px solid var(--news-card-border)',
              borderRadius: 3,
              color: 'var(--news-text-main)',
              fontSize: '0.84rem',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.18s ease',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#D4AF37')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--news-card-border)')}
          />
        </div>
      ))}
    </div>
  </fieldset>
));

// ── Success Modal Helper & Component ─────────────────────────────────────────

interface SuccessMetaItem {
  label: string;
  value: string;
}

interface ParsedSuccess {
  description: string;
  metadata: SuccessMetaItem[] | null;
}

function parseSuccessDetail(detail: string): ParsedSuccess {
  // Regex to match: "Article queued for translation/compile. It will be stored as the spotlight for 'Austria' (slot 1) and delivered by the country's next scheduled notification at 2026-06-04 14:00 UTC — not pushed now."
  const regex = /queued for translation.*?It will be stored as the\s+([a-zA-Z0-9_\-]+)\s+for\s+'([^']+)'\s+\(slot\s+(\d+)\)\s+and delivered.*?notification at\s+(.*?)\s*(?:—|$)/i;
  const match = detail.match(regex);

  if (match) {
    const [, articleType, country, slot, rawTime] = match;
    const capitalizedType = articleType.charAt(0).toUpperCase() + articleType.slice(1);
    
    let formattedTime = rawTime.trim();
    try {
      const cleanTimeStr = formattedTime.replace(' UTC', 'Z').replace(' ', 'T');
      const date = new Date(cleanTimeStr);
      if (!isNaN(date.getTime())) {
        formattedTime = date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) + ' at ' + date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
      }
    } catch (e) {
      // Fallback
    }

    return {
      description: `Your article has been successfully queued for translation and publication. It will be delivered as the spotlight article for ${country}.`,
      metadata: [
        { label: 'Target Country', value: country },
        { label: 'Slot Assignment', value: `${capitalizedType} (Slot ${slot})` },
        { label: 'Scheduled Delivery', value: formattedTime },
      ]
    };
  }

  // Fallback clean text
  const cleanDesc = detail
    .replace(/— not pushed now\.?/i, '')
    .replace(/returns 202 accepted/i, '')
    .trim();

  return {
    description: cleanDesc,
    metadata: null
  };
}

interface SuccessModalProps {
  detail: string;
  onClose: () => void;
}

const SuccessModal = memo(({ detail, onClose }: SuccessModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const parsed = parseSuccessDetail(detail);

  // Close on overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  // Close on Escape & Lock background scrolling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    
    // Save original overflow style of body and set to hidden
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Article queued successfully"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--news-panel-overlay, rgba(0,0,0,0.62))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          background: 'var(--news-modal-bg, #0a0a0a)',
          border: '1px solid var(--news-panel-border, #27272a)',
          borderRadius: 6,
          padding: '36px 40px',
          maxWidth: 480,
          width: '90%',
          textAlign: 'center',
          boxShadow: 'var(--news-card-shadow)',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <CheckCircle2 size={28} style={{ color: '#22c55e' }} />
        </div>

        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--news-text-main)',
            marginBottom: 10,
          }}
        >
          Article Queued
        </h3>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'var(--news-text-muted)',
            lineHeight: 1.6,
            marginBottom: parsed.metadata ? 20 : 28,
            fontWeight: 500,
          }}
        >
          {parsed.description}
        </p>

        {parsed.metadata && (
          <div
            style={{
              background: 'var(--news-table-header-bg)',
              border: '1px solid var(--news-card-border)',
              borderRadius: 4,
              padding: '12px 16px',
              marginBottom: 28,
              textAlign: 'left',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {parsed.metadata.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: 'var(--news-text-muted)', fontWeight: 600 }}>{item.label}</span>
                <span style={{ color: 'var(--news-text-main)', fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#D4AF37',
              border: 'none',
              borderRadius: 3,
              color: '#000',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'filter 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Toggle (boolean switch) ───────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

const Toggle = memo(({ id, checked, onChange, label, description }: ToggleProps) => (
  <label
    htmlFor={id}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      cursor: 'pointer',
      padding: '12px 14px',
      border: `1px solid ${checked ? 'rgba(212,175,55,0.3)' : 'var(--news-card-border)'}`,
      borderRadius: 3,
      background: checked ? 'var(--news-table-header-bg)' : 'var(--news-panel-bg)',
      transition: 'all 0.2s ease',
      userSelect: 'none',
    }}
  >
    <div
      style={{
        position: 'relative',
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? '#D4AF37' : 'var(--news-card-border)',
        border: `1px solid ${checked ? '#D4AF37' : 'var(--news-card-border)'}`,
        transition: 'all 0.22s ease',
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: checked ? 'var(--news-card-bg)' : 'var(--news-text-dim)',
          transition: 'left 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      />
    </div>
    <div>
      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: checked ? '#D4AF37' : 'var(--news-text-muted)' }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: '0.76rem', color: 'var(--news-text-dim)', marginTop: 2, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </div>
  </label>
));

// ── TOPIC_OPTIONS & ARTICLE_TYPE_OPTIONS ──────────────────────────────────────

const TOPIC_OPTIONS = [
  'general', 'politics', 'business', 'technology', 'science',
  'health', 'sports', 'entertainment', 'world', 'environment',
];

const ARTICLE_TYPE_OPTIONS = [
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'brief', label: 'Brief' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'breaking', label: 'Breaking' },
];

// ── Default blank source ──────────────────────────────────────────────────────
const blankSource = (): ManualArticleSource => ({ title: '', image: '', source: '', url: '' });

// ══════════════════════════════════════════════════════════════════════════════
//  ManualNewsPage — Main Component
// ══════════════════════════════════════════════════════════════════════════════

export default function ManualNewsPage() {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [country, setCountry] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('general');
  const [articleType, setArticleType] = useState('spotlight');
  const [extractLearningAids, setExtractLearningAids] = useState(false);
  const [markAsTrending, setMarkAsTrending] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [sources, setSources] = useState<ManualArticleSource[]>([]);

  // ── Country dropdown state ────────────────────────────────────────────────
  const [countries, setCountries] = useState<Record<string, unknown>>({});
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropRef = useRef<HTMLDivElement>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [successDetail, setSuccessDetail] = useState<string | null>(null);

  // ── Fetch countries ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await NewsService.fetchAdminCountries();
        if (!cancelled) {
          setCountries(data.supported_countries || {});
        }
      } catch (err) {
        console.error('[ManualNewsPage] Failed to load countries:', err);
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Close country dropdown on outside click ───────────────────────────────
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => {
      if (countryDropRef.current && !countryDropRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  const filteredCountries = Object.keys(countries)
    .filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  // ── Sources CRUD ──────────────────────────────────────────────────────────
  const addSource = useCallback(() => setSources(prev => [...prev, blankSource()]), []);

  const removeSource = useCallback((index: number) =>
    setSources(prev => prev.filter((_, i) => i !== index)), []);

  const updateSource = useCallback(
    (index: number, field: keyof ManualArticleSource, value: string) =>
      setSources(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))),
    []
  );

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!country) errors.country = 'Country is required.';
    if (!headline.trim()) errors.headline = 'Headline is required.';
    else if (headline.trim().length < 10) errors.headline = 'Headline must be at least 10 characters.';
    if (!body.trim()) errors.body = 'Article body is required.';
    else if (body.trim().length < 50) errors.body = 'Body must be at least 50 characters.';
    if (imageUrl && !/^https?:\/\/.+/.test(imageUrl.trim()))
      errors.image_url = 'Must be a valid URL starting with http:// or https://';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    const payload: ManualArticleRequest = {
      country,
      headline: headline.trim(),
      body: body.trim(),
      topic,
      article_type: articleType,
      extract_learning_aids: extractLearningAids,
      mark_as_trending: markAsTrending,
    };

    if (imageUrl.trim()) payload.image_url = imageUrl.trim();
    if (sources.length > 0) {
      const validSources = sources.filter(s => s.title || s.url || s.source);
      if (validSources.length > 0) payload.sources = validSources;
    }

    setSubmitting(true);
    try {
      const res = await backendApi.post<ManualArticleResponse>(
        '/api/v1/news/admin/manual-article',
        payload,
        { skipToast: true } as any
      );
      // 202 Accepted — show the detail string prominently
      const detail = res.data?.detail || 'Article has been queued for delivery.';
      setSuccessDetail(detail);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 403) {
        showToast('403 — Admin access required to submit manual articles.', 'error');
      } else if (status === 422) {
        // Parse FastAPI-style validation errors
        const detail = data?.detail;
        if (Array.isArray(detail)) {
          const parsed: FieldErrors = {};
          detail.forEach((item: any) => {
            const loc: string[] = item.loc || [];
            const field = loc[loc.length - 1];
            if (field) parsed[field] = item.msg;
          });
          setFieldErrors(parsed);
          showToast('Validation failed — check highlighted fields.', 'error');
        } else {
          showToast(
            typeof detail === 'string' ? detail : 'Validation error. Check your inputs.',
            'error'
          );
        }
      } else {
        showToast(
          data?.detail || data?.message || 'Submission failed. Please try again.',
          'error'
        );
      }
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, headline, body, topic, articleType, extractLearningAids, markAsTrending, imageUrl, sources]);

  const handleSuccessClose = useCallback(() => {
    setSuccessDetail(null);
    // Optionally reset form
    setHeadline('');
    setBody('');
    setImageUrl('');
    setSources([]);
    setTopic('general');
    setArticleType('spotlight');
    setExtractLearningAids(false);
    setMarkAsTrending(false);
    setCountry('');
  }, []);

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 13px',
    background: 'var(--news-input-bg)',
    border: '1px solid var(--news-card-border)',
    borderRadius: 3,
    color: 'var(--news-text-main)',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.18s ease',
    boxSizing: 'border-box',
  };

  return (
    <>
      {/* ── Scoped CSS ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: none; } }

        .mn-input:focus { border-color: #D4AF37 !important; }
        .mn-input.has-error { border-color: #DC143C !important; }

        .mn-submit-btn {
          background: #D4AF37;
          border: none;
          color: #000;
          font-weight: 800;
          font-size: 0.9rem;
          padding: 13px 28px;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 9px;
          letter-spacing: 0.3px;
          transition: filter 0.2s ease, transform 0.15s ease;
        }
        .mn-submit-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .mn-submit-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .mn-accordion-header {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 10px 14px;
          background: var(--news-panel-bg);
          border: 1px solid var(--news-card-border);
          border-radius: 3px;
          color: var(--news-text-muted);
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          transition: all 0.2s ease;
          user-select: none;
        }
        .mn-accordion-header:hover {
          border-color: var(--news-text-muted);
          color: var(--news-text-main);
        }

        .mn-section-title {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--news-text-muted);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mn-section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--news-card-border);
        }

        .mn-country-item:hover { background: var(--news-table-header-bg) !important; }
      `}</style>

      <div className="news-glass-archive">

        {/* ── Page Header ────────────────────────────────────────────────────── */}
        <div className="news-command-header">
          <div>
            <button
              type="button"
              onClick={() => navigate('/news')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--news-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: 8,
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={13} /> Back to News
            </button>
            <h2 className="news-title-sharp">Manual Article Submission</h2>
            <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.84rem', fontWeight: 500 }}>
              Compose and queue a hand-crafted article for a country's next available delivery slot.
            </p>
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────────── */}
        <form id="manual-news-form" onSubmit={handleSubmit} noValidate>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 380px',
              gap: 24,
              alignItems: 'start',
            }}
          >

            {/* ══════════════════════════════════════════════════════════════════
                LEFT COLUMN — Primary Content
            ══════════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Country */}
              <div>
                <p className="mn-section-title">
                  <Globe size={11} style={{ color: '#D4AF37' }} /> Target Country
                </p>

                <FieldLabel htmlFor="mn-country" required>Delivery Country</FieldLabel>
                <div ref={countryDropRef} style={{ position: 'relative' }}>
                  <button
                    id="mn-country"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={countryOpen}
                    onClick={() => setCountryOpen(o => !o)}
                    style={{
                      width: '100%',
                      padding: '10px 13px',
                      background: 'var(--news-input-bg)',
                      border: `1px solid ${fieldErrors.country ? '#DC143C' : countryOpen ? '#D4AF37' : 'var(--news-card-border)'}`,
                      borderRadius: 3,
                      color: country ? 'var(--news-text-main)' : 'var(--news-text-muted)',
                      fontSize: '0.88rem',
                      fontWeight: country ? 700 : 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      transition: 'border-color 0.18s ease',
                      textAlign: 'left',
                    }}
                  >
                    <span>{country || (countriesLoading ? 'Loading countries…' : 'Select a country…')}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        color: 'var(--news-text-muted)',
                        transition: 'transform 0.2s ease',
                        transform: countryOpen ? 'rotate(180deg)' : 'none',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {countryOpen && (
                    <div
                      role="listbox"
                      aria-label="Select delivery country"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 5px)',
                        left: 0,
                        right: 0,
                        zIndex: 300,
                        background: 'var(--news-dropdown-bg)',
                        border: '1px solid var(--news-card-border)',
                        borderRadius: 3,
                        boxShadow: 'var(--news-card-shadow)',
                        maxHeight: 280,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: 8,
                          borderBottom: '1px solid var(--news-card-border)',
                          position: 'sticky',
                          top: 0,
                          background: 'var(--news-dropdown-bg)',
                          zIndex: 1,
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Search country…"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.84rem' }}
                          className="mn-input"
                        />
                      </div>
                      <div style={{ overflowY: 'auto', padding: 4, scrollbarWidth: 'thin', scrollbarColor: 'var(--news-card-border) var(--news-dropdown-bg)' }}>
                        {filteredCountries.length === 0 ? (
                          <div style={{ padding: '12px', color: 'var(--news-text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
                            No countries match
                          </div>
                        ) : (
                          filteredCountries.map(c => (
                            <button
                              key={c}
                              type="button"
                              role="option"
                              aria-selected={country === c}
                              className="mn-country-item"
                              onClick={() => {
                                setCountry(c);
                                setCountryOpen(false);
                                setCountrySearch('');
                                setFieldErrors(prev => ({ ...prev, country: undefined }));
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 12px',
                                background: country === c ? 'rgba(212,175,55,0.1)' : 'transparent',
                                border: 'none',
                                borderRadius: 2,
                                color: country === c ? '#D4AF37' : 'var(--news-text-main)',
                                fontSize: '0.85rem',
                                fontWeight: country === c ? 700 : 400,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 0.12s ease',
                              }}
                            >
                              {c}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <FieldError message={fieldErrors.country} />
                <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: 'var(--news-text-muted)' }}>
                  The backend will schedule delivery to this country's next open slot.
                </p>
              </div>

              {/* Headline */}
              <div>
                <p className="mn-section-title">
                  <FileText size={11} style={{ color: '#D4AF37' }} /> Article Content
                </p>

                <FieldLabel htmlFor="mn-headline" required>Headline</FieldLabel>
                <input
                  id="mn-headline"
                  type="text"
                  className={`mn-input${fieldErrors.headline ? ' has-error' : ''}`}
                  style={inputStyle}
                  value={headline}
                  onChange={e => {
                    setHeadline(e.target.value);
                    if (fieldErrors.headline) setFieldErrors(prev => ({ ...prev, headline: undefined }));
                  }}
                  placeholder="Enter a clear, engaging headline…"
                  maxLength={300}
                  aria-describedby={fieldErrors.headline ? 'mn-headline-err' : undefined}
                />
                <FieldError message={fieldErrors.headline} />
              </div>

              {/* Body */}
              <div>
                <FieldLabel htmlFor="mn-body" required>Article Body</FieldLabel>
                <textarea
                  id="mn-body"
                  className={`mn-input${fieldErrors.body ? ' has-error' : ''}`}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 260, lineHeight: 1.65 }}
                  value={body}
                  onChange={e => {
                    setBody(e.target.value);
                    if (fieldErrors.body) setFieldErrors(prev => ({ ...prev, body: undefined }));
                  }}
                  placeholder="Write your article body here…"
                  aria-describedby="mn-body-hint"
                />
                <FieldError message={fieldErrors.body} />
                <p
                  id="mn-body-hint"
                  style={{ margin: '5px 0 0', fontSize: '0.72rem', color: '#52525b', lineHeight: 1.4 }}
                >
                  💡 Separate paragraphs with a blank line to create distinct content blocks.
                </p>
              </div>

              {/* Submit */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  paddingTop: 4,
                  borderTop: '1px solid #1c1c1f',
                }}
              >
                <button
                  type="submit"
                  form="manual-news-form"
                  disabled={submitting}
                  className="mn-submit-btn"
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Queueing…
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Queue Article for Delivery
                    </>
                  )}
                </button>
                <span style={{ fontSize: '0.76rem', color: 'var(--news-text-muted)', fontWeight: 500 }}>
                  The article will be queued and scheduled automatically.
                </span>
              </div>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                RIGHT COLUMN — Metadata & Advanced
            ══════════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Metadata Card ──────────────────────────────────────────── */}
              <fieldset
                style={{
                  border: '1px solid var(--news-card-border)',
                  borderRadius: 4,
                  padding: '20px',
                  background: 'var(--news-panel-bg)',
                  margin: 0,
                }}
              >
                <legend
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--news-text-muted)',
                    padding: '0 8px',
                  }}
                >
                  Metadata
                </legend>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Topic */}
                  <div>
                    <FieldLabel htmlFor="mn-topic">Topic</FieldLabel>
                    <select
                      id="mn-topic"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      className="mn-input"
                      style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                    >
                      {TOPIC_OPTIONS.map(t => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Article Type */}
                  <div>
                    <FieldLabel htmlFor="mn-article-type">Article Type</FieldLabel>
                    <select
                      id="mn-article-type"
                      value={articleType}
                      onChange={e => setArticleType(e.target.value)}
                      className="mn-input"
                      style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                    >
                      {ARTICLE_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Image URL */}
                  <div>
                    <FieldLabel htmlFor="mn-image-url">
                      <Image size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Cover Image URL
                    </FieldLabel>
                    <input
                      id="mn-image-url"
                      type="url"
                      className={`mn-input${fieldErrors.image_url ? ' has-error' : ''}`}
                      style={inputStyle}
                      value={imageUrl}
                      onChange={e => {
                        setImageUrl(e.target.value);
                        if (fieldErrors.image_url) setFieldErrors(prev => ({ ...prev, image_url: undefined }));
                      }}
                      placeholder="https://cdn.example.com/image.jpg"
                    />
                    <FieldError message={fieldErrors.image_url} />
                  </div>

                  {/* Mark as Trending */}
                  <Toggle
                    id="mn-trending"
                    checked={markAsTrending}
                    onChange={setMarkAsTrending}
                    label="Mark as Trending"
                    description="Promotes article to trending section in the app."
                  />
                </div>
              </fieldset>

              {/* ── Sources Array ──────────────────────────────────────────── */}
              <fieldset
                style={{
                  border: '1px solid var(--news-card-border)',
                  borderRadius: 4,
                  padding: '20px',
                  background: 'var(--news-panel-bg)',
                  margin: 0,
                }}
                aria-label="Article sources"
              >
                <legend
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--news-text-muted)',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Link size={10} style={{ color: '#D4AF37' }} />
                  Sources
                  <span
                    style={{
                      background: 'var(--news-card-border)',
                      borderRadius: 10,
                      padding: '1px 7px',
                      fontSize: '0.65rem',
                      color: 'var(--news-text-muted)',
                    }}
                  >
                    {sources.length}
                  </span>
                </legend>

                {sources.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--news-text-muted)', margin: '0 0 12px', textAlign: 'center' }}>
                    No sources added yet.
                  </p>
                ) : (
                  sources.map((src, idx) => (
                    <SourceRow
                      key={idx}
                      index={idx}
                      source={src}
                      onChange={updateSource}
                      onRemove={removeSource}
                    />
                  ))
                )}

                <button
                  type="button"
                  onClick={addSource}
                  aria-label="Add a new source"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'transparent',
                    border: '1px dashed var(--news-card-border)',
                    borderRadius: 3,
                    color: 'var(--news-text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.18s ease',
                    marginTop: sources.length > 0 ? 4 : 0,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#D4AF37';
                    (e.currentTarget as HTMLButtonElement).style.color = '#D4AF37';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--news-card-border)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--news-text-muted)';
                  }}
                >
                  <Plus size={13} /> Add Source
                </button>
              </fieldset>

              {/* ── Advanced Accordion ────────────────────────────────────── */}
              <div>
                <button
                  type="button"
                  className="mn-accordion-header"
                  onClick={() => setAdvancedOpen(o => !o)}
                  aria-expanded={advancedOpen}
                  aria-controls="mn-advanced-panel"
                  style={{ width: '100%', justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BookOpen size={12} style={{ color: '#D4AF37' }} />
                    Advanced Options
                  </span>
                  <ChevronRight
                    size={14}
                    style={{
                      transition: 'transform 0.2s ease',
                      transform: advancedOpen ? 'rotate(90deg)' : 'none',
                    }}
                  />
                </button>

                {advancedOpen && (
                  <div
                    id="mn-advanced-panel"
                    style={{
                      border: '1px solid var(--news-card-border)',
                      borderTop: 'none',
                      borderRadius: '0 0 3px 3px',
                      padding: '16px',
                      background: 'var(--news-panel-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      animation: 'slideUp 0.2s ease',
                    }}
                  >
                    <Toggle
                      id="mn-learning-aids"
                      checked={extractLearningAids}
                      onChange={setExtractLearningAids}
                      label="Extract Learning Aids"
                      description="AI will generate vocabulary, grammar points, and comprehension exercises from this article."
                    />
                  </div>
                )}
              </div>

              {/* ── Info callout ──────────────────────────────────────────── */}
              <div
                style={{
                  background: 'var(--news-table-header-bg)',
                  border: '1px solid var(--news-card-border)',
                  borderRadius: 3,
                  padding: '12px 14px',
                  fontSize: '0.76rem',
                  color: 'var(--news-text-muted)',
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: '#D4AF37', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <TrendingUp size={11} /> Automated Delivery
                </strong>
                This article will be placed into the selected country's next available delivery slot automatically.
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Success Modal ────────────────────────────────────────────────────── */}
      {successDetail && (
        <SuccessModal detail={successDetail} onClose={handleSuccessClose} />
      )}
    </>
  );
}
