import React, { useState, useMemo } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UserService, UserUsageRecord } from 'api/backendApi';
import useUsers from 'features/users/hooks/useUsers';
import { 
  Activity, Cpu, Database, Server, Zap, Globe, 
  Clock, UserCheck, LucideIcon, Search, 
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
   RefreshCw, User as UserIcon
} from 'lucide-react';
import CountryFlag from 'components/CountryFlag';
import 'features/news/styles/news.scss';

// --- Helper for number formatting ---
const formatNum = (num: number): string => (num || 0).toLocaleString();

// --- Types for Props ---
interface UsageStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  detail?: string;
  isLoading?: boolean;
}

// --- Stat Card Component ---
const UsageStatCard: React.FC<UsageStatCardProps> = ({ title, value, icon: Icon, color, detail, isLoading }) => (
  <div className="country-card" style={{ padding: '24px' }}>
    {isLoading ? (
      <div className="nv-skeleton" style={{ height: 80 }} />
    ) : (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'var(--news-text-dim)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>{title}</p>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--news-text-main)', margin: 0 }}>{value}</h3>
          </div>
          <div style={{ background: `${color}15`, padding: '10px', borderRadius: '8px', border: `1px solid ${color}30` }}>
            <Icon size={20} color={color} />
          </div>
        </div>
        {detail && (
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--news-text-muted)', fontWeight: 500 }}>
            {detail}
          </div>
        )}
      </>
    )}
  </div>
);

