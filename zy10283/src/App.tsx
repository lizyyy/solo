import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { OrderList } from './pages/OrderList';
import { NewOrder } from './pages/NewOrder';
import { OrderDetail } from './pages/OrderDetail';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<OrderList />} />
        <Route path="/orders/new" element={<NewOrder />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
