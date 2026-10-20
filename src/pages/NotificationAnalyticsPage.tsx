import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  NewsService,
  NotificationOpensArticle,
  NotificationOpensParams,
} from 'api/backendApi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import {
  BarChart2,
  Search,
  RefreshCw,
  Globe,
  Calendar,
  Hash,
  Layers,
  Eye,
  MousePointerClick,
  Send,
  TrendingUp,
  Activity,
  ChevronLeft,
  ChevronDown,
  MapPin,
  Clock,
  Newspaper,
  CheckCircle,
} from 'lucide-react';
import CountryFlag from 'components/CountryFlag';
import { getLocalizedStr } from 'features/news/hooks/useAdminNews';
import 'features/news/styles/news.scss';

// ─── constants ─────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 64;
const TABLE_VIEWPORT = 520;

const CHART_COLORS = [
  '#D4AF37', '#3b82f6', '#2ecc71', '#a855f7', '#ef4444',
  '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6',
  '#14b8a6', '#f59e0b', '#6366f1', '#10b981', '#e11d48',
];

// ─── helpers ───────────────────────────────────────────────────────────────────
const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + '…' : s;

const getTodayDateStr = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ─── chart panel wrapper ────────────────────────────────────────────────────────
const ChartPanel = memo(
  ({ title, icon, children, height = 300 }: { title: string; icon: React.ReactNode; children: React.ReactNode; height?: number }) => (
    <div
      style={{
        background: 'var(--news-glass-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--news-glass-border)',
        borderRadius: 8,
        padding: '20px 20px 16px',
        boxShadow: 'var(--news-card-shadow)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.68rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '1.3px',
          color: 'var(--news-text-dim)',
          marginBottom: 18,
        }}
      >
        {icon}
        {title}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
);

// ─── custom recharts tooltip ────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--news-modal-bg)',
        border: '1px solid var(--news-glass-border)',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: '0.78rem',
        color: 'var(--news-text-main)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxWidth: 280,
      }}
    >
      {label && (
        <div
          style={{
            fontWeight: 700,
            marginBottom: 6,
            color: 'var(--news-text-dim)',
            fontSize: '0.7rem',
            wordBreak: 'break-word',
          }}
        >
          {label}
        </div>
      )}
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--news-text-muted)', whiteSpace: 'nowrap' }}>{p.name}:</span>
          <span style={{ fontWeight: 800, color: p.color }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  subtitle?: string;
}

const KpiCard = memo(({ label, value, icon, accent, subtitle }: KpiCardProps) => (
  <div className="country-card" style={{ padding: '20px 22px', gap: 8, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--news-text-dim)', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
        {label}
      </div>
      <div style={{ background: `${accent}18`, borderRadius: 6, padding: 6, color: accent, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: '-0.5px', wordBreak: 'break-all' }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ fontSize: '0.7rem', color: 'var(--news-text-dim)', fontWeight: 500 }}>{subtitle}</div>
    )}
  </div>
));

// ─── Audit Table Row ──────────────────────────────────────────────────────────
interface RowProps {
  row: NotificationOpensArticle;
  index: number;
  style?: React.CSSProperties;
}

