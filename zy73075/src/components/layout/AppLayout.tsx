import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

const titleMap: Record<string, string> = {
  '/': '首页概览',
  '/workorder': '工单详情',
  '/import': '导入回放',
  '/review': '异常复核',
};

export default function AppLayout() {
  const location = useLocation();
  const title = titleMap[location.pathname] ?? '盾构刀盘工单回放';

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-slate-700/70 bg-slate-900/60 backdrop-blur-sm px-6">
          <h2 className={cn('text-lg font-semibold text-white')}>{title}</h2>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
