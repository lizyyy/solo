import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': '概览仪表盘',
  '/import': '数据导入',
  '/merge': '点位归并',
  '/review': '人工复核',
  '/map': '地图标注',
  '/export': '导出公示',
  '/supplement': '补录备注',
};

export default function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || '低碳街区碳账本';

  return (
    <div className="min-h-screen bg-cream-100">
      <Sidebar />
      <div className="ml-64">
        <Header title={title} />
        <main className="p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
