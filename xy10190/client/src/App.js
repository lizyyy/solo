import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import Offers from './pages/Offers';
import OfferDetail from './pages/OfferDetail';
import OfferCreate from './pages/OfferCreate';
import MyApprovals from './pages/MyApprovals';
import AuditLogs from './pages/AuditLogs';
import AppLayout from './components/AppLayout';
import { getCurrentUser } from './services/api';

const { Content } = Layout;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <AppLayout user={user} onLogout={() => setUser(null)}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/offers/new" element={<OfferCreate />} />
          <Route path="/offers/new/:parentId" element={<OfferCreate />} />
          <Route path="/offers/:id" element={<OfferDetail />} />
          <Route path="/my-approvals" element={<MyApprovals />} />
          {user.role === 'hr_admin' || user.role === 'director' ? (
            <Route path="/audit-logs" element={<AuditLogs />} />
          ) : null}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
