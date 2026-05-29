import { NavLink } from 'react-router-dom';
import { Disc3, Library, BarChart3, Home, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/store/useStore';

const navItems = [
  {
    path: '/',
    label: '仪表盘',
    icon: Home,
  },
  {
    path: '/sample-packs',
    label: '采样包',
    icon: Library,
  },
  {
    path: '/report',
    label: '授权报告',
    icon: BarChart3,
  },
];

export const Sidebar = () => {
  const resetToDemoData = useStore((state) => state.resetToDemoData);

  const handleReset = () => {
    if (window.confirm('确定要重置为演示数据吗？当前所有数据将被覆盖。')) {
      resetToDemoData();
    }
  };

  return (
    <aside className="w-64 bg-[#1A1A2E] min-h-screen flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8B86D] flex items-center justify-center">
            <Disc3 className="w-6 h-6 text-[#1A1A2E]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">采样包授权台账</h1>
            <p className="text-xs text-white/50">License Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[#E8B86D] text-[#1A1A2E] shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/50 hover:text-white hover:bg-white/5"
          onClick={handleReset}
        >
          <RotateCcw className="w-4 h-4" />
          重置演示数据
        </Button>
      </div>
    </aside>
  );
};
