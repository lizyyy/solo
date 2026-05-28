import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Home, DataImport, Game, Settlement, Review, Export } from '../pages';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/import',
    element: <DataImport />,
  },
  {
    path: '/game',
    element: <Game />,
  },
  {
    path: '/settlement/:stopId',
    element: <Settlement />,
  },
  {
    path: '/review',
    element: <Review />,
  },
  {
    path: '/export',
    element: <Export />,
  },
]);

export { router, RouterProvider };
