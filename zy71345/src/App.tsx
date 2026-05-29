import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Check from './pages/Check';
import Exceptions from './pages/Exceptions';
import SignOff from './pages/SignOff';
import Compare from './pages/Compare';
import Report from './pages/Report';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'import',
        element: <Import />,
      },
      {
        path: 'check',
        element: <Check />,
      },
      {
        path: 'exceptions',
        element: <Exceptions />,
      },
      {
        path: 'signoff',
        element: <SignOff />,
      },
      {
        path: 'compare',
        element: <Compare />,
      },
      {
        path: 'report',
        element: <Report />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
