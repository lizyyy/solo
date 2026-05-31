import { NavLink, useLocation } from 'react-router-dom';
import { ListTodo, PlusCircle, BookOpen, BarChart3 } from 'lucide-react';

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '任务列表', icon: ListTodo },
    { path: '/tasks/new', label: '新建任务', icon: PlusCircle },
    { path: '/guide', label: '使用指南', icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-primary-800 to-primary-900 min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-primary-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">训练任务排队</h1>
            <p className="text-xs text-primary-300">Training Queue</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-primary-200 hover:bg-primary-700 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-700">
        <div className="bg-primary-700/50 rounded-lg p-4">
          <p className="text-xs text-primary-300 mb-2">快捷提示</p>
          <p className="text-sm text-white">点击任务可查看详情和修改历史</p>
        </div>
      </div>
    </aside>
  );
}
