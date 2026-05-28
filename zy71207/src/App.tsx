import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import AuditList from "@/pages/AuditList";
import AuditDetail from "@/pages/AuditDetail";
import RateVersions from "@/pages/RateVersions";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<AuditList />} />
          <Route path="/audit/:id" element={<AuditDetail />} />
          <Route path="/rate-versions" element={<RateVersions />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
