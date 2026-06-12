import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ImportPage from "@/pages/ImportPage";
import ConflictsPage from "@/pages/ConflictsPage";
import ResultsPage from "@/pages/ResultsPage";
import AuditPage from "@/pages/AuditPage";
import SelfCheckPage from "@/pages/SelfCheckPage";
import SupplementPage from "@/pages/SupplementPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ImportPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/self-check" element={<SelfCheckPage />} />
          <Route path="/supplement/:id" element={<SupplementPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
