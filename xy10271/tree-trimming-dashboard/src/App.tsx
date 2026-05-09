import React, { useState } from 'react';
import { AppProvider } from './store/AppContext';
import Dashboard from './components/Dashboard';
import TreeArchive from './components/TreeArchive';
import ComplaintManagement from './components/ComplaintManagement';
import WorkOrderManagement from './components/WorkOrderManagement';
import PublicList from './components/PublicList';
import './styles.css';

type PageType = 'dashboard' | 'trees' | 'complaints' | 'workorders' | 'public';

const navItems = [
  { id: 'dashboard' as PageType, label: '数据概览', icon: '📊' },
  { id: 'trees' as PageType, label: '树木档案', icon: '🌳' },
  { id: 'complaints' as PageType, label: '投诉管理', icon: '📝' },
  { id: 'workorders' as PageType, label: '工单排序', icon: '📋' },
  { id: 'public' as PageType, label: '结果公示', icon: '📢' }
];

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'trees':
        return <TreeArchive />;
      case 'complaints':
        return <ComplaintManagement />;
      case 'workorders':
        return <WorkOrderManagement />;
      case 'public':
        return <PublicList />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🌳 小区树木修剪工单台</h1>
        <p>智能化树木修剪管理系统 - 按遮光、病虫害、居民投诉自动排序</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="content-area">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
