import React, { useEffect, useState, useCallback } from 'react';
import { X, ExternalLink, Eye, Layers, BookOpen, Tag } from 'lucide-react';
import { NewsService, type ArticleDetail, type ContentBlock } from 'api/backendApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEn(field: Record<string, string | undefined> | string | undefined | null, fallback = ''): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  return field['en'] ?? field['de'] ?? Object.values(field).find(Boolean) ?? fallback;
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '—'; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const DetailSkeleton = () => (
  <div style={{ padding: '0 28px 28px' }}>
    <style>{`
      .dp-sk {
        background: rgba(212,175,55,0.07);
        border-radius: 2px;
        animation: dpSkPulse 1.8s ease infinite;
      }
      @keyframes dpSkPulse {
        0%,100%{ opacity: 0.3; }
        50%{ opacity: 0.65; }
      }
    `}</style>
    {/* Cover */}
    <div className="dp-sk" style={{ width: '100%', height: 180, borderRadius: 2, marginBottom: 24 }} />
    {/* Headline */}
    <div className="dp-sk" style={{ width: '90%', height: 22, marginBottom: 10 }} />
    <div className="dp-sk" style={{ width: '65%', height: 16, marginBottom: 24 }} />
    {/* Meta pills */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {[60, 80, 55].map((w, i) => <div key={i} className="dp-sk" style={{ width: w, height: 24, borderRadius: 2 }} />)}
    </div>
    {/* Content paragraphs */}
    {[...Array(4)].map((_, i) => (
      <div key={i} style={{ marginBottom: 20 }}>
        <div className="dp-sk" style={{ width: '100%', height: 13, marginBottom: 6 }} />
        <div className="dp-sk" style={{ width: '98%', height: 13, marginBottom: 6 }} />
        <div className="dp-sk" style={{ width: '82%', height: 13 }} />
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Section Header
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--news-panel-border)' }}>
    <span style={{ color: '#D4AF37', display: 'flex' }}>{icon}</span>
    <span style={{ color: '#D4AF37', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Content Block renderer
// ─────────────────────────────────────────────────────────────────────────────

const ContentBlockRenderer = ({ block }: { block: ContentBlock }) => {
  const text = typeof block.value === 'string'
    ? block.value
    : getEn(block.value as Record<string, string | undefined>);

  if (block.type === 'image' && text) {
    return (
      <figure style={{ margin: '0 0 20px' }}>
        <img src={text} alt={block.caption || 'image'} style={{ width: '100%', borderRadius: 2, border: '1px solid #27272a', objectFit: 'cover' }} />
        {block.caption && <figcaption style={{ color: '#52525b', fontSize: '0.77rem', marginTop: 6, textAlign: 'center' }}>{block.caption}</figcaption>}
      </figure>
    );
  }

  if (!text) return null;

  return (
    <p style={{ color: 'var(--news-text-muted)', fontSize: '0.9rem', lineHeight: 1.8, margin: '0 0 18px', letterSpacing: '0.1px' }}>
      {text}
    </p>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main panel
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  newsId: string | null;
  onClose: () => void;
}

const ArticleDetailPanel: React.FC<Props> = ({ open, newsId, onClose }) => {
  const [article, setArticle]   = useState<ArticleDetail | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Fetch whenever newsId changes and panel is open
  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setArticle(null);
    try {
      const data = await NewsService.fetchArticleDetails(id);
      setArticle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && newsId) {
      loadDetail(newsId);
    }
  }, [open, newsId, loadDetail]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Panel width constants ──────────────────────────────────────────────────
  const PANEL_WIDTH = 560;

  return (
    <>
      <style>{`
        .dp-overlay {
          position: fixed; inset: 0; z-index: 1050;
          background: var(--news-panel-overlay);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          transition: opacity 0.25s ease;
        }
        .dp-overlay.dp-hidden { opacity: 0; pointer-events: none; }
        .dp-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: ${PANEL_WIDTH}px; max-width: 100vw;
          background: var(--news-panel-bg);
          border-left: 1px solid var(--news-panel-border);
          z-index: 1051;
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        .dp-panel.dp-open {
          transform: translateX(0);
        }
        .dp-scroll {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--news-panel-border) var(--news-panel-bg);
        }
        .dp-scroll::-webkit-scrollbar { width: 6px; }
        .dp-scroll::-webkit-scrollbar-track { background: var(--news-panel-bg); }
        .dp-scroll::-webkit-scrollbar-thumb { background: var(--news-panel-border); border-radius: 3px; }
        .dp-scroll::-webkit-scrollbar-thumb:hover { background: #D4AF37; }
        .dp-source-card:hover { background: rgba(212,175,55,0.06) !important; border-color: rgba(212,175,55,0.3) !important; }
        .dp-close-btn:hover { background: rgba(220,20,60,0.12) !important; border-color: rgba(220,20,60,0.4) !important; color: #DC143C !important; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`dp-overlay${open ? '' : ' dp-hidden'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`dp-panel${open ? ' dp-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Article detail"
      >
        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 18px 28px', borderBottom: '1px solid var(--news-panel-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 3, height: 20, background: '#DC143C', borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: 'var(--news-text-main)', fontWeight: 800, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Article Preview
            </span>
          </div>
          <button
            className="dp-close-btn"
            onClick={onClose}
            style={{ background: 'transparent', border: '1px solid var(--news-panel-border)', color: 'var(--news-text-dim)', width: 34, height: 34, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="dp-scroll">
          {loading && <DetailSkeleton />}

          {error && !loading && (
            <div style={{ padding: '40px 28px', textAlign: 'center' }}>
              <p style={{ color: '#DC143C', fontSize: '0.9rem', marginBottom: 12 }}>⚠ {error}</p>
              <button
                onClick={() => newsId && loadDetail(newsId)}
                style={{ background: 'transparent', border: '1px solid #DC143C', color: '#DC143C', padding: '8px 20px', borderRadius: 2, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700 }}
              >
                Retry
              </button>
            </div>
          )}

          {article && !loading && (
            <div style={{ padding: '0 28px 40px' }}>

              {/* Cover Image */}
              {article.coverImage && (
                <div style={{ margin: '0 -28px 24px', position: 'relative' }}>
                  <img
                    src={article.coverImage}
                    alt="cover"
                    style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, #09090b 100%)' }} />
                </div>
              )}

              {/* Headline */}
              <h2 style={{ color: 'var(--news-text-main)', fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.45, marginBottom: 12, letterSpacing: '-0.3px' }}>
                {getEn(article.headline, '—')}
              </h2>

              {/* Meta pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                {article.topic && (
                  <span style={{ padding: '4px 12px', borderRadius: 2, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
                    {article.topic}
                  </span>
                )}
                {article.forCountries?.map(c => (
                  <span key={c} style={{ padding: '4px 12px', borderRadius: 2, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--news-panel-border)', color: 'var(--news-text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
                    {c}
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 2, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--news-panel-border)', color: 'var(--news-text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
                  <Eye size={11} /> {article.views?.toLocaleString() ?? 0}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 2, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--news-panel-border)', color: 'var(--news-text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
                  {fmt(article.date)}
                </span>
              </div>

              {/* Gold divider */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, #D4AF37, transparent)', opacity: 0.2, marginBottom: 24 }} />

              {/* ── Content ─────────────────────────────────────────────── */}
              {article.content && article.content.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <SectionHeader icon={<Layers size={14} />} label="Content" />
                  {article.content.map((block, i) => (
                    <ContentBlockRenderer key={i} block={block} />
                  ))}
                </section>
              )}

              {/* ── Grammar ─────────────────────────────────────────────── */}
              {article.grammar && article.grammar.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <SectionHeader icon={<BookOpen size={14} />} label={`Grammar (${article.grammar.length})`} />
                  {article.grammar.map((g, i) => {
                    const rules = g.rules?.['en'] ?? [];
                    return (
                      <div key={i} style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 2, padding: '14px 16px', marginBottom: 12 }}>
                        <div style={{ color: '#D4AF37', fontWeight: 800, fontSize: '0.83rem', marginBottom: 6 }}>
                          {getEn(g.title)}
                        </div>
                        <div style={{ color: 'var(--news-text-muted)', fontSize: '0.82rem', lineHeight: 1.7, marginBottom: 8 }}>
                          {getEn(g.description)}
                        </div>
                        {rules.length > 0 && (
                          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                            {rules.map((rule, ri) => (
                              <li key={ri} style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: rule }} />
                            ))}
                          </ul>
                        )}
                        {getEn(g.example) && (
                          <div style={{ borderLeft: '2px solid #D4AF37', paddingLeft: 12, marginTop: 8, color: 'var(--news-text-main)', fontSize: '0.82rem', fontStyle: 'italic', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: getEn(g.example) }}
                          />
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {/* ── Keywords ─────────────────────────────────────────────── */}
              {article.keywords && article.keywords.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <SectionHeader icon={<Tag size={14} />} label={`Keywords (${article.keywords.length})`} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {article.keywords.map((kw, i) => (
                      <span key={i} title={getEn(kw.description)} style={{ padding: '5px 13px', borderRadius: 2, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--news-panel-border)', color: 'var(--news-text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'default' }}>
                        {getEn(kw.title)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Sources ──────────────────────────────────────────────── */}
              {article.sources && article.sources.length > 0 && (
                <section>
                  <SectionHeader icon={<ExternalLink size={14} />} label={`Sources (${article.sources.length})`} />
                  {article.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dp-source-card"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 2,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid #1c1c1e',
                        textDecoration: 'none', marginBottom: 10,
                        transition: 'all 0.18s ease'
                      }}
                    >
                      {src.image ? (
                        <img src={src.image} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 48, height: 36, background: 'rgba(0,0,0,0.05)', borderRadius: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--news-text-main)', fontSize: '0.83rem', fontWeight: 600, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.title}
                        </div>
                        <div style={{ color: 'var(--news-text-dim)', fontSize: '0.74rem', marginTop: 2 }}>{src.source}</div>
                      </div>
                      <ExternalLink size={13} style={{ color: 'var(--news-text-dim)', flexShrink: 0, marginLeft: 'auto' }} />
                    </a>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default ArticleDetailPanel;
