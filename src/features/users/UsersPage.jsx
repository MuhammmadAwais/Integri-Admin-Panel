import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import useUsers from './hooks/useUsers';
import UserMap from './components/UserMap';
import UserActivityGraph from './components/UserActivityGraph';
import UserTable from './components/UserTable';

// ==============================|| FEATURE: USERS — INTELLIGENCE COMMAND ||============================== //

export default function UsersPage() {
  const { users, filteredUsers, loading, globalFilter, setGlobalFilter } = useUsers();

  return (
    <Row>
      {/* Tier 1 & 2: Geo-Pulse Map and Activity Graph */}
      <Col md={12} xl={7} className="mb-4">
        <UserMap 
          users={users} 
          globalFilter={globalFilter} 
          setGlobalFilter={setGlobalFilter} 
        />
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
        />
      </Col>
    </Row>
  );
}
