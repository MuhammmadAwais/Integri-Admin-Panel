import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import {
  Activity, Zap, Cpu, TrendingUp, Sparkles, RefreshCw,
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Copy, CheckCircle, Terminal, Layers, Box,
  ChevronRight, Calendar, Info, LayoutGrid, Table as TableIcon, X
} from 'lucide-react';
import {
  ModelsService,
  type ModelsStatsResponse,
  type ModelStatsItem,
  type BackendModelItem
} from 'api/backendApi';
import { showToast } from 'components/EliteUI/EliteToastContainer';

// ─── Provider Derivation Helper ──────────────────────────────────────────────
const MODEL_PROVIDER_MAP: Record<string, string> = {
  integri: 'Integri Core',
  'gpt-5.2': 'OpenAI', 'gpt-5.4': 'OpenAI', 'gpt-5.4-mini': 'OpenAI',
  'gpt-5.4-nano': 'OpenAI', 'gpt-5.1': 'OpenAI', 'gpt-5-nano': 'OpenAI',
  'gpt-4o-mini': 'OpenAI', 'gpt-4o-mini-search-preview': 'OpenAI',
  'gpt-4o-mini-deep-research': 'OpenAI', 'gpt-4.1-nano': 'OpenAI',
  'gemini-2.5-flash': 'Google', 'gemini-2.5-flash-lite': 'Google',
  'gemini-3-flash-preview': 'Google', 'gemini-3.1-pro-preview': 'Google',
  'gemini-3.1-flash-lite': 'Google',
  'grok-3-mini': 'xAI', 'grok-4-1-fast-reasoning': 'xAI',
  'grok-4-1-fast-non-reasoning': 'xAI', 'grok-4-fast-reasoning': 'xAI',
  'grok-4-fast-non-reasoning': 'xAI', 'grok-4.7': 'xAI',
  'claude-haiku-3': 'Anthropic', 'claude-haiku-4.5': 'Anthropic',
  'claude-opus-5-5': 'Anthropic', 'claude-sonnet-4-5': 'Anthropic',
  'claude-opus-4-8': 'Anthropic',
  'deepseek-reasoner': 'DeepSeek', 'deepseek-chat': 'DeepSeek',
  'perplexity-sonar': 'Perplexity', 'sonar-reasoning': 'Perplexity',
  'mistral-medium-2505': 'Mistral',
  'glm-4.6': 'Zhipu (GLM)', 'glm-4.7': 'Zhipu (GLM)',
  'kimi-k2.6': 'Moonshot (Kimi)', 'kimi-k3': 'Moonshot (Kimi)',
};

const getProviderName = (modelId: string): string => {
  if (MODEL_PROVIDER_MAP[modelId]) return MODEL_PROVIDER_MAP[modelId];
  const lower = modelId.toLowerCase();
  if (lower === 'integri') return 'Integri Core';
  if (lower.startsWith('gpt') || lower.startsWith('o3') || lower.startsWith('whisper')) return 'OpenAI';
  if (lower.includes('gemini')) return 'Google';
  if (lower.includes('grok')) return 'xAI';
  if (lower.includes('claude')) return 'Anthropic';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('sonar') || lower.includes('perplexity')) return 'Perplexity';
  if (lower.includes('mistral')) return 'Mistral';
  if (lower.includes('glm')) return 'Zhipu (GLM)';
  if (lower.includes('kimi') || lower.includes('moonshot')) return 'Moonshot (Kimi)';
  return 'Other';
};

const PROVIDER_COLORS: Record<string, string> = {
  'OpenAI': '#10a37f',
  'Anthropic': '#d97706',
  'Google': '#3b82f6',
  'xAI': '#ef4444',
  'DeepSeek': '#06b6d4',
  'Moonshot (Kimi)': '#8b5cf6',
  'Zhipu (GLM)': '#ec4899',
  'Perplexity': '#14b8a6',
  'Mistral': '#f97316',
  'Integri Core': '#D4AF37',
  'Other': '#71717a'
};

// ─── Format Token Volume ─────────────────────────────────────────────────────
const formatTokens = (val: number): string => {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return val.toLocaleString();
};

interface ModelUsageTabProps {
  isDark: boolean;
  onInspectModel: (model: BackendModelItem) => void;
}

