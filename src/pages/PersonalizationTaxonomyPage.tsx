import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import gsap from 'gsap';
import {
  Tags,
  RotateCcw,
  Save,
  Plus,
  X,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Info,
  RefreshCw,
  Globe,
} from 'lucide-react';
import {
  TaxonomyService,
  type CountryTaxonomyConfig,
  type AllTaxonomyResponse,
} from 'api/backendApi';
import { showToast } from 'components/EliteUI/EliteToastContainer';
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
      gsap.fromTo(boxRef.current, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' });
    }
  }, [open]);

  if (!open) return null;
  const IconComp = iconType === 'danger' ? AlertTriangle : iconType === 'info' ? Info : AlertTriangle;
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PersonalizationTaxonomyPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);

  const [allData, setAllData] = useState<AllTaxonomyResponse | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [currentConfig, setCurrentConfig] = useState<CountryTaxonomyConfig | null>(null);
  const [workingDims, setWorkingDims] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [modal, setModal] = useState<'save' | 'reset' | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // ── Load all taxonomy ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TaxonomyService.fetchAll();
      setAllData(data);
      if (data.configs.length > 0 && !selectedCountry) {
        const first = data.configs[0].country;
        setSelectedCountry(first);
        setCurrentConfig(data.configs[0]);
        setWorkingDims([...data.configs[0].dimensions]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCountry]);

  useEffect(() => { loadAll(); }, []);

  // ── Page enter animation ──────────────────────────────────
  useEffect(() => {
    if (!loading && pageRef.current) {
      gsap.fromTo(pageRef.current.querySelectorAll('.pers-card, .pers-stats-row, .pers-header'),
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out' }
      );
    }
  }, [loading]);

  // ── Animate chips on change ───────────────────────────────
  useEffect(() => {
    if (chipsRef.current) {
      const chips = chipsRef.current.querySelectorAll('.pers-chip');
      gsap.fromTo(chips, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.025, ease: 'back.out(1.2)' });
    }
  }, [workingDims]);

  // ── Country change ────────────────────────────────────────
  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    const cfg = allData?.configs.find(c => c.country === country);
    if (cfg) {
      setCurrentConfig(cfg);
      setWorkingDims([...cfg.dimensions]);
    }
  };

  // ── Tag operations ────────────────────────────────────────
  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '_');
    if (!tag || workingDims.includes(tag)) { setNewTag(''); return; }
    setWorkingDims(prev => [...prev, tag]);
    setNewTag('');
  };

  const removeTag = (idx: number) => {
    setWorkingDims(prev => prev.filter((_, i) => i !== idx));
  };

  const hasChanges = currentConfig
    ? JSON.stringify(workingDims) !== JSON.stringify(currentConfig.dimensions)
    : false;

  // ── Save taxonomy ─────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedCountry) return;
    setSaving(true);
    setModal(null);
    try {
      const updated = await TaxonomyService.updateCountry(selectedCountry, workingDims);
      setCurrentConfig(updated);
      setAllData(prev => prev ? {
        ...prev,
        configs: prev.configs.map(c => c.country === selectedCountry ? updated : c),
      } : prev);
      showToast(`Taxonomy saved for ${selectedCountry}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to save taxonomy', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset taxonomy ────────────────────────────────────────
  const handleReset = async () => {
    if (!selectedCountry) return;
    setResetting(true);
    setModal(null);
    try {
      const result = await TaxonomyService.resetCountry(selectedCountry);
      const updated: CountryTaxonomyConfig = {
        country: selectedCountry,
        dimensions: result.dimensions,
        dimension_count: result.dimensions.length,
        is_default: result.is_default,
        target_count: result.dimensions.length,
      };
      setCurrentConfig(updated);
      setWorkingDims([...result.dimensions]);
      setAllData(prev => prev ? {
        ...prev,
        configs: prev.configs.map(c => c.country === selectedCountry ? updated : c),
      } : prev);
      showToast(`Taxonomy reset to defaults for ${selectedCountry}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to reset taxonomy', 'error');
    } finally {
      setResetting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`pers-page ${!isDark ? 'light-mode' : ''}`}>
        <div className="pers-loading">
          <div className="pers-spinner" />
          <p>Loading taxonomy configurations...</p>
        </div>
      </div>
    );
  }

  const countries = allData?.configs.map(c => c.country) ?? [];
  const defaultDims = allData?.default_dimensions ?? [];

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`} ref={pageRef}>
      {/* ── Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1><Tags size={22} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />Taxonomy Configuration</h1>
          <div className="pers-subtitle">
            Define topic scoring dimensions per country. These dimensions drive news personalization vectors.
            <strong style={{ color: '#fde047', marginLeft: '0.4rem' }}>⚠️ Changing dimensions invalidates user content vectors.</strong>
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
            disabled={!hasChanges || saving || workingDims.length === 0}
          >
            {saving ? <Loader2 size={14} className="spin-icon" /> : <Save size={14} />}
            Save Taxonomy
          </button>
        </div>
      </div>

      {/* ── Country Selector ── */}
      <div className="pers-control-row">
        <Globe size={16} style={{ color: '#a8956b' }} />
        <span className="pers-select-label">Country</span>
        <div className="pers-select-wrapper">
          <select
            value={selectedCountry}
            onChange={e => handleCountryChange(e.target.value)}
            id="taxonomy-country-select"
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

        {currentConfig && (
          <span style={{ fontSize: '0.78rem', color: '#8a8a8f', marginLeft: '0.5rem' }}>
            {currentConfig.dimension_count} dimensions · Target {currentConfig.target_count}
          </span>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="pers-stats-row">
        <div className="pers-stat-card">
          <div className="stat-label">Total Countries</div>
          <div className="stat-value">{allData?.total ?? countries.length}</div>
          <div className="stat-sub">configured entries</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Active Dimensions</div>
          <div className="stat-value">{workingDims.length}</div>
          <div className="stat-sub">for {selectedCountry}</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Global Defaults</div>
          <div className="stat-value">{defaultDims.length}</div>
          <div className="stat-sub">fallback dimensions</div>
        </div>
        <div className="pers-stat-card">
          <div className="stat-label">Custom Configs</div>
          <div className="stat-value">{allData?.configs.filter(c => !c.is_default).length ?? 0}</div>
          <div className="stat-sub">country overrides</div>
        </div>
      </div>

      {/* ── Taxonomy Editor ── */}
      <div className="pers-grid-2">
        {/* Current Dimensions Editor */}
        <div className="pers-card">
          <div className="pers-card-title">
            <Tags size={15} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Dimensions for <span style={{ color: '#D4AF37' }}>{selectedCountry}</span>
          </div>
          <div className="pers-card-subtitle">
            Click ✕ to remove. Add new tags below. Order matters — first dimensions have higher scoring weight.
          </div>

          <div className="pers-divider" />

          {/* Chips */}
          <div className="pers-chips" ref={chipsRef}>
            {workingDims.length === 0 ? (
              <div className="pers-empty" style={{ padding: '1.5rem', width: '100%' }}>
                No dimensions configured. Add some below.
              </div>
            ) : (
              workingDims.map((dim, idx) => (
                <span key={`${dim}-${idx}`} className="pers-chip">
                  <span style={{ fontSize: '0.65rem', opacity: 0.5, marginRight: '0.15rem' }}>{idx + 1}</span>
                  {dim}
                  <button className="chip-remove" onClick={() => removeTag(idx)} aria-label={`Remove ${dim}`}>
                    <X size={11} />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="pers-divider" />

          {/* Add Tag Input */}
          <div className="pers-add-tag-row">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="e.g. technology, sports, economy..."
              onKeyDown={e => e.key === 'Enter' && addTag()}
              id="taxonomy-new-tag-input"
              aria-label="New dimension tag"
            />
            <button
              className="pers-btn pers-btn-primary"
              onClick={addTag}
              disabled={!newTag.trim()}
              id="taxonomy-add-tag-btn"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {hasChanges && (
            <div className="pers-alert alert-warn" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <AlertTriangle size={16} />
              Unsaved changes detected. Save to apply to this country.
            </div>
          )}
        </div>

        {/* Global Default Reference */}
        <div className="pers-card">
          <div className="pers-card-title">
            <Globe size={15} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Global Default Dimensions
          </div>
          <div className="pers-card-subtitle">
            These are the fallback dimensions used when a country has no custom taxonomy configured.
          </div>

          <div className="pers-divider" />

          <div className="pers-chips">
            {defaultDims.length === 0 ? (
              <div className="pers-empty" style={{ padding: '1.5rem', width: '100%' }}>
                No global defaults loaded.
              </div>
            ) : (
              defaultDims.map((dim, idx) => (
                <span key={`default-${dim}-${idx}`} className="pers-chip" style={{ opacity: 0.7, cursor: 'default' }}>
                  <span style={{ fontSize: '0.65rem', opacity: 0.5, marginRight: '0.15rem' }}>{idx + 1}</span>
                  {dim}
                </span>
              ))
            )}
          </div>

          <div className="pers-divider" />

          <div className="pers-alert alert-info" style={{ marginBottom: 0 }}>
            <Info size={15} />
            <div>
              <strong>Resetting</strong> a country's taxonomy replaces its dimensions with these global defaults.
              You can also use these as a reference when building a custom configuration.
            </div>
          </div>
        </div>
      </div>

      {/* ── All Countries Overview ── */}
      {allData && allData.configs.length > 0 && (
        <>
          <div className="pers-divider" style={{ margin: '2rem 0 1.5rem' }} />
          <div className="pers-card-title" style={{ marginBottom: '1rem', color: '#a8956b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
            All Countries Overview
          </div>
          <div className="pers-grid-3">
            {allData.configs.map(cfg => (
              <div
                key={cfg.country}
                className="pers-card"
                style={{
                  cursor: 'pointer',
                  borderColor: cfg.country === selectedCountry ? 'rgba(212,175,55,0.6)' : undefined,
                  padding: '1rem 1.25rem',
                }}
                onClick={() => handleCountryChange(cfg.country)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleCountryChange(cfg.country)}
                aria-label={`Select ${cfg.country} taxonomy`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fafafa' }}>{cfg.country}</span>
                  <span className={`pers-badge ${cfg.is_default ? 'badge-default' : 'badge-custom'}`} style={{ fontSize: '0.6rem' }}>
                    {cfg.is_default ? 'Default' : 'Custom'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#8a8a8f' }}>
                  {cfg.dimension_count} dimensions
                  {cfg.updated_at && (
                    <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>
                      · {new Date(cfg.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Save Modal ── */}
      <ConfirmModal
        open={modal === 'save'}
        title="Save Taxonomy Changes?"
        iconType="warn"
        body={
          <span>
            You are about to save <strong>{workingDims.length} dimensions</strong> for{' '}
            <strong>{selectedCountry}</strong>.<br /><br />
            <span style={{ color: '#fde047' }}>
              ⚠️ Warning: This is a full replacement. All existing user content vectors for this country will be invalidated and must be recomputed.
            </span>
          </span>
        }
        confirmLabel="Yes, Save Taxonomy"
        confirmClass="pers-btn-primary"
        onConfirm={handleSave}
        onCancel={() => setModal(null)}
        loading={saving}
        isDark={isDark}
      />

      {/* ── Reset Modal ── */}
      <ConfirmModal
        open={modal === 'reset'}
        title="Reset Taxonomy to Global Default?"
        iconType="danger"
        body={
          <span>
            This will replace the custom taxonomy for <strong>{selectedCountry}</strong> with the global default dimensions.
            <br /><br />All custom dimensions will be lost. This action cannot be undone.
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
