import { Routes, Route, NavLink } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Nannies from './pages/Nannies';

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h2>月嫂排班服务评价台</h2>
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            排班日历
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>
            订单管理
          </NavLink>
          <NavLink to="/nannies" className={({ isActive }) => isActive ? 'active' : ''}>
            月嫂档案
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/nannies" element={<Nannies />} />
        </Routes>
      </main>
    </div>
  );
}
