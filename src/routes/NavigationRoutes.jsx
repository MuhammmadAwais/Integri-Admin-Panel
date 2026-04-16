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
const NewsEditorPage = Loadable(lazy(() => import('pages/NewsEditorPage')));
const NewsDetailPage = Loadable(lazy(() => import('pages/NewsDetailPage')));
const UsersPage      = Loadable(lazy(() => import('pages/UsersPage')));
const TokensPage     = Loadable(lazy(() => import('pages/TokensPage')));
const SubAdminsPage  = Loadable(lazy(() => import('pages/SubAdminsPage')));
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
        { path: '/news/create',     element: <NewsEditorPage /> },
        { path: '/news/edit/:id',   element: <NewsEditorPage /> },
        { path: '/news/preview/:id', element: <NewsDetailPage /> },
        { path: '/users',      element: <UsersPage /> },
        { path: '/tokens',     element: <TokensPage /> },
        { path: '/sub-admins', element: <SubAdminsPage /> },
        { path: '/prompts',    element: <PromptsPage /> },
        { path: '/users/:id',  element: <UserDetailPage /> },
        { path: '/profile',    element: <ProfilePage /> }
      ]
    }
  ]
};

export default NavigationRoutes;
