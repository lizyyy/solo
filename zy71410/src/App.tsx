import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  AlertTriangle, 
  Download,
  Menu,
  X,
  Leaf,
  Database
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import DataImport from './pages/DataImport';
import FundUsage from './pages/FundUsage';
import Discrepancies from './pages/Discrepancies';
import DataSources from './pages/DataSources';
import QuickGuide from './pages/QuickGuide';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { state, dispatch } = useAppStore();

  const navItems = [
    { path: '/', label: '总览', icon: LayoutDashboard },
    { path: '/import', label: '数据导入', icon: Upload },
    { path: '/sources', label: '来源管理', icon: Database },
    { path: '/fund-usage', label: '资金用途', icon: FileText },
    { path: '/discrepancies', label: '差异处理', icon: AlertTriangle },
    { path: '/export', label: '导出数据', icon: Download },
    { path: '/guide', label: '使用说明', icon: Leaf }
  ];

  const loadSampleData = () => {
    if (confirm('加载示例数据将覆盖当前数据，是否继续？')) {
      dispatch({ type: 'LOAD_SAMPLE_DATA' });
    }
  };

  const clearAllData = () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      dispatch({ type: 'CLEAR_STATE' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Leaf className="w-8 h-8 text-green-600" />
              <span className="font-bold text-lg text-gray-800">绿债资金管理</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 border-r-4 border-green-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={loadSampleData}
              className="w-full btn-secondary text-xs py-1.5"
            >
              加载示例数据
            </button>
            <button
              onClick={clearAllData}
              className="w-full btn-danger text-xs py-1.5"
            >
              清空所有数据
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {navItems.find(n => n.path === location.pathname)?.label || '绿色债券资金用途管理系统'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              数据来源: {state.sources.length} 个
            </span>
            <span className="text-gray-300">|</span>
            <span>
              资金记录: {state.fundUsages.length} 条
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-orange-600">
              待处理差异: {state.discrepancies.filter(d => !d.resolved).length} 项
            </span>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<DataImport />} />
            <Route path="/sources" element={<DataSources />} />
            <Route path="/fund-usage" element={<FundUsage />} />
            <Route path="/discrepancies" element={<Discrepancies />} />
            <Route path="/export" element={<DataImport />} />
            <Route path="/guide" element={<QuickGuide />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
