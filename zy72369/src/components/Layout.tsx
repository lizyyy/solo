import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, AlertTriangle, Clock, ShieldCheck, LogOut } from 'lucide-react';
import { useStore } from '@/store';

const navItems = [
  { to: '/', label: '数据录入', icon: ClipboardList },
  { to: '/anomaly', label: '异常工况表', icon: AlertTriangle },
  { to: '/history', label: '历史记录', icon: Clock },
  { to: '/selfcheck', label: '自检与导出', icon: ShieldCheck },
];

export default function Layout() {
  const currentUser = useStore(s => s.currentUser);
  const logout = useStore(s => s.logout);

  return (
    <div className="flex h-screen bg-[#F7F9FC]">
      <aside className="w-60 flex-shrink-0 bg-[#0F4C5C] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-lg font-bold tracking-wide">光纤弯曲损耗记录</h1>
          <p className="text-xs text-white/50 mt-1">Fiber Bend Loss Record</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {currentUser && (
          <div className="px-5 py-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-white/50">
                  {currentUser.role === 'equipment_engineer' && '设备工程师'}
                  {currentUser.role === 'field_worker' && '现场施工师傅'}
                  {currentUser.role === 'lab_teacher' && '实验老师'}
                </p>
              </div>
              <button onClick={logout} className="text-white/50 hover:text-white transition-colors" title="退出登录">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
