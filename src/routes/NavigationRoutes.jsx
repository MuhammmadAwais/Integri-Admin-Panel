import { lazy } from 'react';
// Triggering Vite to re-resolve imported pages after module swap

// project-imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

// ── Core Dashboard ──
const DefaultPage = Loadable(lazy(() => import('views/navigation/dashboard/Default')));

// ── Integri Feature Pages ──
const NewsPage      = Loadable(lazy(() => import('features/news/NewsPage')));
const UsersPage     = Loadable(lazy(() => import('features/users/UsersPage')));
const TokensPage    = Loadable(lazy(() => import('features/tokens/TokensPage')));
const SubAdminsPage = Loadable(lazy(() => import('features/sub-admins/SubAdminsPage')));
const UserDetailPage = Loadable(lazy(() => import('features/users/components/UserDetailPage')));
const PromptsPage   = Loadable(lazy(() => import('features/prompts/PromptsPage')));

// ==============================|| INTEGRI APP — NAVIGATION ROUTES ||============================== //

const NavigationRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        { path: '/',           element: <DefaultPage /> },
        { path: '/news',       element: <NewsPage /> },
        { path: '/users',      element: <UsersPage /> },
        { path: '/tokens',     element: <TokensPage /> },
        { path: '/sub-admins', element: <SubAdminsPage /> },
        { path: '/prompts',    element: <PromptsPage /> },
        { path: '/users/:id',  element: <UserDetailPage /> }
      ]
    }
  ]
};

export default NavigationRoutes;
