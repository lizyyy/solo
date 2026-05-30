import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import DecisionWorkbench from "@/pages/DecisionWorkbench";
import DataImportCenter from "@/pages/DataImportCenter";
import AuditCenter from "@/pages/AuditCenter";
import ExportReview from "@/pages/ExportReview";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DecisionWorkbench />} />
          <Route path="/import" element={<DataImportCenter />} />
          <Route path="/audit" element={<AuditCenter />} />
          <Route path="/export/:id" element={<ExportReview />} />
        </Route>
      </Routes>
    </Router>
  );
}
