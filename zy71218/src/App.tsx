import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import DataImport from "@/pages/DataImport";
import RepaymentPage from "@/pages/RepaymentPage";
import RiskAnalysis from "@/pages/RiskAnalysis";
import ReportExport from "@/pages/ReportExport";
import HistoryTrace from "@/pages/HistoryTrace";
import CaseDetail from "@/pages/CaseDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/import" element={<DataImport />} />
        <Route path="/collection" element={<RepaymentPage />} />
        <Route path="/risk" element={<RiskAnalysis />} />
        <Route path="/report" element={<ReportExport />} />
        <Route path="/history" element={<HistoryTrace />} />
        <Route path="/case/:id" element={<CaseDetail />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