export default function PlatformUsagePage() {
  const navigate = useNavigate();
  const [limitParam, setLimitParam] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserUsageRecord | 'displayName'; direction: 'asc' | 'desc' } | null>(null);

  // 1. Fetch usage data from Backend
  const { data: usageData, isLoading: isLoadingUsage, isRefetching, refetch } = useQuery({
    queryKey: ['usersUsageFull', limitParam],
    queryFn: () => UserService.fetchUsersUsage(limitParam)
  });

  // 2. Fetch user details from Firebase for enrichment
  const { users: firebaseUsers, loading: isLoadingFirebase } = useUsers();

  // 3. Create enrichment map
  const usersDetailMap = useMemo(() => {
    const map = new Map();
    firebaseUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [firebaseUsers]);

  const rawUsageUsers: UserUsageRecord[] = usageData?.users || [];

  // 4. Filter & Sort Logic
  const processedUsers = useMemo(() => {
    let result = rawUsageUsers.map(u => {
      const fbUser = usersDetailMap.get(u.user_id);
      return {
        ...u,
        displayName: fbUser?.name || 'Guest',
        avatar: fbUser?.avatar || null,
        country: fbUser?.country || (u as any).country || 'Unknown',
        cleanUserId: u.user_id?.replace('@firebase.placeholder', '')
      };
    });

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.email.toLowerCase().includes(q) || 
        u.displayName.toLowerCase().includes(q) || 
        u.user_id.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawUsageUsers, usersDetailMap, searchTerm, sortConfig]);

  // Aggregate stats from raw data
  const totalTokens = rawUsageUsers.reduce((acc, u) => acc + (u.total_tokens_used || 0), 0);
  const totalRequests = rawUsageUsers.reduce((acc, u) => acc + (u.total_api_requests || 0), 0);
  const avgTokens = rawUsageUsers.length ? Math.round(totalTokens / rawUsageUsers.length) : 0;
  const proUsers = rawUsageUsers.filter(u => u.tier?.toLowerCase() === 'pro').length;

  const handleSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: any) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} color="#D4AF37" /> : <ArrowDown size={14} color="#D4AF37" />;
  };

  const isGlobalLoading = isLoadingUsage || isLoadingFirebase || isRefetching;

  return (
    <div className="news-glass-archive" style={{ minHeight: '100vh', paddingBottom: 100 }}>
      {/* Page Header */}
      <div className="news-command-header" style={{ marginBottom: 32 }}>
        <div>
          <h2 className="news-title-sharp">
            <Server size={24} color="#D4AF37" style={{ marginRight: 12, verticalAlign: 'text-bottom' }} /> 
            Platform Usage Analytics
          </h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.88rem', fontWeight: 500, marginTop: 4 }}>
            Deep dive into user activity, token consumption, and API interaction patterns across the Integri ecosystem.
          </p>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <Row className="mb-4">
        <Col sm={6} xl={3} className="mb-3">
          <UsageStatCard title="Aggregated Tokens" value={formatNum(totalTokens)} icon={Cpu} color="#D4AF37" detail="Total intelligence processing units consumed" isLoading={isGlobalLoading && rawUsageUsers.length === 0} />
        </Col>
        <Col sm={6} xl={3} className="mb-3">
          <UsageStatCard title="System Requests" value={formatNum(totalRequests)} icon={Zap} color="#2ecc71" detail="Successful API handshakes across all sectors" isLoading={isGlobalLoading && rawUsageUsers.length === 0} />
        </Col>
        <Col sm={6} xl={3} className="mb-3">
          <UsageStatCard title="Avg User Intensity" value={formatNum(avgTokens)} icon={Activity} color="#3498db" detail="Tokens processed per individual identity" isLoading={isGlobalLoading && rawUsageUsers.length === 0} />
        </Col>
        <Col sm={6} xl={3} className="mb-3">
          <UsageStatCard title="Elite Identities" value={proUsers} icon={UserCheck} color="#9b59b6" detail="Number of accounts on Enterprise/Pro tier" isLoading={isGlobalLoading && rawUsageUsers.length === 0} />
        </Col>
      </Row>

      {/* Control Panel: Parameters & Search */}
      <div style={{ background: 'var(--news-glass-bg)', border: '1px solid var(--news-glass-border)', borderRadius: 4, padding: '20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={16} color="#D4AF37" />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e0e0e0', textTransform: 'uppercase', letterSpacing: '1px' }}>Config</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--news-input-bg)', padding: '6px 12px', borderRadius: 4, border: '1px solid var(--news-glass-border)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--news-text-muted)', fontWeight: 700 }}>LIMIT:</span>
          <input 
            type="number" 
            value={limitParam} 
            onChange={(e) => setLimitParam(parseInt(e.target.value) || 50)}
            style={{ width: 60, background: 'transparent', border: 'none', color: '#D4AF37', fontWeight: 800, outline: 'none', textAlign: 'center' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--news-input-bg)', padding: '6px 16px', borderRadius: 4, border: '1px solid var(--news-glass-border)' }}>
          <Search size={16} color="var(--news-text-muted)" />
          <input 
            type="text" 
            placeholder="Search Identity, Email, or Hash..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--news-text-main)', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        <button 
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', color: '#D4AF37', padding: '6px 16px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
          disabled={isRefetching}
        >
          <RefreshCw size={14} className={isRefetching ? 'spin-anim' : ''} /> {isRefetching ? 'SYNCING...' : 'EXECUTE FETCH'}
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-anim { animation: spin 1s linear infinite; }
      `}</style>

      {/* Detailed Usage Table */}
      <div style={{ marginBottom: 48 }}>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.15rem', fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
          <Database size={20} color="#D4AF37" /> Global Usage Ledger
        </h3>
        
        <div style={{ background: 'var(--news-glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--news-glass-border)', borderRadius: 4, overflow: 'hidden', boxShadow: 'var(--news-card-shadow)' }}>
          <div className="table-responsive">
            <table className="table table-hover mb-0" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--news-table-header-bg)', borderBottom: '1px solid var(--news-glass-border)', color: '#ffffff', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                <tr>
                  <th style={{ padding: '16px 24px', fontWeight: 900, cursor: 'pointer' }} onClick={() => handleSort('displayName')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Identity {getSortIcon('displayName')}</div>
                  </th>
                  <th style={{ padding: '16px 24px', fontWeight: 900, cursor: 'pointer' }} onClick={() => handleSort('tier')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Tier Status {getSortIcon('tier')}</div>
                  </th>
                  <th style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('total_tokens_used')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>Total Tokens {getSortIcon('total_tokens_used')}</div>
                  </th>
                  <th style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('total_api_requests')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>API Requests {getSortIcon('total_api_requests')}</div>
                  </th>
                  <th style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>Joined {getSortIcon('created_at')}</div>
                  </th>
                  <th style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'center' }}>Origin</th>
                </tr>
              </thead>
              <tbody>
                {isGlobalLoading && processedUsers.length === 0 ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
                      <td colSpan={6} style={{ padding: '16px 24px' }}><div className="nv-skeleton" style={{ height: 44 }} /></td>
                    </tr>
                  ))
                ) : processedUsers.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--news-text-dim)', fontStyle: 'italic' }}>No usage data has been logged in the current sector.</td></tr>
                ) : (
                  processedUsers.map((u, idx) => (
                    <tr 
                      key={idx} 
                      style={{ borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', fontSize: '0.9rem', transition: 'all 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--news-table-header-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => navigate(`/users/${u.user_id}`)}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {u.avatar ? (
                            <img src={u.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #D4AF37', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <UserIcon size={16} color="#D4AF37" />
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: '0.95rem' }}>{u.displayName}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--news-text-muted)', marginTop: 2 }}>{u.email}</span>
                            <code style={{ fontSize: '0.65rem', color: '#3498db', marginTop: 3, background: 'rgba(52,152,219,0.08)', padding: '2px 6px', borderRadius: 2 }}>{u.cleanUserId}</code>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          padding: '4px 12px', 
                          borderRadius: '4px', 
                          fontSize: '0.65rem', 
                          fontWeight: 900,
                          backgroundColor: u.tier?.toLowerCase() === 'pro' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                          color: u.tier?.toLowerCase() === 'pro' ? '#D4AF37' : '#a0a0a0',
                          border: `1px solid ${u.tier?.toLowerCase() === 'pro' ? '#D4AF37' : 'var(--news-glass-border)'}`,
                          textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}>
                          {u.tier || 'STANDARD'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <Cpu size={14} color="#D4AF37" style={{ opacity: 0.8 }} />
                          {formatNum(u.total_tokens_used)}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <Zap size={14} color="#2ecc71" style={{ opacity: 0.8 }} />
                          {formatNum(u.total_api_requests)}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--news-text-muted)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <Clock size={14} style={{ opacity: 0.7 }} />
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                           {u.country ? <CountryFlag country={u.country} size={26} /> : <Globe size={20} color="var(--news-text-dim)" />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
