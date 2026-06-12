import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import gsap from 'gsap';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import {
  FlaskConical,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle,
  Globe,
  TrendingUp,
  Target,
  Zap,
  ShieldCheck,
  Users,
  ChevronDown,
} from 'lucide-react';
import {
  CalibrationService,
  ThresholdsService,
  type CalibrationResponse,
  type TierThresholds,
  type CalibrationBin,
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
  iconType = 'info', onConfirm, onCancel, loading, isDark,
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
  const IconComp = iconType === 'danger' ? AlertTriangle : iconType === 'warn' ? AlertTriangle : Info;
  return (
    <div className="pers-modal-overlay" ref={overlayRef}>
      <div className={`pers-modal ${!isDark ? 'light' : ''}`} ref={boxRef}>
        <div className={`modal-icon icon-${iconType}`}><IconComp size={22} /></div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="pers-btn pers-btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`pers-btn ${confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 size={14} className="spin-icon" /> Applying...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Custom Tooltip for chart ──────────────────────────────────────────────────
const CustomBarTooltip: React.FC<any> = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  const d: CalibrationBin = payload[0]?.payload;
  return (
    <div style={{
      background: isDark ? '#1a1a1a' : '#fff',
      border: '1px solid rgba(212,175,55,0.25)',
      borderRadius: '6px',
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      color: isDark ? '#fafafa' : '#111',
    }}>
      <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '0.4rem' }}>
        Cosine [{d?.lo?.toFixed(2)} – {d?.hi?.toFixed(2)}]
      </div>
      <div>Open Rate: <strong style={{ color: '#86efac' }}>{((d?.open_rate ?? 0) * 100).toFixed(1)}%</strong></div>
      <div>Sent: <strong>{d?.sent?.toLocaleString()}</strong></div>
      <div>Opened: <strong>{d?.opened?.toLocaleString()}</strong></div>
    </div>
  );
};

// ── Threshold Comparison Row ──────────────────────────────────────────────────
interface ThresholdCompareRowProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  suggested: number | undefined;
  color: string;
}
const ThresholdCompareRow: React.FC<ThresholdCompareRowProps> = ({ label, icon, current, suggested, color }) => {
  const diff = suggested !== undefined ? suggested - current : null;
  return (
    <div className="sg-cell">
      <div className="sg-key" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{icon} {label}</div>
      <div className="sg-val" style={{ color }}>
        {suggested !== undefined ? suggested.toFixed(3) : '—'}
      </div>
      <div className={`sg-change ${diff === null ? '' : diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`}>
        {diff === null
          ? `Current: ${current.toFixed(3)}`
          : diff === 0
          ? `No change (${current.toFixed(3)})`
          : `${diff > 0 ? '↑' : '↓'} from ${current.toFixed(3)} (${diff > 0 ? '+' : ''}${diff.toFixed(3)})`}
      </div>
    </div>
  );
};

