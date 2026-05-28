import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import SessionAnalysis from "@/pages/SessionAnalysis";
import AnomalyDetails from "@/pages/AnomalyDetails";
import RulesConfig from "@/pages/RulesConfig";
import ReportExport from "@/pages/ReportExport";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session" element={<SessionAnalysis />} />
          <Route path="/anomalies" element={<AnomalyDetails />} />
          <Route path="/rules" element={<RulesConfig />} />
          <Route path="/export" element={<ReportExport />} />
        </Route>
      </Routes>
    </Router>
  );
}
