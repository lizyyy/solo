import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '车辆看板' },
    { path: '/tires', label: '轮胎列表' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        color: 'white',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🚚</span>
            <h1 style={{ fontSize: '20px', fontWeight: 600 }}>货车轮胎翻新管理台</h1>
          </div>
          <nav style={{ display: 'flex', gap: '8px' }}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  color: location.pathname === item.path ? 'white' : 'rgba(255,255,255,0.8)',
                  backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.2)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main style={{ 
        flex: 1, 
        maxWidth: '1400px', 
        width: '100%', 
        margin: '0 auto',
        padding: '24px',
      }}>
        {children}
      </main>
      <footer style={{ 
        padding: '16px 24px', 
        textAlign: 'center', 
        color: '#6b7280',
        fontSize: '14px',
        borderTop: '1px solid #e5e7eb',
      }}>
        轮胎全生命周期管理系统 © 2024
      </footer>
    </div>
  );
};

export default Layout;
