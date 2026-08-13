import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { RequireUserAuth } from './RequireUserAuth';

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
    path: '/admin/usuarios',
    element: <RequireAuth />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { AdminUsersPage } = await import('../pages/AdminUsersPage');
          return { Component: AdminUsersPage };
        },
      },
    ],
  },
  {
    path: '/admin/precios',
    element: <RequireAuth />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { AdminPricingPage } = await import('../pages/AdminPricingPage');
          return { Component: AdminPricingPage };
        },
      },
    ],
  },
  {
    path: '/completar-perfil',
    element: <RequireUserAuth />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { CompleteProfilePage } = await import('../pages/CompleteProfilePage');
          return { Component: CompleteProfilePage };
        },
      },
    ],
  },
  {
    path: '/mi-cuenta',
    element: <RequireUserAuth />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { MiCuentaPage } = await import('../pages/MiCuentaPage');
          return { Component: MiCuentaPage };
        },
      },
    ],
  },
  {
    path: '/pago-pendiente',
    lazy: async () => {
      const { CheckoutPendingPage } = await import('../pages/CheckoutPendingPage');
      return { Component: CheckoutPendingPage };
    },
  },
  {
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('../pages/NotFoundPage');
      return { Component: NotFoundPage };
    },
  },
]);
