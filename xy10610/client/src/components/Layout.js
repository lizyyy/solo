import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/packages', label: '包裹管理', icon: '📦' },
    { path: '/tickets', label: '补资料工单', icon: '🎫' },
    { path: '/resubmit', label: '退单重提', icon: '🔄' },
    { path: '/import', label: '批量导入', icon: '📥' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🚢</span>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#1a202c' }}>清关管理系统</h1>
          </div>
          <nav style={{ display: 'flex', gap: '4px' }}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: location.pathname.startsWith(item.path) ? '#3182ce' : '#4a5568',
                  background: location.pathname.startsWith(item.path) ? '#ebf8ff' : 'transparent',
                  fontWeight: 500,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <footer style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
        跨境包裹清关异常管理系统 © 2024
      </footer>
    </div>
  );
};

export default Layout;