// ── Countries list from thresholds API ───────────────────────────────────────
const DAYS_OPTIONS = [7, 14, 30, 60, 90, 180];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PersonalizationCalibrationPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);

  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [data, setData] = useState<CalibrationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Load country list from thresholds endpoint
  useEffect(() => {
    async function fetchCountries() {
      setLoadingCountries(true);
      try {
        const res = await ThresholdsService.fetchAll();
        const list = res.configs.map(c => c.country);
        setCountries(list);
        if (list.length > 0) setSelectedCountry(list[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCountries(false);
      }
    }
    fetchCountries();
  }, []);

  // Load calibration whenever country or days changes
  const loadCalibration = useCallback(async (country: string, days: number) => {
    if (!country) return;
    setLoading(true);
    setData(null);
    try {
      const res = await CalibrationService.fetchCalibration(country, days);
      setData(res);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to load calibration data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCountry) loadCalibration(selectedCountry, selectedDays);
  }, [selectedCountry, selectedDays]);

  // GSAP animate chart bars after data loads
  useEffect(() => {
    if (data && chartRef.current) {
      gsap.fromTo(chartRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
    if (!loading && pageRef.current) {
      gsap.fromTo(
        pageRef.current.querySelectorAll('.pers-stat-card, .pers-suggestion-card, .pers-chart-wrap, .pers-alert'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }
      );
    }
  }, [data, loading]);

  // Apply suggested thresholds
  const handleApplySuggestions = async () => {
    if (!data?.suggested_thresholds || !selectedCountry) return;
    setApplying(true);
    setShowConfirm(false);
    try {
      await ThresholdsService.updateCountry(selectedCountry, data.suggested_thresholds);
      showToast(`Suggested thresholds applied for ${selectedCountry}`, 'success');
      // Reload calibration to reflect updated current_thresholds
      await loadCalibration(selectedCountry, selectedDays);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to apply suggestions', 'error');
    } finally {
      setApplying(false);
    }
  };

  // Compute chart data with color
  const chartData = (data?.bins ?? []).map(bin => ({
    ...bin,
    label: `${bin.lo.toFixed(2)}`,
    open_pct: parseFloat(((bin.open_rate ?? 0) * 100).toFixed(2)),
  }));

  const maxOpenPct = Math.max(...chartData.map(d => d.open_pct), 1);

  const getBarColor = (bin: CalibrationBin) => {
    if (!data) return '#D4AF37';
    const { active, dormant, premium } = data.current_thresholds;
    if (bin.lo >= premium) return '#D4AF37';
    if (bin.lo >= active) return '#86efac';
    if (bin.lo >= dormant) return '#fde047';
    return '#6b7280';
  };

  const hasSuggestions = !!data?.suggested_thresholds;
  const suggestions = data?.suggested_thresholds;

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`} ref={pageRef}>
      {/* ── Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1>
            <FlaskConical size={22} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Threshold Calibration
          </h1>
          <div className="pers-subtitle">
            Analyze open-rate distribution across cosine similarity bins. Use data-driven suggestions to auto-tune thresholds.
          </div>
        </div>
        <div className="pers-action-group">
          <button
            className="pers-btn pers-btn-secondary"
            onClick={() => loadCalibration(selectedCountry, selectedDays)}
            disabled={loading || !selectedCountry}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {hasSuggestions && (
            <button
              className="pers-btn pers-btn-primary"
              onClick={() => setShowConfirm(true)}
              disabled={applying}
            >
              {applying ? <Loader2 size={14} className="spin-icon" /> : <Zap size={14} />}
              Apply Suggestions
            </button>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="pers-control-row">
        <Globe size={16} style={{ color: '#a8956b' }} />
        <span className="pers-select-label">Country</span>
        <div className="pers-select-wrapper">
          <select
            value={selectedCountry}
            onChange={e => setSelectedCountry(e.target.value)}
            disabled={loadingCountries}
            id="calibration-country-select"
          >
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="pers-select-arrow">▼</span>
        </div>

        <span className="pers-select-label" style={{ marginLeft: '0.5rem' }}>Window</span>
        <div className="pers-select-wrapper" style={{ minWidth: '100px' }}>
          <select
            value={selectedDays}
            onChange={e => setSelectedDays(parseInt(e.target.value))}
            id="calibration-days-select"
          >
            {DAYS_OPTIONS.map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
          <span className="pers-select-arrow">▼</span>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="pers-loading" style={{ minHeight: '300px' }}>
          <div className="pers-spinner" />
          <p>Analyzing calibration data for {selectedCountry} ({selectedDays} days)...</p>
        </div>
      )}

      {/* ── Note / Warning ── */}
      {!loading && data?.note && (
        <div className={`pers-alert ${data.bins.length === 0 ? 'alert-warn' : 'alert-info'}`}>
          <Info size={15} />
          <span>{data.note}</span>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {!loading && data && (
        <>
          <div className="pers-stats-row">
            <div className="pers-stat-card">
              <div className="stat-label">Total Sent</div>
              <div className="stat-value">{data.total_sent.toLocaleString()}</div>
              <div className="stat-sub">notifications · {data.window_days}d</div>
            </div>
            <div className="pers-stat-card">
              <div className="stat-label">Total Opened</div>
              <div className="stat-value">{data.total_opened.toLocaleString()}</div>
              <div className="stat-sub">unique opens</div>
            </div>
            <div className="pers-stat-card">
              <div className="stat-label">Overall Open Rate</div>
              <div className="stat-value" style={{ color: '#86efac' }}>
                {(data.overall_open_rate * 100).toFixed(1)}%
              </div>
              <div className="stat-sub">all cosine bins</div>
            </div>
            <div className="pers-stat-card">
              <div className="stat-label">Inflection Point</div>
              <div className="stat-value" style={{ color: '#D4AF37' }}>
                {data.inflection_cosine != null ? data.inflection_cosine.toFixed(3) : '—'}
              </div>
              <div className="stat-sub">optimal cosine</div>
            </div>
          </div>

          {/* ── Suggested Thresholds Card ── */}
          {hasSuggestions && suggestions ? (
            <div className="pers-suggestion-card">
              <div className="suggestion-title">
                <Target size={16} /> Suggested Threshold Adjustments
                <span className="pers-badge badge-active" style={{ marginLeft: 'auto' }}>Data-Driven</span>
              </div>
              <div className="suggestion-grid">
                <ThresholdCompareRow
                  label="Active"
                  icon={<TrendingUp size={11} />}
                  current={data.current_thresholds.active}
                  suggested={suggestions?.active}
                  color="#86efac"
                />
                <ThresholdCompareRow
                  label="Dormant"
                  icon={<Users size={11} />}
                  current={data.current_thresholds.dormant}
                  suggested={suggestions?.dormant}
                  color="#fde047"
                />
                <ThresholdCompareRow
                  label="Premium"
                  icon={<ShieldCheck size={11} />}
                  current={data.current_thresholds.premium}
                  suggested={suggestions?.premium}
                  color="#D4AF37"
                />
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="pers-btn pers-btn-primary" onClick={() => setShowConfirm(true)} disabled={applying}>
                  {applying ? <Loader2 size={14} className="spin-icon" /> : <Zap size={14} />}
                  Apply These Suggestions
                </button>
              </div>
            </div>
          ) : (
            <div className="pers-alert alert-info" style={{ marginBottom: '1.5rem' }}>
              <CheckCircle size={15} />
              <span>No threshold adjustments suggested. Current thresholds appear well-calibrated for this data window.</span>
            </div>
          )}

          {/* ── Chart ── */}
          {data.bins.length > 0 ? (
            <div className="pers-chart-wrap" ref={chartRef}>
              <div className="chart-title">
                Open Rate by Cosine Similarity Bin
                <span style={{ fontSize: '0.72rem', color: '#8a8a8f', marginLeft: '0.75rem', fontWeight: 400 }}>
                  — Reference lines: current thresholds · {selectedCountry} · {data.window_days}d window
                </span>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {[
                  { color: '#6b7280', label: `< Dormant (${data.current_thresholds.dormant.toFixed(2)})` },
                  { color: '#fde047', label: `Dormant–Active (${data.current_thresholds.dormant.toFixed(2)}–${data.current_thresholds.active.toFixed(2)})` },
                  { color: '#86efac', label: `Active–Premium (${data.current_thresholds.active.toFixed(2)}–${data.current_thresholds.premium.toFixed(2)})` },
                  { color: '#D4AF37', label: `≥ Premium (${data.current_thresholds.premium.toFixed(2)})` },
                ].map(item => (
                  <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#8a8a8f' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color, display: 'inline-block' }} />
                    {item.label}
                  </span>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: isDark ? '#8a8a8f' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(212,175,55,0.15)' }}
                    tickLine={false}
                    label={{ value: 'Cosine Similarity', position: 'insideBottom', offset: -3, fill: '#a8956b', fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={v => `${v}%`}
                    tick={{ fill: isDark ? '#8a8a8f' : '#6b7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, Math.ceil(maxOpenPct * 1.2)]}
                  />
                  <Tooltip content={<CustomBarTooltip isDark={isDark} />} cursor={{ fill: 'rgba(212,175,55,0.05)' }} />

                  {/* Threshold reference lines */}
                  <ReferenceLine x={data.current_thresholds.dormant.toFixed(2)} stroke="#fde047" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Dormant', fill: '#fde047', fontSize: 10, position: 'top' }} />
                  <ReferenceLine x={data.current_thresholds.active.toFixed(2)} stroke="#86efac" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Active', fill: '#86efac', fontSize: 10, position: 'top' }} />
                  <ReferenceLine x={data.current_thresholds.premium.toFixed(2)} stroke="#D4AF37" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'Premium', fill: '#D4AF37', fontSize: 10, position: 'top' }} />

                  {/* Inflection cosine */}
                  {data.inflection_cosine != null && (
                    <ReferenceLine x={data.inflection_cosine.toFixed(2)} stroke="#a78bfa" strokeDasharray="2 4" strokeWidth={2}
                      label={{ value: 'Inflection', fill: '#a78bfa', fontSize: 10, position: 'top' }} />
                  )}

                  <Bar dataKey="open_pct" radius={[4, 4, 0, 0]} name="Open Rate %">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="pers-card" style={{ marginBottom: '1.5rem' }}>
              <div className="pers-empty">
                <FlaskConical size={32} style={{ opacity: 0.4 }} />
                <div>No bin data available for this window.</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.6 }}>Try a larger time window or check if notifications have been sent.</div>
              </div>
            </div>
          )}

          {/* ── Current vs Suggested Comparison Table ── */}
          <div className="pers-card">
            <div className="pers-card-title" style={{ marginBottom: '1rem' }}>
              Current vs Suggested Thresholds
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
                    {['Tier', 'Current', 'Suggested', 'Delta'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.6rem 1rem', color: '#a8956b', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['active', 'dormant', 'premium'] as (keyof TierThresholds)[]).map(tier => {
                    const curr = data.current_thresholds[tier];
                    const sugg = suggestions?.[tier];
                    const delta = sugg !== undefined ? sugg - curr : null;
                    const tierColors: Record<string, string> = { active: '#86efac', dormant: '#fde047', premium: '#D4AF37' };
                    return (
                      <tr key={tier} style={{ borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: tierColors[tier], textTransform: 'capitalize' }}>{tier}</td>
                        <td style={{ padding: '0.65rem 1rem', color: isDark ? '#fafafa' : '#111', fontWeight: 600 }}>{curr.toFixed(3)}</td>
                        <td style={{ padding: '0.65rem 1rem', color: sugg !== undefined ? tierColors[tier] : '#8a8a8f', fontWeight: 600 }}>
                          {sugg !== undefined ? sugg.toFixed(3) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: delta == null ? '#8a8a8f' : delta > 0 ? '#86efac' : delta < 0 ? '#f87171' : '#8a8a8f' }}>
                          {delta == null ? '—' : delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Apply Suggestions Confirmation Modal ── */}
      <ConfirmModal
        open={showConfirm}
        title="Apply Suggested Thresholds?"
        iconType="info"
        body={
          <span>
            Apply the calibration-suggested thresholds for <strong>{selectedCountry}</strong>:
            <br /><br />
            <strong style={{ color: '#86efac' }}>Active:</strong> {suggestions?.active.toFixed(3)} &nbsp;
            <strong style={{ color: '#fde047' }}>Dormant:</strong> {suggestions?.dormant.toFixed(3)} &nbsp;
            <strong style={{ color: '#D4AF37' }}>Premium:</strong> {suggestions?.premium.toFixed(3)}
            <br /><br />
            These will replace the current thresholds immediately.
          </span>
        }
        confirmLabel="Yes, Apply Suggestions"
        confirmClass="pers-btn-primary"
        onConfirm={handleApplySuggestions}
        onCancel={() => setShowConfirm(false)}
        loading={applying}
        isDark={isDark}
      />

      <style>{`.spin-icon { animation: pers-spin 1s linear infinite; }`}</style>
    </div>
  );
}
