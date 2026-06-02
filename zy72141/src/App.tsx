import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ImportPage from '@/pages/ImportPage';
import ReviewPage from '@/pages/ReviewPage';
import ReportPage from '@/pages/ReportPage';
import HistoryPage from '@/pages/HistoryPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/import" replace /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'report', element: <ReportPage /> },
      { path: 'history', element: <HistoryPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
