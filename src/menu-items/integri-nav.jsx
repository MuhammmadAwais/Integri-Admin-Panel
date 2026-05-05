// lucide-react icons — Integri App Navigation
import { LayoutDashboard, Newspaper, Users, LogOut, Cpu, Settings, Bell } from 'lucide-react';

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
      id: 'notifications',
      title: 'Notifications & Schedule',
      type: 'item',
      icon: Bell,
      url: '/news/notifications'
    },
    {
      id: 'users',
      title: 'Users',
      type: 'item',
      icon: Users,
      url: '/users'
    },
    {
      id: 'prompts',
      title: 'Prompts',
      type: 'item',
      icon: Cpu,
      url: '/prompts'
    },

    {
      id: 'settings',
      title: 'Settings',
      type: 'item',
      icon: Settings,
      url: '/profile' // Using /profile as settings as established earlier
    }
  ]
};

export default integriNav;
