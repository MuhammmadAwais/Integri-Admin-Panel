import { lazy } from 'react';
// Triggering Vite to re-resolve imported pages after module swap

// project-imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

import ProtectedRoute from 'components/ProtectedRoute';

// ── Core Dashboard ──
const HomePage = Loadable(lazy(() => import('pages/Home')));

// ── Integri Feature Pages ──
const NewsPage       = Loadable(lazy(() => import('pages/NewsPage')));
const NewsConfigurationPage = Loadable(lazy(() => import('pages/NewsConfiguration')));

const NewsDetailPage = Loadable(lazy(() => import('pages/NewsDetailPage')));
const UsersPage      = Loadable(lazy(() => import('pages/UsersPage')));
const UserDetailPage = Loadable(lazy(() => import('pages/UserDetailPage')));
const PromptsPage    = Loadable(lazy(() => import('pages/PromptsPage')));
const ProfilePage    = Loadable(lazy(() => import('pages/ProfilePage')));

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

        { path: '/news/preview/:id', element: <NewsDetailPage /> },
        { path: '/users',      element: <UsersPage /> },
        { path: '/prompts',    element: <PromptsPage /> },
        { path: '/users/:id',  element: <UserDetailPage /> },
        { path: '/profile',    element: <ProfilePage /> }
      ]
    }
  ]
};

export default NavigationRoutes;
