import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UserService, NewsService, UserUsageRecord } from 'api/backendApi';
import { useEnrichedProfiles } from 'features/users/hooks/useEnrichedProfiles';
import {
  Activity, Cpu, Database, Server, Zap,
  Clock, UserCheck, LucideIcon, Search,
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
  RefreshCw, User as UserIcon, ChevronLeft, ChevronRight, Globe,
  WifiOff, AlertTriangle,
} from 'lucide-react';
import CountryFlag from 'components/CountryFlag';
import 'features/news/styles/news.scss';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;
const LIMIT_MIN = 1;
const LIMIT_MAX = 200;
const DEBOUNCE_MS = 350;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => (n || 0).toLocaleString();

const TIER_RANK: Record<string, number> = { pro: 3, premium: 2, freemium: 1 };
const tierRank = (t?: string) => TIER_RANK[t?.toLowerCase?.() ?? ''] ?? 0;

function tierBadgeStyle(tier?: string): React.CSSProperties {
  const t = tier?.toLowerCase();
  if (t === 'pro')      return { background: 'rgba(212,175,55,0.15)', color: '#D4AF37',  border: '1px solid #D4AF37' };
  if (t === 'premium')  return { background: 'rgba(52,152,219,0.12)', color: '#3498db',  border: '1px solid #3498db' };
  if (t === 'freemium') return { background: 'rgba(46,204,113,0.08)', color: '#2ecc71',  border: '1px solid rgba(46,204,113,0.4)' };
  return { background: 'rgba(255,255,255,0.05)', color: '#a0a0a0', border: '1px solid var(--news-glass-border)' };
}

// ─── Custom debounce hook ─────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'total_tokens_used' | 'total_api_requests' | 'tier';
type SortDir = 'asc' | 'desc';
interface SortConfig { key: SortKey; dir: SortDir }

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string; value: string | number;
  icon: LucideIcon; color: string; detail?: string; isLoading?: boolean;
}
const UsageStatCard = React.memo<StatCardProps>(({ title, value, icon: Icon, color, detail, isLoading }) => (
  <div className="country-card" style={{ padding: '24px' }}>
    {isLoading
      ? <div className="nv-skeleton" style={{ height: 80 }} />
      : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--news-text-dim)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>{title}</p>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--news-text-main)', margin: 0 }}>{value}</h3>
            </div>
            <div style={{ background: `${color}15`, padding: '10px', borderRadius: '8px', border: `1px solid ${color}30` }}>
              <Icon size={20} color={color} />
            </div>
          </div>
          {detail && <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--news-text-muted)', fontWeight: 500 }}>{detail}</div>}
        </>
    }
  </div>
));

