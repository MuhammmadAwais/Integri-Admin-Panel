import { LayoutDashboard, Newspaper, BookOpen, Users, LogOut, Cpu, Settings, Bell, Layers, Activity, SlidersHorizontal, FilePlus } from 'lucide-react';

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
      id: 'manual-news',
      title: 'Manual Article',
      type: 'item',
      icon: FilePlus,
      url: '/news/manual'
    },
    {
      id: 'blogs',
      title: 'Blogs',
      type: 'item',
      icon: BookOpen,
      url: '/blogs'
    },
    {
      id: 'notifications',
      title: 'Notifications',
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
      id: 'platform-usage',
      title: 'Platform Usage',
      type: 'item',
      icon: Activity,
      url: '/system/usage'
    },
    {
      id: 'prompts',
      title: 'Prompts',
      type: 'item',
      icon: Cpu,
      url: '/prompts'
    },
    {
      id: 'ai-models',
      title: 'AI Models',
      type: 'item',
      icon: Layers,
      url: '/system/models'
    },
    {
      id: 'tier-limits',
      title: 'Tier Limits',
      type: 'item',
      icon: SlidersHorizontal,
      url: '/system/tiers'
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
