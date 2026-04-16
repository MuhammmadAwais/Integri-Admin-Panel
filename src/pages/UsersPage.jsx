import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import useUsers from 'features/users/hooks/useUsers';
import UsersMap from 'sections/dashboard/UsersMap';
import UserActivityGraph from 'features/users/components/UserActivityGraph';
import UserTable from 'features/users/components/UserTable';
import ParticleBackground from 'components/ParticleBackground';

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
       <ParticleBackground />
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
      <ParticleBackground />
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
      </Col>
    </Row>
  );
}