// ─── Error Banner ─────────────────────────────────────────────────────────────
const ErrorBanner = React.memo(({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
    <WifiOff size={18} color="#ef4444" />
    <span style={{ fontSize: '0.85rem', color: '#f87171', flex: 1 }}>{message}</span>
    <button
      onClick={onRetry}
      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', padding: '5px 14px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.8px' }}
    >
      RETRY
    </button>
  </div>
));

// ─── Inline styles ────────────────────────────────────────────────────────────
const PAGE_CSS = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin-anim { animation: spin 1s linear infinite; }
@media (max-width: 768px) { .col-joined, .col-uid { display: none !important; } }
.usage-pg-bar {
  display: flex; align-items: center; justify-content: center; gap: 20px;
  padding: 12px 24px; margin-top: 16px;
  background: var(--news-glass-bg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--news-glass-border); border-radius: 4px;
}
.pg-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 4px;
  background: rgba(0,0,0,0.45); border: 1px solid var(--news-glass-border);
  color: #e4e4e7; cursor: pointer; transition: all 0.18s ease;
}
.pg-btn:hover:not(:disabled) { background: rgba(212,175,55,0.12); border-color: #D4AF37; color: #D4AF37; }
.pg-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pg-label { font-size: 0.76rem; font-weight: 700; color: var(--news-text-muted); min-width: 120px; text-align: center; letter-spacing: 0.5px; }
.th-sort {
  padding: 14px 20px; font-weight: 900; cursor: pointer;
  color: #D4AF37 !important; text-transform: uppercase; letter-spacing: 1.5px;
  font-size: 0.68rem; white-space: nowrap; user-select: none;
}
.th-sort:hover { background: rgba(212,175,55,0.05); }
.th-plain { padding: 14px 20px; font-weight: 900; color: #D4AF37 !important; text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.68rem; white-space: nowrap; }
.limit-input::-webkit-inner-spin-button, .limit-input::-webkit-outer-spin-button { opacity: 1; }
.id-skel { display: inline-block; border-radius: 3px; animation: glowPulse 2s cubic-bezier(0.4,0,0.6,1) infinite; background: var(--news-table-header-bg); border: 1px solid var(--news-glass-border); }
.pu-select { background: transparent; border: none; color: #D4AF37; font-weight: 800; font-size: 0.85rem; outline: none; cursor: pointer; }
.pu-select option { background: #111; color: #fff; }
`;

// ─── Page Component ───────────────────────────────────────────────────────────
export default function PlatformUsagePage() {
  const navigate = useNavigate();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchLimit, setFetchLimit] = useState(LIMIT_MAX);
  const [limitInput, setLimitInput] = useState(String(LIMIT_MAX));
  const [userType, setUserType] = useState('all');
  const [countryFilter, setCountryFilter] = useState('');

  // Debounce search to avoid re-filtering on every keystroke
  const searchTerm = useDebounce(searchInput, DEBOUNCE_MS);

  // ── 1. Fetch countries list (long-lived cache — rarely changes) ────────────
  const { data: countriesData } = useQuery({
    queryKey: ['admin-countries'],
    queryFn: () => NewsService.fetchAdminCountries(),
    staleTime: 30 * 60 * 1000,   // 30 min — country list barely changes
    gcTime: 60 * 60 * 1000,      // 1 hour in memory
    retry: 2,
  });
  const countryList = useMemo(
    () => Object.keys(countriesData?.supported_countries ?? {}).sort(),
    [countriesData]
  );

  // ── 2. Fetch usage data ───────────────────────────────────────────────────
  const { data: usageData, isLoading: isLoadingUsage, isRefetching, isError, refetch } = useQuery({
    queryKey: ['usersUsageFull', fetchLimit, userType, countryFilter],
    queryFn: () => UserService.fetchUsersUsage(fetchLimit, userType, countryFilter),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // exp. back-off
    refetchOnWindowFocus: false,
  });
  const raw: UserUsageRecord[] = usageData?.users ?? [];

  // ── 3. Commit limit (blur / Enter) ────────────────────────────────────────
  const commitLimit = useCallback(() => {
    const n = Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, parseInt(limitInput) || LIMIT_MAX));
    setLimitInput(String(n));
    if (n !== fetchLimit) {
      setFetchLimit(n);
      setCurrentPage(1);
    }
  }, [limitInput, fetchLimit]);

  // ── 4. Filter → Sort → Paginate (fully memoised) ─────────────────────────
  const sorted = useMemo(() => {
    let list = [...raw];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        u.email?.toLowerCase?.().includes(q) ||
        u.user_id?.toLowerCase?.().includes(q)
      );
    }
    if (sortConfig) {
      list.sort((a, b) => {
        if (sortConfig.key === 'tier') {
          const av = tierRank(a.tier), bv = tierRank(b.tier);
          if (av === 0 && bv === 0) return 0;
          if (av === 0) return 1;
          if (bv === 0) return -1;
          return sortConfig.dir === 'desc' ? bv - av : av - bv;
        }
        const av = (a[sortConfig.key] as number) || 0;
        const bv = (b[sortConfig.key] as number) || 0;
        return sortConfig.dir === 'desc' ? bv - av : av - bv;
      });
    }
    return list;
  }, [raw, searchTerm, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);

  const pageUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage]);

  const pageUids = useMemo(() => pageUsers.map(u => u.user_id), [pageUsers]);

  // ── 5. Firebase enrichment (current page only) ────────────────────────────
  const { profileMap, isLoading: isEnriching } = useEnrichedProfiles(pageUids);

  // ── 6. Merge API + Firebase ────────────────────────────────────────────────
  const rows = useMemo(() =>
    pageUsers.map(u => ({
      ...u,
      displayName: profileMap.get(u.user_id)?.name ?? null,
      avatar:      profileMap.get(u.user_id)?.avatar ?? null,
      country:     profileMap.get(u.user_id)?.country ?? null,
      cleanUid:    u.user_id?.replace('@firebase_placeholder', ''),
    })),
    [pageUsers, profileMap]
  );

  // ── 7. Aggregated stats (full raw list) ───────────────────────────────────
  const { totalTokens, totalReqs, avgTokens, proUsers } = useMemo(() => ({
    totalTokens: raw.reduce((a, u) => a + (u.total_tokens_used   || 0), 0),
    totalReqs:   raw.reduce((a, u) => a + (u.total_api_requests  || 0), 0),
    avgTokens:   raw.length ? Math.round(raw.reduce((a, u) => a + (u.total_tokens_used || 0), 0) / raw.length) : 0,
    proUsers:    raw.filter(u => u.tier?.toLowerCase() === 'pro').length,
  }), [raw]);

  // ── 8. Sort handler (three-state cycle) ───────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc')       return { key, dir: 'asc'  };
      return null;
    });
    setCurrentPage(1);
  }, []);

  const sortIcon = useCallback((key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortConfig.dir === 'desc'
      ? <ArrowDown size={12} color="#D4AF37" />
      : <ArrowUp   size={12} color="#D4AF37" />;
  }, [sortConfig]);

  const handleSearch  = useCallback((v: string) => { setSearchInput(v); setCurrentPage(1); }, []);
  const handleRefetch = useCallback(() => refetch(), [refetch]);

  const isInitial = isLoadingUsage && raw.length === 0;

  return (
    <div className="news-glass-archive" style={{ minHeight: '100vh', paddingBottom: 100, position: 'relative', zIndex: 1 }}>
      <style>{PAGE_CSS}</style>

      {/* Header */}
      <div className="news-command-header" style={{ marginBottom: 32 }}>
        <div>
          <h2 className="news-title-sharp">
            <Server size={22} color="#D4AF37" style={{ marginRight: 12, verticalAlign: 'text-bottom' }} />
            Platform Usage Analytics
          </h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.87rem', fontWeight: 500, marginTop: 4 }}>
            Deep dive into user activity, token consumption, and API interaction patterns across the Integri ecosystem.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <Row className="mb-4">
        {[
          { title: 'Aggregated Tokens',  value: fmt(totalTokens), icon: Cpu,       color: '#D4AF37', detail: 'Total processing units consumed' },
          { title: 'System Requests',    value: fmt(totalReqs),   icon: Zap,       color: '#2ecc71', detail: 'Successful API handshakes' },
          { title: 'Avg User Intensity', value: fmt(avgTokens),   icon: Activity,  color: '#3498db', detail: 'Tokens per user (avg)' },
          { title: 'Elite Identities',   value: proUsers,         icon: UserCheck, color: '#9b59b6', detail: 'Accounts on Pro tier' },
        ].map(c => (
          <Col key={c.title} sm={6} xl={3} className="mb-3">
            <UsageStatCard {...c} isLoading={isInitial} />
          </Col>
        ))}
      </Row>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          message="Could not load usage data. Check your connection and try again."
          onRetry={handleRefetch}
        />
      )}

      {/* Control Bar */}
      <div style={{ background: 'var(--news-glass-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 4, padding: '14px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={15} color="#D4AF37" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#e0e0e0', textTransform: 'uppercase', letterSpacing: '1px' }}>Filters</span>
        </div>

        {/* Search input */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--news-input-bg)', padding: '7px 14px', borderRadius: 4, border: '1px solid var(--news-glass-border)' }}>
          <Search size={14} color="var(--news-text-muted)" />
          <input
            type="text"
            placeholder="Search by email or user ID…"
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--news-text-main)', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        {/* Plan filter — mutually exclusive with Country */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--news-input-bg)', padding: '5px 12px', borderRadius: 4, border: `1px solid ${userType !== 'all' ? '#D4AF37' : 'var(--news-glass-border)'}` }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--news-text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Plan</span>
          <select
            className="pu-select"
            value={userType}
            onChange={e => {
              setUserType(e.target.value);
              setCountryFilter('');
              setCurrentPage(1);
            }}
          >
            <option value="all">All Plans</option>
            <option value="freemium">Freemium</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        {/* Country filter dropdown (from API) — mutually exclusive with Plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--news-input-bg)', padding: '5px 12px', borderRadius: 4, border: `1px solid ${countryFilter ? '#D4AF37' : 'var(--news-glass-border)'}` }}>
          <Globe size={13} color={countryFilter ? '#D4AF37' : 'var(--news-text-dim)'} />
          <span style={{ fontSize: '0.62rem', color: 'var(--news-text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Country</span>
          <select
            className="pu-select"
            value={countryFilter}
            onChange={e => {
              setCountryFilter(e.target.value);
              setUserType('all');
              setCurrentPage(1);
            }}
          >
            <option value="">All Countries</option>
            {countryList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Limit input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--news-input-bg)', padding: '5px 12px', borderRadius: 4, border: '1px solid var(--news-glass-border)' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--news-text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Limit</span>
          <input
            className="limit-input"
            type="number"
            min={LIMIT_MIN}
            max={LIMIT_MAX}
            value={limitInput}
            onChange={e => setLimitInput(e.target.value)}
            onBlur={commitLimit}
            onKeyDown={e => e.key === 'Enter' && commitLimit()}
            style={{ width: 52, background: 'transparent', border: 'none', color: '#D4AF37', fontWeight: 800, fontSize: '0.85rem', outline: 'none', textAlign: 'center' }}
          />
          <span style={{ fontSize: '0.58rem', color: 'var(--news-text-dim)', whiteSpace: 'nowrap' }}>1–200</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefetch}
          disabled={isRefetching}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', color: '#D4AF37', padding: '7px 16px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.8px' }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.2)')}
          onMouseOut={e  => (e.currentTarget.style.background = 'rgba(212,175,55,0.1)')}
        >
          <RefreshCw size={13} className={isRefetching ? 'spin-anim' : ''} />
          {isRefetching ? 'SYNCING…' : 'REFRESH'}
        </button>

        {!isLoadingUsage && (
          <span style={{ fontSize: '0.68rem', color: 'var(--news-text-dim)', fontWeight: 700, marginLeft: 'auto' }}>
            {sorted.length} / {raw.length} USERS
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.05rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
          <Database size={17} color="#D4AF37" /> Global Usage Ledger
          {isRefetching && <span style={{ fontSize: '0.62rem', color: 'var(--news-text-dim)', marginLeft: 6 }}>SYNCING…</span>}
        </h3>

        <div style={{ background: 'var(--news-glass-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 4, overflow: 'hidden', boxShadow: 'var(--news-card-shadow)' }}>
          <div className="table-responsive">
            <table className="table table-hover mb-0" style={{ borderCollapse: 'collapse', minWidth: 680 }}>
              <thead style={{ background: 'var(--news-table-header-bg)', borderBottom: '2px solid var(--news-glass-border)' }}>
                <tr>
                  <th className="th-plain" style={{ width: 44, paddingRight: 0 }}>#</th>
                  <th className="th-plain">Identity</th>
                  <th className="th-sort" onClick={() => handleSort('tier')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>Tier {sortIcon('tier')}</div>
                  </th>
                  <th className="th-sort" style={{ textAlign: 'right' }} onClick={() => handleSort('total_tokens_used')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>Tokens {sortIcon('total_tokens_used')}</div>
                  </th>
                  <th className="th-sort" style={{ textAlign: 'right' }} onClick={() => handleSort('total_api_requests')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>Requests {sortIcon('total_api_requests')}</div>
                  </th>
                  <th className="th-plain col-joined" style={{ textAlign: 'right' }}>Joined</th>
                  <th className="th-plain" style={{ textAlign: 'center' }}>Origin</th>
                </tr>
              </thead>
              <tbody>
                {isInitial ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
                      <td colSpan={7} style={{ padding: '14px 20px' }}>
                        <div className="nv-skeleton" style={{ height: 40 }} />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--news-text-dim)', fontStyle: 'italic' }}>
                      <AlertTriangle size={18} style={{ marginRight: 8, opacity: 0.5, verticalAlign: 'middle' }} />
                      No usage data found for this query.
                    </td>
                  </tr>
                ) : (
                  rows.map((u, idx) => {
                    const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const ts = tierBadgeStyle(u.tier);
                    return (
                      <tr
                        key={u.user_id}
                        style={{ borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', fontSize: '0.88rem', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--news-table-header-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => navigate(`/users/${u.user_id}`)}
                      >
                        {/* Row number */}
                        <td style={{ padding: '14px 8px 14px 20px', color: 'var(--news-text-dim)', fontSize: '0.72rem', fontWeight: 700 }}>
                          {rowNum}
                        </td>

                        {/* Identity */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {isEnriching
                              ? <span className="id-skel" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                              : u.avatar
                                ? <img src={u.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #D4AF37', objectFit: 'cover', flexShrink: 0 }} />
                                : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <UserIcon size={15} color="#D4AF37" />
                                  </div>
                            }
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              {isEnriching
                                ? <span className="id-skel" style={{ width: 110, height: 14, marginBottom: 5 }} />
                                : <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.displayName || 'Guest'}
                                  </span>
                              }
                              <span style={{ fontSize: '0.7rem', color: 'var(--news-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.email}
                              </span>
                              <code className="col-uid" style={{ fontSize: '0.62rem', color: '#3498db', marginTop: 3, background: 'rgba(52,152,219,0.08)', padding: '2px 5px', borderRadius: 2, display: 'inline-block' }}>
                                {u.cleanUid}
                              </code>
                            </div>
                          </div>
                        </td>

                        {/* Tier badge */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ ...ts, padding: '3px 10px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', display: 'inline-block' }}>
                            {u.tier || 'Standard'}
                          </span>
                        </td>

                        {/* Tokens */}
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                            <Cpu size={13} color="#D4AF37" style={{ opacity: 0.8 }} />
                            {fmt(u.total_tokens_used)}
                          </div>
                        </td>

                        {/* Requests */}
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                            <Zap size={13} color="#2ecc71" style={{ opacity: 0.8 }} />
                            {fmt(u.total_api_requests)}
                          </div>
                        </td>

                        {/* Joined */}
                        <td className="col-joined" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--news-text-muted)', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                            <Clock size={13} style={{ opacity: 0.6 }} />
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>

                        {/* Origin flag */}
                        <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {isEnriching
                              ? <span className="id-skel" style={{ width: 26, height: 20, borderRadius: 2 }} />
                              : u.country && u.country !== 'Unknown'
                                ? <CountryFlag country={u.country} size={26} />
                                : <Globe size={18} color="var(--news-text-dim)" />
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!isInitial && totalPages > 1 && (
          <div className="usage-pg-bar">
            <button
              className="pg-btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pg-label">
              Page {safePage} of {totalPages}
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--news-text-dim)', marginTop: 2 }}>
                {sorted.length} total users
              </span>
            </span>
            <button
              className="pg-btn"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
