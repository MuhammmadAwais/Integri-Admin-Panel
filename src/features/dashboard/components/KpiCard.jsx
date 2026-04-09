import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// styles
import './KpiCard.scss';

// ==============================|| FEATURE: DASHBOARD — KPI CARD ||============================== //

/**
 * KpiCard — Imperial Obsidian metric card with GSAP countUp animation.
 *
 * @param {string}   title      - Metric label (e.g. "Daily Revenue")
 * @param {number}   value      - Target numeric value for the count-up
 * @param {string}   prefix     - Optional prefix symbol (e.g. "$", "₮")
 * @param {string}   suffix     - Optional suffix (e.g. "%", "K")
 * @param {Function} icon       - Lucide-react icon component
 * @param {string}   trend      - Trend string e.g. "+8.2%" or "-3.1%"
 * @param {number}   duration   - Count-up duration in seconds (default 1.8)
 */
export default function KpiCard({ title, value, prefix = '', suffix = '', icon: Icon, trend = '', duration = 1.8 }) {
  const countRef = useRef(null);
  const cardRef = useRef(null);

  // Determine trend direction
  const trendNum = parseFloat(trend);
  const trendDir = isNaN(trendNum) ? 'neutral' : trendNum > 0 ? 'up' : trendNum < 0 ? 'down' : 'neutral';
  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus;

  useEffect(() => {
    if (!countRef.current) return;

    // GSAP countUp: animate from 0 → value
    const counter = { val: 0 };

    const tween = gsap.to(counter, {
      val: value,
      duration,
      ease: 'power2.out',
      delay: 0.2,
      onUpdate: () => {
        if (countRef.current) {
          // Format with commas for readability
          countRef.current.textContent = Math.floor(counter.val).toLocaleString('en-US');
        }
      },
      onComplete: () => {
        // Ensure exact final value is set
        if (countRef.current) {
          countRef.current.textContent = value.toLocaleString('en-US');
        }
      }
    });

    // Cleanup on unmount
    return () => tween.kill();
  }, [value, duration]);

  return (
    <div ref={cardRef} className="card kpi-card" data-gsap-card>
      <div className="card-body">
        {/* Top row: icon + trend */}
        <div className="d-flex justify-content-between align-items-flex-start mb-3">
          {Icon && (
            <div className="kpi-icon-wrap">
              <Icon size={22} strokeWidth={1.75} />
            </div>
          )}
          {trend && (
            <span className={`kpi-trend kpi-trend--${trendDir}`}>
              <TrendIcon size={12} strokeWidth={2.5} />
              {trend}
            </span>
          )}
        </div>

        {/* Value row */}
        <div className="d-flex align-items-baseline gap-1 mt-2">
          {prefix && <span className="kpi-prefix">{prefix}</span>}
          <span ref={countRef} className="kpi-value">0</span>
          {suffix && <span className="kpi-prefix">{suffix}</span>}
        </div>

        {/* Label */}
        <p className="kpi-title mb-0 mt-1">{title}</p>

        {/* Gold accent line */}
        <div className="kpi-divider" />
      </div>
    </div>
  );
}

KpiCard.propTypes = {
  title:    PropTypes.string.isRequired,
  value:    PropTypes.number.isRequired,
  prefix:   PropTypes.string,
  suffix:   PropTypes.string,
  icon:     PropTypes.elementType,
  trend:    PropTypes.string,
  duration: PropTypes.number
};