const AuditRow = memo(({ row, index, style }: RowProps) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 110px 70px 70px 80px',
        alignItems: 'center',
        gap: 0,
        borderBottom: '1px solid var(--news-glass-border)',
        background: hovered ? 'var(--news-table-header-bg)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
        transition: 'background 0.15s',
        minWidth: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Headline */}
      <div style={{ padding: '0 12px 0 20px', minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--news-text-main)',
            fontSize: '0.82rem',
          }}
          title={getLocalizedStr(row.headline_en, '—')}
        >
          {getLocalizedStr(row.headline_en, '—')}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--news-text-dim)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{new Date(row.notified_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          {row.article_type && (
            <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', padding: '1px 6px', borderRadius: 3, fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase' }}>
              {row.article_type}
            </span>
          )}
        </div>
      </div>

      {/* Country */}
      <div style={{ padding: '0 8px', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CountryFlag country={row.country} size={18} />
          <span
            style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--news-text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={row.country}
          >
            {row.country}
          </span>
        </div>
      </div>

      {/* Sent */}
      <div style={{ padding: '0 8px', fontWeight: 700, color: '#2ecc71', fontSize: '0.82rem', textAlign: 'right', paddingRight: 16 }}>
        {row.sent.toLocaleString()}
      </div>

      {/* Opens */}
      <div style={{ padding: '0 8px', fontWeight: 700, color: '#3b82f6', fontSize: '0.82rem', textAlign: 'right', paddingRight: 16 }}>
        {row.unique_opens.toLocaleString()}
      </div>

      {/* Open rate */}
      <div style={{ padding: '0 20px 0 8px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            background: row.open_rate > 0.05 ? 'rgba(46,204,113,0.12)' : row.open_rate > 0 ? 'rgba(212,175,55,0.12)' : 'rgba(82,82,91,0.1)',
            color: row.open_rate > 0.05 ? '#2ecc71' : row.open_rate > 0 ? '#D4AF37' : 'var(--news-text-dim)',
            fontSize: '0.72rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {(row.open_rate * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
});

// ─── Virtual Table ────────────────────────────────────────────────────────────
const VirtualAuditTable = memo(({ rows }: { rows: NotificationOpensArticle[] }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3);
  const endIdx = Math.min(rows.length - 1, Math.ceil((scrollTop + TABLE_VIEWPORT) / ROW_HEIGHT) + 3);

  return (
    <div onScroll={handleScroll} style={{ height: TABLE_VIEWPORT, overflowY: 'auto', position: 'relative', scrollbarWidth: 'thin', scrollbarColor: 'var(--news-scroll-thumb) var(--news-scroll-track)' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {rows.slice(startIdx, endIdx + 1).map((row, i) => (
          <AuditRow
            key={row.news_id + row.notified_at}
            row={row}
            index={startIdx + i}
            style={{ position: 'absolute', top: (startIdx + i) * ROW_HEIGHT, width: '100%', height: ROW_HEIGHT }}
          />
        ))}
      </div>
    </div>
  );
});

// ─── Country Dropdown ─────────────────────────────────────────────────────────
interface CountrySelectProps {
  value: string;
  onChange: (v: string) => void;
  inputStyle: React.CSSProperties;
}

const CountrySelect = memo(({ value, onChange, inputStyle }: CountrySelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const { data: countriesData, isLoading } = useQuery({
    queryKey: ['admin-countries'],
    queryFn: () => NewsService.fetchAdminCountries(),
    staleTime: 5 * 60_000,
  });

  const countries = useMemo(
    () => (countriesData?.supported_countries ? Object.keys(countriesData.supported_countries).sort() : []),
    [countriesData]
  );

  const filtered = useMemo(
    () => countries.filter(c => c.toLowerCase().includes(search.toLowerCase())),
    [countries, search]
  );

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = value || (isLoading ? 'Loading…' : 'All Countries');

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          border: open ? '1px solid #D4AF37' : inputStyle.border,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'var(--news-text-main)' : 'var(--news-text-dim)' }}>
          {value && <CountryFlag country={value} size={16} />}
          {displayValue}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--news-text-dim)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'var(--news-panel-bg)',
            border: '1px solid var(--news-glass-border)',
            borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--news-glass-border)', flexShrink: 0, background: 'var(--news-panel-bg)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem', borderRadius: 4, background: 'var(--news-input-bg)' }}
            />
          </div>
          {/* All option */}
          <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', scrollbarColor: 'var(--news-scroll-thumb) var(--news-scroll-track)', background: 'var(--news-panel-bg)' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              style={{ width: '100%', background: !value ? 'rgba(212,175,55,0.1)' : 'transparent', border: 'none', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', color: 'var(--news-text-dim)', fontSize: '0.82rem', fontStyle: 'italic', display: 'block' }}
            >
              All Countries
            </button>
            {filtered.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                style={{
                  width: '100%',
                  background: value === c ? 'rgba(212,175,55,0.1)' : 'transparent',
                  border: 'none',
                  padding: '9px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: value === c ? '#D4AF37' : 'var(--news-text-main)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontWeight: value === c ? 700 : 400,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (value !== c) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (value !== c) e.currentTarget.style.background = 'transparent'; }}
              >
                <CountryFlag country={c} size={18} />
                {c}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '20px 14px', color: 'var(--news-text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Main Analytics Page ────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void;
}

export default function NotificationAnalyticsPage({ onBack }: Props) {
  const [country, setCountry] = useState('Germany');
  const [date, setDate] = useState(getTodayDateStr);
  const [includeUnsent, setIncludeUnsent] = useState(true);
  const [newsId, setNewsId] = useState('');
  const [limit, setLimit] = useState<number>(100);
  const [params, setParams] = useState<NotificationOpensParams>(() => ({
    country: 'Germany',
    date: getTodayDateStr(),
    include_unsent: true,
    limit: 100,
  }));
  const [hasQueried, setHasQueried] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const handleExecute = useCallback(() => {
    const p: NotificationOpensParams = { limit, include_unsent: includeUnsent };
    if (country.trim()) p.country = country.trim();
    if (date.trim()) p.date = date.trim();
    if (newsId.trim()) p.news_id = newsId.trim();
    setParams(p);
    setHasQueried(true);
  }, [country, date, newsId, limit, includeUnsent]);

  const handleReset = useCallback(() => {
    const today = getTodayDateStr();
    setCountry('Germany');
    setDate(today);
    setNewsId('');
    setIncludeUnsent(true);
    setLimit(100);
    setParams({
      country: 'Germany',
      date: today,
      include_unsent: true,
      limit: 100,
    });
    setHasQueried(true);
  }, []);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['notification-opens', params],
    queryFn: () => NewsService.fetchNotificationOpens(params),
    enabled: hasQueried,
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const articles = data?.articles ?? [];

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const timeA = new Date(a.notified_at).getTime();
      const timeB = new Date(b.notified_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [articles, sortOrder]);

  // ── Computed chart datasets ────────────────────────────────────────────────
  // 1. Top Articles — use article index labels on Y axis; full title in tooltip
  const topArticlesChartData = useMemo(
    () =>
      (summary?.top_articles ?? [])
        .slice()
        .sort((a, b) => (b.unique_opens + b.total_taps) - (a.unique_opens + a.total_taps))
        .slice(0, 8)
        .map((a, i) => ({
          name: `#${i + 1}`,          // short Y-axis label
          fullName: truncate(getLocalizedStr(a.headline_en, '—'), 80),
          unique_opens: a.unique_opens,
          total_taps: a.total_taps,
        })),
    [summary]
  );

  // 2. Sent by Country — aggregate sent per country, top 12
  const sentByCountryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) {
      map[a.country] = (map[a.country] ?? 0) + a.sent;
    }
    return Object.entries(map)
      .map(([country, sent]) => ({ country, sent }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 12);
  }, [articles]);

  // 3. Article Type Breakdown — pie
  const articleTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) {
      const key = a.article_type ?? 'general';
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.replace('_', ' '), value }))
      .sort((a, b) => b.value - a.value);
  }, [articles]);

  // 4. Hourly distribution — bucket by UTC hour
  const hourlyData = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    for (const a of articles) {
      const hour = new Date(a.notified_at).getUTCHours();
      buckets[hour] = (buckets[hour] ?? 0) + a.sent;
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      sent: buckets[h],
    }));
  }, [articles]);

  // 5. Sent volume scatter — top 20 articles by sent for area chart
  const sentTrendData = useMemo(
    () =>
      articles
        .slice()
        .sort((a, b) => b.sent - a.sent)
        .slice(0, 20)
        .map((a, i) => ({
          rank: i + 1,
          name: truncate(a.country, 12),
          sent: a.sent,
          opens: a.unique_opens,
        })),
    [articles]
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--news-input-bg)',
    border: '1px solid var(--news-glass-border)',
    borderRadius: 6,
    padding: '10px 14px',
    color: 'var(--news-text-main)',
    fontSize: '0.88rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--news-text-dim)',
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    marginBottom: 8,
  };

  return (
    <div className="news-glass-archive" style={{ minHeight: '100vh', paddingBottom: 100 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="news-command-header" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ background: 'transparent', border: '1px solid var(--news-glass-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--news-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--news-glass-border)'; e.currentTarget.style.color = 'var(--news-text-dim)'; }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h2 className="news-title-sharp">
              <BarChart2 size={22} color="#D4AF37" style={{ marginRight: 10, verticalAlign: 'text-bottom' }} />
              Notification Analytics
            </h2>
            <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.85rem', fontWeight: 500, marginTop: 3 }}>
              Per-article open/click stats — unique opens, total taps, open rate, and per-country breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* ── Parameter Control Bar ───────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--news-glass-bg)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--news-glass-border)',
          borderRadius: 8,
          padding: '22px 24px',
          marginBottom: 28,
          boxShadow: 'var(--news-card-shadow)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ color: 'var(--news-text-dim)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={13} /> Query Parameters
          </span>
          <span style={{ color: '#D4AF37', textTransform: 'none', letterSpacing: 'normal', fontFamily: 'monospace', fontSize: '0.74rem', background: 'rgba(212,175,55,0.08)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(212,175,55,0.2)' }}>
            GET /news/admin/notification-opens
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18, marginBottom: 20 }}>
          {/* Country — searchable dropdown from API */}
          <div>
            <label style={labelStyle}><Globe size={12} /> Country</label>
            <CountrySelect value={country} onChange={setCountry} inputStyle={inputStyle} />
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}><Calendar size={12} /> Date (YYYY-MM-DD)</label>
            <input
              id="na-date"
              style={inputStyle}
              placeholder="2026-05-15"
              value={date}
              onChange={e => setDate(e.target.value.replace(/[^0-9-]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleExecute()}
              onFocus={e => (e.target.style.borderColor = '#D4AF37')}
              onBlur={e => (e.target.style.borderColor = 'var(--news-glass-border)')}
            />
          </div>

          {/* News ID */}
          <div>
            <label style={labelStyle}><Hash size={12} /> News ID</label>
            <input
              id="na-news-id"
              style={inputStyle}
              placeholder="news_id"
              value={newsId}
              onChange={e => setNewsId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleExecute()}
              onFocus={e => (e.target.style.borderColor = '#D4AF37')}
              onBlur={e => (e.target.style.borderColor = 'var(--news-glass-border)')}
            />
          </div>

          {/* Include Unsent */}
          <div>
            <label style={labelStyle}>
              <CheckCircle size={12} /> Include Unsent
            </label>
            <div
              id="na-include-unsent-toggle"
              onClick={() => setIncludeUnsent(prev => !prev)}
              style={{
                ...inputStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                id="na-include-unsent"
                type="checkbox"
                checked={includeUnsent}
                onChange={e => setIncludeUnsent(e.target.checked)}
                onClick={e => e.stopPropagation()}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: '#D4AF37',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '0.82rem', color: includeUnsent ? '#D4AF37' : 'var(--news-text-dim)', fontWeight: 700 }}>
                {includeUnsent ? 'true' : 'false'}
              </span>
            </div>
          </div>

          {/* Limit */}
          <div>
            <label style={labelStyle}>
              <Activity size={12} /> Limit
              <span style={{ color: 'var(--news-text-dim)', fontSize: '0.62rem' }}>(1–500)</span>
            </label>
            <input
              id="na-limit"
              type="number"
              min={1}
              style={inputStyle}
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value) || 100)}
              onKeyDown={e => e.key === 'Enter' && handleExecute()}
              onFocus={e => (e.target.style.borderColor = '#D4AF37')}
              onBlur={e => (e.target.style.borderColor = 'var(--news-glass-border)')}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            id="na-execute-btn"
            onClick={handleExecute}
            disabled={isLoading || isFetching}
            style={{ flex: '1 1 140px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 6, padding: '12px 0', fontWeight: 800, fontSize: '0.88rem', cursor: isLoading || isFetching ? 'not-allowed' : 'pointer', opacity: isLoading || isFetching ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
          >
            {isLoading || isFetching ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Fetching…</> : <><Search size={15} /> Execute</>}
          </button>
          <button
            id="na-reset-btn"
            onClick={handleReset}
            style={{ flex: '1 1 120px', background: 'transparent', color: 'var(--news-text-muted)', border: '1px solid var(--news-glass-border)', borderRadius: 6, padding: '12px 0', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--news-text-dim)'; e.currentTarget.style.color = 'var(--news-text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--news-glass-border)'; e.currentTarget.style.color = 'var(--news-text-muted)'; }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!hasQueried && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--news-text-dim)' }}>
          <BarChart2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>
            Configure parameters above and click <strong style={{ color: '#D4AF37' }}>Execute</strong> to load analytics.
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {isError && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 8, padding: '20px 24px', color: '#e74c3c', marginBottom: 28, fontWeight: 600, fontSize: '0.9rem' }}>
          Failed to fetch analytics data. Please check your connection and try again.
        </div>
      )}

      {/* ── Loading skeletons ────────────────────────────────────────────── */}
      {isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="nv-skeleton" style={{ height: 100 }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="nv-skeleton" style={{ height: 320 }} />)}
          </div>
          <div className="nv-skeleton" style={{ height: 440 }} />
        </>
      )}

      {/* ── Data loaded ─────────────────────────────────────────────────── */}
      {hasQueried && !isLoading && summary && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Total Runs" value={summary.total_runs.toLocaleString()} icon={<Activity size={15} />} accent="#D4AF37" subtitle="Pipeline runs" />
            <KpiCard label="Total Sent" value={summary.total_sent.toLocaleString()} icon={<Send size={15} />} accent="#2ecc71" subtitle="Push notifications" />
            <KpiCard label="Unique Opens" value={summary.total_unique_opens.toLocaleString()} icon={<Eye size={15} />} accent="#3b82f6" subtitle="Distinct opens" />
            <KpiCard label="Total Taps" value={summary.total_taps.toLocaleString()} icon={<MousePointerClick size={15} />} accent="#a855f7" subtitle="Article taps" />
            <KpiCard label="Open Rate" value={`${(summary.overall_open_rate * 100).toFixed(2)}%`} icon={<TrendingUp size={15} />} accent={summary.overall_open_rate > 0.05 ? '#2ecc71' : '#D4AF37'} subtitle="Opens / sent" />
          </div>

          {/* ── Charts — row 1 ────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

            {/* Chart 1: Top Articles — index labels on Y, full title in tooltip */}
            <ChartPanel title="Top Articles by Opens & Taps" icon={<Eye size={13} color="#3b82f6" />} height={topArticlesChartData.length > 0 ? Math.max(220, topArticlesChartData.length * 36) : 220}>
              {topArticlesChartData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--news-text-dim)', fontSize: '0.82rem' }}>No top article data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topArticlesChartData} margin={{ top: 0, right: 30, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--news-glass-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--news-text-dim)' }} axisLine={{ stroke: 'var(--news-glass-border)' }} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={32}
                      tick={{ fontSize: 11, fill: 'var(--news-text-muted)', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: 'var(--news-modal-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 6, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--news-text-main)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: 300 }}>
                            <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--news-text-main)', fontSize: '0.75rem', wordBreak: 'break-word', lineHeight: 1.4 }}>{d?.fullName}</div>
                            {payload.map((p: any) => (
                              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                                <span style={{ color: 'var(--news-text-muted)' }}>{p.name}:</span>
                                <span style={{ fontWeight: 800, color: p.color }}>{p.value?.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.7rem', color: 'var(--news-text-dim)', paddingTop: 8 }} />
                    <Bar dataKey="unique_opens" name="Unique Opens" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={16} />
                    <Bar dataKey="total_taps" name="Total Taps" fill="#a855f7" radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>

            {/* Chart 2: Sent by Country — top 12 */}
            <ChartPanel title="Sent Volume by Country" icon={<MapPin size={13} color="#2ecc71" />} height={sentByCountryData.length > 0 ? Math.max(220, sentByCountryData.length * 28) : 220}>
              {sentByCountryData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--news-text-dim)', fontSize: '0.82rem' }}>No sent data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={sentByCountryData} margin={{ top: 0, right: 50, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--news-glass-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--news-text-dim)' }} axisLine={{ stroke: 'var(--news-glass-border)' }} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                    <YAxis
                      type="category"
                      dataKey="country"
                      width={90}
                      tick={{ fontSize: 10, fill: 'var(--news-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => truncate(v, 12)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="sent" name="Total Sent" fill="#2ecc71" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      <LabelList dataKey="sent" position="right" style={{ fontSize: 10, fill: 'var(--news-text-dim)' }} formatter={(v: any) => (typeof v === 'number' && v >= 1000) ? `${(v / 1000).toFixed(1)}k` : v} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          </div>

          {/* ── Charts — row 2 ────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

            {/* Chart 3: Hourly Notification Distribution */}
            <ChartPanel title="Hourly Notification Volume (UTC)" icon={<Clock size={13} color="#D4AF37" />} height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradHourly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--news-glass-border)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--news-text-dim)' }} axisLine={{ stroke: 'var(--news-glass-border)' }} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--news-text-dim)' }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="sent" name="Sent" stroke="#D4AF37" strokeWidth={2} fill="url(#gradHourly)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* Chart 4: Article Type Breakdown — Pie */}
            <ChartPanel title="Article Type Distribution" icon={<Newspaper size={13} color="#a855f7" />} height={220}>
              {articleTypeData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--news-text-dim)', fontSize: '0.82rem' }}>No type data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={articleTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={44}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: 'var(--news-text-dim)', strokeWidth: 1 }}
                    >
                      {articleTypeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];
                        return (
                          <div style={{ background: 'var(--news-modal-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 6, padding: '8px 12px', fontSize: '0.78rem', color: 'var(--news-text-main)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                            <span style={{ fontWeight: 700, color: p.payload?.fill }}>{p.name}</span>: {(p.value as number).toLocaleString()} articles
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>

            {/* Chart 5: Top 20 articles by sent volume — Area rank */}
            <ChartPanel title="Top 20 Articles — Sent Volume Ranking" icon={<TrendingUp size={13} color="#3b82f6" />} height={220}>
              {sentTrendData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--news-text-dim)', fontSize: '0.82rem' }}>No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sentTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--news-glass-border)" vertical={false} />
                    <XAxis dataKey="rank" tick={{ fontSize: 9, fill: 'var(--news-text-dim)' }} axisLine={{ stroke: 'var(--news-glass-border)' }} tickLine={false} label={{ value: 'Rank', position: 'insideBottomRight', offset: -4, fontSize: 9, fill: 'var(--news-text-dim)' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--news-text-dim)' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} fill="url(#gradSent)" dot={{ fill: '#3b82f6', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          </div>

          {/* ── Audit Table ──────────────────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ color: 'var(--news-text-main)', fontSize: '0.95rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Activity size={17} color="#D4AF37" /> Article Audit Log
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--news-text-dim)', fontWeight: 600, background: 'var(--news-table-header-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 4, padding: '3px 10px' }}>
                {articles.length.toLocaleString()} records
              </span>
            </div>

            <div
              style={{
                background: 'var(--news-glass-bg)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--news-glass-border)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: 'var(--news-card-shadow)',
                /* Horizontal scroll on small viewports */
                overflowX: 'auto',
              }}
            >
              {/* Min-width wrapper to prevent columns squashing on mobile */}
              <div style={{ minWidth: 580 }}>
                {/* Table Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 110px 70px 70px 80px',
                    background: 'var(--news-table-header-bg)',
                    borderBottom: '1px solid var(--news-glass-border)',
                    padding: '11px 0',
                    color: 'var(--news-text-dim)',
                    fontSize: '0.67rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1.3px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <div style={{ padding: '0 12px 0 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                    Headline <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  </div>
                  <div style={{ padding: '0 8px' }}>Country</div>
                  <div style={{ padding: '0 16px 0 8px', textAlign: 'right' }}>Sent</div>
                  <div style={{ padding: '0 16px 0 8px', textAlign: 'right' }}>Opens</div>
                  <div style={{ padding: '0 20px 0 8px', textAlign: 'center' }}>Rate</div>
                </div>

                {articles.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--news-text-dim)', fontStyle: 'italic', fontSize: '0.88rem' }}>
                    No article records found for the selected parameters.
                  </div>
                ) : articles.length > 200 ? (
                  <VirtualAuditTable rows={sortedArticles} />
                ) : (
                  <div style={{ maxHeight: TABLE_VIEWPORT, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--news-scroll-thumb) var(--news-scroll-track)' }}>
                    {sortedArticles.map((row, index) => (
                      <AuditRow
                        key={row.news_id + row.notified_at}
                        row={row}
                        index={index}
                        style={{ height: ROW_HEIGHT }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
