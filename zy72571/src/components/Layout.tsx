import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  FlaskConical, 
  AlertTriangle, 
  History,
  RotateCcw,
  Play
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/notes', label: '阈值调参笔记', icon: FileText },
  { path: '/experiments', label: '线上实验桶', icon: FlaskConical },
  { path: '/anomalies', label: '异常样本页', icon: AlertTriangle },
  { path: '/history', label: '历史记录', icon: History },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { resetDemo, showToast, rerunCalibration } = useAppStore();
  
  const handleReset = () => {
    resetDemo();
    showToast('info', '演示数据已重置');
  };
  
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900/50 border-r border-slate-700/50 backdrop-blur-sm flex flex-col">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500"></span>
            语音唤醒阈值校准
          </h1>
          <p className="text-xs text-slate-400 mt-1">演示系统 v1.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <button
            onClick={rerunCalibration}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-all active:scale-95"
          >
            <Play size={16} />
            重跑校准
          </button>
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-all active:scale-95"
          >
            <RotateCcw size={16} />
            重置演示
          </button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
