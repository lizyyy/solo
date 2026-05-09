import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import InvoiceList from './pages/InvoiceList';
import Reports from './pages/Reports';
import ImportExport from './pages/ImportExport';

const NAV_ITEMS = [
  { path: '/', label: '工作台', icon: '📊' },
  { path: '/invoices', label: '票据管理', icon: '📄' },
  { path: '/reports', label: '复核报告', icon: '📈' },
  { path: '/import-export', label: '导入导出', icon: '📥' }
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">📋 票据复核台</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/import-export" element={<ImportExport />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
