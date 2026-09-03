import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  Globe,
  TrendingUp,
  Target,
  Users,
  Clock,
  Layers,
  ArrowRight,
  ChevronRight,
  X,
  FileText,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import {
  PersonalizationRunsService,
  ThresholdsService,
  tokenReadyPromise,
  type PersoRunSummary,
  type PersoRunSummaryList,
  type PersoTopicDispatch,
} from 'api/backendApi';
import {
  getStatusMeta,
  analyzeRunDiagnosis,
  buildAudienceFunnel,
} from 'utils/personalizationPlainEnglish';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import PersonalizationNavTabs from 'components/PersonalizationNavTabs';
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

// ── Skeleton Loader Components ───────────────────────────────────────────────
const RunsPageSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    {/* Diagnostic Skeleton */}
    <div className="pers-skeleton" style={{ height: '110px', borderRadius: '10px' }} />

    {/* KPI Cards Skeleton */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
      }}
    >
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="pers-skeleton"
          style={{ height: '100px', borderRadius: '8px' }}
        />
      ))}
    </div>

    {/* Funnel Skeleton */}
    <div className="pers-skeleton" style={{ height: '340px', borderRadius: '8px' }} />

    {/* Bottom Cards Skeleton */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}
    >
      <div className="pers-skeleton" style={{ height: '240px', borderRadius: '8px' }} />
      <div className="pers-skeleton" style={{ height: '240px', borderRadius: '8px' }} />
    </div>
  </div>
);

const HistoryTableSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem' }}>
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="pers-skeleton"
        style={{ height: '44px', borderRadius: '4px' }}
      />
    ))}
  </div>
);

