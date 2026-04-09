// lucide-react icons — Integri App Navigation
import { LayoutDashboard, Newspaper, Users, Coins, ShieldCheck, LogOut } from 'lucide-react';

// ==============================|| INTEGRI APP — NAVIGATION MENU ||============================== //

/**
 * Single source of truth for all Integri App sidebar navigation.
 * Icons use lucide-react React components (not CSS class strings).
 * NavItem.jsx detects typeof === 'function' and renders them accordingly.
 */
const integriNav = {
  id: 'integri-main-nav',
  title: 'Navigation',
  type: 'group',
  children: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      type: 'item',
      icon: LayoutDashboard,
      url: '/'
    },
    {
      id: 'news',
      title: 'News',
      type: 'item',
      icon: Newspaper,
      url: '/news'
    },
    {
      id: 'users',
      title: 'Users',
      type: 'item',
      icon: Users,
      url: '/users'
    },
    {
      id: 'token-system',
      title: 'Token System',
      type: 'item',
      icon: Coins,
      url: '/tokens'
    },
    {
      id: 'sub-admins',
      title: 'Sub Admins',
      type: 'item',
      icon: ShieldCheck,
      url: '/sub-admins'
    },
    {
      id: 'logout',
      title: 'Logout',
      type: 'item',      // NavItem handles 'logout' url specially → navigate('/login')
      icon: LogOut,
      url: '/login'
    }
  ]
};

export default integriNav;
