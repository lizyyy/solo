import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Building2, Users, Ship, Package, ListTodo, FileDown, AlertTriangle 
} from 'lucide-react';
import { useAppStore } from '../store/store';

const navItems = [
  { path: '/', label: '概览', icon: Home },
  { path: '/rooms', label: '房间管理', icon: Building2 },
  { path: '/guests', label: '住客管理', icon: Users },
  { path: '/ships', label: '船班管理', icon: Ship },
  { path: '/supplies', label: '物资管理', icon: Package },
  { path: '/batches', label: '撤离批次', icon: ListTodo },
  { path: '/export', label: '导出报表', icon: FileDown },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { status, supplies } = useAppStore();
  
  const hasSupplyWarning = supplies.some(s => s.status === 'low' || s.quantity <= s.min_threshold);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">台风撤房</h1>
              <p className="text-xs text-gray-500">物资联动表</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.path === '/supplies' && hasSupplyWarning && (
                  <span className="w-2 h-2 bg-danger-500 rounded-full ml-auto"></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {status && (
            <div className="text-sm text-gray-500">
              <div className="flex justify-between mb-1">
                <span>撤离进度</span>
                <span className="font-medium text-gray-900">
                  {status.guests.evacuated}/{status.guests.total}
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className={`progress-bar-fill ${
                    status.guests.percentage >= 100 
                      ? 'bg-success-500' 
                      : status.guests.percentage >= 50 
                        ? 'bg-primary-500' 
                        : 'bg-warning-500'
                  }`}
                  style={{ width: `${status.guests.percentage}%` }}
                />
              </div>
              <p className="text-xs mt-2">{status.guests.percentage}% 已完成</p>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
