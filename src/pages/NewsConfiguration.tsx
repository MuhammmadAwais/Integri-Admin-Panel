import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Settings, Activity } from 'lucide-react';
import LanguageConfigSection from 'features/news/components/LanguageConfigSection';
import TopicConfigSection from 'features/news/components/TopicConfigSection';
import { NewsService, type AdminCountriesResponse, type CountryDetails } from 'api/backendApi';
import 'features/news/styles/news.scss';

// ── Skeleton ─────────────────────────────────────────────────────────────
const ConfigSkeleton = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
    {[...Array(6)].map((_, i) => (
      <div 
        key={i}
        style={{
          background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 4,
          padding: 24,
          height: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="nv-skeleton" style={{ width: 140, height: 22 }} />
          <div className="nv-skeleton" style={{ width: 40, height: 22 }} />
        </div>
        <div className="nv-skeleton" style={{ flex: 1, borderRadius: 3 }} />
        <div className="nv-skeleton" style={{ width: '100%', height: 36 }} />
      </div>
    ))}
  </div>
);

export default function NewsConfigurationPage() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Record<string, CountryDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    NewsService.fetchAdminCountries()
      .then((res: AdminCountriesResponse) => {
        if (!cancelled) {
          setCountries(res.supported_countries || {});
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError('Failed to load configuration.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="news-glass-archive">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="news-command-header" style={{ marginBottom: 30 }}>
        <div>
          <button 
            onClick={() => navigate('/news')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--news-text-dim)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}
          >
            <ArrowLeft size={14} /> Back to News
          </button>
          <h2 className="news-title-sharp">News Configuration</h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.84rem', fontWeight: 500 }}>
            Manage supported pipelines and localized settings.
          </p>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <style>{`
        .nv-skeleton {
          background: rgba(212,175,55,0.1);
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 4px;
          animation: glowPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes glowPulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
      `}</style>

      {loading ? (
        <ConfigSkeleton />
      ) : error ? (
        <div style={{ color: '#DC143C', fontSize: '0.9rem', fontWeight: 600 }}>⚠ {error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {Object.entries(countries).map(([countryName, details]) => (
            <div 
              key={countryName}
              style={{
                background: 'var(--news-card-bg)',
                border: '1px solid var(--news-card-border)',
                borderRadius: 4,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--news-card-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} style={{ color: '#D4AF37' }} />
                  <span style={{ color: 'var(--news-text-main)', fontSize: '1.1rem', fontWeight: 800 }}>{countryName}</span>
                </div>
                <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 2, padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {details.locale}
                </span>
              </div>
              
              <div style={{ background: 'var(--news-input-bg)', border: '1px solid var(--news-card-border)', borderRadius: 3, padding: 12, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--news-text-dim)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  <Activity size={12} /> Pipeline Note
                </div>
                <div style={{ color: 'var(--news-text-muted)', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  {details.pipeline_note || 'No active notes.'}
                </div>
              </div>
              
              <button style={{
                background: 'transparent',
                border: '1px solid var(--news-card-border)',
                color: 'var(--news-text-main)',
                padding: '8px 12px',
                borderRadius: 3,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--news-card-border)'; e.currentTarget.style.color = 'var(--news-text-main)'; }}
              >
                <Settings size={14} /> Configure
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Language Configurations ─────────────────────────────────────── */}
      <LanguageConfigSection />

      {/* ── Topic Configurations ────────────────────────────────────────── */}
      <TopicConfigSection />
    </div>
  );
}
