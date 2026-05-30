import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import Dashboard from '../pages/dashboard';
import ContractLink from '../pages/contract-link';
import PointsCalc from '../pages/points-calc';
import PaymentMatch from '../pages/payment-match';
import History from '../pages/history';
import Report from '../pages/report';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'contract-link',
        element: <ContractLink />,
      },
      {
        path: 'points-calc',
        element: <PointsCalc />,
      },
      {
        path: 'payment-match',
        element: <PaymentMatch />,
      },
      {
        path: 'history',
        element: <History />,
      },
      {
        path: 'report',
        element: <Report />,
      },
    ],
  },
]);

export default router;
