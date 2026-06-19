import { Navigate, BrowserRouter as Router, Route, Routes, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { ConsolePage } from '@/pages/ConsolePage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { AnomaliesPage } from '@/pages/AnomaliesPage';
import { HandoffPage } from '@/pages/HandoffPage';

const META: Record<string, { title: string; subtitle: string }> = {
  '/console': { title: '回放控制台', subtitle: '提交回放 · 幂等去重 · 除零边界与影响范围' },
  '/materials': { title: '材料与历史', subtitle: '历史答案 · 现场痕迹 · 人工改判 · 后补说明' },
  '/anomalies': { title: '异常看板', subtitle: '空集合异常 · 除零边界 · 来源行汇总' },
  '/handoff': { title: '值班交接', subtitle: '哪里放材料 · 哪里看异常 · 哪里重新导出' },
};

function Layout() {
  const { pathname } = useLocation();
  const meta = META[pathname] ?? { title: '矩阵分解参数回放', subtitle: '' };
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/console" replace />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/handoff" element={<HandoffPage />} />
          <Route path="*" element={<Navigate to="/console" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
