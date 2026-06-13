import { writeFileSync } from 'fs';

const appContent = `import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import ImportPage from '@/pages/ImportPage';
import ReviewPage from '@/pages/ReviewPage';
import ConflictPage from '@/pages/ConflictPage';
import SupplementPage from '@/pages/SupplementPage';
import SelfCheckPage from '@/pages/SelfCheckPage';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-900 text-slate-100">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/import" replace />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/conflicts" element={<ConflictPage />} />
            <Route path="/supplement" element={<SupplementPage />} />
            <Route path="/selfcheck" element={<SelfCheckPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
`;

writeFileSync('/Users/lzy/pro/solo/workspaces/zy72510/src/App.tsx', appContent);
console.log('App.tsx written');
