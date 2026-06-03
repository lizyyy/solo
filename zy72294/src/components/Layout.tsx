import { Outlet, useLocation } from 'react-router-dom';
import { Warehouse, RotateCcw } from 'lucide-react';
import SidebarNav from '@/components/SidebarNav';
import { useAppStore } from '@/store';

export default function Layout() {
  const location = useLocation();
  const resetToMock = useAppStore((s) => s.resetToMock);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 fixed left-0 top-0 bottom-0 z-10">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-industrial-700 flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-industrial-900 leading-tight">堆垛体积估算</p>
            <p className="text-[10px] text-gray-400">Grain Stack Volume Est.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <SidebarNav activePath={location.pathname} />
        </div>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={resetToMock}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置为演示数据
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
