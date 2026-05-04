import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import Home from './pages/Home';
import SessionDetail from './pages/SessionDetail';
import ImportWizard from './pages/ImportWizard';
import './App.css';

function App() {
  const { currentSessionId, fetchSessions } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await fetchSessions();
      } catch (error) {
        console.error('初始化失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <h1>🔥 消防训练馆烟雾扩散复盘工具</h1>
          <nav>
            <a href="/" className="nav-link">
              <span>📋</span> 训练列表
            </a>
            <a href="/import" className="nav-link">
              <span>📥</span> 导入数据
            </a>
          </nav>
        </header>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session/:id" element={<SessionDetail />} />
            <Route path="/import" element={<ImportWizard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
