import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import gsap from 'gsap';
import {
  Gauge,
  Save,
  RotateCcw,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  Globe,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ThresholdsService,
  type CountryThresholdsConfig,
  type AllThresholdsResponse,
  type TierThresholds,
} from 'api/backendApi';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import PersonalizationNavTabs from 'components/PersonalizationNavTabs';
import './personalization.scss';

// ── Confirmation Modal ────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  confirmClass?: string;
  iconType?: 'warn' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  isDark: boolean;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, title, body, confirmLabel = 'Confirm', confirmClass = 'pers-btn-primary',
  iconType = 'warn', onConfirm, onCancel, loading, isDark,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && overlayRef.current && boxRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(boxRef.current, { opacity: 0, scale: 0.92, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' });
    }
  }, [open]);

  if (!open) return null;
  const IconComp = iconType === 'danger' ? AlertTriangle : Info;
  return (
    <div className="pers-modal-overlay" ref={overlayRef}>
      <div className={`pers-modal ${!isDark ? 'light' : ''}`} ref={boxRef}>
        <div className={`modal-icon icon-${iconType}`}><IconComp size={22} /></div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="pers-btn pers-btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`pers-btn ${confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 size={14} className="spin-icon" /> Working...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Slider Cell ───────────────────────────────────────────────────────────────
interface SliderCellProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  color?: string;
  description: string;
}
const SliderCell: React.FC<SliderCellProps> = ({ label, icon, value, onChange, disabled, color = '#D4AF37', description }) => {
  const pct = Math.round(value * 100);
  return (
    <div className="threshold-tier-card">
      <div className="tier-label">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {icon} {label}
        </span>
        <span className="pers-badge badge-active">{value.toFixed(2)}</span>
      </div>
      <div className="pers-slider-wrap">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
          aria-label={`${label} threshold`}
        />
        <span className="slider-value" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#8a8a8f', lineHeight: 1.4 }}>{description}</div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const TIER_META: Record<keyof TierThresholds, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  active: {
    label: 'Active Tier',
    icon: <TrendingUp size={13} />,
    desc: 'Minimum cosine similarity for active/engaged users. Higher = stricter personalization.',
    color: '#86efac',
  },
  dormant: {
    label: 'Dormant Tier',
    icon: <Users size={13} />,
    desc: 'Threshold for dormant users. Lower threshold ensures they still receive relevant content.',
    color: '#fde047',
  },
  premium: {
    label: 'Premium Tier',
    icon: <ShieldCheck size={13} />,
    desc: 'Highest bar for premium subscribers who expect top-relevance content.',
    color: '#D4AF37',
  },
};

