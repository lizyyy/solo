import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/common/Layout";
import { ImportPage } from "@/pages/ImportPage";
import { AnalysisPage } from "@/pages/AnalysisPage";
import { ReportPage } from "@/pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ImportPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
