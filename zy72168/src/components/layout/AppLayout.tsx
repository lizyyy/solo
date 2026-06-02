import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: '数据看板', subtitle: '道路施工绕行评估总览与主流程演示' },
  '/dashboard': { title: '数据看板', subtitle: '道路施工绕行评估总览与主流程演示' },
  '/points': { title: '点位管理', subtitle: '施工点位列表、搜索与管理' },
  '/points/merge': { title: '点位归并', subtitle: '同名路口智能识别与归并处理' },
  '/feedbacks': { title: '反馈记录', subtitle: '投诉、会议纪要、现场记录管理' },
  '/plans': { title: '方案版本', subtitle: '绕行方案版本管理与追溯' },
  '/reports': { title: '评估报告', subtitle: '分类报告生成与交接导出' },
};

export default function AppLayout() {
  const location = useLocation();
  const pathKey = Object.keys(pageTitles).find(
    (key) => location.pathname === key || location.pathname.startsWith(key + '/')
  ) || '/';
  const pageInfo = pageTitles[pathKey];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
