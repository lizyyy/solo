import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/ImportPage';
import AnomaliesPage from '@/pages/AnomaliesPage';
import ComparePage from '@/pages/ComparePage';
import ReviewPage from '@/pages/ReviewPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/import', element: <ImportPage /> },
      { path: '/anomalies', element: <AnomaliesPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/review', element: <ReviewPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
