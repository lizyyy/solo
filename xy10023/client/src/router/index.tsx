import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/components/Layout/MainLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import TicketsPage from '@/pages/TicketsPage';
import TicketDetailPage from '@/pages/TicketDetailPage';
import PendingFollowUpsPage from '@/pages/PendingFollowUpsPage';
import OverdueFollowUpsPage from '@/pages/OverdueFollowUpsPage';
import ExportsPage from '@/pages/ExportsPage';
import AuthGuard from '@/components/AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AuthGuard><MainLayout /></AuthGuard>,
    children: [
      {
        path: '',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'tickets',
        element: <TicketsPage />,
      },
      {
        path: 'tickets/:id',
        element: <TicketDetailPage />,
      },
      {
        path: 'followups',
        element: <PendingFollowUpsPage />,
      },
      {
        path: 'followups/pending',
        element: <PendingFollowUpsPage />,
      },
      {
        path: 'followups/overdue',
        element: <OverdueFollowUpsPage />,
      },
      {
        path: 'exports',
        element: <ExportsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;
