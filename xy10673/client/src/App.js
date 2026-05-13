import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Subscriptions from './pages/Subscriptions';
import PauseRequests from './pages/PauseRequests';
import Deliveries from './pages/Deliveries';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <div style={styles.app}>
        <nav style={styles.nav}>
          <h1 style={styles.title}>📰 报刊订阅暂停补投系统</h1>
          <div style={styles.navLinks}>
            <Link to="/" style={styles.link}>异常看板</Link>
            <Link to="/subscriptions" style={styles.link}>订阅管理</Link>
            <Link to="/pause-requests" style={styles.link}>暂停申请</Link>
            <Link to="/deliveries" style={styles.link}>投递与补投</Link>
            <Link to="/reports" style={styles.link}>报表导出</Link>
          </div>
        </nav>
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/pause-requests" element={<PauseRequests />} />
            <Route path="/deliveries" element={<Deliveries />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

const styles = {
  app: { minHeight: '100vh' },
  nav: { background: '#2c3e50', color: 'white', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  title: { fontSize: '1.25rem', fontWeight: 600 },
  navLinks: { display: 'flex', gap: '1.5rem' },
  link: { color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: '4px', transition: 'background 0.2s' },
  main: { padding: '2rem' }
};

export default App;
