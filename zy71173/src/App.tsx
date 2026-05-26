import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import GamePage from '@/pages/GamePage';
import ReplayPage from '@/pages/ReplayPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/game/:levelId',
    element: <GamePage />,
  },
  {
    path: '/replay/:recordId',
    element: <ReplayPage />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
