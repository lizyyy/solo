import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ListTodo, 
  UserCheck, 
  FileText, 
  PlayCircle,
  Music2
} from 'lucide-react';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/records', label: '记录列表', icon: ListTodo },
  { path: '/review', label: '店长复核', icon: UserCheck },
  { path: '/verification', label: '核销单对账', icon: FileText },
  { path: '/demo', label: '演示中心', icon: PlayCircle },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Music2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">库存联动</h1>
            <p className="text-xs text-slate-400">艺人周边管理系统</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">当前用户</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-sm font-bold">
              阿
            </div>
            <div>
              <p className="text-sm font-medium">巡演统筹</p>
              <p className="text-xs text-slate-400">阿梅</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
