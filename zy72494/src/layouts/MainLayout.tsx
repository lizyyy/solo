import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, MapPin, ClipboardList, FileWarning, 
  BarChart3, FileText, Calculator, User
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '工作台' },
  { path: '/redline', icon: MapPin, label: '红线图备注' },
  { path: '/inspection', icon: ClipboardList, label: '网格员巡查表' },
  { path: '/complaints', icon: FileWarning, label: '投诉调解记录' },
  { path: '/visualization', icon: BarChart3, label: '3D/图表展示' },
  { path: '/reports', icon: FileText, label: '报告中心' },
  { path: '/calculation', icon: Calculator, label: '计算面板' },
];

export default function MainLayout() {
  const currentUser = useAppStore((state) => state.currentUser);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 
            className="text-xl font-bold text-primary-800 cursor-pointer hover:text-primary-900 transition-colors"
            onClick={() => navigate('/')}
          >
            宠物活动区
            <br />
            投诉调解系统
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{currentUser}</p>
              <p className="text-xs text-gray-500">社区书记</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
