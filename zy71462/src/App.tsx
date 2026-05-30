import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import ImportCenter from "@/pages/ImportCenter";
import RebalanceConfig from "@/pages/RebalanceConfig";
import ResultAnalysis from "@/pages/ResultAnalysis";
import ErrorDiagnosis from "@/pages/ErrorDiagnosis";
import VersionCompare from "@/pages/VersionCompare";
import ExportCenter from "@/pages/ExportCenter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportCenter />} />
        <Route path="/configure" element={<RebalanceConfig />} />
        <Route path="/result" element={<ResultAnalysis />} />
        <Route path="/diagnose" element={<ErrorDiagnosis />} />
        <Route path="/compare" element={<VersionCompare />} />
        <Route path="/export" element={<ExportCenter />} />
      </Routes>
    </Router>
  );
}
