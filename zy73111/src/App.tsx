import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import CollisionList from '@/pages/CollisionList';
import CollisionDetail from '@/pages/CollisionDetail';
import AuditHistory from '@/pages/AuditHistory';
import ExportCenter from '@/pages/ExportCenter';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#f5f6f8]">
        <NavBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/collisions" replace />} />
            <Route path="/collisions" element={<CollisionList />} />
            <Route path="/collisions/:id" element={<CollisionDetail />} />
            <Route path="/audit" element={<AuditHistory />} />
            <Route path="/export" element={<ExportCenter />} />
            <Route path="*" element={<Navigate to="/collisions" replace />} />
          </Routes>
        </main>
        <footer className="text-center text-[10px] text-history-gray py-3 border-t border-slate-200 bg-white/60 mono">
          施工变更碰撞预审系统 · 月底封账版 v1.0 · 碰撞视角锁定 · 口径变更追溯 · 改判链路审计
        </footer>
      </div>
    </Router>
  );
}
