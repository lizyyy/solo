import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Database, History, AlertTriangle, Download, Settings } from 'lucide-react';
import { Workbench } from './pages/Workbench';
import { VersionHistory } from './pages/VersionHistory';
import { AnomalyCenter } from './pages/AnomalyCenter';
import { ExportCenter } from './pages/ExportCenter';
import { BatchProcessing } from './pages/BatchProcessing';

const navItems = [
  { path: '/workbench', label: '数据工作台', icon: Database },
  { path: '/versions', label: '版本历史', icon: History },
  { path: '/anomalies', label: '异常中心', icon: AlertTriangle },
  { path: '/exports', label: '导出中心', icon: Download },
  { path: '/batch', label: '批量处理', icon: Settings },
];

export const App: React.FC = () => {
  return (
    <Router>
      <div className="h-screen flex flex-col bg-primary-50">
        <header className="flex items-center justify-between px-6 py-3 bg-primary-800 text-white border-b border-primary-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-info-500 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-lg leading-tight">城市电网博弈</h1>
              <p className="text-xs text-primary-300 font-mono">数据核对系统 v1.0.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-primary-300">数据状态:</span>
            <span className="flex items-center gap-1 text-success-400">
              <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse-slow" />
              在线
            </span>
          </div>
        </header>

        <nav className="flex items-center gap-1 px-4 py-2 bg-white border-b border-primary-200">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-mono transition-colors ${
                  isActive
                    ? 'bg-info-50 text-info-700 border-b-2 border-info-500'
                    : 'text-primary-500 hover:text-primary-700 hover:bg-primary-50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/versions" element={<VersionHistory />} />
            <Route path="/anomalies" element={<AnomalyCenter />} />
            <Route path="/exports" element={<ExportCenter />} />
            <Route path="/batch" element={<BatchProcessing />} />
          </Routes>
        </main>

        <footer className="flex items-center justify-between px-6 py-2 bg-white border-t border-primary-200 text-xs font-mono text-primary-400">
          <span>城市电网博弈数据核对系统 | 纯前端离线运行模式</span>
          <span>数据存储: LocalStorage + IndexedDB</span>
        </footer>
      </div>
    </Router>
  );
};
