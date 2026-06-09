import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import MaterialList from '@/pages/MaterialList';
import MaterialDetail from '@/pages/MaterialDetail';
import History from '@/pages/History';
import ImportForm from '@/pages/ImportForm';

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-7xl font-bold text-slate-300 mb-4">404</div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">页面未找到</h2>
        <p className="text-sm text-slate-500 mb-6">您访问的页面不存在或已被移动</p>
        <Link
          to="/"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          返回材料列表
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<MaterialList />} />
          <Route path="/material/:id" element={<MaterialDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/import" element={<ImportForm />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
