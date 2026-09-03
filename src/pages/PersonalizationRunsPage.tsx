import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Radio,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle,
  Globe,
  TrendingUp,
  Target,
  Zap,
  Users,
  Clock,
  Send,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  X,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import {
  PersonalizationRunsService,
  ThresholdsService,
  type PersoRunSummary,
  type PersoRunSummaryList,
  type PersoTopicDispatch,
} from 'api/backendApi';
import {
  getStatusMeta,
  analyzeRunDiagnosis,
  buildAudienceFunnel,
  getScoreInterpretation,
} from 'utils/personalizationPlainEnglish';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import './personalization.scss';

// ── Slot Configuration ───────────────────────────────────────────────────────
const SLOTS = [
  { id: undefined, label: 'All Slots (Latest)' },
  { id: 1, label: 'Slot 1 (Morning)' },
  { id: 2, label: 'Slot 2 (Afternoon)' },
  { id: 3, label: 'Slot 3 (Evening)' },
];

const DAYS_OPTIONS = [7, 14, 30, 90];

// ── Helper: Format Dates & Durations ─────────────────────────────────────────
function formatDate(isoStr?: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Custom Tooltip for Trend Chart ──────────────────────────────────────────
const CustomTrendTooltip: React.FC<any> = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '8px',
        padding: '0.85rem 1.15rem',
        fontSize: '0.82rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        color: isDark ? '#fafafa' : '#111111',
        minWidth: '220px',
      }}
    >
      <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '0.35rem' }}>
        {formatDate(item?.run_at || item?.date)}
        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.8 }}>
          (Slot {item?.slot})
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
        <span>Audience Reach:</span>
        <strong style={{ color: '#86efac' }}>{item?.push_rate_pct?.toFixed(1)}%</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
        <span>Relevance Filtered:</span>
        <strong style={{ color: '#fde047' }}>{item?.threshold_drop_rate_pct?.toFixed(1)}%</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
        <span>New Readers:</span>
        <strong style={{ color: '#93c5fd' }}>{item?.cold_start_rate_pct?.toFixed(1)}%</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span>Delivered / Matched:</span>
        <strong>{item?.users_matched?.toLocaleString()} readers</strong>
      </div>
    </div>
  );
};

// ── Run Detail Modal ─────────────────────────────────────────────────────────
interface RunDetailModalProps {
  run: PersoRunSummary | null;
  open: boolean;
  onClose: () => void;
  isDark: boolean;
}

