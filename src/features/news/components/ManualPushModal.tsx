import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { NewsService, ArticleDetail, SupportedLanguagesResponse, ManualPushResponse } from 'api/backendApi';
import CountryFlag from 'components/CountryFlag';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import { getLocalizedStr } from 'features/news/hooks/useAdminNews';

interface ManualPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsId: string | null;
  collection: string | null;
  fallbackHeadline?: string | null | any;
  fallbackCountry?: string | null;
}

// In-memory persistent map of cooldown ends per "country:newsId:langScope"
// Ensures cooldown remains active even if modal is closed and re-opened
const pushCooldowns = new Map<string, number>();

export const ManualPushModal: React.FC<ManualPushModalProps> = ({
  isOpen,
  onClose,
  newsId,
  collection,
  fallbackHeadline,
  fallbackCountry
}) => {
  const navigate = useNavigate();

  // Local UI state
  const [selectedLang, setSelectedLang] = useState<string | null>(null); // null = "All configured languages"
  const [isPushing, setIsPushing] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [successResponse, setSuccessResponse] = useState<ManualPushResponse | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Reset state when modal opens for a new article
  useEffect(() => {
    if (isOpen) {
      setSelectedLang(null);
      setIsPushing(false);
      setErrorDetail(null);
      setSuccessResponse(null);
    }
  }, [isOpen, newsId]);

  // Fetch article detail to get exact country and translated headline map (§3)
  const {
    data: article,
    isLoading: isArticleLoading,
    error: articleError,
    refetch: refetchArticle
  } = useQuery<ArticleDetail>({
    queryKey: ['article-detail', newsId, collection],
    queryFn: () => NewsService.fetchArticleDetails(newsId!, collection || undefined),
    enabled: isOpen && Boolean(newsId),
    retry: 1,
    staleTime: 30000
  });

  // Fetch supported languages dictionary ({ code: name }) to show readable labels (§3)
  const { data: supportedLangsData } = useQuery<SupportedLanguagesResponse>({
    queryKey: ['supported-languages'],
    queryFn: () => NewsService.fetchSupportedLanguages(),
    staleTime: Infinity,
    enabled: isOpen
  });

  // Map of lang code -> human readable name
  const langNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    const list = supportedLangsData?.languages || [];
    list.forEach((l) => {
      if (l.code) {
        map[l.code.toLowerCase()] = l.name;
      }
    });
    return map;
  }, [supportedLangsData]);

  // Determine effective country and headline map
  const effectiveCountry = article?.country || fallbackCountry || 'Global';
  const headlineMap: Record<string, string> = useMemo(() => {
    if (article?.headline && typeof article.headline === 'object') {
      return article.headline as Record<string, string>;
    }
    if (fallbackHeadline && typeof fallbackHeadline === 'object') {
      return fallbackHeadline as Record<string, string>;
    }
    return {};
  }, [article, fallbackHeadline]);

  const availableLangCodes = useMemo(() => {
    return Object.keys(headlineMap);
  }, [headlineMap]);

  // Derive preview headline to display in header (guaranteed primitive string)
  const displayHeadline = useMemo(() => {
    return getLocalizedStr(article?.headline || fallbackHeadline, 'Article');
  }, [article, fallbackHeadline]);

  // Check and countdown cooldown timer (§5 - 60s Redis lock protection)
  const effectiveScopeKey = `${effectiveCountry}:${newsId}:${selectedLang || 'all'}`;
  useEffect(() => {
    if (!isOpen || !newsId) return;

    const checkCooldown = () => {
      const expiresAt = pushCooldowns.get(effectiveScopeKey) || 0;
      const rem = Math.ceil((expiresAt - Date.now()) / 1000);
      setCooldownRemaining(rem > 0 ? rem : 0);
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, newsId, effectiveScopeKey]);

  // Handle push submission (§4 POST /news/admin/articles/{news_id}/push)
  const handlePushNow = async () => {
    if (!newsId || isPushing || cooldownRemaining > 0) return;

    setIsPushing(true);
    setErrorDetail(null);

    try {
      const payload = {
        collection: collection || article?._collection || 'News',
        language: selectedLang // null for "All configured languages"
      };

      const response = await NewsService.pushArticle(newsId, payload);
      setSuccessResponse(response);
      showToast('Push queued. Delivery stats will appear in ~30 seconds.', 'success');

      // Set 60-second cooldown for this target scope (§5)
      pushCooldowns.set(effectiveScopeKey, Date.now() + 60000);
      setCooldownRemaining(60);
    } catch (err: any) {
      const status = err?.response?.status;
      const detailMsg =
        err?.response?.data?.detail ||
        err?.message ||
        'An unexpected error occurred while queuing the manual push.';

      setErrorDetail(detailMsg);
      showToast(detailMsg, 'error');

      // If 409 Conflict, activate 60s cooldown automatically per recommendation (§5)
      if (status === 409) {
        pushCooldowns.set(effectiveScopeKey, Date.now() + 60000);
        setCooldownRemaining(60);
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handleNavigateToStats = () => {
    onClose();
    navigate(`/news/notifications?country=${encodeURIComponent(effectiveCountry)}`);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#18181b',
          border: '1px solid rgba(212,175,55,0.3)',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(212,175,55,0.08) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(212,175,55,0.15)',
                border: '1px solid rgba(212,175,55,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37'
              }}
            >
              <Bell size={16} />
            </div>
            <div>
              <h3
                style={{
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 800,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                Manual Admin Push
              </h3>
              <span
                style={{
                  color: '#a1a1aa',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2
                }}
              >
                Immediate FCM Broadcast
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#a1a1aa',
              width: 32,
              height: 32,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a1a1aa';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body ────────────────────────────────────────────────── */}
        <div style={{ padding: '24px' }}>
          {/* Headline & Country confirmation box (§1 & §2) */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: 20
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CountryFlag country={effectiveCountry} size={20} />
              <span
                style={{
                  color: '#D4AF37',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Target Audience: {effectiveCountry}
              </span>
            </div>
            <div
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.92rem',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              “{displayHeadline}”
            </div>
          </div>

          {/* If article loading */}
          {isArticleLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 0',
                color: '#a1a1aa',
                gap: 10,
                fontSize: '0.85rem'
              }}
            >
              <Loader2 size={18} className="animate-spin" />
              Loading translation languages...
            </div>
          )}

          {/* If article load failed */}
          {articleError && !isArticleLoading && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                background: 'rgba(220,20,60,0.08)',
                border: '1px solid rgba(220,20,60,0.3)',
                color: '#DC143C',
                fontSize: '0.82rem',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Failed to fetch article language map.</span>
              <button
                onClick={() => refetchArticle()}
                style={{
                  background: 'transparent',
                  border: '1px solid #DC143C',
                  color: '#DC143C',
                  padding: '4px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ── SUCCESS VIEW (§4 & §6) ── */}
          {successResponse ? (
            <div
              style={{
                padding: '20px',
                borderRadius: 6,
                background: 'rgba(46, 204, 113, 0.07)',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                marginBottom: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <CheckCircle2 size={22} color="#2ecc71" />
                <div>
                  <div style={{ color: '#2ecc71', fontWeight: 800, fontSize: '0.95rem' }}>
                    Push Queued Successfully
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    Task ID: {successResponse.task_id}
                  </div>
                </div>
              </div>

              <p
                style={{
                  color: '#d4d4d8',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  margin: '0 0 16px 0'
                }}
              >
                Delivery is in progress. Check the <strong>Notification Stats</strong> view in ~30
                seconds for live sent/failed counts.
              </p>

              <button
                onClick={handleNavigateToStats}
                style={{
                  width: '100%',
                  background: '#D4AF37',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'filter 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseOut={(e) => (e.currentTarget.style.filter = 'none')}
              >
                View Delivery Stats <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <>
              {/* ── LANGUAGE PICKER (§3) ── */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    color: '#e4e4e7',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    marginBottom: 8
                  }}
                >
                  Language Scope:
                </label>

                <select
                  value={selectedLang || ''}
                  onChange={(e) => setSelectedLang(e.target.value || null)}
                  disabled={isPushing || isArticleLoading}
                  style={{
                    width: '100%',
                    background: '#27272a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: 6,
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">● All configured languages</option>
                  {availableLangCodes.map((code) => {
                    const readableName = langNameMap[code.toLowerCase()] || code.toUpperCase();
                    return (
                      <option key={code} value={code}>
                        ○ {readableName} ({code})
                      </option>
                    );
                  })}
                </select>
                <div style={{ color: '#71717a', fontSize: '0.74rem', marginTop: 6 }}>
                  {selectedLang
                    ? `Only users in ${effectiveCountry} whose app language is "${selectedLang}" will receive this notification.`
                    : `Sends to all translated languages in ${effectiveCountry}. Each user receives the version matching their in-app language.`}
                </div>
              </div>

              {/* ── SAFETY WARNING (§2 Rule #3) ── */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 6,
                  background: 'rgba(212,175,55,0.07)',
                  border: '1px solid rgba(212,175,55,0.25)',
                  color: '#e4e4e7',
                  fontSize: '0.83rem',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 20
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: '#D4AF37', flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <strong style={{ color: '#D4AF37' }}>Important:</strong> This sends immediately
                  and overrides per-user opt-outs. Users who already received this article via the
                  automatic schedule will receive it again.
                </div>
              </div>

              {/* ── ERROR DISPLAY (§5) ── */}
              {errorDetail && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: 'rgba(220,20,60,0.1)',
                    border: '1px solid rgba(220,20,60,0.35)',
                    color: '#DC143C',
                    fontSize: '0.83rem',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{errorDetail}</div>
                </div>
              )}

              {/* ── ACTION FOOTER (§2) ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 12
                }}
              >
                <button
                  onClick={onClose}
                  disabled={isPushing}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#a1a1aa',
                    padding: '9px 18px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handlePushNow}
                  disabled={isPushing || cooldownRemaining > 0 || isArticleLoading}
                  style={{
                    background:
                      cooldownRemaining > 0
                        ? '#3f3f46'
                        : isPushing
                          ? '#a1a1aa'
                          : '#D4AF37',
                    color: '#000',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor:
                      cooldownRemaining > 0 || isPushing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s'
                  }}
                >
                  {isPushing ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Sending...
                    </>
                  ) : cooldownRemaining > 0 ? (
                    <>
                      <Clock size={15} /> Wait ({cooldownRemaining}s)
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Push now
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ManualPushModal;
