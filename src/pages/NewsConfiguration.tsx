import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import LanguageConfigSection from 'features/news/components/LanguageConfigSection';
import TopicConfigSection from 'features/news/components/TopicConfigSection';
import CountryFlag from 'components/CountryFlag';
import { NewsService, type AdminCountriesResponse, type CountryDetails } from 'api/backendApi';
import 'features/news/styles/news.scss';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const ConfigSkeleton = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        style={{
          background: 'var(--news-table-header-bg)',
          border: '1px solid var(--news-glass-border)',
          borderRadius: 4,
          padding: 24,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="nv-skeleton" style={{ width: 36, height: 27, borderRadius: 2 }} />
          <div className="nv-skeleton" style={{ width: 32, height: 20 }} />
        </div>
        <div className="nv-skeleton" style={{ width: 160, height: 24, marginTop: 4 }} />
        <div className="nv-skeleton" style={{ flex: 1, borderRadius: 3 }} />
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
        if (!cancelled) setCountries(res.supported_countries || {});
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

      {/* ── Skeletons & Syles now in news.scss ── */}


      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="news-command-header" style={{ marginBottom: 32 }}>
        <div>
          <button
            onClick={() => navigate('/news')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--news-text-dim)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}
          >
            <ArrowLeft size={14} /> Back to News
          </button>
          <h2 className="news-title-sharp">News Configuration</h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.84rem', fontWeight: 500 }}>
            Manage supported pipelines and localized settings for each country.
          </p>
        </div>
      </div>

      {/* ── Country Cards ───────────────────────────────────────────────── */}
      {loading ? (
        <ConfigSkeleton />
      ) : error ? (
        <div style={{ color: '#DC143C', fontSize: '0.9rem', fontWeight: 600 }}>⚠ {error}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {Object.entries(countries).map(([countryName, details]) => (
            <div key={countryName} className="country-card">

              {/* Top row: Flag + Name | ISO badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CountryFlag country={details.locale ?? countryName} size={32} style={{ borderRadius: 3 }} />
                  <span style={{ color: 'var(--news-text-main)', fontSize: '1.05rem', fontWeight: 800 }}>
                    {countryName}
                  </span>
                </div>
                <span style={{
                  background: 'rgba(212,175,55,0.08)',
                  color: '#D4AF37',
                  border: '1px solid rgba(212,175,55,0.2)',
                  borderRadius: 3,
                  padding: '3px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}>
                  {details.locale}
                </span>
              </div>

              {/* Pipeline Note */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, padding: '10px 12px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--news-text-dim)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  <Activity size={11} /> Pipeline Note
                </div>
                <div style={{ color: 'var(--news-text-muted)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  {details.pipeline_note || 'No active notes.'}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── Language Configurations ─────────────────────────────────────── */}
      <LanguageConfigSection countryDetails={countries} />

      {/* ── Topic Configurations ────────────────────────────────────────── */}
      <TopicConfigSection countryDetails={countries} />
    </div>
  );
}
