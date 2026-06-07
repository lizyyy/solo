import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReportList } from "@/pages/ReportList";
import { ReportDetail } from "@/pages/ReportDetail";
import { Visualization } from "@/pages/Visualization";
import { AnomalyList } from "@/pages/AnomalyList";
import { ImportPage } from "@/pages/ImportPage";

function AppLayout() {
  const location = useLocation();
  const showSidebar = true;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-auto">
        <Routes location={location}>
          <Route path="/" element={<ReportList />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/report/:id" element={<ReportDetail />} />
          <Route path="/report/:id/visualization" element={<Visualization />} />
          <Route path="/report/:id/anomalies" element={<AnomalyList />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