export default function PersonalizationThresholdsPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);

  const [allData, setAllData] = useState<AllThresholdsResponse | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [currentConfig, setCurrentConfig] = useState<CountryThresholdsConfig | null>(null);
  const [workingThresholds, setWorkingThresholds] = useState<TierThresholds>({ active: 0, dormant: 0, premium: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [modal, setModal] = useState<'save' | 'reset' | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ThresholdsService.fetchAll();
      setAllData(data);
      if (data.configs.length > 0) {
        const first = data.configs[0];
        setSelectedCountry(first.country);
        setCurrentConfig(first);
        setWorkingThresholds({ ...first.thresholds });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!loading && pageRef.current) {
      gsap.fromTo(
        pageRef.current.querySelectorAll('.pers-card, .pers-stats-row, .threshold-tier-row, .pers-header'),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' }
      );
    }
  }, [loading]);

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    const cfg = allData?.configs.find(c => c.country === country);
    if (cfg) {
      setCurrentConfig(cfg);
      setWorkingThresholds({ ...cfg.thresholds });
    }
  };

  const hasChanges = currentConfig
    ? JSON.stringify(workingThresholds) !== JSON.stringify(currentConfig.thresholds)
    : false;

  const updateTier = (key: keyof TierThresholds, val: number) => {
    setWorkingThresholds(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!selectedCountry) return;
    setSaving(true);
    setModal(null);
    try {
      const updated = await ThresholdsService.updateCountry(selectedCountry, workingThresholds);
      setCurrentConfig(updated);
      setAllData(prev => prev ? {
        ...prev,
        configs: prev.configs.map(c => c.country === selectedCountry ? updated : c),
      } : prev);
      showToast(`Thresholds saved for ${selectedCountry}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to save thresholds', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedCountry) return;
    setResetting(true);
    setModal(null);
    try {
      const result = await ThresholdsService.resetCountry(selectedCountry);
      const updated: CountryThresholdsConfig = {
        country: selectedCountry,
        thresholds: result.thresholds,
        is_default: result.is_default,
      };
      setCurrentConfig(updated);
      setWorkingThresholds({ ...result.thresholds });
      setAllData(prev => prev ? {
        ...prev,
        configs: prev.configs.map(c => c.country === selectedCountry ? updated : c),
      } : prev);
      showToast(`Thresholds reset to defaults for ${selectedCountry}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to reset thresholds', 'error');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className={`pers-page ${!isDark ? 'light-mode' : ''}`}>
        <div className="pers-loading">
          <div className="pers-spinner" />
          <p>Loading threshold configurations...</p>
        </div>
      </div>
    );
  }

  const countries = allData?.configs.map(c => c.country) ?? [];
  const defaultThresholds = allData?.default_thresholds;

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`} ref={pageRef}>
      {/* ── Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1>
            <Gauge size={22} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Tier Thresholds
          </h1>
          <div className="pers-subtitle">
            Manage cosine-similarity floors per country and user tier. Higher values = stricter content matching.
          </div>
        </div>
        <div className="pers-action-group">
          <button className="pers-btn pers-btn-secondary" onClick={loadAll} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="pers-btn pers-btn-danger"
            onClick={() => setModal('reset')}
            disabled={!selectedCountry || resetting}
          >
            {resetting ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
            Reset to Default
          </button>
          <button
            className="pers-btn pers-btn-primary"
            onClick={() => setModal('save')}
            disabled={!hasChanges || saving}
          >
            {saving ? <Loader2 size={14} className="spin-icon" /> : <Save size={14} />}
            Save Thresholds
          </button>
        </div>
      </div>

      {/* ── Personalization Suite Navigation Tabs ── */}
      <PersonalizationNavTabs />

      {/* ── Country Selector ── */}
      <div className="pers-control-row">
        <Globe size={16} style={{ color: '#a8956b' }} />
        <span className="pers-select-label">Country</span>
        <div className="pers-select-wrapper">
          <select
            value={selectedCountry}
            onChange={e => handleCountryChange(e.target.value)}
            id="thresholds-country-select"
          >
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="pers-select-arrow">▼</span>
        </div>
        {currentConfig && (
          <span className={`pers-badge ${currentConfig.is_default ? 'badge-default' : 'badge-custom'}`}>
            {currentConfig.is_default ? 'Using Global Default' : 'Custom Config'}
          </span>
        )}
        {currentConfig?.updated_at && (
          <span style={{ fontSize: '0.75rem', color: '#8a8a8f' }}>
            Updated {new Date(currentConfig.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="pers-stats-row">
        <div className="pers-stat-card">
          <div className="stat-label">Total Countries</div>
          <div className="stat-value">{allData?.total ?? countries.length}</div>
          <div className="stat-sub">with configs</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Active Threshold</div>
          <div className="stat-value" style={{ color: '#86efac' }}>{workingThresholds.active.toFixed(2)}</div>
          <div className="stat-sub">{selectedCountry}</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Dormant Threshold</div>
          <div className="stat-value" style={{ color: '#fde047' }}>{workingThresholds.dormant.toFixed(2)}</div>
          <div className="stat-sub">{selectedCountry}</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Premium Threshold</div>
          <div className="stat-value" style={{ color: '#D4AF37' }}>{workingThresholds.premium.toFixed(2)}</div>
          <div className="stat-sub">{selectedCountry}</div>
        </div>
      </div>

      {/* ── Threshold Sliders ── */}
      <div className="pers-card" style={{ marginBottom: '1.5rem' }}>
        <div className="pers-card-title" style={{ marginBottom: '0.35rem' }}>
          <Gauge size={15} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Thresholds for <span style={{ color: '#D4AF37' }}>{selectedCountry}</span>
        </div>
        <div className="pers-card-subtitle">
          Adjust cosine similarity floors for each user tier. Range: 0.00 (no filter) → 1.00 (exact match).
        </div>
        <div className="pers-divider" />
        <div className="threshold-tier-row">
          {(Object.keys(TIER_META) as (keyof TierThresholds)[]).map(key => (
            <SliderCell
              key={key}
              label={TIER_META[key].label}
              icon={TIER_META[key].icon}
              value={workingThresholds[key]}
              onChange={v => updateTier(key, v)}
              disabled={saving || resetting}
              color={TIER_META[key].color}
              description={TIER_META[key].desc}
            />
          ))}
        </div>

        {hasChanges && (
          <div className="pers-alert alert-warn" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            <AlertTriangle size={15} />
            Unsaved changes. Click "Save Thresholds" to apply.
          </div>
        )}
      </div>

      {/* ── Global Defaults Reference ── */}
      {defaultThresholds && (
        <div className="pers-card" style={{ marginBottom: '1.5rem' }}>
          <div className="pers-card-title">
            <Info size={15} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Global Default Thresholds
          </div>
          <div className="pers-card-subtitle">Reference values used when no country override is configured.</div>
          <div className="pers-divider" />
          <div className="threshold-tier-row">
            {(Object.keys(TIER_META) as (keyof TierThresholds)[]).map(key => (
              <div key={key} className="threshold-tier-card" style={{ opacity: 0.7 }}>
                <div className="tier-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {TIER_META[key].icon} {TIER_META[key].label}
                  </span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: TIER_META[key].color }}>
                  {defaultThresholds[key].toFixed(2)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#8a8a8f' }}>global default</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All Countries Table ── */}
      {allData && allData.configs.length > 0 && (
        <div className="pers-card">
          <div className="pers-card-title" style={{ marginBottom: '1rem' }}>All Country Configurations</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
                  {['Country', 'Active', 'Dormant', 'Premium', 'Type', 'Updated'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: '#a8956b', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allData.configs.map(cfg => (
                  <tr
                    key={cfg.country}
                    onClick={() => handleCountryChange(cfg.country)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(212,175,55,0.06)',
                      background: cfg.country === selectedCountry ? 'rgba(212,175,55,0.04)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = cfg.country === selectedCountry ? 'rgba(212,175,55,0.04)' : 'transparent')}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#fafafa' }}>{cfg.country}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#86efac', fontWeight: 700 }}>{cfg.thresholds.active.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#fde047', fontWeight: 700 }}>{cfg.thresholds.dormant.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#D4AF37', fontWeight: 700 }}>{cfg.thresholds.premium.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span className={`pers-badge ${cfg.is_default ? 'badge-default' : 'badge-custom'}`} style={{ fontSize: '0.62rem' }}>
                        {cfg.is_default ? 'Default' : 'Custom'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#8a8a8f', fontSize: '0.75rem' }}>
                      {cfg.updated_at ? new Date(cfg.updated_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Save Modal ── */}
      <ConfirmModal
        open={modal === 'save'}
        title="Save Threshold Changes?"
        iconType="info"
        body={
          <span>
            Apply new thresholds for <strong>{selectedCountry}</strong>:
            <br /><br />
            <strong style={{ color: '#86efac' }}>Active:</strong> {workingThresholds.active.toFixed(2)} &nbsp;
            <strong style={{ color: '#fde047' }}>Dormant:</strong> {workingThresholds.dormant.toFixed(2)} &nbsp;
            <strong style={{ color: '#D4AF37' }}>Premium:</strong> {workingThresholds.premium.toFixed(2)}
            <br /><br />
            These take effect immediately for all new personalization queries.
          </span>
        }
        confirmLabel="Yes, Save Thresholds"
        confirmClass="pers-btn-primary"
        onConfirm={handleSave}
        onCancel={() => setModal(null)}
        loading={saving}
        isDark={isDark}
      />

      {/* ── Reset Modal ── */}
      <ConfirmModal
        open={modal === 'reset'}
        title="Reset to Global Defaults?"
        iconType="danger"
        body={
          <span>
            This will replace the custom thresholds for <strong>{selectedCountry}</strong> with the global default values.
            <br /><br />
            <strong>Default:</strong> Active {defaultThresholds?.active.toFixed(2)} · Dormant {defaultThresholds?.dormant.toFixed(2)} · Premium {defaultThresholds?.premium.toFixed(2)}
          </span>
        }
        confirmLabel="Yes, Reset to Default"
        confirmClass="pers-btn-danger"
        onConfirm={handleReset}
        onCancel={() => setModal(null)}
        loading={resetting}
        isDark={isDark}
      />

      <style>{`.spin-icon { animation: pers-spin 1s linear infinite; }`}</style>
    </div>
  );
}
