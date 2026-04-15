import { useEffect } from 'react';
import { gsap } from 'gsap';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { TrendingUp, Users, Coins, Activity, Award, MapPin } from 'lucide-react';
import useBusinessIntelligence from 'hooks/useBusinessIntelligence';

// feature-based imports
import KpiCard from 'features/dashboard/components/KpiCard';

// sections (retained from template — EarningChart, UsersMap, RatingCard, RecentUsersCard)
import { UsersMap, EarningChart, RatingCard, RecentUsersCard } from 'sections/dashboard/default';

// ==============================|| INTEGRI APP — DASHBOARD PAGE ||============================== //

/**
 * Stat indicator data — lightweight replacements for static numbers below the chart.
 */
const statData = [
  { icon: Award,  value: '235', label: 'TOTAL SIGNALS' },
  { icon: MapPin, value: '26',  label: 'ACTIVE REGIONS' }
];

// ================================|| DASHBOARD - DEFAULT ||============================== //

export default function DefaultPage() {
  const { stats, loading: analyticsLoading } = useBusinessIntelligence();

  /**
   * Dynamic KPI generation bridging the analytics pipeline.
   */
  const dynamicKpiData = [
    {
      title:  'Monthly Revenue',
      value:  stats.monthlyRevenue,
      prefix: '$',
      icon:   TrendingUp,
      trend:  `+${((stats.monthlyRevenue - 24500) / 24500 * 100).toFixed(1)}%` // mocked trend
    },
    {
      title:  'Active Users (AAU)',
      value:  stats.activeUsers,
      icon:   Users,
      trend:  '+12.5%'
    },
    {
      title:  'Conversion Rate',
      value:  stats.conversionRate,
      suffix: '%',
      icon:   Coins,
      trend:  '+3.7%'
    }
  ];

  // ── GSAP cross-card stagger orchestration ──
  // After all cards mount, target every [data-gsap-card] and stagger the
  // slide-up. The individual MainCard useEffect handles solo sub-page entrances;
  // this context overrides with a cohesive stagger across the full dashboard grid.
  useEffect(() => {
    const cards = document.querySelectorAll('[data-gsap-card]');
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,          // 80ms delay between each card
        clearProps: 'transform,opacity'
      }
    );
  }, []);

  return (
    <Row>
      {/* ── ROW 1: KPI Cards ── */}
      {dynamicKpiData.map((kpi, index) => (
        <Col key={index} md={6} xl={4}>
          <div style={{ background: 'var(--kpi-bg)', border: '2px solid var(--kpi-border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
             <KpiCard {...kpi} />
          </div>
        </Col>
      ))}

      {/* ── ROW 2: Map + Chart + Stats ── */}
      <Col md={6} xl={8}>
        <UsersMap />
      </Col>
      <Col md={6} xl={4}>
        <>
          <EarningChart />

          {/* Stat indicators — theme-aware */}
          <div className="card" data-gsap-card style={{ background: 'var(--kpi-bg)', border: '2px solid var(--kpi-border)' }}>
            <div className="card-body">
              {statData.map(({ icon: Icon, value, label }) => (
                <div key={label} className="d-flex align-items-center gap-3 mb-3">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'var(--kpi-icon-bg)',
                      border: '1px solid var(--kpi-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--kpi-icon-color)',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h6 style={{ color: 'var(--kpi-value-color)', marginBottom: 0, fontWeight: 700 }}>{value}</h6>
                    <small style={{ color: 'var(--kpi-title-color)', fontSize: '0.7rem', opacity: 0.8, letterSpacing: '0.06em' }}>{label}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      </Col>

      {/* ── ROW 3: Social Performance ── */}
      {[
        { platform: 'Facebook', icon: Activity, color: 'var(--kpi-icon-color)', count: '12,281', pct: '+7.2%' },
        { platform: 'Twitter',  icon: Activity, color: '#DC143C', count: '11,200', pct: '+6.2%' },
        { platform: 'Google',   icon: Activity, color: 'var(--kpi-title-color)', count: '10,500', pct: '+5.9%' }
      ].map(({ platform, icon: Icon, color, count, pct }, i) => (
        <Col key={platform} md={i === 0 ? 12 : 6} xl={4}>
          <div className="card" data-gsap-card style={{ background: 'var(--kpi-bg)', border: '2px solid var(--kpi-border)' }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <Icon size={20} style={{ color }} strokeWidth={1.75} />
                  <span style={{ color: 'var(--kpi-value-color)', fontWeight: 600 }}>{platform}</span>
                </div>
                <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>{pct}</span>
              </div>
              <h4 style={{ color: 'var(--kpi-value-color)', fontWeight: 700, marginTop: 12 }}>
                {count}
                <small style={{ color: 'var(--kpi-title-color)', opacity: 0.8, fontSize: '0.75rem', fontWeight: 400, marginLeft: 6 }}>Total Likes</small>
              </h4>
              <div style={{ height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`, marginTop: 8 }} />
            </div>
          </div>
        </Col>
      ))}

      {/* ── ROW 4: Rating + Recent Users ── */}
      <Col md={6} xl={4}>
        <RatingCard />
      </Col>
      <Col md={6} xl={8}>
        <RecentUsersCard />
      </Col>
    </Row>
  );
}
