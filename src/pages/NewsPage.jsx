import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, RotateCw, Calendar, Globe, ChevronDown } from 'lucide-react';
import Button from 'react-bootstrap/Button';

// project-imports
import { useAdminNews } from 'features/news/hooks/useAdminNews';
import NewsVirtualTable from 'features/news/components/NewsVirtualTable';
import ArticleDetailPanel from 'features/news/components/ArticleDetailPanel';
import MainCard from 'components/MainCard';
import { NewsService } from 'api/backendApi';
import EliteModal from 'components/EliteUI/EliteModal';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import { ManualPushModal } from 'features/news/components/ManualPushModal';

// styles
import 'features/news/styles/news.scss';

// ══════════════════════════════════════════════════════════════════════════════
//  NewsPage — REST API-driven, virtualized, slide-over detail
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsPage() {
  const navigate = useNavigate();
  const headerRef = useRef(null);

  // ── Data hook ─────────────────────────────────────────────────────────────
  const {
    articles, loading, error, total,
    days, setDays,
    country, setCountry,
    countries, countriesLoading,
    tokenStatus,
    refetch,
  } = useAdminNews();

    // Log article updates for debugging network/responses
    React.useEffect(() => {
      console.log('📰 [NewsPage] articles state changed', { total, articlesCount: (articles || []).length, loading, error });
    }, [articles, total, loading, error]);

    const refetchAndLog = () => {
      console.log('📰 [NewsPage] manual refetch triggered');
      try { refetch(); } catch (e) { console.error('📰 [NewsPage] refetch error:', e); }
    };

  // ── Detail panel state ────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen]       = useState(false);
  const [selectedId, setSelectedId]     = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [countryOpen, setCountryOpen]   = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropRef                  = useRef(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget]           = useState(null);

  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushTarget, setPushTarget]       = useState(null);

  const handlePushClick = (id, collection, headline, country) => {
    setPushTarget({ id, collection, headline, country });
    setPushModalOpen(true);
  };

  const handleRowClick = (id, collection) => {
    setSelectedId(id);
    setSelectedCollection(collection);
    setPanelOpen(true);
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
  };

  const handleDelete = (id, collection) => {
    setDeleteTarget({ id, collection });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { id, collection } = deleteTarget;
      const response = await NewsService.deleteArticle(id, collection);
      console.log('Deleted successfully:', response);
      showToast('Article deleted successfully.', 'success');
      refetch();
    } catch (err) {
      console.error('Failed to delete article:', err);
      showToast('Failed to delete article. Please try again.', 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current.children,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, []);

  // ── Close country dropdown on outside click ───────────────────────────────
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e) => {
      if (countryDropRef.current && !countryDropRef.current.contains(e.target)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  // ── Days input — controlled, hook handles debounce ────────────────────────
  const handleDaysChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setDays(v);
  };

  // ── Filter countries ──────────────────────────────────────────────────────
  const filteredCountries = Object.keys(countries || {}).filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="news-glass-archive">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div ref={headerRef} className="news-command-header">
        <div>
          <h2 className="news-title-sharp">News Management</h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.84rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          {tokenStatus === 'waiting' ? (
              <span style={{ color: '#D4AF37', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D4AF37', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
                Generating auth token…
              </span>
            ) : tokenStatus === 'failed' ? (
              <span style={{ color: '#DC143C' }}>⚠ Auth token failed — requests may be unauthorized</span>
            ) : loading ? (
              <span style={{ color: 'var(--news-text-dim)' }}>Fetching articles…</span>
            ) : error ? (
              <span style={{ color: '#DC143C' }}>⚠ {error}</span>
            ) : (
              <>
                <span style={{ color: 'var(--news-text-dim)' }}>
                  <span style={{ color: '#D4AF37', fontWeight: 700 }}>{total.toLocaleString()}</span> article{total !== 1 ? 's' : ''} — last {days} day{days !== 1 ? 's' : ''}
                </span>
                {country && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#D4AF37', padding: '2px 8px', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 2 }}>
                    {country}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            className="btn-publish-gold d-flex align-items-center gap-2"
            onClick={() => navigate('/news/configuration')}
          >
            News Configuration
          </Button>
        </div>
      </div>

      {/* ── Filter Controls ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Days Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#52525b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={11} style={{ color: '#D4AF37' }} /> Days Window
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="news-days-input"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={handleDaysChange}
              style={{
                width: 110,
                padding: '10px 14px',
                background: 'var(--news-input-bg)',
                border: '1px solid var(--news-card-border)',
                borderRadius: 3,
                color: 'var(--news-text-main)',
                fontSize: '0.9rem',
                fontWeight: 700,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s ease',
                MozAppearance: 'textfield',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D4AF37'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--news-card-border)'; }}
            />
            <span style={{ position: 'absolute', right: 10, color: 'var(--news-text-dim)', fontSize: '0.74rem', fontWeight: 600, pointerEvents: 'none' }}>
              days
            </span>
          </div>
          <span style={{ color: 'var(--news-text-dim)', fontSize: '0.68rem' }}>Min 1 · Max 90 · 500ms debounce</span>
        </div>

        {/* Country Dropdown */}
        <div ref={countryDropRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
          <label style={{ color: '#52525b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Globe size={11} style={{ color: '#D4AF37' }} /> Country Filter
          </label>
          <button
            id="news-country-dropdown"
            onClick={() => setCountryOpen(o => !o)}
            style={{
              minWidth: 200,
              padding: '10px 14px',
              background: 'var(--news-input-bg)',
              border: `1px solid ${countryOpen ? '#D4AF37' : 'var(--news-card-border)'}`,
              borderRadius: 3,
              color: country ? 'var(--news-text-main)' : 'var(--news-text-dim)',
              fontSize: '0.88rem',
              fontWeight: country ? 700 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              transition: 'border-color 0.2s ease',
            }}
          >
            <span>{country || (countriesLoading ? 'Loading…' : 'All Countries')}</span>
            <ChevronDown
              size={14}
              style={{ color: 'var(--news-text-dim)', transition: 'transform 0.2s ease', transform: countryOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
            />
          </button>

          {/* Dropdown menu */}
          {countryOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 200,
              background: 'var(--news-dropdown-bg)',
              border: '1px solid var(--news-card-border)',
              borderRadius: 3,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              minWidth: 220,
              maxHeight: 280,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Search Input */}
              <div style={{ padding: '8px', borderBottom: '1px solid var(--news-card-border)', position: 'sticky', top: 0, background: 'var(--news-dropdown-bg)', zIndex: 1 }}>
                <input
                  type="text"
                  placeholder="Search Country..."
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--news-input-bg)',
                    border: '1px solid var(--news-card-border)',
                    borderRadius: 3,
                    color: 'var(--news-text-main)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#D4AF37'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--news-card-border)'; }}
                  onClick={e => e.stopPropagation()}
                />
              </div>

              <div style={{ padding: '4px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--news-card-border) var(--news-dropdown-bg)' }}>
                {/* All Countries option */}
                <button
                  onClick={() => { setCountry(null); setCountryOpen(false); setCountrySearch(''); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 12px',
                    background: country === null ? 'rgba(212,175,55,0.1)' : 'transparent',
                    border: 'none', borderRadius: 2,
                    color: country === null ? '#D4AF37' : '#71717a',
                    fontSize: '0.85rem', fontWeight: country === null ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (country !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (country !== null) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Globe size={12} style={{ color: '#52525b' }} />
                  All Countries
                </button>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--news-card-border)', margin: '4px 0' }} />

                {/* Country list from API */}
                {filteredCountries.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCountry(c); setCountryOpen(false); setCountrySearch(''); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px',
                      background: country === c ? 'rgba(212,175,55,0.1)' : 'transparent',
                      border: 'none', borderRadius: 2,
                      color: country === c ? '#D4AF37' : 'var(--news-text-main)',
                      fontSize: '0.85rem', fontWeight: country === c ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (country !== c) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (country !== c) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {c}
                  </button>
                ))}

                {filteredCountries.length === 0 && !countriesLoading && (
                  <div style={{ padding: '12px', color: '#52525b', fontSize: '0.82rem', textAlign: 'center' }}>
                    No countries match
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Refresh button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'transparent', fontSize: '0.7rem', userSelect: 'none' }}>·</label>
          <button
            title="Refresh"
            onClick={refetchAndLog}
            disabled={loading}
            style={{
              background: 'transparent', border: '1px solid var(--news-card-border)', color: 'var(--news-text-muted)',
              width: 42, height: 42, borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', flexShrink: 0
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--news-card-border)'; e.currentTarget.style.color = 'var(--news-text-muted)'; }}
          >
            <RotateCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Spin animation for loading + token pulse */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* ── Token Status Banner (shown while awaiting token) ──────────────── */}
      {tokenStatus === 'waiting' && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.84rem',
          color: '#D4AF37',
          fontWeight: 500,
        }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D4AF37', animation: 'pulse-dot 1.2s ease-in-out infinite', flexShrink: 0 }} />
          <span>⏳ Waiting for backend auth token… News data will load automatically once the token is ready.</span>
        </div>
      )}
      {tokenStatus === 'failed' && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          background: 'rgba(220,20,60,0.08)',
          border: '1px solid rgba(220,20,60,0.3)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.84rem',
          color: '#DC143C',
          fontWeight: 500,
        }}>
          ⚠ Failed to generate backend auth token. API requests may return 401 Unauthorized.
        </div>
      )}

      {/* ── Virtualized Table ────────────────────────────────────────────── */}
      <NewsVirtualTable
        articles={articles}
        loading={loading}
        total={total}
        onRowClick={handleRowClick}
        onDelete={handleDelete}
        onPushClick={handlePushClick}
      />

      {/* ── Article Detail Slide-over ─────────────────────────────────────── */}
      <ArticleDetailPanel
        open={panelOpen}
        newsId={selectedId}
        collection={selectedCollection}
        onClose={handleClosePanel}
        onPushClick={handlePushClick}
      />

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      <EliteModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Delete Article"
        confirmText="Permanently Delete"
      >
        Are you sure you want to delete this article? This action is permanent and cannot be undone.
      </EliteModal>

      {/* ── Manual Admin Push Modal ───────────────────────────────────────── */}
      <ManualPushModal
        isOpen={pushModalOpen}
        onClose={() => { setPushModalOpen(false); setPushTarget(null); }}
        newsId={pushTarget?.id || null}
        collection={pushTarget?.collection || null}
        fallbackHeadline={pushTarget?.headline || null}
        fallbackCountry={pushTarget?.country || null}
      />
    </div>
  );
}
