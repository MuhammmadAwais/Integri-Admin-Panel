import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Radio, Gauge, FlaskConical, Tags, Database } from 'lucide-react';

const TABS = [
  { id: 'runs', label: 'Run Summaries', path: '/personalization/runs', icon: Radio },
  { id: 'thresholds', label: 'Tier Thresholds', path: '/personalization/thresholds', icon: Gauge },
  { id: 'calibration', label: 'Calibration', path: '/personalization/calibration', icon: FlaskConical },
  { id: 'taxonomy', label: 'Taxonomy', path: '/personalization/taxonomy', icon: Tags },
  { id: 'memory-backfill', label: 'Memory Backfill', path: '/personalization/memory-backfill', icon: Database },
];

export default function PersonalizationNavTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'rgba(212, 175, 55, 0.04)',
        border: '1px solid rgba(212, 175, 55, 0.18)',
        borderRadius: '10px',
        padding: '0.35rem',
        marginBottom: '1.75rem',
        overflowX: 'auto',
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;

        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              fontSize: '0.82rem',
              fontWeight: isActive ? 700 : 600,
              background: isActive ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
              border: isActive ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid transparent',
              color: isActive ? '#D4AF37' : '#8a8a8f',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.18s ease',
            }}
          >
            <Icon size={14} style={{ color: isActive ? '#D4AF37' : 'inherit' }} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
