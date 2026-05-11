import { useEffect, useState } from 'react';
import ScreenManagement from './components/ScreenManagement';
import ContentManagement from './components/ContentManagement';
import ScheduleManagement from './components/ScheduleManagement';
import PriorityRules from './components/PriorityRules';
import FreezeControl from './components/FreezeControl';
import HistoryViewer from './components/HistoryViewer';
import { appStateStorage } from './storage';
import { AppState } from './types';

type Page = 'screens' | 'contents' | 'schedules' | 'rules' | 'freeze' | 'history';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('schedules');
  const [appState, setAppState] = useState<AppState>({ isFrozen: false });

  useEffect(() => {
    setAppState(appStateStorage.get());
  }, []);

  const toggleFrozen = (reason?: string) => {
    if (reason) {
      const newState: AppState = {
        isFrozen: true,
        frozenBy: '系统管理员',
        frozenAt: new Date().toISOString(),
        frozenReason: reason,
      };
      appStateStorage.save(newState);
      setAppState(newState);
    } else {
      const newState: AppState = { isFrozen: false };
      appStateStorage.save(newState);
      setAppState(newState);
    }
  };

  const navItems: { key: Page; label: string; icon: string }[] = [
    { key: 'schedules', label: '排期管理', icon: '📅' },
    { key: 'screens', label: '屏幕档案', icon: '🖥️' },
    { key: 'contents', label: '内容档案', icon: '📁' },
    { key: 'rules', label: '优先级规则', icon: '⚖️' },
    { key: 'freeze', label: '发布冻结', icon: '🔒' },
    { key: 'history', label: '操作历史', icon: '📜' },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'screens':
        return <ScreenManagement isFrozen={appState.isFrozen} />;
      case 'contents':
        return <ContentManagement isFrozen={appState.isFrozen} />;
      case 'schedules':
        return <ScheduleManagement isFrozen={appState.isFrozen} toggleFrozen={toggleFrozen} />;
      case 'rules':
        return <PriorityRules isFrozen={appState.isFrozen} />;
      case 'freeze':
        return <FreezeControl isFrozen={appState.isFrozen} onToggle={toggleFrozen} />;
      case 'history':
        return <HistoryViewer />;
      default:
        return <ScheduleManagement isFrozen={appState.isFrozen} toggleFrozen={toggleFrozen} />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">🏬 商场导视屏内容排期台</h1>
        </div>
        <div className="header-right">
          {appState.isFrozen && (
            <div className="frozen-indicator" title={`冻结原因：${appState.frozenReason}`}>
              🔒 发布已冻结
            </div>
          )}
          <div className="user-info">系统管理员</div>
        </div>
      </header>

      <div className="main-container">
        <nav className="sidebar">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <main className="content-area">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