// ── Run Detail Modal (With Custom Scrollbar) ─────────────────────────────────
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
      gsap.fromTo(modalOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18 });
      gsap.fromTo(
        modalBoxRef.current,
        { opacity: 0, scale: 0.95, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power2.out' }
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
        style={{
          maxWidth: '680px',
          width: '92%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, textAlign: 'left', fontSize: '1.15rem' }}>
              Delivery Run Report — {run.country}
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#a8956b', marginTop: '0.2rem' }}>
              Slot {run.slot} • {formatDate(run.run_at || run.date)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
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
            Report Overview
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
            Raw Technical JSON
          </button>
        </div>

        {/* Custom-scrolled body */}
        <div className="pers-modal-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
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
                    Run Outcome
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: statusMeta.color, marginTop: '0.15rem' }}>
                    {statusMeta.label}
                  </div>
                </div>
                <span className={`pers-badge ${statusMeta.badgeClass}`}>{run.status}</span>
              </div>

              {/* Funnel Breakdown Table */}
              <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Audience Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Total Registered Readers:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.cohort?.enumerated?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Available for Matching:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{run.cohort?.eligible_for_match?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Matched Readers:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#86efac' }}>{run.matching?.users_matched?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Held Back (Below Cutoff):</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#fde047' }}>{run.matching?.users_below_threshold?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Skipped (New / No History):</span>
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
                  Device Delivery
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Successfully Sent:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#86efac' }}>{run.dispatch?.sent?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Failed Device Deliveries:</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: run.dispatch?.failed ? '#f87171' : 'inherit' }}>
                      {run.dispatch?.failed?.toLocaleString() ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Time Taken:</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{formatDuration(run.elapsed_ms)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8a8a8f' }}>Articles Evaluated:</span>
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
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy JSON</>}
                </button>
              </div>
              <pre
                className="pers-modal-scroll"
                style={{
                  background: isDark ? '#080808' : '#f0f0f0',
                  color: isDark ? '#d4af37' : '#333',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  overflowX: 'auto',
                  maxHeight: '48vh',
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

  // Authorization & Initialization
  const [isAuthorizing, setIsAuthorizing] = useState(true);

  // Filters & State
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'latest' | 'history'>('latest');
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Data states
  const [lastRun, setLastRun] = useState<PersoRunSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<PersoRunSummaryList | null>(null);
  const [loadingLastRun, setLoadingLastRun] = useState(false);
  const [loadingRecentRuns, setLoadingRecentRuns] = useState(false);
  const [lastRunNotFound, setLastRunNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail Modal State
  const [modalRun, setModalRun] = useState<PersoRunSummary | null>(null);
  const [showModal, setShowModal] = useState(false);

  // ── 1. Safe Initialization: Await Auth Token Before Firing Calls ──
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsAuthorizing(true);
      setErrorMessage(null);
      try {
        // Wait for token to be confirmed ready so requests don't 401 or cause lagging
        await tokenReadyPromise;
        const res = await ThresholdsService.fetchAll();
        if (!isMounted) return;

        const list = res?.configs?.map((c) => c.country) || [];
        setCountries(list);
        if (list.length > 0) {
          setSelectedCountry(list[0]);
        }
      } catch (e: any) {
        console.warn('Initial setup warning:', e);
        if (!isMounted) return;
        const fallback = ['Germany', 'Pakistan', 'United States', 'United Kingdom'];
        setCountries(fallback);
        setSelectedCountry(fallback[0]);
      } finally {
        if (isMounted) setIsAuthorizing(false);
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── 2. Fetch Last Run (Only when authorized and country is set) ──
  const loadLastRun = useCallback(async (country: string, slot?: number) => {
    if (!country) return;
    setLoadingLastRun(true);
    setLastRunNotFound(false);
    setErrorMessage(null);
    try {
      const data = await PersonalizationRunsService.fetchLastRun(country, slot);
      setLastRun(data);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setLastRunNotFound(true);
        setLastRun(null);
      } else if (e?.response?.status === 403) {
        setErrorMessage('Administrator privileges are required to view news delivery summaries.');
        setLastRun(null);
      } else if (e?.response?.status === 422) {
        setErrorMessage(`Region "${country}" is not recognized in the system.`);
        setLastRun(null);
      } else {
        setErrorMessage('Unable to connect to the delivery server. Please click Refresh to try again.');
        setLastRun(null);
      }
    } finally {
      setLoadingLastRun(false);
    }
  }, []);

  // ── 3. Fetch Recent Runs ──
  const loadRecentRuns = useCallback(async (country: string, days: number) => {
    if (!country) return;
    setLoadingRecentRuns(true);
    setErrorMessage(null);
    try {
      const data = await PersonalizationRunsService.fetchRecentRuns(country, days);
      setRecentRuns(data);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setErrorMessage('Administrator privileges are required to view historical summaries.');
      } else {
        setErrorMessage('Failed to load past delivery runs. Please check your connection.');
      }
      setRecentRuns(null);
    } finally {
      setLoadingRecentRuns(false);
    }
  }, []);

  // Trigger loads after authorization is ready
  useEffect(() => {
    if (!isAuthorizing && selectedCountry) {
      loadLastRun(selectedCountry, selectedSlot);
    }
  }, [isAuthorizing, selectedCountry, selectedSlot, loadLastRun]);

  useEffect(() => {
    if (!isAuthorizing && selectedCountry && activeTab === 'history') {
      loadRecentRuns(selectedCountry, selectedDays);
    }
  }, [isAuthorizing, selectedCountry, selectedDays, activeTab, loadRecentRuns]);

  // Computed data for components
  const diagnosis = lastRun ? analyzeRunDiagnosis(lastRun) : null;
  const funnelSteps = lastRun ? buildAudienceFunnel(lastRun) : [];
  const statusMeta = lastRun ? getStatusMeta(lastRun.status) : null;

  // Filtered runs for history table
  const filteredRuns = (recentRuns?.runs ?? []).filter((r) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    const dateStr = (r.run_at || r.date || '').toLowerCase();
    const slotStr = `slot ${r.slot}`.toLowerCase();
    const statusStr = (r.status || '').toLowerCase();
    return dateStr.includes(q) || slotStr.includes(q) || statusStr.includes(q);
  });

  // Aggregated history stats for chosen window
  const totalRunsCount = recentRuns?.runs?.length ?? 0;
  const avgPushRate =
    totalRunsCount > 0
      ? (
          recentRuns!.runs.reduce((acc, r) => acc + (r.rates?.push_rate_pct ?? 0), 0) /
          totalRunsCount
        ).toFixed(1)
      : '0.0';
  const avgDropRate =
    totalRunsCount > 0
      ? (
          recentRuns!.runs.reduce((acc, r) => acc + (r.rates?.threshold_drop_rate_pct ?? 0), 0) /
          totalRunsCount
        ).toFixed(1)
      : '0.0';
  const totalDeliveredInWindow = (recentRuns?.runs ?? []).reduce(
    (acc, r) => acc + (r.dispatch?.sent ?? r.matching?.users_matched ?? 0),
    0
  );

  const openRunModal = (r: PersoRunSummary) => {
    setModalRun(r);
    setShowModal(true);
  };

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`}>
      {/* ── Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1>News Delivery Summaries</h1>
          <div className="pers-subtitle">
            Review how notifications match reader interests across each slot. View the audience funnel and understand why readers received or missed alerts in simple words.
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
              showToast('Refreshed delivery data', 'success');
            }}
            disabled={isAuthorizing || loadingLastRun || loadingRecentRuns}
          >
            <RefreshCw
              size={14}
              className={loadingLastRun || loadingRecentRuns ? 'spin-icon' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Cross-Navigation Tabs across all Personalization Views ── */}
      <PersonalizationNavTabs />

      {/* ── Control Row (Country & Slot Switchers) ── */}
      <div className="pers-control-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="pers-select-label">
              <Globe size={13} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Country / Region:
            </span>
            <div className="pers-select-wrapper" style={{ minWidth: '180px' }}>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={isAuthorizing}
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
                    disabled={isAuthorizing || loadingLastRun}
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
              <span className="pers-select-label">Time Window:</span>
              <div className="pers-pill-group">
                {DAYS_OPTIONS.map((days) => (
                  <button
                    key={days}
                    className={`pers-pill-btn ${selectedDays === days ? 'active' : ''}`}
                    onClick={() => setSelectedDays(days)}
                    disabled={isAuthorizing || loadingRecentRuns}
                  >
                    Last {days} Days
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Last Run Timing Badge */}
        {lastRun && activeTab === 'latest' && !isAuthorizing && !loadingLastRun && (
          <div style={{ fontSize: '0.8rem', color: '#a8956b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={13} />
            <span>Fired: <strong>{formatDate(lastRun.run_at)}</strong> (Slot {lastRun.slot})</span>
          </div>
        )}
      </div>

      {/* ── Main View Switcher Tabs ── */}
      <div className="pers-tab-nav">
        <button
          className={`pers-tab-btn ${activeTab === 'latest' ? 'active' : ''}`}
          onClick={() => setActiveTab('latest')}
        >
          Latest Delivery Run
        </button>
        <button
          className={`pers-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Delivery History & Past Logs
        </button>
      </div>

      {/* ── Error Banner if any ── */}
      {errorMessage && (
        <div className="pers-alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  TAB 1: LATEST DELIVERY RUN                                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'latest' && (
        <div>
          {isAuthorizing || loadingLastRun ? (
            <RunsPageSkeleton />
          ) : lastRunNotFound ? (
            <div className="pers-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Info size={36} style={{ color: '#D4AF37', margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ fontSize: '1.2rem', color: '#fafafa', marginBottom: '0.5rem' }}>
                No Notification Runs Recorded for {selectedCountry}
              </h3>
              <p style={{ color: '#8a8a8f', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                The automated news delivery system has not run for this country yet, or notifications are currently turned off for this region.
                Once the scheduled background delivery fires, detailed reports will appear here automatically.
              </p>
              <button
                className="pers-btn pers-btn-secondary"
                onClick={() => navigate('/personalization/thresholds')}
              >
                View Country Relevance Thresholds
              </button>
            </div>
          ) : !lastRun ? (
            <div className="pers-empty">
              <p>No delivery data available for this selection.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* ── 1. Diagnostic Card (Plain English Answer) ── */}
              {diagnosis && (
                <div className={`pers-diagnostic-card diag-${diagnosis.severity}`}>
                  <div className="diag-top">
                    <div className="diag-icon">
                      {diagnosis.severity === 'success' ? (
                        <CheckCircle size={22} />
                      ) : diagnosis.severity === 'error' ? (
                        <AlertTriangle size={22} />
                      ) : (
                        <Info size={22} />
                      )}
                    </div>
                    <div className="diag-content">
                      <div className="diag-badge-row">
                        <span className="diag-tag">Delivery Diagnosis</span>
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
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── 2. Top Metric KPI Cards ── */}
              <div className="pers-stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {/* Reach Rate */}
                <div className="pers-stat-card">
                  <span className="stat-label">Audience Reached</span>
                  <span className="stat-value" style={{ color: '#86efac' }}>
                    {lastRun.rates?.push_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.matching?.users_matched?.toLocaleString() ?? 0} of {lastRun.cohort?.eligible_for_match?.toLocaleString() ?? 0} available readers
                  </span>
                </div>

                {/* Relevance Cutoff Drop */}
                <div className="pers-stat-card">
                  <span className="stat-label">Held Back (Low Relevance)</span>
                  <span className="stat-value" style={{ color: '#fde047' }}>
                    {lastRun.rates?.threshold_drop_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.matching?.users_below_threshold?.toLocaleString() ?? 0} readers had stories below cutoff
                  </span>
                </div>

                {/* New Readers (Cold Start) */}
                <div className="pers-stat-card">
                  <span className="stat-label">New Readers</span>
                  <span className="stat-value" style={{ color: '#93c5fd' }}>
                    {lastRun.rates?.cold_start_rate_pct?.toFixed(1) ?? '0'}%
                  </span>
                  <span className="stat-sub">
                    {lastRun.cohort?.no_vector?.toLocaleString() ?? 0} readers have no reading history yet
                  </span>
                </div>

                {/* Phone Delivery Success */}
                <div className="pers-stat-card">
                  <span className="stat-label">Phone Deliveries</span>
                  <span className="stat-value">
                    {lastRun.dispatch?.sent?.toLocaleString() ?? 0}
                  </span>
                  <span className="stat-sub">
                    {lastRun.dispatch?.failed ? `${lastRun.dispatch.failed} failed phone deliveries` : '100% delivered to devices'}
                  </span>
                </div>

                {/* Articles Evaluated & Duration */}
                <div className="pers-stat-card">
                  <span className="stat-label">Articles & Speed</span>
                  <span className="stat-value" style={{ color: '#D4AF37' }}>
                    {lastRun.candidate_articles ?? 0} Articles
                  </span>
                  <span className="stat-sub">
                    Processed in {formatDuration(lastRun.elapsed_ms)}
                  </span>
                </div>
              </div>

              {/* ── 3. Audience Journey (Funnel) ── */}
              <div className="pers-funnel-card">
                <div className="funnel-header">
                  <div>
                    <h3 className="fh-title">
                      <Target size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: '#D4AF37' }} />
                      Audience Journey & Step-by-Step Drop-off
                    </h3>
                    <div className="fh-sub">
                      Shows how many users started in this country and how many reached each milestone to receive a notification.
                    </div>
                  </div>
                  <button
                    className="pers-btn pers-btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                    onClick={() => openRunModal(lastRun)}
                  >
                    <FileText size={13} /> Full Report & JSON
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

              {/* ── 4. Two-Column Row: Clean Score Benchmarks & Category Breakdown ── */}
              <div className="pers-grid-2">
                {/* Column 1: Match Score Benchmarks (Real Data, No Fake Multiplier Graph) */}
                <div className="pers-card">
                  <h3 className="pers-card-title">
                    Reader Interest Score Benchmarks
                  </h3>
                  <div className="pers-card-subtitle">
                    How strongly the candidate news stories scored against reader preferences in this run.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                    {/* p50 Median */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block' }}>Typical Reader Match (Median / p50)</strong>
                        <span style={{ fontSize: '0.74rem', color: '#8a8a8f' }}>Score of the middle reader in the group</span>
                      </div>
                      <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.05rem', alignSelf: 'center' }}>
                        {(lastRun.matching?.score_p50 ?? 0).toFixed(4)}
                      </span>
                    </div>

                    {/* p90 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block' }}>Top 10% Strongest Match (p90)</strong>
                        <span style={{ fontSize: '0.74rem', color: '#8a8a8f' }}>90% of reader scores were below this</span>
                      </div>
                      <span style={{ color: '#86efac', fontWeight: 700, fontSize: '1.05rem', alignSelf: 'center' }}>
                        {(lastRun.matching?.score_p90 ?? 0).toFixed(4)}
                      </span>
                    </div>

                    {/* Max */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block' }}>Highest Score in Run (Max)</strong>
                        <span style={{ fontSize: '0.74rem', color: '#8a8a8f' }}>Single best article-to-reader match</span>
                      </div>
                      <span style={{ color: '#86efac', fontWeight: 700, fontSize: '1.05rem', alignSelf: 'center' }}>
                        {(lastRun.matching?.score_max ?? 0).toFixed(4)}
                      </span>
                    </div>

                    {/* Mean */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block' }}>Average Match Score (Mean)</strong>
                        <span style={{ fontSize: '0.74rem', color: '#8a8a8f' }}>Overall average across all evaluated readers</span>
                      </div>
                      <span style={{ color: '#a8956b', fontWeight: 700, fontSize: '1.05rem', alignSelf: 'center' }}>
                        {(lastRun.matching?.score_mean ?? 0).toFixed(4)}
                      </span>
                    </div>

                    {/* Active Threshold Floors */}
                    <div style={{ marginTop: '0.4rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(212,175,55,0.15)' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        Required Cutoff Floors for this Run
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {Object.entries(lastRun.config?.thresholds ?? {}).map(([topic, threshold]) => (
                          <div
                            key={topic}
                            style={{
                              background: 'rgba(212,175,55,0.06)',
                              border: '1px solid rgba(212,175,55,0.22)',
                              borderRadius: '5px',
                              padding: '0.3rem 0.6rem',
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
                  <h3 className="pers-card-title">
                    Delivery by News Category
                  </h3>
                  <div className="pers-card-subtitle">
                    Notifications sent to devices grouped by category.
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
                              <span className="ts-label">Success Rate</span>
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
                      No per-category breakdown recorded for this run.
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
                      <span style={{ color: '#8a8a8f' }}>Unique Notification Bundles:</span>
                      <strong style={{ display: 'block', color: '#D4AF37', marginTop: '0.15rem' }}>
                        {lastRun.matching?.distinct_payload_groups ?? 0} article bundles
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#8a8a8f' }}>Filtered Past 7-Day Stories:</span>
                      <strong style={{ display: 'block', color: '#86efac', marginTop: '0.15rem' }}>
                        {lastRun.matching?.recent_push_dedup_count ?? 0} duplicates skipped
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  TAB 2: RUN HISTORY & PAST LOGS                              */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div>
          {isAuthorizing || loadingRecentRuns ? (
            <div className="pers-card">
              <HistoryTableSkeleton />
            </div>
          ) : !recentRuns || recentRuns.runs.length === 0 ? (
            <div className="pers-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Info size={36} style={{ color: '#D4AF37', margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ fontSize: '1.2rem', color: '#fafafa', marginBottom: '0.5rem' }}>
                No Runs Found in the Last {selectedDays} Days
              </h3>
              <p style={{ color: '#8a8a8f', maxWidth: '480px', margin: '0 auto' }}>
                There are no recorded notification delivery runs for {selectedCountry} in this time period.
                Try widening your time window to 30 or 90 days.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* ── Summary Cards for the Historical Window ── */}
              <div className="pers-stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="pers-stat-card">
                  <span className="stat-label">Runs Recorded</span>
                  <span className="stat-value">{totalRunsCount}</span>
                  <span className="stat-sub">in the last {selectedDays} days</span>
                </div>
                <div className="pers-stat-card">
                  <span className="stat-label">Average Reach</span>
                  <span className="stat-value" style={{ color: '#86efac' }}>{avgPushRate}%</span>
                  <span className="stat-sub">of available audience</span>
                </div>
                <div className="pers-stat-card">
                  <span className="stat-label">Average Cutoff Filtered</span>
                  <span className="stat-value" style={{ color: '#fde047' }}>{avgDropRate}%</span>
                  <span className="stat-sub">held back by cutoff</span>
                </div>
                <div className="pers-stat-card">
                  <span className="stat-label">Total Delivered</span>
                  <span className="stat-value" style={{ color: '#D4AF37' }}>{totalDeliveredInWindow.toLocaleString()}</span>
                  <span className="stat-sub">alerts sent across all slots</span>
                </div>
              </div>

              {/* ── Historical Runs Table ── */}
              <div className="pers-table-wrapper">
                <div className="table-toolbar">
                  <div>
                    <div className="tt-title">
                      Delivery Run Logs ({filteredRuns.length} of {recentRuns.count} runs)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#8a8a8f', marginTop: '0.15rem' }}>
                      Click any row to inspect the full report and view raw data.
                    </div>
                  </div>

                  {/* Search box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: '#8a8a8f' }} />
                      <input
                        type="text"
                        placeholder="Filter by date or slot..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        style={{
                          background: isDark ? '#060606' : '#ffffff',
                          border: '1px solid rgba(212,175,55,0.25)',
                          borderRadius: '6px',
                          padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                          color: isDark ? '#fafafa' : '#111111',
                          fontSize: '0.8rem',
                          outline: 'none',
                          minWidth: '220px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="pers-data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Slot</th>
                        <th>Outcome</th>
                        <th>Articles</th>
                        <th>Eligible Audience</th>
                        <th>Matched</th>
                        <th>Reach Rate</th>
                        <th>Held Back Rate</th>
                        <th>Speed</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRuns.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#8a8a8f' }}>
                            No runs match your search query.
                          </td>
                        </tr>
                      ) : (
                        filteredRuns.map((r, idx) => {
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
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
