import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import ImportPage from "@/pages/ImportPage";
import AnalysisPage from "@/pages/AnalysisPage";
import ExportPage from "@/pages/ExportPage";
import GuidePage from "@/pages/GuidePage";
import { useAnalysisStore } from "@/store/analysisStore";

function AppContent() {
  const { loadFromLocalStorage } = useAnalysisStore();

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/guide" element={<GuidePage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
