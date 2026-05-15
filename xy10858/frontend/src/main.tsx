import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import SynonymGroups from './pages/SynonymGroups';
import SynonymGroupDetail from './pages/SynonymGroupDetail';
import PublishBatches from './pages/PublishBatches';
import BatchDetail from './pages/BatchDetail';

function Nav() {
  const location = useLocation();
  const navItems = [
    { path: '/', label: '同义词组', exact: true },
    { path: '/batches', label: '发布批次' }
  ];

  return (
    <nav style={{ background: '#1f2937', color: 'white', padding: '0 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '60px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, marginRight: '40px' }}>搜索同义词发布台</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: 'inherit',
                background: (item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)) ? '#374151' : 'transparent'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh' }}>
        <Nav />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          <Routes>
            <Route path="/" element={<SynonymGroups />} />
            <Route path="/synonym-groups/:id" element={<SynonymGroupDetail />} />
            <Route path="/batches" element={<PublishBatches />} />
            <Route path="/batches/:id" element={<BatchDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
