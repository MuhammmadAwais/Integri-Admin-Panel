import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, RotateCw, Calendar, Globe, ChevronDown } from 'lucide-react';
import Button from 'react-bootstrap/Button';

// project-imports
import { useAdminNews } from 'features/news/hooks/useAdminNews';
import NewsVirtualTable from 'features/news/components/NewsVirtualTable';
import ArticleDetailPanel from 'features/news/components/ArticleDetailPanel';
import ParticleBackground from 'components/ParticleBackground';

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
    refetch,
  } = useAdminNews();

  // ── Detail panel state ────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen]       = useState(false);
  const [selectedId, setSelectedId]     = useState(null);
  const [countryOpen, setCountryOpen]   = useState(false);
  const countryDropRef                  = useRef(null);

  const handleRowClick = (id) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
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

  return (
    <div className="news-glass-archive">
      <ParticleBackground />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div ref={headerRef} className="news-command-header">
        <div>
          <h2 className="news-title-sharp">News Management</h2>
          <p style={{ color: '#71717a', margin: 0, fontSize: '0.84rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? (
              <span style={{ color: '#52525b' }}>Fetching articles…</span>
            ) : error ? (
              <span style={{ color: '#DC143C' }}>⚠ {error}</span>
            ) : (
              <>
                <span style={{ color: '#a1a1aa' }}>
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
            onClick={() => navigate('/news/create')}
          >
            <Plus size={15} /> Publish Article
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
                background: '#000',
                border: '1px solid #27272a',
                borderRadius: 3,
                color: '#e4e4e7',
                fontSize: '0.9rem',
                fontWeight: 700,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s ease',
                MozAppearance: 'textfield',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D4AF37'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
            />
            <span style={{ position: 'absolute', right: 10, color: '#52525b', fontSize: '0.74rem', fontWeight: 600, pointerEvents: 'none' }}>
              days
            </span>
          </div>
          <span style={{ color: '#3f3f46', fontSize: '0.68rem' }}>Min 1 · Max 90 · 500ms debounce</span>
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
              background: '#000',
              border: `1px solid ${countryOpen ? '#D4AF37' : '#27272a'}`,
              borderRadius: 3,
              color: country ? '#e4e4e7' : '#52525b',
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
              style={{ color: '#52525b', transition: 'transform 0.2s ease', transform: countryOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
            />
          </button>

          {/* Dropdown menu */}
          {countryOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 200,
              background: '#09090b',
              border: '1px solid #27272a',
              borderRadius: 3,
              boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              minWidth: 220,
              maxHeight: 280,
              overflowY: 'auto',
              padding: '4px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#27272a #09090b',
            }}>
              {/* All Countries option */}
              <button
                onClick={() => { setCountry(null); setCountryOpen(false); }}
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
              <div style={{ height: 1, background: '#1c1c1e', margin: '4px 0' }} />

              {/* Country list from API */}
              {countries.map(c => (
                <button
                  key={c}
                  onClick={() => { setCountry(c); setCountryOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 12px',
                    background: country === c ? 'rgba(212,175,55,0.1)' : 'transparent',
                    border: 'none', borderRadius: 2,
                    color: country === c ? '#D4AF37' : '#a1a1aa',
                    fontSize: '0.85rem', fontWeight: country === c ? 700 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (country !== c) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (country !== c) e.currentTarget.style.background = 'transparent'; }}
                >
                  {c}
                </button>
              ))}

              {countries.length === 0 && !countriesLoading && (
                <div style={{ padding: '12px', color: '#52525b', fontSize: '0.82rem', textAlign: 'center' }}>
                  No countries available
                </div>
              )}
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
            onClick={refetch}
            disabled={loading}
            style={{
              background: 'transparent', border: '1px solid #27272a', color: '#71717a',
              width: 42, height: 42, borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', flexShrink: 0
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
          >
            <RotateCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Spin animation for loading */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* ── Virtualized Table ────────────────────────────────────────────── */}
      <NewsVirtualTable
        articles={articles}
        loading={loading}
        total={total}
        onRowClick={handleRowClick}
      />

      {/* ── Article Detail Slide-over ─────────────────────────────────────── */}
      <ArticleDetailPanel
        open={panelOpen}
        newsId={selectedId}
        onClose={handleClosePanel}
      />
    </div>
  );
}
