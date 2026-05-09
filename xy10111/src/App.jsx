import React, { useState, useEffect } from 'react';
import { dataStore } from './utils/dataStore';
import Dashboard from './components/Dashboard';
import MeetingsPage from './components/MeetingsPage';
import GroupsPage from './components/GroupsPage';
import DispatchPage from './components/DispatchPage';
import HistoryPage from './components/HistoryPage';

const PAGES = {
  DASHBOARD: 'dashboard',
  MEETINGS: 'meetings',
  GROUPS: 'groups',
  DISPATCH: 'dispatch',
  HISTORY: 'history',
};

const PAGE_ICONS = {
  [PAGES.DASHBOARD]: '📊',
  [PAGES.MEETINGS]: '📋',
  [PAGES.GROUPS]: '👥',
  [PAGES.DISPATCH]: '📤',
  [PAGES.HISTORY]: '📜',
};

const PAGE_LABELS = {
  [PAGES.DASHBOARD]: '工作台',
  [PAGES.MEETINGS]: '会议管理',
  [PAGES.GROUPS]: '小组管理',
  [PAGES.DISPATCH]: '附件分发',
  [PAGES.HISTORY]: '历史记录',
};

function App() {
  const [currentPage, setCurrentPage] = useState(PAGES.DASHBOARD);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const allData = await dataStore.getAllData();
      setData(allData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async () => {
    await loadData();
  };

  const renderPage = () => {
    if (loading || !data) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8c8c8c' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>加载中...</div>
        </div>
      );
    }

    switch (currentPage) {
      case PAGES.DASHBOARD:
        return <Dashboard data={data} refreshData={refreshData} onNavigate={setCurrentPage} />;
      case PAGES.MEETINGS:
        return <MeetingsPage data={data} refreshData={refreshData} />;
      case PAGES.GROUPS:
        return <GroupsPage data={data} refreshData={refreshData} />;
      case PAGES.DISPATCH:
        return <DispatchPage data={data} refreshData={refreshData} />;
      case PAGES.HISTORY:
        return <HistoryPage data={data} refreshData={refreshData} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📋 会议纪要附件分发桌面台</h1>
        <p>高效管理会议附件，避免版本混乱，记录分发历史</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          {Object.values(PAGES).map((page) => (
            <div
              key={page}
              className={`nav-item ${currentPage === page ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              <span>{PAGE_ICONS[page]}</span>
              <span>{PAGE_LABELS[page]}</span>
            </div>
          ))}
        </aside>

        <main className="content-area">
          <div className="page-container">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
