import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RecordListPage from '@/pages/RecordListPage';
import RecordDetailPage from '@/pages/RecordDetailPage';
import HistoryPage from '@/pages/HistoryPage';
import ExceptionQueuePage from '@/pages/ExceptionQueuePage';
import { PawPrint, Home } from 'lucide-react';

function NotFound() {
  return (
    <div className="min-h-screen bg-mist-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-mist-100 flex items-center justify-center mx-auto mb-6">
          <PawPrint className="w-10 h-10 text-mist-300" />
        </div>
        <p className="font-serif text-7xl font-bold text-mist-300 mb-4">404</p>
        <h1 className="font-serif text-2xl font-bold text-mist-800 mb-2">
          页面走丢了
        </h1>
        <p className="text-mist-500 mb-8">
          您访问的页面不存在，可能链接已过期或已被移动。
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 transition-colors shadow-lg shadow-forest-700/20"
        >
          <Home className="w-5 h-5" />
          返回首页
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordListPage />} />
        <Route path="/records/:id" element={<RecordDetailPage />} />
        <Route path="/records/:id/history" element={<HistoryPage />} />
        <Route path="/queue" element={<ExceptionQueuePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
