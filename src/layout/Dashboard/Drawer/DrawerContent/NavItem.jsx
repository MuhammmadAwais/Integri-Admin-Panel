import PropTypes from 'prop-types';
import { useLocation, matchPath, Link, useNavigate } from 'react-router-dom';

// project-imports
import { handlerDrawerOpen } from 'api/menu';

// ==============================|| NAVIGATION - ITEM ||============================== //

/**
 * Renders the nav item icon.
 * Supports two formats:
 *   1. CSS class string (legacy template): e.g. 'ph ph-house-line'
 *   2. Lucide React component (Integri App): e.g. LayoutDashboard
 */
function NavIcon({ icon }) {
  if (!icon) return null;

  const isReactComponent = typeof icon === 'function' || typeof icon === 'object';

  return (
    <span className="pc-micon">
      {isReactComponent ? (
        // Lucide React icon — render as component
        (() => {
          const Icon = icon;
          return <Icon size={18} strokeWidth={2} className="integri-nav-icon" />;
        })()
      ) : (
        // Legacy CSS icon
        <i className={icon} />
      )}
    </span>
  );
}

export default function NavItem({ item }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const itemPath = item?.link || item?.url;
  const itemTarget = item?.target ? '_blank' : '_self';
  const isSelected = itemPath ? !!matchPath({ path: itemPath, end: true }, pathname) : false;
  const isMobile = window.innerWidth <= 1024;

  const handleClick = () => {
    // Close drawer on mobile
    if (isMobile) handlerDrawerOpen(false);

    // Handle logout action type
    if (item?.type === 'logout') {
      navigate('/login');
    }
  };

  return (
    <li className={`pc-item ${isSelected ? 'active' : ''}`}>
      <Link className="pc-link" to={item?.url || '#'} target={itemTarget} onClick={handleClick}>
        <NavIcon icon={item?.icon} />
        <span className="pc-mtext">{item.title}</span>
      </Link>
    </li>
  );
}

NavItem.propTypes = { item: PropTypes.any };
NavIcon.propTypes = { icon: PropTypes.oneOfType([PropTypes.string, PropTypes.func]) };
