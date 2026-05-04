import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { api } from './services/api';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import DevicesPage from './pages/DevicesPage';
import RisksPage from './pages/RisksPage';
import ExportPage from './pages/ExportPage';
import './App.css';

function App() {
  const fetchAllData = useAppStore((state) => state.fetchAllData);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkServer = async () => {
      try {
        await api.getHealth();
        setServerStatus('online');
        fetchAllData();
      } catch (error) {
        setServerStatus('offline');
      }
    };

    checkServer();
  }, [fetchAllData]);

  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <h1>🔭 观测夜预检工具</h1>
          <div className="server-status">
            服务器状态:
            <span className={`status-badge status-${serverStatus}`}>
              {serverStatus === 'checking' ? '检查中...' : serverStatus === 'online' ? '在线' : '离线'}
            </span>
          </div>
        </header>

        <nav className="app-nav">
          <Link to="/" className="nav-link">
            📊 仪表板
          </Link>
          <Link to="/import" className="nav-link">
            📁 数据导入
          </Link>
          <Link to="/devices" className="nav-link">
            🔧 设备管理
          </Link>
          <Link to="/risks" className="nav-link">
            ⚠️ 风险检测
          </Link>
          <Link to="/export" className="nav-link">
            📤 数据导出
          </Link>
        </nav>

        <main className="app-main">
          {serverStatus === 'offline' ? (
            <div className="offline-message">
              <h2>❌ 服务器连接失败</h2>
              <p>无法连接到后端服务器。请确保后端服务正在运行。</p>
              <p>运行命令: <code>npm run dev:backend</code></p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Routes>
          )}
        </main>

        <footer className="app-footer">
          <p>天文社观测夜预检工具 v1.0</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
