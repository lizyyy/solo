import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import Layout from '@/components/Layout';
import ScheduleList from '@/pages/ScheduleList';
import Analysis from '@/pages/Analysis';
import Retrieve from '@/pages/Retrieve';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ScheduleList />} />
          <Route path="/analysis/:batchId" element={<Analysis />} />
          <Route path="/retrieve" element={<Retrieve />} />
          <Route
            path="*"
            element={
              <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="text-6xl font-display font-bold text-warn-400">404</div>
                <div className="text-ink-200 text-lg">页面不存在</div>
                <Link
                  to="/"
                  className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/10 text-sm"
                >
                  <Home className="w-4 h-4" />
                  返回首页
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
