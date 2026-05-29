import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/Import';
import AnalysisPage from '@/pages/Analysis';
import HistoryPage from '@/pages/History';
import ClassOverview from '@/pages/ClassOverview';
import ExportPage from '@/pages/Export';
import SamplesPage from '@/pages/Samples';

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-96 p-6">
      <div className="text-center">
        <div className="text-9xl font-bold text-slate-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">页面不存在</h1>
        <p className="text-slate-600">您访问的页面可能已被移除或不存在</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/analysis/:workId" element={<AnalysisPage />} />
          <Route path="/history/:workId" element={<HistoryPage />} />
          <Route path="/class" element={<ClassOverview />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/samples" element={<SamplesPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
