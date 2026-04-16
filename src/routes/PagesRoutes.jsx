import { lazy } from 'react';

// project-imports
import Loadable from 'components/Loadable';
import AuthLayout from 'layout/Auth';

// render - auth pages
const LoginPage = Loadable(lazy(() => import('pages/LoginPage')));
const SignupPage = Loadable(lazy(() => import('pages/SignupPage')));

// ==============================|| AUTH PAGES ROUTING ||============================== //

const PagesRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <AuthLayout />,
      children: [
        {
          path: 'login',
          element: <LoginPage />
        },
        {
          path: 'signup',
          element: <SignupPage />
        }
      ]
    }
  ]
};

export default PagesRoutes;
