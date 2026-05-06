import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useQuery } from '@tanstack/react-query';

import { UserService } from 'api/backendApi';
import useUsers from 'features/users/hooks/useUsers';
import UsersMap from 'sections/dashboard/UsersMap';
import UserActivityGraph from 'features/users/components/UserActivityGraph';
import UserTable from 'features/users/components/UserTable';
import MainCard from 'components/MainCard';
import { Activity } from 'lucide-react';

const UsageOverviewTable = () => {
  const { data: usageData, isLoading, isError } = useQuery({
    queryKey: ['usersUsage'],
    queryFn: () => UserService.fetchUsersUsage(50)
  });

  if (isLoading) {
    return (
      <MainCard title="Platform Usage Overview" className="mt-4">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr style={{ background: 'rgba(212,175,55,0.05)' }}>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>User</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Tier</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Total Tokens</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Total Requests</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td colSpan="5">
                    <div className="placeholder-glow">
                      <span className="placeholder col-12 bg-secondary"></span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MainCard>
    );
  }

  if (isError || !usageData || !usageData.users) return null;

  const formatNum = (num) => (num || 0).toLocaleString();
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch(e) { return dateStr; }
  };

  return (
    <MainCard 
      title={
        <div className="d-flex align-items-center gap-2">
          <Activity size={18} color="#D4AF37" />
          <span style={{ color: '#D4AF37' }}>Platform Usage Overview</span>
        </div>
      } 
      className="mt-4" 
      bodyClassName="p-0"
    >
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead style={{ background: 'rgba(212,175,55,0.05)' }}>
            <tr>
              <th style={{ color: '#D4AF37', borderBottom: 'none', paddingLeft: '24px' }}>Email</th>
              <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Tier</th>
              <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Total Tokens</th>
              <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Total Requests</th>
              <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            {usageData.users.map((u, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s ease' }} className="hover-row">
                <td style={{ color: '#e0d5b8', borderBottom: 'none', paddingLeft: '24px' }}>{u.email}</td>
                <td style={{ borderBottom: 'none' }}>
                  <span style={{
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: u.tier === 'pro' ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.05)',
                    color: u.tier === 'pro' ? '#D4AF37' : '#a8956b',
                    border: `1px solid ${u.tier === 'pro' ? '#D4AF37' : 'rgba(255,255,255,0.2)'}`
                  }}>
                    {u.tier ? u.tier.toUpperCase() : 'UNKNOWN'}
                  </span>
                </td>
                <td style={{ color: '#e0d5b8', borderBottom: 'none', fontWeight: 600 }}>{formatNum(u.total_tokens_used)}</td>
                <td style={{ color: '#e0d5b8', borderBottom: 'none', fontWeight: 600 }}>{formatNum(u.total_api_requests)}</td>
                <td style={{ color: '#a8956b', borderBottom: 'none' }}>{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MainCard>
  );
};

// ==============================|| FEATURE: USERS — INTELLIGENCE COMMAND ||============================== //

export default function UsersPage() {
  const { 
    users, 
    filteredUsers, 
    loading, 
    globalFilter, 
    setGlobalFilter, 
    countryFilter,
    setCountryFilter,
    statusFilter,
    setStatusFilter,
    clearFilters,
    hasMore, 
    fetchNextBatch, 
    refreshUsers 
  } = useUsers();

  return (
    <Row>
      {/* Tier 1 & 2: Geo-Pulse Map and Activity Graph */}
      <Col md={12} xl={7} className="mb-4">
        {/* Reusing the dashboard's world map ui for consistency */}
        <UsersMap height={400} />
      </Col>
      <Col md={12} xl={5} className="mb-4">
        <UserActivityGraph users={users} loading={loading} />
      </Col>

      {/* Tier 3: The Archive (Shadow Table) */}
      <Col md={12}>
        <UserTable 
          users={filteredUsers} 
          loading={loading} 
          globalFilter={globalFilter} 
          setGlobalFilter={setGlobalFilter}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          clearFilters={clearFilters}
          onRefresh={refreshUsers}
          loadMore={fetchNextBatch}
          hasMore={hasMore}
        />
        <UsageOverviewTable />
      </Col>
    </Row>
  );
}
