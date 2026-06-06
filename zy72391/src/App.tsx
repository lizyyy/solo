import { useSystem } from './context/SystemContext';
import Dashboard from './pages/Dashboard';
import DataImport from './pages/DataImport';
import ParamReplay from './pages/ParamReplay';
import Review from './pages/Review';

function App() {
  const { state, setActiveTab } = useSystem();

  const navItems = [
    { key: 'dashboard', label: '小看板' },
    { key: 'import', label: '数据导入' },
    { key: 'replay', label: '参数回放' },
    { key: 'review', label: '复核处理' }
  ];

  const renderPage = () => {
    switch (state.activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'import':
        return <DataImport />;
      case 'replay':
        return <ParamReplay />;
      case 'review':
        return <Review />;
      default:
        return <Dashboard />;
    }
  };

  const pageTitles: Record<string, string> = {
    'dashboard': '地铁制动热负荷 - 小看板',
    'import': '数据导入',
    'replay': '参数回放',
    'review': '复核处理'
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          制动热负荷系统
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.key}
              className={`nav-item ${state.activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <div className="page-title">{pageTitles[state.activeTab]}</div>
          <div style={{ color: '#8c8c8c', fontSize: '13px' }}>
            当前用户：何工（设备工程师）
          </div>
        </header>
        <div className="page-content">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
