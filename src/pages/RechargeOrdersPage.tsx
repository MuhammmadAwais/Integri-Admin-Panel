import React, { useState, useEffect } from 'react';
import { 
  RechargeOrdersService, 
  type RechargeOrder, 
  type RechargeMetrics,
  type RechargeOrderState
} from 'api/backendApi';
import CountryFlag from 'components/CountryFlag';
import RechargeOrderDetailDrawer from 'components/RechargeOrderDetailDrawer';
import { 
  Search, 
  RotateCcw, 
  Copy, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useSelector } from 'react-redux';
import './recharge-orders.scss';

export default function RechargeOrdersPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [metrics, setMetrics] = useState<RechargeMetrics>({
    gross_revenue_eur: 0,
    delivered_orders_count: 0,
    total_paid_orders_count: 0,
    needs_review_count: 0,
    stuck_refunds_count: 0,
    stripe_min_failure_count: 0,
    ding_cost_total_eur: 0
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'review' | 'summary'>('all');
  const [selectedOrder, setSelectedOrder] = useState<RechargeOrder | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<RechargeOrderState | 'all'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, metricsData] = await Promise.all([
        RechargeOrdersService.fetchOrders({
          state: activeTab === 'review' ? 'all' : stateFilter,
          needs_review_only: activeTab === 'review',
          search: searchQuery,
          order_by: 'paid_at'
        }),
        RechargeOrdersService.fetchMetrics()
      ]);

      setOrders(ordersData.orders);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, stateFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const handleRowClick = (order: RechargeOrder) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  };

  const formatStatus = (state: string) => {
    switch (state) {
      case 'delivered': return 'Delivered';
      case 'paid': return 'Paid';
      case 'submitting': return 'Submitting';
      case 'submitted': return 'In Progress';
      case 'failed': return 'Failed';
      case 'refunded': return 'Refunded';
      case 'created': return 'Checkout Started';
      case 'expired': return 'Expired';
      default: return state;
    }
  };

  const successPercentage = metrics.total_paid_orders_count > 0 
    ? Math.round((metrics.delivered_orders_count / metrics.total_paid_orders_count) * 100) 
    : 100;

  return (
    <div className={`recharge-orders-page ${isDark ? 'dark-theme' : 'light-theme'}`}>
      {/* Header */}
      <div className="page-header">
        <div className="title-group">
          <h1>Mobile Top-Up Orders</h1>
          <p>View phone recharge purchases, operator delivery status, and payment records.</p>
        </div>

        <button 
          type="button" 
          className="btn-refresh" 
          onClick={loadData}
          disabled={loading}
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* System Notice */}
      <div className="system-notice">
        <AlertCircle size={15} />
        <span>Top-up orders are processed automatically by the system and cannot be edited manually.</span>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Delivered Revenue</div>
          <div className="metric-value">€{metrics.gross_revenue_eur.toFixed(2)}</div>
          <div className="metric-hint">Settled customer payments</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Fulfilled Orders</div>
          <div className="metric-value">{metrics.delivered_orders_count}</div>
          <div className="metric-hint">{successPercentage}% success rate</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Requires Review</div>
          <div className={`metric-value ${metrics.needs_review_count > 0 ? 'text-alert' : ''}`}>
            {metrics.needs_review_count}
          </div>
          <div className="metric-hint">Orders needing staff attention</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Below Minimum Charge</div>
          <div className="metric-value">{metrics.stripe_min_failure_count}</div>
          <div className="metric-hint">Rejected under €0.50 minimum</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        <button 
          type="button" 
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Orders
        </button>

        <button 
          type="button" 
          className={`tab-item ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          Needs Review
          {metrics.needs_review_count > 0 && (
            <span className="badge-count">{metrics.needs_review_count}</span>
          )}
        </button>

        <button 
          type="button" 
          className={`tab-item ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Financial Summary
        </button>
      </div>

      {/* Tab 1 & 2: Table */}
      {activeTab !== 'summary' ? (
        <>
          {/* Filters Bar */}
          <div className="table-controls">
            <form onSubmit={handleSearchSubmit} className="search-input">
              <Search size={15} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Search by Order ID, User ID, or Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            {activeTab === 'all' && (
              <div className="filters-group">
                <select 
                  value={stateFilter} 
                  onChange={(e) => setStateFilter(e.target.value as any)}
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="paid">Paid</option>
                  <option value="submitted">In Progress</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>User ID</th>
                  <th>Operator &amp; Plan</th>
                  <th>Recipient Phone</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <Loader2 size={24} className="animate-spin text-muted" />
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr 
                      key={o.orderId}
                      className={o.needs_review ? 'row-flagged' : ''}
                      onClick={() => handleRowClick(o)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Order ID */}
                      <td>
                        <div className="order-id-cell">
                          <code>{o.orderId.substring(0, 10)}...</code>
                          <button 
                            type="button" 
                            className="btn-copy"
                            onClick={(e) => handleCopyId(e, o.orderId)}
                            title="Copy Order ID"
                          >
                            {copiedOrderId === o.orderId ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* User ID */}
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>
                          {o.uid.substring(0, 10)}...
                        </span>
                      </td>

                      {/* Operator & Plan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                          <CountryFlag country={o.country_iso} size={15} />
                          <span>{o.provider_code}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{o.title}</div>
                      </td>

                      {/* Phone */}
                      <td>
                        <span style={{ fontFamily: 'monospace' }}>{o.masked_phone}</span>
                      </td>

                      {/* Amount */}
                      <td>
                        <span style={{ fontWeight: 600 }}>€{o.total_eur.toFixed(2)}</span>
                        <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                          {o.receive_value} {o.receive_currency}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill ${o.state}`}>
                          {formatStatus(o.state)}
                        </span>
                        {o.needs_review && (
                          <span className="pill-review">Action Needed</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                        {o.paid_at ? new Date(o.paid_at).toLocaleDateString() : 'Unpaid'}
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          type="button" 
                          className="btn-details"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(o);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Tab 3: Financial Summary */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="table-wrapper" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Revenue Breakdown</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280' }}>Customer Payments (Delivered):</span>
              <span style={{ fontWeight: 600 }}>€{metrics.gross_revenue_eur.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280' }}>Operator Wholesale Cost (Ding):</span>
              <span style={{ fontWeight: 600, color: '#dc2626' }}>€{metrics.ding_cost_total_eur.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
              <span style={{ color: '#6b7280' }}>Integri Service Fee:</span>
              <span style={{ fontWeight: 600 }}>€0.00</span>
            </div>
          </div>

          <div className="table-wrapper" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Reconciliation Details</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
              Order records tie directly to external providers using the Order ID.
              Search in Stripe by matching the <strong>order_id</strong> metadata field, or in DingConnect by looking up the <strong>DistributorRef</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <RechargeOrderDetailDrawer 
        order={selectedOrder}
        isOpen={isDrawerOpen}
        isDark={isDark}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
