import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ReconciliationPage from "@/pages/ReconciliationPage";
import EvaluationPage from "@/pages/EvaluationPage";
import AuditLogPage from "@/pages/AuditLogPage";
import LeakDetectionPage from "@/pages/LeakDetectionPage";
import { useStore } from "@/store";

export default function App() {
  const { fetchAuditLogs } = useStore();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <Router>
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<ReconciliationPage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/audit-log" element={<AuditLogPage />} />
              <Route path="/leak-detection" element={<LeakDetectionPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
