import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import ReportList from './pages/ReportList.jsx';
import ReportDetail from './pages/ReportDetail.jsx';
import AnomalyQueue from './pages/AnomalyQueue.jsx';
import { api } from './api.js';

function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [summary, setSummary] = useState({ total: 0, suspended: 0, pending: 0, anomalies: 0 });

  useEffect(() => {
    api.getSummary().then(setSummary).catch(() => {});
  }, [loc.pathname]);

  const navCls = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => nav('/')} className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <span className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white text-lg">🐾</span>
              流浪动物救助报告导出
            </button>
            <nav className="flex gap-1">
              <NavLink to="/" end className={navCls}>📋 报告列表</NavLink>
              <NavLink to="/anomalies" className={navCls}>
                ⚠️ 异常队列
                {summary.anomalies > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{summary.anomalies}</span>
                )}
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex gap-4 text-gray-600">
              <span>报告总数 <b className="text-gray-900">{summary.total}</b></span>
              <span>待审核 <b className="text-blue-600">{summary.pending}</b></span>
              <span>已挂起 <b className="text-amber-600">{summary.suspended}</b></span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 w-full flex-1">
        <Routes>
          <Route path="/" element={<ReportList summary={summary} />} />
          <Route path="/r/:id" element={<ReportDetail />} />
          <Route path="/anomalies" element={<AnomalyQueue />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-200 bg-white py-3 text-center text-xs text-gray-500">
        数据真实写回 SQLite · 重启后历史备注不丢失 · 状态与异常队列实时联动
      </footer>
    </div>
  );
}

export default App;
