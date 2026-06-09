import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from '@/components/layout/NavBar';
import MaterialsListPage from '@/pages/MaterialsListPage';
import MaterialDetailPage from '@/pages/MaterialDetailPage';
import HistoryPage from '@/pages/HistoryPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div
          className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(30,58,95,0.08),_transparent_70%)] z-0"
        />
        <NavBar />
        <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<MaterialsListPage />} />
            <Route path="/materials/:id" element={<MaterialDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🏗️</div>
                <div className="text-xl font-semibold text-slate-800 mb-2">页面不存在</div>
                <div className="text-sm text-slate-500">请从导航菜单进入功能页面</div>
              </div>
            } />
          </Routes>
        </main>
        <footer className="relative z-10 border-t border-slate-200 bg-white/60 mt-12">
          <div className="max-w-[1600px] mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-500">
            <div>结构加固材料追踪系统 · 数据本地持久化，重启不丢失</div>
            <div>
              设计院助理 阿宁 使用 · 基于 SQLite 存储
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