const RunDetailModal: React.FC<RunDetailModalProps> = ({ run, open, onClose, isDark }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');
  const [copied, setCopied] = useState(false);
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const modalBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && modalOverlayRef.current && modalBoxRef.current) {
      gsap.fromTo(modalOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(
        modalBoxRef.current,
        { opacity: 0, scale: 0.94, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.3)' }
      );
    }
  }, [open]);

  if (!open || !run) return null;

  const statusMeta = getStatusMeta(run.status);
  const jsonString = JSON.stringify(run, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Run summary JSON copied to clipboard', 'success');
  };

  return (
    <div className="pers-modal-overlay" ref={modalOverlayRef} onClick={onClose}>
      <div
        className={`pers-modal ${!isDark ? 'light' : ''}`}
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', textAlign: 'left', padding: '1.75rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={18} style={{ color: '#D4AF37' }} />
              Run Breakdown — {run.country}
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#a8956b', marginTop: '0.2rem' }}>
              Slot {run.slot} • {formatDate(run.run_at)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#a8956b', cursor: 'pointer', padding: '0.3rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '0.35rem' }}>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === 'summary' ? '#D4AF37' : '#8a8a8f',
              padding: '0.4rem 0.8rem',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Friendly Summary
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'json' ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === 'json' ? '#D4AF37' : '#8a8a8f',
              padding: '0.4rem 0.8rem',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Raw JSON
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          {activeTab === 'summary' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status Header */}
              <div
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  border: '1px solid rgba(212,175,55,0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#a8956b', textTransform: 'uppercase', fontWeight: 700 }}>
                    Delivery Result
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: statusMeta.color, marginTop: '0.15rem' }}>
                    {statusMeta.label}
                  </div>
                </div>
                <span className={`pers-badge ${statusMeta.badgeClass}`}>{run.status}</span>
              </div>

              {/* Audience Funnel Summary */}
              <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Audience Flow & Filtering
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Total Registered Readers:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.cohort?.enumerated?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Passed to Recommender:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.cohort?.eligible_for_match?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Matched Relevant Stories:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#86efac' }}>{run.matching?.users_matched?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Dropped by Relevance Cutoff:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#fde047' }}>{run.matching?.users_below_threshold?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Skipped (No Profile Yet):</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#93c5fd' }}>{run.cohort?.no_vector?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Skipped (Daily Limit Reached):</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.cohort?.frequency_capped?.toLocaleString() ?? 0}</strong>
                  </div>
                </div>
              </div>

              {/* Delivery Stats */}
              <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Delivery & Device Dispatch
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Delivered Notifications:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#86efac' }}>{run.dispatch?.sent?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Failed Device Deliveries:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: run.dispatch?.failed ? '#f87171' : 'inherit' }}>
                      {run.dispatch?.failed?.toLocaleString() ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Elapsed Compute Time:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{formatDuration(run.elapsed_ms)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Candidate Stories Evaluated:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.candidate_articles ?? 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <button
                  className="pers-btn pers-btn-secondary"
                  onClick={handleCopyJson}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy JSON</>}
                </button>
              </div>
              <pre
                style={{
                  background: isDark ? '#080808' : '#f0f0f0',
                  color: isDark ? '#d4af37' : '#333',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  overflowX: 'auto',
                  border: '1px solid rgba(212,175,55,0.2)',
                }}
              >
                {jsonString}
              </pre>
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(212,175,55,0.2)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="pers-btn pers-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page Component ──────────────────────────────────────────────────────
export default function PersonalizationRunsPage() {
  const navigate = useNavigate();
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);

  // Filters & State
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'latest' | 'history'>('latest');
  const [selectedDays, setSelectedDays] = useState<number>(7);

  // Data states
  const [lastRun, setLastRun] = useState<PersoRunSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<PersoRunSummaryList | null>(null);
  const [loadingLastRun, setLoadingLastRun] = useState(false);
  const [loadingRecentRuns, setLoadingRecentRuns] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [lastRunNotFound, setLastRunNotFound] = useState(false);

  // Detail Modal State
  const [modalRun, setModalRun] = useState<PersoRunSummary | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Refs for animations
  const pageRef = useRef<HTMLDivElement>(null);
  const latestRunRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // ── Fetch Available Countries ──────────────────────────────
  useEffect(() => {
    async function loadCountries() {
      setLoadingCountries(true);
      try {
        const res = await ThresholdsService.fetchAll();
        const list = res?.configs?.map((c) => c.country) || [];
        setCountries(list);
        if (list.length > 0 && !selectedCountry) {
          setSelectedCountry(list[0]);
        }
      } catch (e) {
        console.error('Failed to load countries list', e);
        // Fallback default country
        const fallback = ['Germany', 'Pakistan', 'United States', 'United Kingdom'];
        setCountries(fallback);
        setSelectedCountry(fallback[0]);
      } finally {
        setLoadingCountries(false);
      }
    }
    loadCountries();
  }, []);

  // ── Fetch Last Run for Selected Country & Slot ─────────────
  const loadLastRun = useCallback(async (country: string, slot?: number) => {
    if (!country) return;
    setLoadingLastRun(true);
    setLastRunNotFound(false);
    try {
      const data = await PersonalizationRunsService.fetchLastRun(country, slot);
      setLastRun(data);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setLastRunNotFound(true);
        setLastRun(null);
      } else {
        showToast(e?.response?.data?.message || 'Failed to load last run summary', 'error');
        setLastRun(null);
      }
    } finally {
      setLoadingLastRun(false);
    }
  }, []);

  // ── Fetch Recent Runs for Selected Country & Days ──────────
  const loadRecentRuns = useCallback(async (country: string, days: number) => {
    if (!country) return;
    setLoadingRecentRuns(true);
    try {
      const data = await PersonalizationRunsService.fetchRecentRuns(country, days);
      setRecentRuns(data);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to load historical runs', 'error');
      setRecentRuns(null);
    } finally {
      setLoadingRecentRuns(false);
    }
  }, []);

  // Trigger loads on parameter changes
  useEffect(() => {
    if (selectedCountry) {
      loadLastRun(selectedCountry, selectedSlot);
    }
  }, [selectedCountry, selectedSlot, loadLastRun]);

  useEffect(() => {
    if (selectedCountry && activeTab === 'history') {
      loadRecentRuns(selectedCountry, selectedDays);
    }
  }, [selectedCountry, selectedDays, activeTab, loadRecentRuns]);

  // GSAP animation when latest run data changes
  useEffect(() => {
    if (lastRun && latestRunRef.current) {
      gsap.fromTo(
        latestRunRef.current.querySelectorAll('.pers-diagnostic-card, .pers-stat-card, .pers-funnel-card, .pers-card'),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [lastRun]);

  // GSAP animation for history tab
  useEffect(() => {
    if (recentRuns && historyRef.current) {
      gsap.fromTo(
        historyRef.current.querySelectorAll('.pers-chart-wrap, .pers-table-wrapper'),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
      );
    }
  }, [recentRuns]);

  // Computed data for components
  const diagnosis = lastRun ? analyzeRunDiagnosis(lastRun) : null;
  const funnelSteps = lastRun ? buildAudienceFunnel(lastRun) : [];
  const statusMeta = lastRun ? getStatusMeta(lastRun.status) : null;

  // Chart data for historical runs
  const trendChartData = (recentRuns?.runs ?? [])
    .slice()
    .reverse()
    .map((r, i) => ({
      index: i,
      slot: r.slot,
      date: r.date,
      run_at: r.run_at,
      label: `${r.date} (S${r.slot})`,
      push_rate_pct: r.rates?.push_rate_pct ?? 0,
      threshold_drop_rate_pct: r.rates?.threshold_drop_rate_pct ?? 0,
      cold_start_rate_pct: r.rates?.cold_start_rate_pct ?? 0,
      users_matched: r.matching?.users_matched ?? 0,
    }));

  const openRunModal = (r: PersoRunSummary) => {
    setModalRun(r);
    setShowModal(true);
  };

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`} ref={pageRef}>
      {/* ── Page Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1>
            <Radio size={24} style={{ display: 'inline', marginRight: '0.6rem', verticalAlign: 'middle' }} />
            Personalization Run Summaries
          </h1>
          <div className="pers-subtitle">
            Understand how notifications match reader interests across each slot. View delivery funnels and diagnose why readers received or missed alerts in plain English.
          </div>
        </div>

        <div className="pers-action-group">
          <button
            className="pers-btn pers-btn-secondary"
            onClick={() => {
              if (activeTab === 'latest') {
                loadLastRun(selectedCountry, selectedSlot);
              } else {
                loadRecentRuns(selectedCountry, selectedDays);
              }
              showToast('Refreshed delivery run data', 'success');
            }}
            disabled={loadingLastRun || loadingRecentRuns}
          >
            {loadingLastRun || loadingRecentRuns ? (
              <Loader2 size={15} className="spin-icon" />
            ) : (
              <RefreshCw size={15} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Control Row (Country & Slot Switchers) ── */}
      <div className="pers-control-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="pers-select-label">
              <Globe size={13} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Region:
            </span>
            <div className="pers-select-wrapper" style={{ minWidth: '180px' }}>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={loadingCountries}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="pers-select-arrow">▼</span>
            </div>
          </div>

          {/* Slot filter selector */}
          {activeTab === 'latest' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pers-select-label">Delivery Slot:</span>
              <div className="pers-pill-group">
                {SLOTS.map((slot) => (
                  <button
                    key={slot.label}
                    className={`pers-pill-btn ${selectedSlot === slot.id ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(slot.id)}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Days filter selector for History */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pers-select-label">Lookback Window:</span>
              <div className="pers-pill-group">
                {DAYS_OPTIONS.map((days) => (
                  <button
                    key={days}
                    className={`pers-pill-btn ${selectedDays === days ? 'active' : ''}`}
                    onClick={() => setSelectedDays(days)}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Last Run Timing Badge */}
        {lastRun && activeTab === 'latest' && (
          <div style={{ fontSize: '0.8rem', color: '#a8956b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={14} />
            <span>Fired: <strong>{formatDate(lastRun.run_at)}</strong></span>
            <span>(Slot {lastRun.slot})</span>
          </div>
        )}
      </div>

      {/* ── Main View Switcher Tabs ── */}
      <div className="pers-tab-nav">
        <button
          className={`pers-tab-btn ${activeTab === 'latest' ? 'active' : ''}`}
          onClick={() => setActiveTab('latest')}
        >
          <Radio size={16} />
          Latest Delivery Run
        </button>
        <button
          className={`pers-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <TrendingUp size={16} />
          Run History & Trends
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  TAB 1: LATEST DELIVERY RUN                                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'latest' && (
        <div ref={latestRunRef}>
          {loadingLastRun ? (
            <div className="pers-loading">
              <div className="pers-spinner" />
              <p>Analyzing latest delivery run for {selectedCountry}...</p>
            </div>
          ) : lastRunNotFound ? (
            <div className="pers-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Info size={40} style={{ color: '#D4AF37', margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ fontSize: '1.25rem', color: '#fafafa', marginBottom: '0.5rem' }}>
                No Notification Runs Recorded for {selectedCountry}
              </h3>
              <p style={{ color: '#8a8a8f', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                Personalization has not fired for this region yet, or notifications are currently disabled.
                Once the scheduled background dispatcher triggers, detailed run summaries will appear here.
              </p>
              <button
                className="pers-btn pers-btn-secondary"
                onClick={() => navigate('/personalization/thresholds')}
              >
                Inspect Country Thresholds
              </button>
            </div>
          ) : !lastRun ? (
            <div className="pers-empty">
              <AlertTriangle size={36} />
              <p>No run summary data available for this selection.</p>
            </div>
          ) : (
            <>
              {/* ── 1. Diagnostic Card (Plain English "Why did only N users get pushed?") ── */}
              {diagnosis && (
                <div className={`pers-diagnostic-card diag-${diagnosis.severity}`}>
                  <div className="diag-top">
                    <div className="diag-icon">
                      {diagnosis.severity === 'success' ? (
                        <CheckCircle size={24} />
                      ) : diagnosis.severity === 'error' ? (
                        <AlertTriangle size={24} />
                      ) : diagnosis.severity === 'warning' ? (
                        <Sparkles size={24} />
                      ) : (
                        <Info size={24} />
                      )}
                    </div>
                    <div className="diag-content">
                      <div className="diag-badge-row">
                        <span className="diag-tag">Dispatch Diagnostic</span>
                        <span className={`pers-badge ${statusMeta?.badgeClass || 'badge-default'}`}>
                          {statusMeta?.label || lastRun.status}
                        </span>
                      </div>
                      <h2 className="diag-title">{diagnosis.title}</h2>
                      <p className="diag-summary">{diagnosis.summary}</p>
                      <div className="diag-detail">{diagnosis.detail}</div>
                    </div>
                  </div>

                  {diagnosis.action && (
                    <div className="diag-actions">
                      <button
                        className="pers-btn pers-btn-primary"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                        onClick={() => navigate(diagnosis.action!.path)}
                      >
                        {diagnosis.action.label}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── 2. Top Metric KPI Cards ── */}
              <div className="pers-stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                {/* Reach Rate */}
                <div className="pers-stat-card">
                  <span className="stat-label">Audience Reached</span>
                  <span className="stat-value" style={{ color: '#86efac' }}>
                    {lastRun.rates?.push_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.matching?.users_matched?.toLocaleString() ?? 0} of {lastRun.cohort?.eligible_for_match?.toLocaleString() ?? 0} ready readers
                  </span>
                </div>

                {/* Relevance Cutoff Drop */}
                <div className="pers-stat-card">
                  <span className="stat-label">Filtered by Relevance</span>
                  <span className="stat-value" style={{ color: '#fde047' }}>
                    {lastRun.rates?.threshold_drop_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.matching?.users_below_threshold?.toLocaleString() ?? 0} readers held back by cutoff
                  </span>
                </div>

                {/* New Readers (Cold Start) */}
                <div className="pers-stat-card">
                  <span className="stat-label">New Readers</span>
                  <span className="stat-value" style={{ color: '#93c5fd' }}>
                    {lastRun.rates?.cold_start_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.cohort?.no_vector?.toLocaleString() ?? 0} readers without history profile
                  </span>
                </div>

                {/* Phone Delivery Success */}
                <div className="pers-stat-card">
                  <span className="stat-label">Device Deliveries</span>
                  <span className="stat-value">
                    {lastRun.dispatch?.sent?.toLocaleString() ?? 0}
                  </span>
                  <span className="stat-sub">
                    {lastRun.dispatch?.failed ? `${lastRun.dispatch.failed} failed deliveries` : '100% delivered to devices'}
                  </span>
                </div>

                {/* Candidate Articles & Speed */}
                <div className="pers-stat-card">
                  <span className="stat-label">Stories & Speed</span>
                  <span className="stat-value" style={{ color: '#D4AF37' }}>
                    {lastRun.candidate_articles ?? 0} Stories
                  </span>
                  <span className="stat-sub">
                    Completed in {formatDuration(lastRun.elapsed_ms)}
                  </span>
                </div>
              </div>

              {/* ── 3. Interactive Visual Audience Funnel Flow ── */}
              <div className="pers-funnel-card">
                <div className="funnel-header">
                  <div>
                    <h3 className="fh-title">
                      <Target size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: '#D4AF37' }} />
                      Audience Journey & Decision Funnel
                    </h3>
                    <div className="fh-sub">
                      Step-by-step trace of how reader audience flowed from registered user count to phone delivery.
                    </div>
                  </div>
                  <button
                    className="pers-btn pers-btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                    onClick={() => openRunModal(lastRun)}
                  >
                    <FileText size={14} /> Full Technical Details
                  </button>
                </div>

                <div className="funnel-steps-container">
                  {funnelSteps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <div className="funnel-step">
                        <div className="fs-row">
                          <div className="fs-left">
                            <div className="fs-num">{step.stepNumber}</div>
                            <div className="fs-title-box">
                              <div className="fs-name">{step.title}</div>
                              <div className="fs-desc">{step.plainEnglish}</div>
                            </div>
                          </div>
                          <div className="fs-right">
                            <span className="fs-count">{step.count.toLocaleString()}</span>
                            <span className="fs-pct">({step.pctOfTotal}% of audience)</span>
                          </div>
                        </div>

                        <div className="fs-progress-track">
                          <div className="fs-progress-fill" style={{ width: `${step.pctOfTotal}%` }} />
                        </div>
                      </div>

                      {/* Drop Indicator between steps */}
                      {idx < funnelSteps.length - 1 && funnelSteps[idx + 1].dropCount > 0 && (
                        <div className="funnel-drop-indicator">
                          <span className="drop-arrow">↳</span>
                          <span className="drop-text">
                            Skipped {funnelSteps[idx + 1].dropCount.toLocaleString()} readers: {funnelSteps[idx + 1].dropReason}
                          </span>
                          {funnelSteps[idx + 1].dropBadge && (
                            <span className="drop-pill">{funnelSteps[idx + 1].dropBadge}</span>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* ── 4. Two-Column Row: Match Strength vs Required Cutoffs & Delivery Breakdown ── */}
              <div className="pers-grid-2">
                {/* Column 1: Match Strength vs Cutoff */}
                <div className="pers-card">
                  <h3 className="pers-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target size={18} style={{ color: '#D4AF37' }} />
                    Reader Match Scores vs Required Cutoffs
                  </h3>
                  <div className="pers-card-subtitle">
                    How strongly the candidate news stories matched reader interests compared against the minimum cutoff floor.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
                    {/* Typical Reader Match Score (p50) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        <span>
                          <strong>Typical Reader Match</strong> (Median / p50):
                        </span>
                        <span style={{ color: '#D4AF37', fontWeight: 700 }}>
                          {(lastRun.matching?.score_p50 ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="fs-progress-track" style={{ height: '8px' }}>
                        <div
                          className="fs-progress-fill"
                          style={{
                            width: `${Math.min((lastRun.matching?.score_p50 ?? 0) * 400, 100)}%`,
                            background: getScoreInterpretation(lastRun.matching?.score_p50 ?? 0).color,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#8a8a8f', marginTop: '0.25rem' }}>
                        Level: {getScoreInterpretation(lastRun.matching?.score_p50 ?? 0).label}
                      </div>
                    </div>

                    {/* Top 10% Strongest Matches (p90) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        <span>
                          <strong>Top 10% Strongest Matches</strong> (p90):
                        </span>
                        <span style={{ color: '#86efac', fontWeight: 700 }}>
                          {(lastRun.matching?.score_p90 ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="fs-progress-track" style={{ height: '8px' }}>
                        <div
                          className="fs-progress-fill"
                          style={{
                            width: `${Math.min((lastRun.matching?.score_p90 ?? 0) * 400, 100)}%`,
                            background: '#86efac',
                          }}
                        />
                      </div>
                    </div>

                    {/* Highest Cohort Score */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        <span>
                          <strong>Highest Cohort Score</strong>:
                        </span>
                        <span style={{ color: '#86efac', fontWeight: 700 }}>
                          {(lastRun.matching?.score_max ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="fs-progress-track" style={{ height: '8px' }}>
                        <div
                          className="fs-progress-fill"
                          style={{
                            width: `${Math.min((lastRun.matching?.score_max ?? 0) * 400, 100)}%`,
                            background: '#86efac',
                          }}
                        />
                      </div>
                    </div>

                    {/* Active Threshold Floors Snapshot */}
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(212,175,55,0.15)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                        Active Cutoff Floors (This Run)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {Object.entries(lastRun.config?.thresholds ?? {}).map(([topic, threshold]) => (
                          <div
                            key={topic}
                            style={{
                              background: 'rgba(212,175,55,0.06)',
                              border: '1px solid rgba(212,175,55,0.25)',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.78rem',
                              display: 'flex',
                              gap: '0.4rem',
                            }}
                          >
                            <span style={{ color: '#a8956b', textTransform: 'capitalize' }}>{topic}:</span>
                            <strong style={{ color: '#D4AF37' }}>{Number(threshold).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Category Delivery Breakdown */}
                <div className="pers-card">
                  <h3 className="pers-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} style={{ color: '#D4AF37' }} />
                    Category Delivery Breakdown
                  </h3>
                  <div className="pers-card-subtitle">
                    Notifications dispatched to mobile devices grouped by news topic.
                  </div>

                  {lastRun.dispatch?.per_topic && Object.keys(lastRun.dispatch.per_topic).length > 0 ? (
                    <div className="pers-topics-grid">
                      {Object.entries(lastRun.dispatch.per_topic).map(([topic, stats]: [string, PersoTopicDispatch]) => (
                        <div className="topic-card" key={topic}>
                          <div className="topic-name">
                            <span>{topic}</span>
                            <span style={{ fontSize: '0.7rem', color: '#a8956b' }}>
                              {stats.batches} {stats.batches === 1 ? 'batch' : 'batches'}
                            </span>
                          </div>
                          <div className="topic-stats">
                            <div className="ts-item">
                              <span className="ts-label">Delivered</span>
                              <span className="ts-val-sent">{stats.sent.toLocaleString()}</span>
                            </div>
                            <div className="ts-item">
                              <span className="ts-label">Failed</span>
                              <span className="ts-val-failed">{stats.failed.toLocaleString()}</span>
                            </div>
                            <div className="ts-item">
                              <span className="ts-label">Success</span>
                              <span className="ts-val">
                                {stats.sent + stats.failed > 0
                                  ? `${((stats.sent / (stats.sent + stats.failed)) * 100).toFixed(0)}%`
                                  : '100%'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8a8f', fontSize: '0.85rem' }}>
                      No per-category breakdown available for this run.
                    </div>
                  )}

                  {/* Multicast Payload & Dedup stats */}
                  <div
                    style={{
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid rgba(212,175,55,0.15)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#8a8a8f' }}>Unique Story Bundles:</span>
                      <strong style={{ display: 'block', color: '#D4AF37' }}>
                        {lastRun.matching?.distinct_payload_groups ?? 0} multicast payloads
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#8a8a8f' }}>7-Day History Dedup:</span>
                      <strong style={{ display: 'block', color: '#86efac' }}>
                        {lastRun.matching?.recent_push_dedup_count ?? 0} duplicate stories filtered
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  TAB 2: RUN HISTORY & TRENDS                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div ref={historyRef}>
          {loadingRecentRuns ? (
            <div className="pers-loading">
              <div className="pers-spinner" />
              <p>Loading {selectedDays}-day history for {selectedCountry}...</p>
            </div>
          ) : !recentRuns || recentRuns.runs.length === 0 ? (
            <div className="pers-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Info size={40} style={{ color: '#D4AF37', margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ fontSize: '1.25rem', color: '#fafafa', marginBottom: '0.5rem' }}>
                No Runs Found in the Last {selectedDays} Days
              </h3>
              <p style={{ color: '#8a8a8f', maxWidth: '480px', margin: '0 auto' }}>
                There are no recorded personalization runs for {selectedCountry} in this time window.
                Try widening your lookback to 30 or 90 days.
              </p>
            </div>
          ) : (
            <>
              {/* ── 1. Recharts Trend Area Chart ── */}
              <div className="pers-chart-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 className="chart-title" style={{ margin: 0 }}>
                      Delivery Reach vs Relevance Cutoff Drift
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#8a8a8f', marginTop: '0.2rem' }}>
                      Watch for drift: A rising amber line indicates that relevance cutoffs are gating too aggressively.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#86efac' }} />
                      <span style={{ color: '#86efac' }}>Audience Reached %</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fde047' }} />
                      <span style={{ color: '#fde047' }}>Relevance Filtered %</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#93c5fd' }} />
                      <span style={{ color: '#93c5fd' }}>New Readers %</span>
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#86efac" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#86efac" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fde047" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#fde047" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(212, 175, 55, 0.1)' : '#eaeaea'} />
                      <XAxis
                        dataKey="label"
                        stroke={isDark ? '#8a8a8f' : '#666'}
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={isDark ? '#8a8a8f' : '#666'}
                        fontSize={11}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTrendTooltip isDark={isDark} />} />
                      <Area
                        type="monotone"
                        dataKey="push_rate_pct"
                        name="Audience Reach %"
                        stroke="#86efac"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#reachGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="threshold_drop_rate_pct"
                        name="Relevance Filtered %"
                        stroke="#fde047"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#dropGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── 2. Historical Runs Table ── */}
              <div className="pers-table-wrapper">
                <div className="table-toolbar">
                  <div className="tt-title">
                    Run Logs — {recentRuns.count} {recentRuns.count === 1 ? 'Run' : 'Runs'} in {recentRuns.days} Days
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#8a8a8f' }}>
                    Click any run row to view complete breakdown & JSON
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="pers-data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Slot</th>
                        <th>Status</th>
                        <th>Stories</th>
                        <th>Eligible</th>
                        <th>Matched</th>
                        <th>Reach Rate</th>
                        <th>Cutoff Drop</th>
                        <th>Compute Time</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.runs.map((r, idx) => {
                        const sMeta = getStatusMeta(r.status);
                        return (
                          <tr key={`${r.date}-${r.slot}-${idx}`} onClick={() => openRunModal(r)}>
                            <td style={{ fontWeight: 600 }}>{formatDate(r.run_at || r.date)}</td>
                            <td>
                              <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                Slot {r.slot}
                              </span>
                            </td>
                            <td>
                              <span className={`pers-badge ${sMeta.badgeClass}`}>
                                {sMeta.label}
                              </span>
                            </td>
                            <td>{r.candidate_articles ?? 0}</td>
                            <td>{r.cohort?.eligible_for_match?.toLocaleString() ?? 0}</td>
                            <td style={{ color: '#86efac', fontWeight: 700 }}>
                              {r.matching?.users_matched?.toLocaleString() ?? 0}
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {r.rates?.push_rate_pct?.toFixed(1) ?? '0'}%
                            </td>
                            <td style={{ color: '#fde047' }}>
                              {r.rates?.threshold_drop_rate_pct?.toFixed(1) ?? '0'}%
                            </td>
                            <td style={{ color: '#8a8a8f' }}>{formatDuration(r.elapsed_ms)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="pers-btn pers-btn-secondary"
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRunModal(r);
                                }}
                              >
                                Inspect <ChevronRight size={12} />
                              </button>
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
        </div>
      )}

      {/* ── Run Detail Drill-down Modal ── */}
      <RunDetailModal
        run={modalRun}
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setModalRun(null);
        }}
        isDark={isDark}
      />
    </div>
  );
}
