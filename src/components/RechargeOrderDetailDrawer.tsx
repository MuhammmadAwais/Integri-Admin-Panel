import React, { useState } from 'react';
import { 
  type RechargeOrder, 
  RechargeOrdersService 
} from 'api/backendApi';
import CountryFlag from './CountryFlag';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle,
  Eye,
  Info
} from 'lucide-react';

interface DrawerProps {
  order: RechargeOrder | null;
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export default function RechargeOrderDetailDrawer({ order, isOpen, onClose, isDark = true }: DrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [unmaskedMsisdn, setUnmaskedMsisdn] = useState<string | null>(null);
  const [revealingPhone, setRevealingPhone] = useState<boolean>(false);
  const [showRevealModal, setShowRevealModal] = useState<boolean>(false);
  const [revealReason, setRevealReason] = useState<string>('');

  if (!isOpen || !order) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConfirmReveal = async () => {
    try {
      setRevealingPhone(true);
      const res = await RechargeOrdersService.revealPhoneNumber(order.orderId, revealReason || 'Customer support verification');
      setUnmaskedMsisdn(res.msisdn);
      setShowRevealModal(false);
    } catch (err) {
      console.error('Failed to reveal phone:', err);
    } finally {
      setRevealingPhone(false);
    }
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

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />

      <div className={`drawer-panel ${isDark ? 'dark-theme' : 'light-theme'}`}>
        {/* Drawer Header */}
        <div className="drawer-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className={`status-pill ${order.state}`}>
                {formatStatus(order.state)}
              </span>
              {order.needs_review && (
                <span className="pill-review">Action Needed</span>
              )}
            </div>
            <h3>Order Details</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="drawer-content">
          
          {/* Order ID Section */}
          <div className="drawer-section">
            <div className="section-heading">Order Reference ID</div>
            <div className="info-list">
              <div className="info-row">
                <span className="label">Order ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <code style={{ fontSize: '0.85rem' }}>{order.orderId}</code>
                  <button 
                    type="button" 
                    className="btn-unmask"
                    onClick={() => handleCopy(order.orderId, 'orderId')}
                  >
                    {copiedKey === 'orderId' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.4rem' }}>
              Matches <code>order_id</code> in Stripe and <code>DistributorRef</code> in DingConnect.
            </div>
          </div>

          {/* Customer & Product Section */}
          <div className="drawer-section">
            <div className="section-heading">Product &amp; Recipient</div>
            <div className="info-list">
              <div className="info-row">
                <span className="label">Customer User ID:</span>
                <span className="value">
                  <code>{order.uid}</code>
                </span>
              </div>

              <div className="info-row">
                <span className="label">Country / Operator:</span>
                <span className="value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CountryFlag country={order.country_iso} size={16} />
                  <span>{order.provider_code}</span>
                </span>
              </div>

              <div className="info-row">
                <span className="label">Package Plan:</span>
                <span className="value">{order.title}</span>
              </div>

              <div className="info-row">
                <span className="label">Recipient Phone:</span>
                <div className="value" style={{ display: 'flex', alignItems: 'center' }}>
                  <span>{unmaskedMsisdn ? `+${unmaskedMsisdn}` : order.masked_phone}</span>
                  {!unmaskedMsisdn && (
                    <button 
                      type="button" 
                      className="btn-unmask"
                      onClick={() => setShowRevealModal(true)}
                    >
                      Reveal
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Fees Section */}
          <div className="drawer-section">
            <div className="section-heading">Financial Details</div>
            <div className="info-list">
              <div className="info-row highlight-row">
                <span className="label">Customer Charged:</span>
                <span className="value" style={{ color: '#2563eb' }}>€{order.total_eur.toFixed(2)} EUR</span>
              </div>

              <div className="info-row">
                <span className="label">Airtime Wholesale Value:</span>
                <span className="value">€{order.send_value_eur.toFixed(2)}</span>
              </div>

              <div className="info-row">
                <span className="label">Ding Operator Fee:</span>
                <span className="value">€{(order.ding_fee_eur ?? 0).toFixed(2)}</span>
              </div>

              <div className="info-row">
                <span className="label">Recipient Receives:</span>
                <span className="value" style={{ color: '#16a34a', fontWeight: 600 }}>
                  {order.receive_value} {order.receive_currency}
                </span>
              </div>
            </div>
          </div>

          {/* External Links Section */}
          <div className="drawer-section">
            <div className="section-heading">External Records</div>
            <div className="info-list">
              <div className="info-row">
                <span className="label">Stripe Payment:</span>
                <div className="value">
                  {order.stripe_payment_intent_id ? (
                    <a 
                      href={`https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-btn"
                    >
                      View in Stripe <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>None</span>
                  )}
                </div>
              </div>

              <div className="info-row">
                <span className="label">Ding Transfer Ref:</span>
                <span className="value">
                  {order.ding_transfer_ref ? (
                    <code>{order.ding_transfer_ref}</code>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>Pending</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Error / Refund Notes (If applicable) */}
          {(order.error || order.refund_status || order.last_error) && (
            <div className="drawer-section">
              <div className="section-heading" style={{ color: '#dc2626' }}>Issues &amp; Diagnostics</div>
              <div className="info-list">
                {order.error && (
                  <div className="info-row">
                    <span className="label">Error Code:</span>
                    <span className="value" style={{ color: '#dc2626' }}>{order.error}</span>
                  </div>
                )}
                {order.refund_status && (
                  <div className="info-row">
                    <span className="label">Refund Status:</span>
                    <span className="value">{order.refund_status}</span>
                  </div>
                )}
              </div>
              {order.last_error && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px', fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.4 }}>
                  {order.last_error}
                </div>
              )}
            </div>
          )}

          {/* Timeline Section */}
          <div className="drawer-section">
            <div className="section-heading">Timeline</div>
            <div className="info-list">
              <div className="info-row">
                <span className="label">Order Created:</span>
                <span className="value">{new Date(order.created_at).toLocaleString()}</span>
              </div>
              {order.paid_at && (
                <div className="info-row">
                  <span className="label">Payment Confirmed:</span>
                  <span className="value">{new Date(order.paid_at).toLocaleString()}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="info-row">
                  <span className="label">Delivered:</span>
                  <span className="value">{new Date(order.delivered_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Reveal Modal */}
      {showRevealModal && (
        <div className="modal-backdrop-custom">
          <div className="modal-card-custom" style={{ background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb' }}>
            <h5 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Confirm Phone Number Reveal</h5>
            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>
              Recipient phone numbers are protected personal data. Revealing this number is recorded in the system audit logs.
            </p>
            <input 
              type="text" 
              placeholder="Reason for unmasking (e.g. support inquiry)"
              value={revealReason}
              onChange={(e) => setRevealReason(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-unmask"
                onClick={() => setShowRevealModal(false)}
                disabled={revealingPhone}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-details"
                style={{ background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' }}
                onClick={handleConfirmReveal}
                disabled={revealingPhone}
              >
                {revealingPhone ? 'Revealing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
