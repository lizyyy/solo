import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import BatchListPage from "@/pages/BatchListPage";
import BatchDetailPage from "@/pages/BatchDetailPage";
import DataEntryPage from "@/pages/DataEntryPage";
import AnalysisPage from "@/pages/AnalysisPage";
import HistoryPage from "@/pages/HistoryPage";
import ReportPage from "@/pages/ReportPage";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isBatchDetail = location.pathname.startsWith('/batches/') && location.pathname !== '/batches';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/batches" replace />} />
          <Route path="/batches" element={<BatchListPage />} />
          <Route path="/batches/:id" element={<BatchDetailPage />}>
            <Route index element={<Navigate to="data" replace />} />
            <Route path="data" element={<DataEntryPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="report" element={<ReportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/batches" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}
