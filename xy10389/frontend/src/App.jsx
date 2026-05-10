import React, { useState, useEffect } from 'react';
import { dashboardAPI } from './services/api';
import Dashboard from './pages/Dashboard';
import Cages from './pages/Cages';
import Hospitalizations from './pages/Hospitalizations';
import CareTasks from './pages/CareTasks';
import TransferRequests from './pages/TransferRequests';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';

const NAV_ITEMS = [
  { id: 'dashboard', label: '仪表盘', icon: '📊' },
  { id: 'cages', label: '笼位看板', icon: '🏠' },
  { id: 'hospitalizations', label: '住院管理', icon: '🏥' },
  { id: 'care-tasks', label: '护理任务', icon: '📋' },
  { id: 'transfers', label: '转笼申请', icon: '🔄' },
  { id: 'alerts', label: '异常提示', icon: '⚠️' },
  { id: 'reports', label: '报表导出', icon: '📈' }
];

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSummary = async () => {
    try {
      const response = await dashboardAPI.getSummary();
      setSummary(response.data);
    } catch (error) {
      console.error('加载概览数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard summary={summary} onNavigate={setCurrentPage} />;
      case 'cages':
        return <Cages />;
      case 'hospitalizations':
        return <Hospitalizations />;
      case 'care-tasks':
        return <CareTasks />;
      case 'transfers':
        return <TransferRequests />;
      case 'alerts':
        return <Alerts />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard summary={summary} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🐾 宠物医院住院笼位台</h1>
        <p>管理住院信息、笼位分配、护理任务与转笼申请</p>
      </div>

      <div className="nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={currentPage === item.id ? 'active' : ''}
            onClick={() => setCurrentPage(item.id)}
          >
            {item.icon} {item.label}
            {item.id === 'alerts' && summary?.unresolvedAlerts > 0 && (
              <span style={{
                marginLeft: '6px',
                background: '#e74c3c',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '10px'
              }}>
                {summary.unresolvedAlerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {renderPage()}
    </div>
  );
}

export default App;
