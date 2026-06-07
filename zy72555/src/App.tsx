import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home } from '@/pages/Home';
import { TrainingLogs } from '@/pages/TrainingLogs';
import { ThresholdNotes } from '@/pages/ThresholdNotes';
import { ChangeHistoryPage } from '@/pages/ChangeHistory';
import { BoundaryRules } from '@/pages/BoundaryRules';
import { Home as HomeIcon, FileText, BookOpen, History, ShieldAlert, Warehouse } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser } = useAppStore();

  const navItems = [
    { path: '/', label: '工作流向导', Icon: HomeIcon, color: 'text-blue-400' },
    { path: '/training-logs', label: '训练日志管理', Icon: FileText, color: 'text-blue-400' },
    { path: '/threshold-notes', label: '阈值调参笔记', Icon: BookOpen, color: 'text-amber-400' },
    { path: '/change-history', label: '变更历史', Icon: History, color: 'text-purple-400' },
    { path: '/boundary-rules', label: '边界规则中心', Icon: ShieldAlert, color: 'text-red-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 fixed left-0 top-0">
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Warehouse size={24} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">强化学习仓储调度</h1>
                <p className="text-xs text-slate-500">评测追踪系统</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map(({ path, label, Icon, color }) => {
              const isActive = location.pathname === path;
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={18} className={isActive ? color : ''} />
                  {label}
                </NavLink>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
            <div className="text-xs text-slate-500">当前登录</div>
            <div className="text-sm text-slate-300 mt-1">{currentUser}</div>
          </div>
        </aside>

        <main className="ml-64 flex-1 min-h-screen">
          <div className="p-8 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/training-logs" element={<TrainingLogs />} />
          <Route path="/threshold-notes" element={<ThresholdNotes />} />
          <Route path="/change-history" element={<ChangeHistoryPage />} />
          <Route path="/boundary-rules" element={<BoundaryRules />} />
        </Routes>
      </Layout>
    </Router>
  );
}
