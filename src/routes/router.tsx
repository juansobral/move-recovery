import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: async () => {
      const { LandingPage } = await import('../pages/LandingPage');
      return { Component: LandingPage };
    },
  },
  {
    path: '/admin/login',
    lazy: async () => {
      const { AdminLoginPage } = await import('../pages/AdminLoginPage');
      return { Component: AdminLoginPage };
    },
  },
  {
    path: '/admin',
    element: <RequireAuth />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { AdminDashboardPage } = await import('../pages/AdminDashboardPage');
          return { Component: AdminDashboardPage };
        },
      },
    ],
  },
  {
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('../pages/NotFoundPage');
      return { Component: NotFoundPage };
    },
  },
]);
