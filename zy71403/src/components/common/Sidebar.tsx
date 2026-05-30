import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Table, ClipboardList, PieChart, Settings, HelpCircle } from 'lucide-react';

const navigation = [
  { name: '估值概览', path: '/', icon: LayoutDashboard },
  { name: '估值明细', path: '/records', icon: Table },
  { name: '状态工作台', path: '/workbench', icon: ClipboardList },
  { name: '统计分析', path: '/analytics', icon: PieChart },
];

const bottomNav = [
  { name: '系统设置', path: '/settings', icon: Settings },
  { name: '帮助中心', path: '/help', icon: HelpCircle },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-navy-900 text-white flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-navy-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
            <PieChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-serif text-lg font-semibold">侧袋估值</div>
            <div className="text-xs text-navy-300">私募基金运营平台</div>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-medium text-navy-400 uppercase tracking-wider">
          主菜单
        </div>
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                      : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </nav>
      
      <div className="border-t border-navy-700 p-3">
        <div className="space-y-1">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-navy-300 hover:bg-navy-800 hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
