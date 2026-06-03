import { lazy } from 'react';
// Triggering Vite to re-resolve imported pages after module swap

// project-imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

import ProtectedRoute from 'components/ProtectedRoute';

// ── Core Dashboard ──
const HomePage = Loadable(lazy(() => import('pages/Home')));

// ── Integri Feature Pages ──
const NewsPage              = Loadable(lazy(() => import('pages/NewsPage')));
const NewsConfigurationPage = Loadable(lazy(() => import('pages/NewsConfiguration')));
const NotificationsPage     = Loadable(lazy(() => import('pages/NotificationsPage')));
const ManualNewsPage        = Loadable(lazy(() => import('pages/ManualNewsPage')));

const BlogsPage             = Loadable(lazy(() => import('pages/BlogsPage')));
const BlogBuilderPage       = Loadable(lazy(() => import('pages/BlogBuilderPage')));

const NewsDetailPage = Loadable(lazy(() => import('pages/NewsDetailPage')));
const UsersPage      = Loadable(lazy(() => import('pages/UsersPage')));
const UserDetailPage = Loadable(lazy(() => import('pages/UserDetailPage')));
const PromptsPage    = Loadable(lazy(() => import('pages/PromptsPage')));
const ProfilePage    = Loadable(lazy(() => import('pages/ProfilePage')));
const ModelsPage        = Loadable(lazy(() => import('pages/ModelsPage')));
const PlatformUsagePage = Loadable(lazy(() => import('pages/PlatformUsagePage')));
const TierConfigurationPage = Loadable(lazy(() => import('pages/TierConfigurationPage')));

// ==============================|| INTEGRI APP — NAVIGATION ROUTES ||============================== //

const NavigationRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
      children: [
        { path: '/',           element: <HomePage /> },
        { path: '/news',           element: <NewsPage /> },
        { path: '/news/configuration', element: <NewsConfigurationPage /> },
        { path: '/news/notifications', element: <NotificationsPage /> },
        { path: '/news/manual',        element: <ManualNewsPage /> },
        { path: '/blogs',           element: <BlogsPage /> },
        { path: '/blogs/builder',   element: <BlogBuilderPage /> },

        { path: '/news/preview/:id', element: <NewsDetailPage /> },
        { path: '/users',      element: <UsersPage /> },
        { path: '/prompts',    element: <PromptsPage /> },
        { path: '/system/models', element: <ModelsPage /> },
        { path: '/system/usage',  element: <PlatformUsagePage /> },
        { path: '/system/tiers',  element: <TierConfigurationPage /> },
        { path: '/users/:id',  element: <UserDetailPage /> },
        { path: '/profile',    element: <ProfilePage /> }
      ]
    }
  ]
};

export default NavigationRoutes;
