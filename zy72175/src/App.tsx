
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Database, Activity, FileCheck, FileBarChart } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Samples } from './pages/Samples';
import { Detection } from './pages/Detection';
import { Review } from './pages/Review';
import { Reports } from './pages/Reports';

const navItems = [
  { path: '/', label: '检测仪表盘', icon: Home, key: 'dashboard' },
  { path: '/samples', label: '样本管理', icon: Database, key: 'samples' },
  { path: '/detection', label: '漂移检测', icon: Activity, key: 'detection' },
  { path: '/review', label: '人工改判', icon: FileCheck, key: 'review' },
  { path: '/reports', label: '报告中心', icon: FileBarChart, key: 'reports' },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="w-64 bg-gradient-to-b from-slate-800 to-slate-900 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">意图漂移监控</h1>
            <p className="text-xs text-slate-400">客服质量监控系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3">
        <p className="px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          导航菜单
        </p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">周</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">周姐</p>
              <p className="text-xs text-slate-400">标注负责人</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/detection" element={<Detection />} />
          <Route path="/review" element={<Review />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
