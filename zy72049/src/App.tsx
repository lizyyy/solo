import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Train from '@/pages/Train';
import Conflict from '@/pages/Conflict';
import Report from '@/pages/Report';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/train/:recordId" element={<Train />} />
          <Route path="/conflict/:recordId" element={<Conflict />} />
          <Route path="/report/:recordId" element={<Report />} />
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">404</h2>
                  <p className="text-zinc-400 mb-4">页面不存在</p>
                  <a
                    href="/"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition-colors"
                  >
                    返回首页
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