type SortField = 'calls' | 'tokens' | 'alltime_calls' | 'alltime_tokens' | 'id';
type SortDirection = 'asc' | 'desc';
type FilterTab = 'all' | 'active' | 'picker' | 'pinned' | 'zero';

export default function ModelUsageTab({ isDark, onInspectModel }: ModelUsageTabProps) {
  // ── Query Parameters State ──
  // Default to today's UTC ISO date (e.g. '2026-10-24' or current)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedDays, setSelectedDays] = useState<number>(1);

  // ── Filters & Display State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('calls');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ── Styling Tokens ──
  const gold = '#D4AF37';
  const goldDim = '#b48a04';
  const textPrimary = isDark ? '#f4f4f5' : '#111827';
  const textMuted = isDark ? '#71717a' : '#9ca3af';
  const surfaceBg = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';

  // ── Fetch Telemetry Stats ──
  const {
    data: statsData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery<ModelsStatsResponse>({
    queryKey: ['modelStats', selectedDate, selectedDays],
    queryFn: () => ModelsService.fetchModelStats({ date: selectedDate, days: selectedDays }),
    staleTime: 60_000,
  });

  const totals = statsData?.totals ?? { calls: 0, tokens: 0, alltime_calls: 0, alltime_tokens: 0 };
  const rawModels = statsData?.models ?? [];
  const windowInfo = statsData?.window;

  // ── Top Model Calculations ──
  const topModelByCalls = useMemo(() => {
    if (!rawModels.length) return null;
    return [...rawModels].sort((a, b) => b.calls - a.calls)[0];
  }, [rawModels]);

  const activeModelsCount = useMemo(() => {
    return rawModels.filter(m => m.calls > 0).length;
  }, [rawModels]);

  // ── Provider Aggregation ──
  const providerStats = useMemo(() => {
    const map: Record<string, { calls: number; tokens: number; count: number }> = {};
    rawModels.forEach(m => {
      const p = getProviderName(m.id);
      if (!map[p]) map[p] = { calls: 0, tokens: 0, count: 0 };
      map[p].calls += m.calls;
      map[p].tokens += m.tokens;
      map[p].count += 1;
    });

    const totalWindowCalls = totals.calls || 1;
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        calls: data.calls,
        tokens: data.tokens,
        count: data.count,
        percent: ((data.calls / totalWindowCalls) * 100),
        color: PROVIDER_COLORS[name] || '#71717a'
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [rawModels, totals.calls]);

  // ── Filtered & Sorted Models ──
  const filteredModels = useMemo(() => {
    return rawModels
      .filter(item => {
        // Tab filter
        if (filterTab === 'active' && item.calls === 0) return false;
        if (filterTab === 'zero' && item.calls > 0) return false;
        if (filterTab === 'picker' && !item.in_user_picker) return false;
        if (filterTab === 'pinned' && (!item.used_by || item.used_by.length === 0)) return false;

        // Provider filter
        if (providerFilter !== 'all') {
          const p = getProviderName(item.id);
          if (p !== providerFilter) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const idMatch = item.id.toLowerCase().includes(q);
          const provMatch = getProviderName(item.id).toLowerCase().includes(q);
          const featureMatch = item.used_by?.some(u =>
            u.feature.toLowerCase().includes(q) ||
            u.source.toLowerCase().includes(q) ||
            (u.note && u.note.toLowerCase().includes(q))
          );
          if (!idMatch && !provMatch && !featureMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (typeof valA === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
      });
  }, [rawModels, filterTab, providerFilter, searchQuery, sortField, sortDirection]);

  // ── Sort Toggle ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const copyText = (txt: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(txt);
    showToast(`Copied ${label} to clipboard`, 'success');
  };

  // ── CSV Export ──
  const exportToCSV = () => {
    if (!filteredModels.length) {
      showToast('No model data available to export', 'error');
      return;
    }
    const headers = [
      'Model ID', 'Provider', 'In User Picker', 'Window Calls', 'Window Tokens',
      'Avg Tokens Per Call', 'All-Time Calls', 'All-Time Tokens', 'Pinned Features'
    ];
    const rows = filteredModels.map(m => [
      `"${m.id}"`,
      `"${getProviderName(m.id)}"`,
      m.in_user_picker ? 'Yes' : 'No',
      m.calls,
      m.tokens,
      m.calls > 0 ? (m.tokens / m.calls).toFixed(1) : 0,
      m.alltime_calls,
      m.alltime_tokens,
      `"${(m.used_by || []).map(u => u.feature).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `model_stats_${selectedDate}_${selectedDays}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported stats CSV successfully', 'success');
  };

  return (
    <div>
      {/* ── Header Card & Date Range Controls ── */}
      <Row className="mb-4">
        <Col md={12}>
          <div className="models-header-card p-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div style={{
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center'
              }}>
                <Activity size={26} color={gold} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ color: isDark ? gold : goldDim, margin: 0, fontWeight: 800, letterSpacing: '-0.3px' }}>
                    Model Usage & Consumption Telemetry
                  </h4>
                  <span style={{
                    background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px',
                    padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                  }}>
                    GET /api/v1/models/stats
                  </span>
                </div>
                <p style={{ color: isDark ? '#a8956b' : '#6b7280', margin: '4px 0 0', fontSize: '0.85rem', fontWeight: 500 }}>
                  Real-time telemetry of API calls, token burn rates, and subsystem loads across all backend & chat models.
                </p>
              </div>
            </div>

            {/* Time Window Selectors */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Date Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color={gold} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{
                    background: isDark ? '#18181b' : '#ffffff',
                    color: textPrimary,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}`,
                    borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem',
                    fontWeight: 600, outline: 'none', cursor: 'pointer'
                  }}
                />
              </div>

              {/* Day range pills */}
              <div style={{
                display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                borderRadius: '8px', padding: '3px', border: `1px solid ${surfaceBorder}`
              }}>
                {[1, 3, 7, 14, 30].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDays(d)}
                    style={{
                      background: selectedDays === d ? gold : 'transparent',
                      color: selectedDays === d ? '#000' : textMuted,
                      border: 'none', borderRadius: '6px', padding: '4px 10px',
                      fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                      transition: 'all 0.16s ease'
                    }}
                  >
                    {d === 1 ? '1D' : `${d}D`}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                style={{
                  background: 'rgba(212,175,55,0.1)', border: `1px solid ${gold}`,
                  color: gold, borderRadius: '8px', padding: '7px 14px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: isFetching ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!isFetching) { e.currentTarget.style.background = gold; e.currentTarget.style.color = '#000'; } }}
                onMouseLeave={e => { if (!isFetching) { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.color = gold; } }}
              >
                <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
                {isFetching ? 'Updating...' : 'Sync'}
              </button>
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Active Window Badge / Telemetry Banner ── */}
      {windowInfo && (
        <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2" style={{
          background: isDark ? 'rgba(212,175,55,0.04)' : 'rgba(212,175,55,0.06)',
          border: `1px solid ${isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.25)'}`,
          borderRadius: '8px', fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#e4e4e7' : '#374151' }}>
            <Info size={14} color={gold} />
            <span>
              Telemetry Window: <strong>{windowInfo.from}</strong> → <strong>{windowInfo.to}</strong> ({windowInfo.days} day{windowInfo.days > 1 ? 's' : ''})
            </span>
            <span style={{ color: textMuted }}>•</span>
            <span style={{ color: textMuted }}>Scope: <code>{windowInfo.scope}</code></span>
          </div>

          <div style={{ color: textMuted }}>
            {rawModels.length} models tracked • {activeModelsCount} active
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <Row className="g-3 mb-4">
        {/* Total Window Calls */}
        <Col xl={3} lg={6} sm={6} xs={12}>
          <div className="model-stat-card d-flex align-items-center justify-content-between">
            <div>
              <div style={{ fontSize: '0.72rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Window API Invocations
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: textPrimary, lineHeight: 1.2, marginTop: '4px' }}>
                {isLoading ? '—' : totals.calls.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: gold, marginTop: '3px', fontWeight: 600 }}>
                {totals.alltime_calls.toLocaleString()} all-time calls
              </div>
            </div>
            <div style={{
              background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Zap size={22} color={gold} />
            </div>
          </div>
        </Col>

        {/* Total Window Tokens */}
        <Col xl={3} lg={6} sm={6} xs={12}>
          <div className="model-stat-card d-flex align-items-center justify-content-between">
            <div>
              <div style={{ fontSize: '0.72rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Window Token Volume
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', lineHeight: 1.2, marginTop: '4px' }}>
                {isLoading ? '—' : formatTokens(totals.tokens)}
              </div>
              <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '3px' }}>
                {formatTokens(totals.alltime_tokens)} all-time ({totals.tokens.toLocaleString()} tokens)
              </div>
            </div>
            <div style={{
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Cpu size={22} color="#10b981" />
            </div>
          </div>
        </Col>

        {/* Active Models in Window */}
        <Col xl={3} lg={6} sm={6} xs={12}>
          <div className="model-stat-card d-flex align-items-center justify-content-between">
            <div>
              <div style={{ fontSize: '0.72rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Catalog Utilization
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8', lineHeight: 1.2, marginTop: '4px' }}>
                {isLoading ? '—' : `${activeModelsCount} / ${rawModels.length}`}
              </div>
              <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '3px' }}>
                {rawModels.length ? ((activeModelsCount / rawModels.length) * 100).toFixed(0) : 0}% of models active
              </div>
            </div>
            <div style={{
              background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Activity size={22} color="#38bdf8" />
            </div>
          </div>
        </Col>

        {/* Top Utilized Model */}
        <Col xl={3} lg={6} sm={6} xs={12}>
          <div
            className="model-stat-card d-flex align-items-center justify-content-between"
            onClick={() => {
              if (topModelByCalls) onInspectModel(topModelByCalls);
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.72rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Top Utilized Model
              </div>
              <div
                style={{
                  fontSize: '1.15rem', fontWeight: 900, color: '#c084fc',
                  fontFamily: 'monospace', lineHeight: 1.3, marginTop: '4px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}
                title={topModelByCalls?.id ?? 'None'}
              >
                {isLoading ? '—' : (topModelByCalls?.id ?? 'None')}
              </div>
              <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '3px' }}>
                {topModelByCalls ? `${topModelByCalls.calls.toLocaleString()} calls (${totals.calls ? ((topModelByCalls.calls / totals.calls) * 100).toFixed(1) : 0}%)` : 'No traffic'}
              </div>
            </div>
            <div style={{
              background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)',
              borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingUp size={22} color="#c084fc" />
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Provider Traffic Share Distribution Bar ── */}
      {providerStats.length > 0 && totals.calls > 0 && (
        <div className="mb-4 p-3" style={{
          background: surfaceBg, border: `1px solid ${surfaceBorder}`, borderRadius: '10px', backdropFilter: 'blur(10px)'
        }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: gold, letterSpacing: '0.6px' }}>
              Provider Volume Distribution (Window)
            </span>
            <span style={{ fontSize: '0.72rem', color: textMuted }}>
              Click any provider to filter
            </span>
          </div>

          {/* Proportional Stacked Bar */}
          <div style={{
            height: '10px', borderRadius: '999px', overflow: 'hidden',
            display: 'flex', width: '100%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            marginBottom: '10px'
          }}>
            {providerStats.filter(p => p.calls > 0).map((p, idx) => (
              <div
                key={idx}
                title={`${p.name}: ${p.calls.toLocaleString()} calls (${p.percent.toFixed(1)}%)`}
                style={{
                  width: `${p.percent}%`,
                  background: p.color,
                  transition: 'width 0.4s ease'
                }}
              />
            ))}
          </div>

          {/* Provider Chips */}
          <div className="d-flex flex-wrap gap-2">
            {providerStats.filter(p => p.calls > 0).map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setProviderFilter(prev => prev === p.name ? 'all' : p.name)}
                style={{
                  background: providerFilter === p.name ? `${p.color}25` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  border: `1px solid ${providerFilter === p.name ? p.color : surfaceBorder}`,
                  borderRadius: '6px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: textPrimary }}>{p.name}</span>
                <span style={{ fontSize: '0.72rem', color: textMuted, fontWeight: 600 }}>
                  {p.calls.toLocaleString()} ({p.percent.toFixed(1)}%)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar: Search, Filters, View Modes & CSV Export ── */}
      <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3 p-3" style={{
        background: surfaceBg, border: `1px solid ${surfaceBorder}`, borderRadius: '10px', backdropFilter: 'blur(10px)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 280px' }}>
          <Search size={16} color={textMuted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by model ID, provider, feature (e.g. News Writer)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 34px 8px 36px',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '8px', color: textPrimary, fontSize: '0.82rem', outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer', padding: 0
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`model-filter-pill ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All ({rawModels.length})
          </button>
          <button
            type="button"
            className={`model-filter-pill ${filterTab === 'active' ? 'active' : ''}`}
            onClick={() => setFilterTab('active')}
          >
            Active ({activeModelsCount})
          </button>
          <button
            type="button"
            className={`model-filter-pill ${filterTab === 'picker' ? 'active' : ''}`}
            onClick={() => setFilterTab('picker')}
          >
            Chat Picker
          </button>
          <button
            type="button"
            className={`model-filter-pill ${filterTab === 'pinned' ? 'active' : ''}`}
            onClick={() => setFilterTab('pinned')}
          >
            Pinned Subsystems
          </button>
          <button
            type="button"
            className={`model-filter-pill ${filterTab === 'zero' ? 'active' : ''}`}
            onClick={() => setFilterTab('zero')}
          >
            Zero Calls
          </button>
        </div>

        {/* Right side tools: Provider select, View Toggle, Export */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Provider Select */}
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{
              background: isDark ? '#18181b' : '#ffffff',
              color: textPrimary,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: '8px', padding: '7px 12px', fontSize: '0.8rem',
              fontWeight: 600, outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="all">All Providers</option>
            {providerStats.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          {/* View Toggle */}
          <div style={{
            display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            borderRadius: '8px', padding: '2px', border: `1px solid ${surfaceBorder}`
          }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table view"
              style={{
                background: viewMode === 'table' ? gold : 'transparent',
                color: viewMode === 'table' ? '#000' : textMuted,
                border: 'none', borderRadius: '6px', padding: '6px 9px', cursor: 'pointer'
              }}
            >
              <TableIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card view"
              style={{
                background: viewMode === 'cards' ? gold : 'transparent',
                color: viewMode === 'cards' ? '#000' : textMuted,
                border: 'none', borderRadius: '6px', padding: '6px 9px', cursor: 'pointer'
              }}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportToCSV}
            title="Export CSV"
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.5)'}`,
              color: gold, borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Table / Cards Content ── */}
      {isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <RefreshCw size={32} color={gold} style={{ animation: 'spin 1s linear infinite', marginBottom: '14px' }} />
          <h5 style={{ color: textPrimary, fontWeight: 700 }}>Fetching Model Usage Telemetry...</h5>
          <p style={{ color: textMuted, fontSize: '0.85rem' }}>Gathering invocation and token counts from /api/v1/models/stats</p>
        </div>
      ) : isError ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px'
        }}>
          <h5 style={{ color: '#ef4444', fontWeight: 800 }}>Failed to Load Model Usage Stats</h5>
          <p style={{ color: textMuted, fontSize: '0.85rem', margin: '8px 0 16px' }}>
            {error instanceof Error ? error.message : 'The endpoint could not be reached or returned an error.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              background: '#ef4444', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      ) : filteredModels.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          background: surfaceBg, border: `1px dashed ${surfaceBorder}`, borderRadius: '12px'
        }}>
          <Activity size={36} color={gold} style={{ opacity: 0.6, marginBottom: '12px' }} />
          <h5 style={{ color: textPrimary, fontWeight: 700, margin: '0 0 6px' }}>No models match your filters</h5>
          <p style={{ color: textMuted, fontSize: '0.85rem', margin: '0 0 16px' }}>
            Try clearing the search query or changing your filter criteria.
          </p>
          <button
            type="button"
            onClick={() => { setFilterTab('all'); setProviderFilter('all'); setSearchQuery(''); }}
            style={{
              background: gold, color: '#000', border: 'none', borderRadius: '8px',
              padding: '8px 18px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ═══════════════════════════════════════════════════
            TABLE VIEW
        ═══════════════════════════════════════════════════ */
        <div style={{
          background: surfaceBg, border: `1px solid ${surfaceBorder}`,
          borderRadius: '12px', overflow: 'hidden', backdropFilter: 'blur(10px)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  borderBottom: `1px solid ${surfaceBorder}`, color: textMuted
                }}>
                  <th
                    style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}
                    onClick={() => handleSort('id')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Model & Provider</span>
                      {sortField === 'id' ? (sortDirection === 'asc' ? <ArrowUp size={12} color={gold} /> : <ArrowDown size={12} color={gold} />) : <ArrowUpDown size={12} opacity={0.4} />}
                    </div>
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}>
                    Routing & Bindings
                  </th>
                  <th
                    style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}
                    onClick={() => handleSort('calls')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Window Calls</span>
                      {sortField === 'calls' ? (sortDirection === 'asc' ? <ArrowUp size={12} color={gold} /> : <ArrowDown size={12} color={gold} />) : <ArrowUpDown size={12} opacity={0.4} />}
                    </div>
                  </th>
                  <th
                    style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}
                    onClick={() => handleSort('tokens')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Window Tokens</span>
                      {sortField === 'tokens' ? (sortDirection === 'asc' ? <ArrowUp size={12} color={gold} /> : <ArrowDown size={12} color={gold} />) : <ArrowUpDown size={12} opacity={0.4} />}
                    </div>
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}>
                    Avg Tokens/Call
                  </th>
                  <th
                    style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}
                    onClick={() => handleSort('alltime_calls')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>All-Time Totals</span>
                      {sortField === 'alltime_calls' ? (sortDirection === 'asc' ? <ArrowUp size={12} color={gold} /> : <ArrowDown size={12} color={gold} />) : <ArrowUpDown size={12} opacity={0.4} />}
                    </div>
                  </th>
                  <th style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.6px' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((model) => {
                  const prov = getProviderName(model.id);
                  const provColor = PROVIDER_COLORS[prov] || '#71717a';
                  const callPercent = totals.calls ? ((model.calls / totals.calls) * 100) : 0;
                  const tokenPercent = totals.tokens ? ((model.tokens / totals.tokens) * 100) : 0;
                  const avgTokens = model.calls > 0 ? (model.tokens / model.calls).toFixed(0) : '—';

                  return (
                    <tr
                      key={model.id}
                      style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(212,175,55,0.04)' : 'rgba(212,175,55,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Model & Provider */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                color: textPrimary, fontWeight: 800, fontFamily: 'monospace',
                                fontSize: '0.86rem'
                              }}
                            >
                              {model.id}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => copyText(model.id, 'Model ID', e)}
                              title="Copy Model ID"
                              style={{
                                background: 'transparent', border: 'none', color: textMuted,
                                cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center'
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = gold}
                              onMouseLeave={e => e.currentTarget.style.color = textMuted}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          <div>
                            <span style={{
                              background: `${provColor}18`, color: provColor,
                              border: `1px solid ${provColor}35`, borderRadius: '4px',
                              padding: '1px 6px', fontSize: '0.66rem', fontWeight: 700
                            }}>
                              {prov}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Routing & Bindings */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            {model.in_user_picker ? (
                              <span style={{
                                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px',
                                padding: '1px 6px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                Chat Picker
                              </span>
                            ) : (
                              <span style={{
                                background: 'rgba(192,132,252,0.12)', color: '#c084fc',
                                border: '1px solid rgba(192,132,252,0.3)', borderRadius: '4px',
                                padding: '1px 6px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                Internal Only
                              </span>
                            )}
                          </div>
                          {model.used_by && model.used_by.length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {model.used_by.slice(0, 2).map((ub, idx) => (
                                <span
                                  key={idx}
                                  title={`${ub.feature} (${ub.source})`}
                                  style={{
                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                    color: textMuted, borderRadius: '4px', padding: '1px 5px',
                                    fontSize: '0.66rem', fontWeight: 600
                                  }}
                                >
                                  {ub.feature}
                                </span>
                              ))}
                              {model.used_by.length > 2 && (
                                <span style={{ fontSize: '0.66rem', color: gold, fontWeight: 700 }}>
                                  +{model.used_by.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: textMuted, fontStyle: 'italic' }}>
                              Unpinned
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Window Calls */}
                      <td style={{ padding: '14px 18px' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: textPrimary, fontSize: '0.9rem' }}>
                            {model.calls.toLocaleString()}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <div style={{
                              width: '60px', height: '4px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                              borderRadius: '999px', overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(callPercent, 100)}%`, height: '100%',
                                background: gold
                              }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', color: textMuted }}>
                              {callPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Window Tokens */}
                      <td style={{ padding: '14px 18px' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.9rem' }}>
                            {formatTokens(model.tokens)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <div style={{
                              width: '60px', height: '4px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                              borderRadius: '999px', overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(tokenPercent, 100)}%`, height: '100%',
                                background: '#10b981'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', color: textMuted }}>
                              {tokenPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Avg Tokens/Call */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontWeight: 700, color: textPrimary }}>
                          {avgTokens}
                        </span>
                      </td>

                      {/* All-Time */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '0.78rem' }}>
                          <span style={{ color: textPrimary, fontWeight: 700 }}>{model.alltime_calls.toLocaleString()}</span>
                          <span style={{ color: textMuted }}> calls</span>
                          <div style={{ color: textMuted, fontSize: '0.72rem' }}>
                            {formatTokens(model.alltime_tokens)} tokens
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onInspectModel(model)}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${isDark ? 'rgba(212,175,55,0.25)' : 'rgba(212,175,55,0.4)'}`,
                            color: gold, borderRadius: '6px', padding: '5px 10px',
                            fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = gold; e.currentTarget.style.color = '#000'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = gold; }}
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
      ) : (
        /* ═══════════════════════════════════════════════════
            CARDS VIEW
        ═══════════════════════════════════════════════════ */
        <Row className="g-3">
          {filteredModels.map(model => {
            const prov = getProviderName(model.id);
            const provColor = PROVIDER_COLORS[prov] || '#71717a';
            const callPercent = totals.calls ? ((model.calls / totals.calls) * 100) : 0;
            const tokenPercent = totals.tokens ? ((model.tokens / totals.tokens) * 100) : 0;

            return (
              <Col xl={4} lg={6} md={6} sm={12} key={model.id}>
                <div
                  className="model-card-item p-3 h-100 d-flex flex-column justify-content-between"
                  onClick={() => onInspectModel(model)}
                >
                  <div>
                    {/* Header */}
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div>
                        <div
                          style={{
                            color: textPrimary, fontWeight: 800, fontSize: '0.86rem',
                            fontFamily: 'monospace', wordBreak: 'break-all'
                          }}
                        >
                          {model.id}
                        </div>
                        <span style={{
                          background: `${provColor}18`, color: provColor,
                          border: `1px solid ${provColor}35`, borderRadius: '4px',
                          padding: '1px 6px', fontSize: '0.64rem', fontWeight: 700,
                          display: 'inline-block', marginTop: '3px'
                        }}>
                          {prov}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => copyText(model.id, 'Model ID', e)}
                        title="Copy Model ID"
                        style={{
                          background: 'transparent', border: 'none', color: textMuted,
                          cursor: 'pointer', padding: '2px 4px', borderRadius: '4px'
                        }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    {/* Picker & Pinned badges */}
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
                      {model.in_user_picker ? (
                        <span style={{
                          background: 'rgba(16,185,129,0.12)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px',
                          padding: '1px 6px', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase'
                        }}>
                          Chat Picker
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(192,132,252,0.12)', color: '#c084fc',
                          border: '1px solid rgba(192,132,252,0.3)', borderRadius: '4px',
                          padding: '1px 6px', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase'
                        }}>
                          Internal Only
                        </span>
                      )}

                      {model.used_by && model.used_by.length > 0 && (
                        <span style={{
                          background: 'rgba(212,175,55,0.12)', color: gold,
                          border: '1px solid rgba(212,175,55,0.3)', borderRadius: '4px',
                          padding: '1px 6px', fontSize: '0.64rem', fontWeight: 800
                        }}>
                          {model.used_by.length} Pins
                        </span>
                      )}
                    </div>

                    {/* Window Metrics Row */}
                    <div style={{
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${surfaceBorder}`, borderRadius: '8px', padding: '10px',
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.66rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                          Window Calls
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: textPrimary, marginTop: '2px' }}>
                          {model.calls.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: gold, marginTop: '1px' }}>
                          {callPercent.toFixed(1)}% of window
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.66rem', color: textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                          Window Tokens
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                          {formatTokens(model.tokens)}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: textMuted, marginTop: '1px' }}>
                          {tokenPercent.toFixed(1)}% of window
                        </div>
                      </div>
                    </div>

                    {/* All-Time stats */}
                    <div style={{ fontSize: '0.72rem', color: textMuted, display: 'flex', justifyContent: 'space-between' }}>
                      <span>All-Time Calls: <strong style={{ color: textPrimary }}>{model.alltime_calls.toLocaleString()}</strong></span>
                      <span>Tokens: <strong style={{ color: textPrimary }}>{formatTokens(model.alltime_tokens)}</strong></span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="d-flex align-items-center justify-content-between mt-3 pt-2" style={{
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    fontSize: '0.72rem'
                  }}>
                    <span style={{ color: textMuted }}>
                      Avg: {model.calls > 0 ? (model.tokens / model.calls).toFixed(0) : 0} tok/call
                    </span>
                    <span style={{ color: gold, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      Inspect <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
