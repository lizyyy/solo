import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import TaskList from '@/pages/TaskList';
import TaskDetail from '@/pages/TaskDetail';
import HistoryPage from '@/pages/HistoryPage';
import ScreenshotsPage from '@/pages/ScreenshotsPage';
import GuidePage from '@/pages/GuidePage';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-slate-200">
      <header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 transition group-hover:scale-105">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white"><path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M3 7L12 11L21 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 11V21" stroke="currentColor" strokeWidth="1.8"/></svg>
            </div>
            <div>
              <div className="font-display text-base font-bold leading-tight text-white">CAD 复核系统</div>
              <div className="text-[10px] text-slate-500 leading-tight">机电管线综合审查平台</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/" className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:bg-bg-elevated hover:text-white">任务列表</Link>
            <Link to="/guide" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:bg-bg-elevated hover:text-white">
              <BookOpen className="h-3.5 w-3.5" />上手文档
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TaskList />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/tasks/:taskId/history" element={<HistoryPage />} />
          <Route path="/tasks/:taskId/screenshots" element={<ScreenshotsPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="*" element={<div className="p-10 text-center text-slate-400">404 页面不存在</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}
