import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Workspace3D from '@/pages/Workspace3D';
import ReportExport from '@/pages/ReportExport';
import DataManagement from '@/pages/DataManagement';
import {
  LayoutDashboard,
  Download,
  Database,
  Bot,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModificationStore } from '@/store';

const navItems = [
  { label: '工作台', icon: LayoutDashboard, path: '/' },
  { label: '导出', icon: Download, path: '/export' },
  { label: '数据管理', icon: Database, path: '/data' },
];

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useModificationStore((s) => s.currentUser);

  return (
    <header className="glass flex items-center justify-between px-6 h-14 border-b border-warehouse-border/50 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-accent-blue" />
          <h1 className="text-base font-bold gradient-text tracking-wide">
            机器人仓储路径云图
          </h1>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all duration-200',
                location.pathname === item.path
                  ? 'text-accent-blue bg-accent-blue/10 border border-accent-blue/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warehouse-surface/80 border border-warehouse-border/50">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">{currentUser}</span>
        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="h-full flex flex-col bg-warehouse-bg overflow-hidden">
      <AppHeader />
      <Routes>
        <Route path="/" element={<Workspace3D noHeader />} />
        <Route path="/export" element={<ReportExport noHeader />} />
        <Route path="/data" element={<DataManagement noHeader />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
