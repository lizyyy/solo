import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ReleaseList from './pages/ReleaseList';
import ReleaseDetail from './pages/ReleaseDetail';

const App = () => {
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link to="/" style={styles.logo}>
            🚀 发布就绪度管理平台
          </Link>
          <nav style={styles.nav}>
            <Link to="/" style={styles.navLink}>发布列表</Link>
          </nav>
        </div>
      </header>
      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<ReleaseList />} />
          <Route path="/release/:id" element={<ReleaseDetail />} />
        </Routes>
      </main>
    </div>
  );
};

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '0 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    textDecoration: 'none'
  },
  nav: {
    display: 'flex',
    gap: '24px'
  },
  navLink: {
    color: 'rgba(255,255,255,0.9)',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 16px',
    borderRadius: '4px',
    transition: 'background 0.2s'
  },
  main: {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    width: '100%'
  }
};

export default App;
